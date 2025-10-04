import express from "express";
import { Review } from "../models/reviews.js";
import { Ticket } from "../models/tickets.js";
import { Employee } from "../models/employees.js";
import { User } from "../models/users.js";
import { getNextId } from "../utils/counters.js";
import { authRequired, requirePerm } from "../middleware/auth.js";

const router = express.Router();

// Get reviews with filtering
router.get("/", authRequired, requirePerm('support.reviews'), async (req, res, next) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      reviewer_id,
      date,
      ticket_id,
      resolved
    } = req.query;

    // Build filters
    const filters = {};
    
    if (reviewer_id) filters.reviewer_id = Number(reviewer_id);
    if (ticket_id) filters.ticket_id = Number(ticket_id);
    if (resolved !== undefined) filters.resolved = resolved === 'true';
    
    // Date filtering
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      filters.review_date = { $gte: startDate, $lt: endDate };
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(pageSize)));
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const [reviews, total] = await Promise.all([
      Review.find(filters)
        .sort({ review_date: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Review.countDocuments(filters)
    ]);

    // Get reviewer and ticket details
    const reviewerIds = [...new Set(reviews.map(r => r.reviewer_id).filter(Boolean))];
    const ticketIds = [...new Set(reviews.map(r => r.ticket_id).filter(Boolean))];
    
    const [reviewers, tickets] = await Promise.all([
      Employee.find({ employee_id: { $in: reviewerIds } })
        .select('employee_id name').lean(),
      Ticket.find({ ticket_id: { $in: ticketIds } })
        .select('ticket_id customer_phone issue_category resolution_status').lean()
    ]);
    
    const reviewerMap = new Map(reviewers.map(r => [r.employee_id, r]));
    const ticketMap = new Map(tickets.map(t => [t.ticket_id, t]));

    // Enrich reviews
    const enrichedReviews = reviews.map(review => ({
      ...review,
      reviewer_info: reviewerMap.get(review.reviewer_id) || null,
      ticket_info: ticketMap.get(review.ticket_id) || null
    }));

    res.json({
      ok: true,
      data: enrichedReviews,
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

// Get single review
router.get("/:review_id", authRequired, requirePerm('support.reviews'), async (req, res, next) => {
  try {
    const reviewId = Number(req.params.review_id);
    const review = await Review.findOne({ review_id: reviewId }).lean();
    
    if (!review) {
      return res.status(404).json({ 
        ok: false, 
        error: { message: "Review not found" } 
      });
    }

    // Get related data
    const [reviewer, ticket] = await Promise.all([
      Employee.findOne({ employee_id: review.reviewer_id }).lean(),
      Ticket.findOne({ ticket_id: review.ticket_id }).lean()
    ]);

    res.json({
      ok: true,
      data: {
        ...review,
        reviewer_info: reviewer,
        ticket_info: ticket
      }
    });
  } catch (err) {
    next(err);
  }
});

// Create review
router.post("/", authRequired, requirePerm('support.reviews'), async (req, res, next) => {
  try {
    const {
      ticket_id,
      issue_status,
      resolved,
      notes
    } = req.body;

    // Validate required fields
    if (!ticket_id || !issue_status || resolved === undefined) {
      return res.status(400).json({ 
        ok: false, 
        error: { message: "Ticket ID, issue status, and resolved status are required" } 
      });
    }

    // Validate ticket exists
    const ticket = await Ticket.findOne({ ticket_id: Number(ticket_id) });
    if (!ticket) {
      return res.status(400).json({ 
        ok: false, 
        error: { message: "Ticket not found" } 
      });
    }

    // Get current user's employee_id
    const user = await User.findOne({ user_id: req.user.user_id });
    if (!user || !user.employee_id) {
      return res.status(400).json({ 
        ok: false, 
        error: { message: "User not associated with employee" } 
      });
    }

    // Get next review ID
    const review_id = await getNextId('review');

    const review = await Review.create({
      review_id,
      ticket_id: Number(ticket_id),
      reviewer_id: user.employee_id,
      review_date: new Date(),
      issue_status,
      resolved: Boolean(resolved),
      notes
    });

    res.status(201).json({
      ok: true,
      data: review
    });
  } catch (err) {
    next(err);
  }
});

// Update review
router.patch("/:review_id", authRequired, requirePerm('support.reviews'), async (req, res, next) => {
  try {
    const reviewId = Number(req.params.review_id);
    const {
      issue_status,
      resolved,
      notes
    } = req.body;

    const review = await Review.findOne({ review_id: reviewId });
    if (!review) {
      return res.status(404).json({ 
        ok: false, 
        error: { message: "Review not found" } 
      });
    }

    const updates = {};
    if (issue_status !== undefined) updates.issue_status = issue_status;
    if (resolved !== undefined) updates.resolved = Boolean(resolved);
    if (notes !== undefined) updates.notes = notes;

    const updatedReview = await Review.findOneAndUpdate(
      { review_id: reviewId },
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      ok: true,
      data: updatedReview
    });
  } catch (err) {
    next(err);
  }
});

// Get stuck tickets for QA review
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

    // Check which tickets already have reviews
    const ticketIds = stuckTickets.map(t => t.ticket_id);
    const existingReviews = await Review.find({ ticket_id: { $in: ticketIds } })
      .select('ticket_id').lean();
    const reviewedTicketIds = new Set(existingReviews.map(r => r.ticket_id));

    const enrichedTickets = stuckTickets.map(ticket => ({
      ...ticket,
      agent_info: agentMap.get(ticket.agent_id) || null,
      age_hours: Math.floor((Date.now() - ticket.updatedAt.getTime()) / (1000 * 60 * 60)),
      has_review: reviewedTicketIds.has(ticket.ticket_id)
    }));

    res.json({
      ok: true,
      data: enrichedTickets
    });
  } catch (err) {
    next(err);
  }
});

// Resolve QA review
router.patch("/:review_id/resolve", authRequired, requirePerm('support.reviews'), async (req, res, next) => {
  try {
    const reviewId = Number(req.params.review_id);
    const { resolved, notes } = req.body;

    const review = await Review.findOne({ review_id: reviewId });
    if (!review) {
      return res.status(404).json({ 
        ok: false, 
        error: { message: "Review not found" } 
      });
    }

    const updates = {
      resolved: Boolean(resolved)
    };
    
    if (notes !== undefined) updates.notes = notes;

    const updatedReview = await Review.findOneAndUpdate(
      { review_id: reviewId },
      updates,
      { new: true }
    );

    // If QA marks as resolved, we might want to update the ticket status
    if (resolved === true) {
      await Ticket.findOneAndUpdate(
        { ticket_id: review.ticket_id },
        { resolution_status: 'Completed' }
      );
    }

    res.json({
      ok: true,
      data: updatedReview
    });
  } catch (err) {
    next(err);
  }
});

export default router;