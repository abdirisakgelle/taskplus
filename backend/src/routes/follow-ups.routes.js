import express from "express";
import { FollowUp } from "../models/follow_ups.js";
import { Ticket } from "../models/tickets.js";
import { Employee } from "../models/employees.js";
import { User } from "../models/users.js";
import { Notification } from "../models/notifications.js";
import { authRequired, requirePerm } from "../middleware/auth.js";

const router = express.Router();

// Get follow-ups with filtering
router.get("/", authRequired, requirePerm('support.followups'), async (req, res, next) => {
  try {
    const {
      ticket_id,
      follow_up_agent_id,
      issue_solved,
      satisfied,
      repeated_issue,
      date_from,
      date_to,
      page = 1,
      limit = 20
    } = req.query;

    // Build filters
    const filters = {};
    if (ticket_id) filters.ticket_id = Number(ticket_id);
    if (follow_up_agent_id) filters.follow_up_agent_id = Number(follow_up_agent_id);
    if (issue_solved !== undefined) filters.issue_solved = issue_solved === 'true';
    if (satisfied !== undefined) filters.satisfied = satisfied === 'true';
    if (repeated_issue !== undefined) filters.repeated_issue = repeated_issue === 'true';

    // Date range filtering
    if (date_from || date_to) {
      filters.follow_up_date = {};
      if (date_from) filters.follow_up_date.$gte = new Date(date_from);
      if (date_to) filters.follow_up_date.$lte = new Date(date_to);
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const [followUps, total] = await Promise.all([
      FollowUp.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      FollowUp.countDocuments(filters)
    ]);

    // Get ticket and agent details
    const ticketIds = [...new Set(followUps.map(f => f.ticket_id))];
    const agentIds = [...new Set(followUps.map(f => f.follow_up_agent_id).filter(Boolean))];

    const [tickets, agents] = await Promise.all([
      Ticket.find({ ticket_id: { $in: ticketIds } })
        .select('ticket_id customer_phone issue_description resolution_status').lean(),
      Employee.find({ employee_id: { $in: agentIds } })
        .select('employee_id name').lean()
    ]);

    const ticketMap = new Map(tickets.map(t => [t.ticket_id, t]));
    const agentMap = new Map(agents.map(a => [a.employee_id, a]));

    // Enrich follow-ups
    const enrichedFollowUps = followUps.map(followUp => ({
      ...followUp,
      ticket_info: ticketMap.get(followUp.ticket_id) || null,
      agent_info: agentMap.get(followUp.follow_up_agent_id) || null
    }));

    res.json({
      follow_ups: enrichedFollowUps,
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

// Get single follow-up
router.get("/:id", authRequired, requirePerm('support.followups'), async (req, res, next) => {
  try {
    const followUpId = Number(req.params.id);
    const followUp = await FollowUp.findOne({ follow_up_id: followUpId }).lean();
    
    if (!followUp) {
      return res.status(404).json({ message: "Follow-up not found" });
    }

    // Get ticket and agent details
    const [ticket, agent] = await Promise.all([
      Ticket.findOne({ ticket_id: followUp.ticket_id }).lean(),
      followUp.follow_up_agent_id ? 
        Employee.findOne({ employee_id: followUp.follow_up_agent_id }).lean() : null
    ]);

    const enrichedFollowUp = {
      ...followUp,
      ticket_info: ticket,
      agent_info: agent
    };

    res.json(enrichedFollowUp);
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
      follow_up_date,
      issue_solved,
      satisfied,
      repeated_issue,
      follow_up_notes
    } = req.body;

    if (!ticket_id) {
      return res.status(400).json({ message: "Ticket ID is required" });
    }

    // Validate ticket exists
    const ticket = await Ticket.findOne({ ticket_id });
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Validate agent if provided
    if (follow_up_agent_id) {
      const agent = await Employee.findOne({ employee_id: follow_up_agent_id });
      if (!agent) {
        return res.status(400).json({ message: "Invalid follow-up agent" });
      }
    }

    const followUp = await FollowUp.create({
      ticket_id,
      follow_up_agent_id: follow_up_agent_id || null,
      follow_up_date: follow_up_date ? new Date(follow_up_date) : new Date(),
      issue_solved: issue_solved || false,
      satisfied: satisfied || false,
      repeated_issue: repeated_issue || false,
      follow_up_notes
    });

    // Update ticket status if issue is solved
    if (issue_solved && ticket.resolution_status !== 'Closed') {
      await Ticket.findOneAndUpdate(
        { ticket_id },
        { resolution_status: 'Closed' }
      );
    }

    // Notify ticket agent about follow-up
    if (ticket.agent_id) {
      const agentUser = await User.findOne({ employee_id: ticket.agent_id });
      if (agentUser) {
        await Notification.create({
          user_id: agentUser.user_id,
          title: "Follow-up Created",
          message: `A follow-up has been created for ticket #${ticket_id}`,
          type: "follow_up_created"
        });
      }
    }

    res.status(201).json(followUp);
  } catch (err) {
    next(err);
  }
});

// Update follow-up
router.put("/:id", authRequired, requirePerm('support.followups'), async (req, res, next) => {
  try {
    const followUpId = Number(req.params.id);
    const {
      follow_up_agent_id,
      follow_up_date,
      issue_solved,
      satisfied,
      repeated_issue,
      follow_up_notes
    } = req.body;

    const followUp = await FollowUp.findOne({ follow_up_id: followUpId });
    if (!followUp) {
      return res.status(404).json({ message: "Follow-up not found" });
    }

    // Validate agent if changing
    if (follow_up_agent_id !== undefined && follow_up_agent_id !== followUp.follow_up_agent_id) {
      if (follow_up_agent_id) {
        const agent = await Employee.findOne({ employee_id: follow_up_agent_id });
        if (!agent) {
          return res.status(400).json({ message: "Invalid follow-up agent" });
        }
      }
    }

    const updates = {};
    if (follow_up_agent_id !== undefined) updates.follow_up_agent_id = follow_up_agent_id;
    if (follow_up_date !== undefined) updates.follow_up_date = new Date(follow_up_date);
    if (issue_solved !== undefined) updates.issue_solved = issue_solved;
    if (satisfied !== undefined) updates.satisfied = satisfied;
    if (repeated_issue !== undefined) updates.repeated_issue = repeated_issue;
    if (follow_up_notes !== undefined) updates.follow_up_notes = follow_up_notes;

    const updatedFollowUp = await FollowUp.findOneAndUpdate(
      { follow_up_id: followUpId },
      updates,
      { new: true }
    );

    // Update ticket status if issue status changed
    if (issue_solved !== undefined) {
      const ticket = await Ticket.findOne({ ticket_id: followUp.ticket_id });
      if (ticket) {
        const newStatus = issue_solved ? 'Closed' : 'Open';
        if (ticket.resolution_status !== newStatus) {
          await Ticket.findOneAndUpdate(
            { ticket_id: followUp.ticket_id },
            { resolution_status: newStatus }
          );
        }
      }
    }

    res.json(updatedFollowUp);
  } catch (err) {
    next(err);
  }
});

// Delete follow-up
router.delete("/:id", authRequired, requirePerm('support.followups'), async (req, res, next) => {
  try {
    const followUpId = Number(req.params.id);
    
    const deleted = await FollowUp.findOneAndDelete({ follow_up_id: followUpId });
    if (!deleted) {
      return res.status(404).json({ message: "Follow-up not found" });
    }

    res.json({ message: "Follow-up deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// Get follow-ups for a specific ticket
router.get("/ticket/:ticketId", authRequired, requirePerm('support.followups'), async (req, res, next) => {
  try {
    const ticketId = Number(req.params.ticketId);
    
    const followUps = await FollowUp.find({ ticket_id: ticketId })
      .sort({ createdAt: -1 })
      .lean();

    // Get agent details
    const agentIds = [...new Set(followUps.map(f => f.follow_up_agent_id).filter(Boolean))];
    const agents = await Employee.find({ employee_id: { $in: agentIds } })
      .select('employee_id name').lean();
    const agentMap = new Map(agents.map(a => [a.employee_id, a]));

    const enrichedFollowUps = followUps.map(followUp => ({
      ...followUp,
      agent_info: agentMap.get(followUp.follow_up_agent_id) || null
    }));

    res.json(enrichedFollowUps);
  } catch (err) {
    next(err);
  }
});

// Get follow-up statistics
router.get("/stats/overview", authRequired, requirePerm('support.followups'), async (req, res, next) => {
  try {
    const { agent_id, date_from, date_to } = req.query;
    
    let matchFilter = {};
    if (agent_id) matchFilter.follow_up_agent_id = Number(agent_id);
    
    if (date_from || date_to) {
      matchFilter.follow_up_date = {};
      if (date_from) matchFilter.follow_up_date.$gte = new Date(date_from);
      if (date_to) matchFilter.follow_up_date.$lte = new Date(date_to);
    }

    const stats = await FollowUp.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          issues_solved: { $sum: { $cond: ["$issue_solved", 1, 0] } },
          satisfied_customers: { $sum: { $cond: ["$satisfied", 1, 0] } },
          repeated_issues: { $sum: { $cond: ["$repeated_issue", 1, 0] } }
        }
      }
    ]);

    const result = stats[0] || {
      total: 0,
      issues_solved: 0,
      satisfied_customers: 0,
      repeated_issues: 0
    };

    // Add calculated metrics
    result.resolution_rate = result.total > 0 ? 
      ((result.issues_solved / result.total) * 100).toFixed(2) : "0.00";
    result.satisfaction_rate = result.total > 0 ? 
      ((result.satisfied_customers / result.total) * 100).toFixed(2) : "0.00";
    result.repeat_issue_rate = result.total > 0 ? 
      ((result.repeated_issues / result.total) * 100).toFixed(2) : "0.00";

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
