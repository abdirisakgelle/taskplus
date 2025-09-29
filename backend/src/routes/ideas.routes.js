import express from "express";
import { Idea } from "../models/ideas.js";
import { Content } from "../models/content.js";
import { Employee } from "../models/employees.js";
import { User } from "../models/users.js";
import { Notification } from "../models/notifications.js";
import { authRequired, requirePerm } from "../middleware/auth.js";

const router = express.Router();

// Get ideas with filtering and pagination
router.get("/", authRequired, requirePerm('content.ideas'), async (req, res, next) => {
  try {
    const {
      status,
      contributor,
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
    if (status) filters.status = status;
    if (contributor) filters.contributor = Number(contributor);
    
    // Date range filtering
    if (date_from || date_to) {
      filters.submission_date = {};
      if (date_from) filters.submission_date.$gte = new Date(date_from);
      if (date_to) filters.submission_date.$lte = new Date(date_to);
    }

    // Search
    if (search) {
      filters.title = { $regex: search, $options: 'i' };
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sortObj = {};
    sortObj[sort_by] = sort_order === 'asc' ? 1 : -1;

    // Execute query
    const [ideas, total] = await Promise.all([
      Idea.find(filters)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Idea.countDocuments(filters)
    ]);

    // Get contributor details
    const contributorIds = [...new Set(ideas.map(i => i.contributor).filter(Boolean))];
    const contributors = await Employee.find({ employee_id: { $in: contributorIds } })
      .select('employee_id name').lean();
    const contributorMap = new Map(contributors.map(c => [c.employee_id, c]));

    // Get content count for each idea
    const ideaIds = ideas.map(i => i.idea_id);
    const contentCounts = await Content.aggregate([
      { $match: { idea_id: { $in: ideaIds } } },
      { $group: { _id: "$idea_id", count: { $sum: 1 } } }
    ]);
    const contentCountMap = new Map(contentCounts.map(cc => [cc._id, cc.count]));

    // Enrich ideas
    const enrichedIdeas = ideas.map(idea => ({
      ...idea,
      contributor_info: contributorMap.get(idea.contributor) || null,
      content_count: contentCountMap.get(idea.idea_id) || 0
    }));

    res.json({
      ideas: enrichedIdeas,
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

// Get single idea with content
router.get("/:id", authRequired, requirePerm('content.ideas'), async (req, res, next) => {
  try {
    const ideaId = Number(req.params.id);
    const idea = await Idea.findOne({ idea_id: ideaId }).lean();
    
    if (!idea) {
      return res.status(404).json({ message: "Idea not found" });
    }

    // Get contributor and content details
    const [contributor, content] = await Promise.all([
      idea.contributor ? Employee.findOne({ employee_id: idea.contributor }).lean() : null,
      Content.find({ idea_id: ideaId }).lean()
    ]);

    const enrichedIdea = {
      ...idea,
      contributor_info: contributor,
      content: content
    };

    res.json(enrichedIdea);
  } catch (err) {
    next(err);
  }
});

// Create idea
router.post("/", authRequired, requirePerm('content.ideas'), async (req, res, next) => {
  try {
    const { title, contributor, submission_date, status } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Idea title is required" });
    }

    // Validate contributor if provided
    if (contributor) {
      const emp = await Employee.findOne({ employee_id: contributor });
      if (!emp) {
        return res.status(400).json({ message: "Invalid contributor" });
      }
    }

    // Get current user's employee_id if no contributor specified
    let finalContributor = contributor;
    if (!finalContributor) {
      const user = await User.findOne({ user_id: req.user.user_id });
      if (user && user.employee_id) {
        finalContributor = user.employee_id;
      }
    }

    const idea = await Idea.create({
      title: title.trim(),
      contributor: finalContributor,
      submission_date: submission_date ? new Date(submission_date) : new Date(),
      status: status || "Draft"
    });

    res.status(201).json(idea);
  } catch (err) {
    next(err);
  }
});

// Update idea
router.put("/:id", authRequired, requirePerm('content.ideas'), async (req, res, next) => {
  try {
    const ideaId = Number(req.params.id);
    const { title, contributor, submission_date, status } = req.body;

    const idea = await Idea.findOne({ idea_id: ideaId });
    if (!idea) {
      return res.status(404).json({ message: "Idea not found" });
    }

    // Check if user can update this idea (contributor or admin)
    const user = await User.findOne({ user_id: req.user.user_id });
    if (user && user.employee_id && idea.contributor !== user.employee_id) {
      // Allow if user has admin permissions (you might want to implement role-based access)
      // For now, we'll allow any authenticated user with ideas permissions
    }

    // Validate contributor if changing
    if (contributor !== undefined && contributor !== idea.contributor) {
      if (contributor) {
        const emp = await Employee.findOne({ employee_id: contributor });
        if (!emp) {
          return res.status(400).json({ message: "Invalid contributor" });
        }
      }
    }

    const updates = {};
    if (title !== undefined && title.trim()) updates.title = title.trim();
    if (contributor !== undefined) updates.contributor = contributor;
    if (submission_date !== undefined) updates.submission_date = new Date(submission_date);
    if (status !== undefined) updates.status = status;

    const updatedIdea = await Idea.findOneAndUpdate(
      { idea_id: ideaId },
      updates,
      { new: true }
    );

    // Notify contributor if status changed to approved
    if (status && status !== idea.status && status === 'Approved' && idea.contributor) {
      const contributorUser = await User.findOne({ employee_id: idea.contributor });
      if (contributorUser) {
        await Notification.create({
          user_id: contributorUser.user_id,
          title: "Idea Approved",
          message: `Your idea "${updatedIdea.title}" has been approved!`,
          type: "idea_approved"
        });
      }
    }

    res.json(updatedIdea);
  } catch (err) {
    next(err);
  }
});

// Delete idea
router.delete("/:id", authRequired, requirePerm('content.ideas'), async (req, res, next) => {
  try {
    const ideaId = Number(req.params.id);
    
    // Check if idea has associated content
    const contentCount = await Content.countDocuments({ idea_id: ideaId });
    if (contentCount > 0) {
      return res.status(400).json({ 
        message: "Cannot delete idea with associated content. Delete content first." 
      });
    }

    const deleted = await Idea.findOneAndDelete({ idea_id: ideaId });
    if (!deleted) {
      return res.status(404).json({ message: "Idea not found" });
    }

    res.json({ message: "Idea deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// Get my ideas (ideas by current user)
router.get("/my/ideas", authRequired, requirePerm('content.ideas'), async (req, res, next) => {
  try {
    // Get current user's employee_id
    const user = await User.findOne({ user_id: req.user.user_id });
    if (!user || !user.employee_id) {
      return res.json([]);
    }

    const { status } = req.query;
    const filters = { contributor: user.employee_id };
    if (status) filters.status = status;

    const ideas = await Idea.find(filters)
      .sort({ updatedAt: -1 })
      .lean();

    // Get content count for each idea
    const ideaIds = ideas.map(i => i.idea_id);
    const contentCounts = await Content.aggregate([
      { $match: { idea_id: { $in: ideaIds } } },
      { $group: { _id: "$idea_id", count: { $sum: 1 } } }
    ]);
    const contentCountMap = new Map(contentCounts.map(cc => [cc._id, cc.count]));

    const enrichedIdeas = ideas.map(idea => ({
      ...idea,
      content_count: contentCountMap.get(idea.idea_id) || 0
    }));

    res.json(enrichedIdeas);
  } catch (err) {
    next(err);
  }
});

// Get idea statistics
router.get("/stats/overview", authRequired, requirePerm('content.ideas'), async (req, res, next) => {
  try {
    const { contributor_id, date_from, date_to } = req.query;
    
    let matchFilter = {};
    if (contributor_id) matchFilter.contributor = Number(contributor_id);
    
    if (date_from || date_to) {
      matchFilter.submission_date = {};
      if (date_from) matchFilter.submission_date.$gte = new Date(date_from);
      if (date_to) matchFilter.submission_date.$lte = new Date(date_to);
    }

    const stats = await Idea.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          draft: { $sum: { $cond: [{ $eq: ["$status", "Draft"] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] } },
          in_review: { $sum: { $cond: [{ $eq: ["$status", "In Review"] }, 1, 0] } }
        }
      }
    ]);

    const result = stats[0] || {
      total: 0,
      draft: 0,
      approved: 0,
      rejected: 0,
      in_review: 0
    };

    // Add calculated metrics
    result.approval_rate = result.total > 0 ? 
      ((result.approved / result.total) * 100).toFixed(2) : "0.00";

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Approve idea
router.put("/:id/approve", authRequired, requirePerm('content.ideas'), async (req, res, next) => {
  try {
    const ideaId = Number(req.params.id);
    
    const idea = await Idea.findOne({ idea_id: ideaId });
    if (!idea) {
      return res.status(404).json({ message: "Idea not found" });
    }

    const updatedIdea = await Idea.findOneAndUpdate(
      { idea_id: ideaId },
      { status: 'Approved' },
      { new: true }
    );

    // Notify contributor
    if (idea.contributor) {
      const contributorUser = await User.findOne({ employee_id: idea.contributor });
      if (contributorUser) {
        await Notification.create({
          user_id: contributorUser.user_id,
          title: "Idea Approved",
          message: `Your idea "${updatedIdea.title}" has been approved!`,
          type: "idea_approved"
        });
      }
    }

    res.json(updatedIdea);
  } catch (err) {
    next(err);
  }
});

// Reject idea
router.put("/:id/reject", authRequired, requirePerm('content.ideas'), async (req, res, next) => {
  try {
    const ideaId = Number(req.params.id);
    const { reason } = req.body;
    
    const idea = await Idea.findOne({ idea_id: ideaId });
    if (!idea) {
      return res.status(404).json({ message: "Idea not found" });
    }

    const updatedIdea = await Idea.findOneAndUpdate(
      { idea_id: ideaId },
      { status: 'Rejected' },
      { new: true }
    );

    // Notify contributor
    if (idea.contributor) {
      const contributorUser = await User.findOne({ employee_id: idea.contributor });
      if (contributorUser) {
        await Notification.create({
          user_id: contributorUser.user_id,
          title: "Idea Status Update",
          message: `Your idea "${updatedIdea.title}" has been rejected${reason ? ': ' + reason : ''}`,
          type: "idea_rejected"
        });
      }
    }

    res.json(updatedIdea);
  } catch (err) {
    next(err);
  }
});

export default router;
