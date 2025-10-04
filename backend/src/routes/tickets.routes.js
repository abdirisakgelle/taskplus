import express from "express";
import { Ticket } from "../models/tickets.js";
import { FollowUp } from "../models/follow_ups.js";
import { Review } from "../models/reviews.js";
import { Employee } from "../models/employees.js";
import { User } from "../models/users.js";
import { getNextId } from "../utils/counters.js";
import { authRequired, requirePerm } from "../middleware/auth.js";

const router = express.Router();

// Get tickets with filtering and pagination
router.get("/", authRequired, requirePerm('support.tickets'), async (req, res, next) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      from,
      to,
      resolution_status,
      issue_category,
      agent_id,
      search,
      stuck = false
    } = req.query;

    // Build filters
    const filters = {};
    
    if (resolution_status) {
      if (Array.isArray(resolution_status)) {
        filters.resolution_status = { $in: resolution_status };
      } else {
        filters.resolution_status = resolution_status;
      }
    }
    
    if (issue_category) {
      if (Array.isArray(issue_category)) {
        filters.issue_category = { $in: issue_category };
      } else {
        filters.issue_category = issue_category;
      }
    }
    
    if (agent_id) filters.agent_id = Number(agent_id);
    
    // Date range filtering
    if (from || to) {
      filters.createdAt = {};
      if (from) filters.createdAt.$gte = new Date(from);
      if (to) filters.createdAt.$lte = new Date(to);
    }
    
    // Search
    if (search) {
      filters.$or = [
        { customer_phone: { $regex: search, $options: 'i' } },
        { customer_location: { $regex: search, $options: 'i' } },
        { issue_description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Stuck tickets (>1 hour)
    if (stuck === 'true') {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      filters.resolution_status = { $in: ['Pending', 'In-Progress', 'Completed'] };
      filters.updatedAt = { $lte: oneHourAgo };
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(pageSize)));
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const [tickets, total] = await Promise.all([
      Ticket.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Ticket.countDocuments(filters)
    ]);

    // Get agent details
    const agentIds = [...new Set(tickets.map(t => t.agent_id).filter(Boolean))];
    const agents = await Employee.find({ employee_id: { $in: agentIds } })
      .select('employee_id name').lean();
    const agentMap = new Map(agents.map(a => [a.employee_id, a]));

    // Get latest follow-up for each ticket to compute ticket_state
    const ticketIds = tickets.map(t => t.ticket_id);
    const latestFollowUps = await FollowUp.aggregate([
      { $match: { ticket_id: { $in: ticketIds } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$ticket_id', latest: { $first: '$$ROOT' } } }
    ]);
    const followUpMap = new Map(latestFollowUps.map(f => [f._id, f.latest]));

    // Enrich tickets with computed state
    const enrichedTickets = tickets.map(ticket => {
      const latestFollowUp = followUpMap.get(ticket.ticket_id);
      let ticket_state = 'Open';
      
      if (ticket.resolution_status === 'Completed') {
        if (latestFollowUp && latestFollowUp.issue_solved === true) {
          ticket_state = 'Closed';
        } else if (latestFollowUp && latestFollowUp.issue_solved === false) {
          ticket_state = 'Reopened';
        } else {
          ticket_state = 'Closed';
        }
      } else if (latestFollowUp && latestFollowUp.issue_solved === false) {
        ticket_state = 'Reopened';
      }

      return {
        ...ticket,
        agent_info: agentMap.get(ticket.agent_id) || null,
        ticket_state
      };
    });

    res.json({
      ok: true,
      data: enrichedTickets,
      meta: {
        total,
        page: pageNum,
        limit: limitNum
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get single ticket with full details
router.get("/:ticket_id", authRequired, requirePerm('support.tickets'), async (req, res, next) => {
  try {
    const ticketId = Number(req.params.ticket_id);
    const ticket = await Ticket.findOne({ ticket_id: ticketId }).lean();
    
    if (!ticket) {
      return res.status(404).json({ 
        ok: false, 
        error: { message: "Ticket not found" } 
      });
    }

    // Get related data
    const [agent, followUps, reviews] = await Promise.all([
      ticket.agent_id ? Employee.findOne({ employee_id: ticket.agent_id }).lean() : null,
      FollowUp.find({ ticket_id: ticketId }).sort({ createdAt: -1 }).lean(),
      Review.find({ ticket_id: ticketId }).sort({ createdAt: -1 }).lean()
    ]);

    // Get follow-up agent and reviewer details
    const followUpAgentIds = [...new Set(followUps.map(f => f.follow_up_agent_id).filter(Boolean))];
    const reviewerIds = [...new Set(reviews.map(r => r.reviewer_id).filter(Boolean))];
    const allEmployeeIds = [...followUpAgentIds, ...reviewerIds];

    const employees = await Employee.find({ employee_id: { $in: allEmployeeIds } })
      .select('employee_id name').lean();
    const employeeMap = new Map(employees.map(e => [e.employee_id, e]));

    // Enrich follow-ups and reviews
    const enrichedFollowUps = followUps.map(followUp => ({
      ...followUp,
      agent_info: employeeMap.get(followUp.follow_up_agent_id) || null
    }));

    const enrichedReviews = reviews.map(review => ({
      ...review,
      reviewer_info: employeeMap.get(review.reviewer_id) || null
    }));

    const enrichedTicket = {
      ...ticket,
      agent_info: agent,
      follow_ups: enrichedFollowUps,
      reviews: enrichedReviews
    };

    res.json({
      ok: true,
      data: enrichedTicket
    });
  } catch (err) {
    next(err);
  }
});

// Create ticket
router.post("/", authRequired, requirePerm('support.tickets'), async (req, res, next) => {
  try {
    const {
      customer_phone,
      customer_location,
      communication_channel = 'Phone',
      device_type,
      issue_category,
      issue_type,
      issue_description,
      agent_id
    } = req.body;

    // A) Controller/Service input checks (before writing to DB)
    const errors = [];
    
    // Validate customer_phone: required and format
    if (!customer_phone) {
      errors.push({ field: 'customer_phone', code: 'required', detail: 'Customer phone is required.' });
    } else if (!/^[0-9]{7,15}$/.test(customer_phone)) {
      errors.push({ field: 'customer_phone', code: 'invalid_format', detail: 'Use digits only (7–15).' });
    }
    
    // Validate issue_category: required and enum
    const validCategories = ['App', 'IPTV', 'Streaming', 'VOD', 'Subscription', 'OTP', 'Programming', 'Other'];
    if (!issue_category) {
      errors.push({ field: 'issue_category', code: 'required', detail: 'Issue category is required.' });
    } else if (!validCategories.includes(issue_category)) {
      errors.push({ field: 'issue_category', code: 'invalid_value', detail: `Must be one of: ${validCategories.join(', ')}.` });
    }
    
    // Validate issue_description: trim and reject if only whitespace
    if (issue_description && issue_description.trim() === '') {
      errors.push({ field: 'issue_description', code: 'invalid_value', detail: 'Cannot be only whitespace.' });
    }
    
    // Validate resolution_status: enum
    const validStatuses = ['Pending', 'In-Progress', 'Completed'];
    if (req.body.resolution_status && !validStatuses.includes(req.body.resolution_status)) {
      errors.push({ field: 'resolution_status', code: 'invalid_value', detail: `Must be one of: ${validStatuses.join(', ')}.` });
    }
    
    // Return field-level errors if any
    if (errors.length > 0) {
      return res.status(400).json({
        ok: false,
        error: {
          message: 'Validation failed',
          errors: errors
        }
      });
    }

    // Get agent_id from authenticated user's employeeId
    let numericAgentId = null;
    
    if (req.user && req.user.id) {
      const currentUser = await User.findById(req.user.id).populate('employeeId', 'employee_id');
      if (currentUser && currentUser.employeeId && currentUser.employeeId.employee_id) {
        numericAgentId = currentUser.employeeId.employee_id;
      }
    }
    
    // If no employeeId found, validate the provided agent_id
    if (!numericAgentId && agent_id && agent_id !== '') {
      // Check if agent_id is a numeric string (employee_id) or ObjectId
      if (/^\d+$/.test(agent_id)) {
        // It's already a numeric employee_id
        numericAgentId = parseInt(agent_id);
      } else {
        // It's an ObjectId, find the employee by ObjectId
        const agent = await Employee.findById(agent_id);
        if (!agent) {
          return res.status(400).json({ 
            ok: false, 
            error: { message: "Invalid agent" } 
          });
        }
        numericAgentId = agent.employee_id;
      }
      
      // Final validation with numeric ID
      const agent = await Employee.findOne({ employee_id: numericAgentId });
      if (!agent) {
        return res.status(400).json({ 
          ok: false, 
          error: { message: "Invalid agent" } 
        });
      }
    }

    // B) Normalize defaults
    const resolution_status = req.body.resolution_status || 'Pending';
    let first_call_resolution = req.body.first_call_resolution || 'No';
    
    // C) Enforce FCR-Status rule server-side (authoritative)
    if (resolution_status === 'Completed') {
      first_call_resolution = 'Yes';
    } else {
      first_call_resolution = 'No';
    }

    // Get next ticket ID
    let ticket_id = await getNextId('ticket');
    console.log('Generated ticket_id:', ticket_id);
    
    // Ensure we have a valid ticket_id
    if (!ticket_id || ticket_id === undefined) {
      console.error('Failed to generate ticket_id, using fallback');
      ticket_id = 1; // Fallback ID
    }

    const ticket = await Ticket.create({
      ticket_id,
      customer_phone,
      customer_location,
      communication_channel,
      device_type,
      issue_category,
      issue_type,
      issue_description,
      agent_id: numericAgentId,
      resolution_status,
      first_call_resolution
    });

    // D) Auto-create follow_up on Completed (existing rule)
    if (resolution_status === 'Completed') {
      try {
        const follow_up_id = await getNextId('follow_up');
        await FollowUp.create({
          follow_up_id,
          ticket_id: ticket.ticket_id,
          customer_phone: ticket.customer_phone,
          follow_up_date: new Date(),
          status: 'Pending',
          notes: 'Auto-created follow-up for completed ticket'
        });
      } catch (followUpErr) {
        console.error('Error creating follow-up:', followUpErr);
        // Don't fail the ticket creation if follow-up fails
      }
    }

    console.log('Created ticket:', ticket);
    console.log('Ticket ID:', ticket.ticket_id);
    
    res.status(201).json({
      ok: true,
      data: ticket
    });
  } catch (err) {
    next(err);
  }
});

// Update ticket with business logic
router.patch("/:ticket_id", authRequired, requirePerm('support.tickets'), async (req, res, next) => {
  try {
    const ticketId = Number(req.params.ticket_id);
    const {
      resolution_status,
      first_call_resolution,
      agent_id,
      ...otherUpdates
    } = req.body;

    const ticket = await Ticket.findOne({ ticket_id: ticketId });
    if (!ticket) {
      return res.status(404).json({ 
        ok: false, 
        error: { message: "Ticket not found" } 
      });
    }

    const updates = { ...otherUpdates };
    
    // Update resolution status without changing FCR
    if (resolution_status) {
      updates.resolution_status = resolution_status;
    }
    
    // Allow manual FCR override for admin/QA only
    if (first_call_resolution !== undefined) {
      updates.first_call_resolution = first_call_resolution;
    }

    const updatedTicket = await Ticket.findOneAndUpdate(
      { ticket_id: ticketId },
      updates,
      { new: true, runValidators: true }
    );

    // Business Rule: Auto-create Follow-up when status becomes "Completed"
    if (resolution_status === 'Completed' && ticket.resolution_status !== 'Completed') {
      const follow_up_id = await getNextId('follow_up');
      
      await FollowUp.create({
        follow_up_id,
        ticket_id: ticketId,
        follow_up_agent_id: ticket.agent_id,
        follow_up_date: new Date(),
        issue_solved: null,
        satisfied: null,
        repeated_issue: false
      });
    }

    res.json({
      ok: true,
      data: updatedTicket
    });
  } catch (err) {
    next(err);
  }
});

// Reopen ticket (business rule)
router.patch("/:ticket_id/reopen", authRequired, requirePerm('support.tickets'), async (req, res, next) => {
  try {
    const ticketId = Number(req.params.ticket_id);
    
    const ticket = await Ticket.findOne({ ticket_id: ticketId });
    if (!ticket) {
      return res.status(404).json({ 
        ok: false, 
        error: { message: "Ticket not found" } 
      });
    }

    // Business Rule: Reopen Logic
    const updatedTicket = await Ticket.findOneAndUpdate(
      { ticket_id: ticketId },
      {
        resolution_status: 'Pending',
        first_call_resolution: 'No'
        // Keep same agent_id (no reassignment)
      },
      { new: true }
    );

    res.json({
      ok: true,
      data: updatedTicket
    });
  } catch (err) {
    next(err);
  }
});

// Get stuck tickets for QA
router.get("/stuck/tickets", authRequired, requirePerm('support.reviews'), async (req, res, next) => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const stuckTickets = await Ticket.find({
      resolution_status: { $in: ['Pending', 'In-Progress', 'Completed'] },
      updatedAt: { $lte: oneHourAgo }
    })
    .sort({ updatedAt: 1 })
    .lean();

    // Get agent details
    const agentIds = [...new Set(stuckTickets.map(t => t.agent_id).filter(Boolean))];
    const agents = await Employee.find({ employee_id: { $in: agentIds } })
      .select('employee_id name').lean();
    const agentMap = new Map(agents.map(a => [a.employee_id, a]));

    const enrichedTickets = stuckTickets.map(ticket => ({
      ...ticket,
      agent_info: agentMap.get(ticket.agent_id) || null,
      age_hours: Math.floor((Date.now() - ticket.updatedAt.getTime()) / (1000 * 60 * 60))
    }));

    res.json({
      ok: true,
      data: enrichedTickets
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tickets/:ticket_id - Delete a ticket
router.delete("/:ticket_id", authRequired, requirePerm('support.tickets'), async (req, res, next) => {
  try {
    const ticketId = Number(req.params.ticket_id);
    
    const ticket = await Ticket.findOne({ ticket_id: ticketId });
    if (!ticket) {
      return res.status(404).json({ 
        ok: false, 
        error: { message: "Ticket not found" } 
      });
    }

    // Delete the ticket
    await Ticket.deleteOne({ ticket_id: ticketId });

    res.json({ 
      ok: true, 
      data: { message: `Ticket #${ticketId} deleted successfully` } 
    });
  } catch (err) {
    next(err);
  }
});

export default router;
