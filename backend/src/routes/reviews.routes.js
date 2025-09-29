import express from "express";
import { Review } from "../models/reviews.js";
import { Ticket } from "../models/tickets.js";
import { Employee } from "../models/employees.js";
import { User } from "../models/users.js";
import { Notification } from "../models/notifications.js";
import { authRequired, requirePerm } from "../middleware/auth.js";

const router = express.Router();

// Get reviews with filtering
router.get("/", authRequired, requirePerm('support.reviews'), async (req, res, next) => {
  try {
    const {
      ticket_id,
      reviewer_id,
      issue_status,
      resolved,
      date_from,
      date_to,
      page = 1,
      limit = 20
    } = req.query;

    // Build filters
    const filters = {};
    if (ticket_id) filters.ticket_id = Number(ticket_id);
    if (reviewer_id) filters.reviewer_id = Number(reviewer_id);
    if (issue_status) filters.issue_status = issue_status;
    if (resolved !== undefined) filters.resolved = resolved === 'true';

    // Date range filtering
    if (date_from || date_to) {
      filters.review_date = {};
      if (date_from) filters.review_date.$gte = new Date(date_from);
      if (date_to) filters.review_date.$lte = new Date(date_to);
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const [reviews, total] = await Promise.all([
      Review.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Review.countDocuments(filters)
    ]);

    // Get ticket and reviewer details
    const ticketIds = [...new Set(reviews.map(r => r.ticket_id))];
    const reviewerIds = [...new Set(reviews.map(r => r.reviewer_id).filter(Boolean))];

    const [tickets, reviewers] = await Promise.all([
      Ticket.find({ ticket_id: { $in: ticketIds } })
        .select('ticket_id customer_phone issue_description resolution_status agent_id').lean(),
      Employee.find({ employee_id: { $in: reviewerIds } })
        .select('employee_id name').lean()
    ]);

    const ticketMap = new Map(tickets.map(t => [t.ticket_id, t]));
    const reviewerMap = new Map(reviewers.map(r => [r.employee_id, r]));

    // Enrich reviews
    const enrichedReviews = reviews.map(review => ({
      ...review,
      ticket_info: ticketMap.get(review.ticket_id) || null,
      reviewer_info: reviewerMap.get(review.reviewer_id) || null
    }));

    res.json({
      reviews: enrichedReviews,
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

// Get single review
router.get("/:id", authRequired, requirePerm('support.reviews'), async (req, res, next) => {
  try {
    const reviewId = Number(req.params.id);
    const review = await Review.findOne({ review_id: reviewId }).lean();
    
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Get ticket and reviewer details
    const [ticket, reviewer] = await Promise.all([
      Ticket.findOne({ ticket_id: review.ticket_id }).lean(),
      review.reviewer_id ? 
        Employee.findOne({ employee_id: review.reviewer_id }).lean() : null
    ]);

    const enrichedReview = {
      ...review,
      ticket_info: ticket,
      reviewer_info: reviewer
    };

    res.json(enrichedReview);
  } catch (err) {
    next(err);
  }
});

// Create review
router.post("/", authRequired, requirePerm('support.reviews'), async (req, res, next) => {
  try {
    const {
      ticket_id,
      reviewer_id,
      review_date,
      issue_status,
      resolved,
      notes
    } = req.body;

    if (!ticket_id) {
      return res.status(400).json({ message: "Ticket ID is required" });
    }

    // Validate ticket exists
    const ticket = await Ticket.findOne({ ticket_id });
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Validate reviewer if provided
    if (reviewer_id) {
      const reviewer = await Employee.findOne({ employee_id: reviewer_id });
      if (!reviewer) {
        return res.status(400).json({ message: "Invalid reviewer" });
      }
    }

    // Get current user's employee_id if no reviewer specified
    let finalReviewerId = reviewer_id;
    if (!finalReviewerId) {
      const user = await User.findOne({ user_id: req.user.user_id });
      if (user && user.employee_id) {
        finalReviewerId = user.employee_id;
      }
    }

    const review = await Review.create({
      ticket_id,
      reviewer_id: finalReviewerId,
      review_date: review_date ? new Date(review_date) : new Date(),
      issue_status,
      resolved: resolved || false,
      notes
    });

    // Update ticket resolution status based on review
    if (resolved !== undefined) {
      const newStatus = resolved ? 'Closed' : 'Open';
      if (ticket.resolution_status !== newStatus) {
        await Ticket.findOneAndUpdate(
          { ticket_id },
          { resolution_status: newStatus }
        );
      }
    }

    // Notify ticket agent about review
    if (ticket.agent_id) {
      const agentUser = await User.findOne({ employee_id: ticket.agent_id });
      if (agentUser) {
        await Notification.create({
          user_id: agentUser.user_id,
          title: "Ticket Reviewed",
          message: `Ticket #${ticket_id} has been reviewed`,
          type: "ticket_review"
        });
      }
    }

    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
});

// Update review
router.put("/:id", authRequired, requirePerm('support.reviews'), async (req, res, next) => {
  try {
    const reviewId = Number(req.params.id);
    const {
      reviewer_id,
      review_date,
      issue_status,
      resolved,
      notes
    } = req.body;

    const review = await Review.findOne({ review_id: reviewId });
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Check if user can update this review (reviewer or admin)
    const user = await User.findOne({ user_id: req.user.user_id });
    if (user && user.employee_id && review.reviewer_id !== user.employee_id) {
      // Allow if user has admin permissions (you might want to implement role-based access)
      // For now, we'll allow any authenticated user with review permissions
    }

    // Validate reviewer if changing
    if (reviewer_id !== undefined && reviewer_id !== review.reviewer_id) {
      if (reviewer_id) {
        const reviewer = await Employee.findOne({ employee_id: reviewer_id });
        if (!reviewer) {
          return res.status(400).json({ message: "Invalid reviewer" });
        }
      }
    }

    const updates = {};
    if (reviewer_id !== undefined) updates.reviewer_id = reviewer_id;
    if (review_date !== undefined) updates.review_date = new Date(review_date);
    if (issue_status !== undefined) updates.issue_status = issue_status;
    if (resolved !== undefined) updates.resolved = resolved;
    if (notes !== undefined) updates.notes = notes;

    const updatedReview = await Review.findOneAndUpdate(
      { review_id: reviewId },
      updates,
      { new: true }
    );

    // Update ticket status if resolution changed
    if (resolved !== undefined && resolved !== review.resolved) {
      const ticket = await Ticket.findOne({ ticket_id: review.ticket_id });
      if (ticket) {
        const newStatus = resolved ? 'Closed' : 'Open';
        if (ticket.resolution_status !== newStatus) {
          await Ticket.findOneAndUpdate(
            { ticket_id: review.ticket_id },
            { resolution_status: newStatus }
          );
        }
      }
    }

    res.json(updatedReview);
  } catch (err) {
    next(err);
  }
});

// Delete review
router.delete("/:id", authRequired, requirePerm('support.reviews'), async (req, res, next) => {
  try {
    const reviewId = Number(req.params.id);
    
    const deleted = await Review.findOneAndDelete({ review_id: reviewId });
    if (!deleted) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.json({ message: "Review deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// Get reviews for a specific ticket
router.get("/ticket/:ticketId", authRequired, requirePerm('support.reviews'), async (req, res, next) => {
  try {
    const ticketId = Number(req.params.ticketId);
    
    const reviews = await Review.find({ ticket_id: ticketId })
      .sort({ createdAt: -1 })
      .lean();

    // Get reviewer details
    const reviewerIds = [...new Set(reviews.map(r => r.reviewer_id).filter(Boolean))];
    const reviewers = await Employee.find({ employee_id: { $in: reviewerIds } })
      .select('employee_id name').lean();
    const reviewerMap = new Map(reviewers.map(r => [r.employee_id, r]));

    const enrichedReviews = reviews.map(review => ({
      ...review,
      reviewer_info: reviewerMap.get(review.reviewer_id) || null
    }));

    res.json(enrichedReviews);
  } catch (err) {
    next(err);
  }
});

// Get my reviews (reviews by current user)
router.get("/my/reviews", authRequired, requirePerm('support.reviews'), async (req, res, next) => {
  try {
    // Get current user's employee_id
    const user = await User.findOne({ user_id: req.user.user_id });
    if (!user || !user.employee_id) {
      return res.json([]);
    }

    const { resolved, date_from, date_to } = req.query;
    const filters = { reviewer_id: user.employee_id };
    
    if (resolved !== undefined) filters.resolved = resolved === 'true';
    
    if (date_from || date_to) {
      filters.review_date = {};
      if (date_from) filters.review_date.$gte = new Date(date_from);
      if (date_to) filters.review_date.$lte = new Date(date_to);
    }

    const reviews = await Review.find(filters)
      .sort({ updatedAt: -1 })
      .lean();

    // Get ticket details
    const ticketIds = [...new Set(reviews.map(r => r.ticket_id))];
    const tickets = await Ticket.find({ ticket_id: { $in: ticketIds } })
      .select('ticket_id customer_phone issue_description resolution_status').lean();
    const ticketMap = new Map(tickets.map(t => [t.ticket_id, t]));

    const enrichedReviews = reviews.map(review => ({
      ...review,
      ticket_info: ticketMap.get(review.ticket_id) || null
    }));

    res.json(enrichedReviews);
  } catch (err) {
    next(err);
  }
});

// Get review statistics
router.get("/stats/overview", authRequired, requirePerm('support.reviews'), async (req, res, next) => {
  try {
    const { reviewer_id, date_from, date_to } = req.query;
    
    let matchFilter = {};
    if (reviewer_id) matchFilter.reviewer_id = Number(reviewer_id);
    
    if (date_from || date_to) {
      matchFilter.review_date = {};
      if (date_from) matchFilter.review_date.$gte = new Date(date_from);
      if (date_to) matchFilter.review_date.$lte = new Date(date_to);
    }

    const stats = await Review.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          resolved: { $sum: { $cond: ["$resolved", 1, 0] } },
          by_status: {
            $push: "$issue_status"
          }
        }
      }
    ]);

    const result = stats[0] || {
      total: 0,
      resolved: 0,
      by_status: []
    };

    // Calculate status distribution
    const statusCounts = result.by_status.reduce((acc, status) => {
      if (status) {
        acc[status] = (acc[status] || 0) + 1;
      }
      return acc;
    }, {});

    // Add calculated metrics
    result.resolution_rate = result.total > 0 ? 
      ((result.resolved / result.total) * 100).toFixed(2) : "0.00";
    result.status_distribution = statusCounts;
    
    // Remove the array to clean up response
    delete result.by_status;

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
