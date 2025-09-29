import express from "express";
import { Ticket } from "../models/tickets.js";
import { FollowUp } from "../models/follow_ups.js";
import { Review } from "../models/reviews.js";
import { Employee } from "../models/employees.js";
import { User } from "../models/users.js";
import { Notification } from "../models/notifications.js";
import { authRequired, requirePerm } from "../middleware/auth.js";

const router = express.Router();

// Get tickets with filtering and pagination
router.get("/", authRequired, requirePerm('support.tickets'), async (req, res, next) => {
  try {
    const {
      status,
      agent_id,
      communication_channel,
      device_type,
      issue_type,
      first_call_resolution,
      date_from,
      date_to,
      search,
      page = 1,
      limit = 20,
      sort_by = 'createdAt',
      sort_order = 'desc'
    } = req.query;

    // Build filters
    const filters = {};
    if (status) filters.resolution_status = status;
    if (agent_id) filters.agent_id = Number(agent_id);
    if (communication_channel) filters.communication_channel = communication_channel;
    if (device_type) filters.device_type = device_type;
    if (issue_type) filters.issue_type = issue_type;
    if (first_call_resolution !== undefined) filters.first_call_resolution = first_call_resolution === 'true';

    // Date range filtering
    if (date_from || date_to) {
      filters.createdAt = {};
      if (date_from) filters.createdAt.$gte = new Date(date_from);
      if (date_to) filters.createdAt.$lte = new Date(date_to);
    }

    // Search
    if (search) {
      filters.$or = [
        { customer_phone: { $regex: search, $options: 'i' } },
        { customer_location: { $regex: search, $options: 'i' } },
        { issue_description: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sortObj = {};
    sortObj[sort_by] = sort_order === 'asc' ? 1 : -1;

    // Execute query
    const [tickets, total] = await Promise.all([
      Ticket.find(filters)
        .sort(sortObj)
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

    // Get follow-up and review counts
    const ticketIds = tickets.map(t => t.ticket_id);
    const [followUpCounts, reviewCounts] = await Promise.all([
      FollowUp.aggregate([
        { $match: { ticket_id: { $in: ticketIds } } },
        { $group: { _id: "$ticket_id", count: { $sum: 1 } } }
      ]),
      Review.aggregate([
        { $match: { ticket_id: { $in: ticketIds } } },
        { $group: { _id: "$ticket_id", count: { $sum: 1 } } }
      ])
    ]);

    const followUpCountMap = new Map(followUpCounts.map(fc => [fc._id, fc.count]));
    const reviewCountMap = new Map(reviewCounts.map(rc => [rc._id, rc.count]));

    // Enrich tickets
    const enrichedTickets = tickets.map(ticket => ({
      ...ticket,
      agent_info: agentMap.get(ticket.agent_id) || null,
      follow_up_count: followUpCountMap.get(ticket.ticket_id) || 0,
      review_count: reviewCountMap.get(ticket.ticket_id) || 0
    }));

    res.json({
      tickets: enrichedTickets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get single ticket with full details
router.get("/:id", authRequired, requirePerm('support.tickets'), async (req, res, next) => {
  try {
    const ticketId = Number(req.params.id);
    const ticket = await Ticket.findOne({ ticket_id: ticketId }).lean();
    
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Get related data
    const [agent, followUps, reviews] = await Promise.all([
      ticket.agent_id ? Employee.findOne({ employee_id: ticket.agent_id }).lean() : null,
      FollowUp.find({ ticket_id: ticketId }).sort({ createdAt: -1 }).lean(),
      Review.find({ ticket_id: ticketId }).sort({ createdAt: -1 }).lean()
    ]);

    // Get follow-up agent details
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

    res.json(enrichedTicket);
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
      communication_channel,
      device_type,
      issue_type,
      issue_description,
      agent_id
    } = req.body;

    // Validate required fields
    if (!customer_phone || !issue_description) {
      return res.status(400).json({ message: "Customer phone and issue description are required" });
    }

    // Validate agent if provided
    if (agent_id) {
      const agent = await Employee.findOne({ employee_id: agent_id });
      if (!agent) {
        return res.status(400).json({ message: "Invalid agent" });
      }
    }

    const ticket = await Ticket.create({
      customer_phone,
      customer_location,
      communication_channel,
      device_type,
      issue_type,
      issue_description,
      agent_id: agent_id || null,
      resolution_status: "Open"
    });

    // Notify assigned agent
    if (agent_id) {
      const agentUser = await User.findOne({ employee_id: agent_id });
      if (agentUser) {
        await Notification.create({
          user_id: agentUser.user_id,
          title: "New Ticket Assigned",
          message: `You have been assigned a new support ticket #${ticket.ticket_id}`,
          type: "ticket_assignment"
        });
      }
    }

    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
});

// Update ticket
router.put("/:id", authRequired, requirePerm('support.tickets'), async (req, res, next) => {
  try {
    const ticketId = Number(req.params.id);
    const {
      customer_phone,
      customer_location,
      communication_channel,
      device_type,
      issue_type,
      issue_description,
      agent_id,
      first_call_resolution,
      resolution_status
    } = req.body;

    const ticket = await Ticket.findOne({ ticket_id: ticketId });
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Validate agent if changing
    if (agent_id !== undefined && agent_id !== ticket.agent_id) {
      if (agent_id) {
        const agent = await Employee.findOne({ employee_id: agent_id });
        if (!agent) {
          return res.status(400).json({ message: "Invalid agent" });
        }
      }
    }

    const updates = {};
    if (customer_phone !== undefined) updates.customer_phone = customer_phone;
    if (customer_location !== undefined) updates.customer_location = customer_location;
    if (communication_channel !== undefined) updates.communication_channel = communication_channel;
    if (device_type !== undefined) updates.device_type = device_type;
    if (issue_type !== undefined) updates.issue_type = issue_type;
    if (issue_description !== undefined) updates.issue_description = issue_description;
    if (agent_id !== undefined) updates.agent_id = agent_id;
    if (first_call_resolution !== undefined) updates.first_call_resolution = first_call_resolution;
    if (resolution_status !== undefined) updates.resolution_status = resolution_status;

    const updatedTicket = await Ticket.findOneAndUpdate(
      { ticket_id: ticketId },
      updates,
      { new: true }
    );

    // Send notifications for important changes
    if (agent_id && agent_id !== ticket.agent_id) {
      const agentUser = await User.findOne({ employee_id: agent_id });
      if (agentUser) {
        await Notification.create({
          user_id: agentUser.user_id,
          title: "Ticket Reassigned",
          message: `Ticket #${ticketId} has been assigned to you`,
          type: "ticket_assignment"
        });
      }
    }

    if (resolution_status && resolution_status !== ticket.resolution_status && ticket.agent_id) {
      const agentUser = await User.findOne({ employee_id: ticket.agent_id });
      if (agentUser) {
        await Notification.create({
          user_id: agentUser.user_id,
          title: "Ticket Status Updated",
          message: `Ticket #${ticketId} status changed to: ${resolution_status}`,
          type: "ticket_update"
        });
      }
    }

    res.json(updatedTicket);
  } catch (err) {
    next(err);
  }
});

// Delete ticket
router.delete("/:id", authRequired, requirePerm('support.tickets'), async (req, res, next) => {
  try {
    const ticketId = Number(req.params.id);
    
    // Delete related follow-ups and reviews first
    await Promise.all([
      FollowUp.deleteMany({ ticket_id: ticketId }),
      Review.deleteMany({ ticket_id: ticketId })
    ]);

    const deleted = await Ticket.findOneAndDelete({ ticket_id: ticketId });
    if (!deleted) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.json({ message: "Ticket and related records deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// Get ticket statistics
router.get("/stats/overview", authRequired, requirePerm('support.tickets'), async (req, res, next) => {
  try {
    const { agent_id, date_from, date_to } = req.query;
    
    let matchFilter = {};
    if (agent_id) matchFilter.agent_id = Number(agent_id);
    
    if (date_from || date_to) {
      matchFilter.createdAt = {};
      if (date_from) matchFilter.createdAt.$gte = new Date(date_from);
      if (date_to) matchFilter.createdAt.$lte = new Date(date_to);
    }

    const stats = await Ticket.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $eq: ["$resolution_status", "Open"] }, 1, 0] } },
          closed: { $sum: { $cond: [{ $eq: ["$resolution_status", "Closed"] }, 1, 0] } },
          in_progress: { $sum: { $cond: [{ $eq: ["$resolution_status", "In Progress"] }, 1, 0] } },
          first_call_resolution: { $sum: { $cond: ["$first_call_resolution", 1, 0] } },
          whatsapp: { $sum: { $cond: [{ $eq: ["$communication_channel", "WhatsApp"] }, 1, 0] } },
          phone: { $sum: { $cond: [{ $eq: ["$communication_channel", "Phone"] }, 1, 0] } }
        }
      }
    ]);

    const result = stats[0] || {
      total: 0,
      open: 0,
      closed: 0,
      in_progress: 0,
      first_call_resolution: 0,
      whatsapp: 0,
      phone: 0
    };

    // Add calculated metrics
    result.first_call_resolution_rate = result.total > 0 ? 
      ((result.first_call_resolution / result.total) * 100).toFixed(2) : "0.00";

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Get my tickets (for agents)
router.get("/my/tickets", authRequired, requirePerm('support.tickets'), async (req, res, next) => {
  try {
    // Get current user's employee_id
    const user = await User.findOne({ user_id: req.user.user_id });
    if (!user || !user.employee_id) {
      return res.json([]);
    }

    const { status } = req.query;
    const filters = { agent_id: user.employee_id };
    if (status) filters.resolution_status = status;

    const tickets = await Ticket.find(filters)
      .sort({ updatedAt: -1 })
      .lean();

    res.json(tickets);
  } catch (err) {
    next(err);
  }
});

export default router;
