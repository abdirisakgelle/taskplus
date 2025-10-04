import express from "express";
import { FollowUp } from "../models/follow_ups.js";
import { Ticket } from "../models/tickets.js";
import { Employee } from "../models/employees.js";
import { Review } from "../models/reviews.js";
import { getNextId } from "../utils/counters.js";
import { authRequired, requirePerm } from "../middleware/auth.js";
import { User } from "../models/users.js";

const router = express.Router();

// Get pending follow-ups (tickets completed in last 7 days without resolved follow-up)
router.get("/pending", authRequired, requirePerm('support.followups'), async (req, res, next) => {
  try {
    const { q = '', range = '7d', page = 1, pageSize = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    
    // Calculate date range
    const now = new Date();
    let startDate;
    switch (range) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
    }
    
    // Build search filter
    const searchFilter = {};
    if (q) {
      searchFilter.$or = [
        { customer_phone: { $regex: q, $options: 'i' } },
        { ticket_id: parseInt(q) || 0 }
      ];
    }
    
    // Find completed tickets in date range
    const completedTickets = await Ticket.find({
      resolution_status: 'Completed',
      updatedAt: { $gte: startDate },
      ...searchFilter
    }).lean();
    
    // Get ticket IDs
    const ticketIds = completedTickets.map(t => t.ticket_id);
    
    // Find existing follow-ups for these tickets
    const existingFollowUps = await FollowUp.find({
      ticket_id: { $in: ticketIds }
    }).lean();
    
    // Create map of ticket_id -> follow_up
    const followUpMap = {};
    existingFollowUps.forEach(fu => {
      followUpMap[fu.ticket_id] = fu;
    });
    
    // Filter tickets that need follow-up (no follow-up or issue_solved is null/0)
    const pendingTickets = completedTickets.filter(ticket => {
      const followUp = followUpMap[ticket.ticket_id];
      return !followUp || followUp.issue_solved === null || followUp.issue_solved === 0;
    });
    
    // Get reviews for supervisor status
    const reviews = await Review.find({
      ticket_id: { $in: pendingTickets.map(t => t.ticket_id) }
    }).sort({ createdAt: -1 }).lean();
    
    // Create map of ticket_id -> latest review
    const reviewMap = {};
    reviews.forEach(review => {
      if (!reviewMap[review.ticket_id]) {
        reviewMap[review.ticket_id] = review;
      }
    });
    
    // Format response
    const result = pendingTickets.slice(skip, skip + parseInt(pageSize)).map(ticket => {
      const followUp = followUpMap[ticket.ticket_id];
      const review = reviewMap[ticket.ticket_id];
      
      return {
        ticket_id: ticket.ticket_id,
        customer_phone: ticket.customer_phone,
        issue_type: ticket.issue_type,
        resolution_status: ticket.resolution_status,
        supervisor_status: review ? review.issue_status : '-',
        date: review ? review.review_date : ticket.updatedAt,
        follow_up_id: followUp ? followUp._id : null
      };
    });
    
    res.json({
      ok: true,
      data: result,
      meta: {
        total: pendingTickets.length,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get follow-ups with filtering
router.get("/", authRequired, requirePerm('support.followups'), async (req, res, next) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      agent_id,
      issue_solved,
      repeated_issue,
      issue_category,
      from,
      to
    } = req.query;

    // Build filters
    const filters = {};
    
    if (agent_id) filters.follow_up_agent_id = Number(agent_id);
    if (issue_solved !== undefined) filters.issue_solved = issue_solved === 'true';
    if (repeated_issue !== undefined) filters.repeated_issue = repeated_issue === 'true';
    
    // Date range filtering
    if (from || to) {
      filters.follow_up_date = {};
      if (from) filters.follow_up_date.$gte = new Date(from);
      if (to) filters.follow_up_date.$lte = new Date(to);
    }

    // If filtering by issue category, we need to join with tickets
    let pipeline = [];
    
    if (issue_category) {
      pipeline = [
        {
          $lookup: {
            from: 'tickets',
            localField: 'ticket_id',
            foreignField: 'ticket_id',
            as: 'ticket'
          }
        },
        { $unwind: '$ticket' },
        { $match: { 'ticket.issue_category': issue_category } }
      ];
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(pageSize)));
    const skip = (pageNum - 1) * limitNum;

    let followUps, total;

    if (pipeline.length > 0) {
      // Use aggregation for complex queries
      pipeline.push(
        { $match: filters },
        { $sort: { follow_up_date: -1 } },
        { $skip: skip },
        { $limit: limitNum }
      );
      
      const [results, countResults] = await Promise.all([
        FollowUp.aggregate(pipeline),
        FollowUp.aggregate([...pipeline.slice(0, -2), { $count: 'total' }])
      ]);
      
      followUps = results;
      total = countResults[0]?.total || 0;
    } else {
      // Simple query
      [followUps, total] = await Promise.all([
        FollowUp.find(filters)
          .sort({ follow_up_date: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        FollowUp.countDocuments(filters)
      ]);
    }

    // Get agent details
    const agentIds = [...new Set(followUps.map(f => f.follow_up_agent_id).filter(Boolean))];
    const agents = await Employee.find({ employee_id: { $in: agentIds } })
      .select('employee_id name').lean();
    const agentMap = new Map(agents.map(a => [a.employee_id, a]));

    // Enrich follow-ups
    const enrichedFollowUps = followUps.map(followUp => ({
      ...followUp,
      agent_info: agentMap.get(followUp.follow_up_agent_id) || null
    }));

    res.json({
      ok: true,
      data: enrichedFollowUps,
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

// Get single follow-up
router.get("/:follow_up_id", authRequired, requirePerm('support.followups'), async (req, res, next) => {
  try {
    const followUpId = Number(req.params.follow_up_id);
    const followUp = await FollowUp.findOne({ follow_up_id: followUpId }).lean();
    
    if (!followUp) {
      return res.status(404).json({ 
        ok: false, 
        error: { message: "Follow-up not found" } 
      });
    }

    // Get related ticket and agent info
    const [ticket, agent] = await Promise.all([
      Ticket.findOne({ ticket_id: followUp.ticket_id }).lean(),
      followUp.follow_up_agent_id ? Employee.findOne({ employee_id: followUp.follow_up_agent_id }).lean() : null
    ]);

    res.json({
      ok: true,
      data: {
        ...followUp,
        ticket_info: ticket,
        agent_info: agent
      }
    });
  } catch (err) {
    next(err);
  }
});

// Update follow-up with business logic
router.patch("/:follow_up_id", authRequired, requirePerm('support.followups'), async (req, res, next) => {
  try {
    const followUpId = Number(req.params.follow_up_id);
    const {
      issue_solved,
      satisfied,
      repeated_issue,
      follow_up_notes,
      follow_up_date
    } = req.body;

    const followUp = await FollowUp.findOne({ follow_up_id: followUpId });
    if (!followUp) {
      return res.status(404).json({ 
        ok: false, 
        error: { message: "Follow-up not found" } 
      });
    }

    const updates = {};
    if (issue_solved !== undefined) updates.issue_solved = issue_solved;
    if (satisfied !== undefined) updates.satisfied = satisfied;
    if (repeated_issue !== undefined) updates.repeated_issue = repeated_issue;
    if (follow_up_notes !== undefined) updates.follow_up_notes = follow_up_notes;
    if (follow_up_date !== undefined) updates.follow_up_date = new Date(follow_up_date);

    const updatedFollowUp = await FollowUp.findOneAndUpdate(
      { follow_up_id: followUpId },
      updates,
      { new: true, runValidators: true }
    );

    // Business Rule: Customer says Not Solved
    if (issue_solved === false) {
      await Ticket.findOneAndUpdate(
        { ticket_id: followUp.ticket_id },
        {
          resolution_status: 'Pending',
          first_call_resolution: 'No'
          // Keep same agent_id
        }
      );
    }

    // Business Rule: Customer confirms Solved
    if (issue_solved === true) {
      // Check if ticket was never reopened to set FCR=Yes
      const ticket = await Ticket.findOne({ ticket_id: followUp.ticket_id });
      if (ticket && ticket.resolution_status === 'Completed') {
        // Check if this is the first time it's being marked as solved
        const previousFollowUps = await FollowUp.find({
          ticket_id: followUp.ticket_id,
          follow_up_id: { $lt: followUpId }
        }).sort({ createdAt: -1 });

        const wasReopened = previousFollowUps.some(f => f.issue_solved === false);
        
        if (!wasReopened) {
          await Ticket.findOneAndUpdate(
            { ticket_id: followUp.ticket_id },
            { first_call_resolution: 'Yes' }
          );
        }
      }
    }

    res.json({
      ok: true,
      data: updatedFollowUp
    });
  } catch (err) {
    next(err);
  }
});

// Mark as solved
router.patch("/:follow_up_id/solved", authRequired, requirePerm('support.followups'), async (req, res, next) => {
  try {
    const followUpId = Number(req.params.follow_up_id);
    const { satisfied } = req.body;

    const followUp = await FollowUp.findOne({ follow_up_id: followUpId });
    if (!followUp) {
      return res.status(404).json({ 
        ok: false, 
        error: { message: "Follow-up not found" } 
      });
    }

    const updatedFollowUp = await FollowUp.findOneAndUpdate(
      { follow_up_id: followUpId },
      {
        issue_solved: true,
        satisfied: satisfied !== undefined ? satisfied : null
      },
      { new: true }
    );

    // Update ticket FCR if this is the first resolution
    const ticket = await Ticket.findOne({ ticket_id: followUp.ticket_id });
    if (ticket && ticket.resolution_status === 'Completed') {
      const wasReopened = await FollowUp.findOne({
        ticket_id: followUp.ticket_id,
        follow_up_id: { $lt: followUpId },
        issue_solved: false
      });

      if (!wasReopened) {
        await Ticket.findOneAndUpdate(
          { ticket_id: followUp.ticket_id },
          { first_call_resolution: 'Yes' }
        );
      }
    }

    res.json({
      ok: true,
      data: updatedFollowUp
    });
  } catch (err) {
    next(err);
  }
});

// Mark as not solved (reopens ticket)
router.patch("/:follow_up_id/not-solved", authRequired, requirePerm('support.followups'), async (req, res, next) => {
  try {
    const followUpId = Number(req.params.follow_up_id);
    const { follow_up_notes } = req.body;

    const followUp = await FollowUp.findOne({ follow_up_id: followUpId });
    if (!followUp) {
      return res.status(404).json({ 
        ok: false, 
        error: { message: "Follow-up not found" } 
      });
    }

    const updatedFollowUp = await FollowUp.findOneAndUpdate(
      { follow_up_id: followUpId },
      {
        issue_solved: false,
        repeated_issue: true,
        follow_up_notes: follow_up_notes || updatedFollowUp.follow_up_notes
      },
      { new: true }
    );

    // Business Rule: Reopen ticket
    await Ticket.findOneAndUpdate(
      { ticket_id: followUp.ticket_id },
      {
        resolution_status: 'Pending',
        first_call_resolution: 'No'
        // Keep same agent_id
      }
    );

    res.json({
      ok: true,
      data: updatedFollowUp
    });
  } catch (err) {
    next(err);
  }
});

// No answer - reschedule
router.patch("/:follow_up_id/no-answer", authRequired, requirePerm('support.followups'), async (req, res, next) => {
  try {
    const followUpId = Number(req.params.follow_up_id);
    const { follow_up_date, follow_up_notes } = req.body;

    const followUp = await FollowUp.findOne({ follow_up_id: followUpId });
    if (!followUp) {
      return res.status(404).json({ 
        ok: false, 
        error: { message: "Follow-up not found" } 
      });
    }

    const updatedFollowUp = await FollowUp.findOneAndUpdate(
      { follow_up_id: followUpId },
      {
        follow_up_date: follow_up_date ? new Date(follow_up_date) : new Date(),
        follow_up_notes: follow_up_notes || updatedFollowUp.follow_up_notes
      },
      { new: true }
    );

    res.json({
      ok: true,
      data: updatedFollowUp
    });
  } catch (err) {
    next(err);
  }
});

// Assign to me
router.patch("/:follow_up_id/assign-to-me", authRequired, requirePerm('support.followups'), async (req, res, next) => {
  try {
    const followUpId = Number(req.params.follow_up_id);
    
    // Get current user's employee_id
    const user = await User.findOne({ user_id: req.user.user_id });
    if (!user || !user.employee_id) {
      return res.status(400).json({ 
        ok: false, 
        error: { message: "User not associated with employee" } 
      });
    }

    const followUp = await FollowUp.findOne({ follow_up_id: followUpId });
    if (!followUp) {
      return res.status(404).json({ 
        ok: false, 
        error: { message: "Follow-up not found" } 
      });
    }

    const updatedFollowUp = await FollowUp.findOneAndUpdate(
      { follow_up_id: followUpId },
      { follow_up_agent_id: user.employee_id },
      { new: true }
    );

    res.json({
      ok: true,
      data: updatedFollowUp
    });
  } catch (err) {
    next(err);
  }
});

// Create follow-up
router.post("/", authRequired, requirePerm('support.followups'), async (req, res, next) => {
  try {
    const {
      ticket_id,
      follow_up_agent_id,
      issue_solved,
      satisfied,
      repeated_issue,
      follow_up_notes,
      customer_location
    } = req.body;
    
    // Validation
    const errors = [];
    if (issue_solved === undefined || issue_solved === null) {
      errors.push({ field: 'issue_solved', detail: 'Select yes or no.' });
    }
    if (issue_solved === 1 && (satisfied === undefined || satisfied === null)) {
      errors.push({ field: 'satisfied', detail: 'Please indicate if you are satisfied.' });
    }
    if (issue_solved === 0 && (!follow_up_notes || follow_up_notes.trim().length < 5)) {
      errors.push({ field: 'follow_up_notes', detail: 'Please add at least 5 characters.' });
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        ok: false,
        error: {
          message: 'Validation failed',
          errors: errors
        }
      });
    }
    
    const follow_up_id = await getNextId('follow_up');
    
    const followUp = await FollowUp.create({
      follow_up_id,
      ticket_id,
      follow_up_agent_id,
      follow_up_date: new Date(),
      issue_solved,
      satisfied,
      repeated_issue,
      follow_up_notes
    });
    
    // Update ticket based on follow-up results
    const ticket = await Ticket.findOne({ ticket_id });
    if (ticket) {
      if (issue_solved === 1) {
        // Issue solved - keep completed, set FCR to Yes if not already set
        await Ticket.findOneAndUpdate(
          { ticket_id },
          { 
            first_call_resolution: 'Yes',
            ...(customer_location && { customer_location })
          }
        );
      } else {
        // Issue not solved - reopen ticket
        await Ticket.findOneAndUpdate(
          { ticket_id },
          {
            resolution_status: 'Pending',
            first_call_resolution: 'No',
            ...(customer_location && { customer_location })
          }
        );
      }
    }
    
    res.status(201).json({ ok: true, data: followUp });
  } catch (err) {
    next(err);
  }
});

export default router;