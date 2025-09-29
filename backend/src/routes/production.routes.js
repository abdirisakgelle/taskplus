import express from "express";
import { Production } from "../models/production.js";
import { Content } from "../models/content.js";
import { SocialMedia } from "../models/social_media.js";
import { Employee } from "../models/employees.js";
import { User } from "../models/users.js";
import { Notification } from "../models/notifications.js";
import { authRequired, requirePerm } from "../middleware/auth.js";

const router = express.Router();

// Get productions with filtering and pagination
router.get("/", authRequired, requirePerm('content.production'), async (req, res, next) => {
  try {
    const {
      content_id,
      editor_id,
      production_status,
      sent_to_social_team,
      completion_date_from,
      completion_date_to,
      page = 1,
      limit = 20,
      sort_by = 'createdAt',
      sort_order = 'desc'
    } = req.query;

    // Build filters
    const filters = {};
    if (content_id) filters.content_id = Number(content_id);
    if (editor_id) filters.editor_id = Number(editor_id);
    if (production_status) filters.production_status = production_status;
    if (sent_to_social_team !== undefined) filters.sent_to_social_team = sent_to_social_team === 'true';
    
    // Completion date range filtering
    if (completion_date_from || completion_date_to) {
      filters.completion_date = {};
      if (completion_date_from) filters.completion_date.$gte = new Date(completion_date_from);
      if (completion_date_to) filters.completion_date.$lte = new Date(completion_date_to);
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sortObj = {};
    sortObj[sort_by] = sort_order === 'asc' ? 1 : -1;

    // Execute query
    const [productions, total] = await Promise.all([
      Production.find(filters)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Production.countDocuments(filters)
    ]);

    // Get related data
    const contentIds = [...new Set(productions.map(p => p.content_id).filter(Boolean))];
    const editorIds = [...new Set(productions.map(p => p.editor_id).filter(Boolean))];

    const [content, editors] = await Promise.all([
      Content.find({ content_id: { $in: contentIds } }).lean(),
      Employee.find({ employee_id: { $in: editorIds } }).select('employee_id name').lean()
    ]);

    // Get social media posts for each production
    const productionIds = productions.map(p => p.production_id);
    const socialPosts = await SocialMedia.find({ content_id: { $in: contentIds } })
      .select('content_id status approved').lean();

    const contentMap = new Map(content.map(c => [c.content_id, c]));
    const editorMap = new Map(editors.map(e => [e.employee_id, e]));
    
    // Group social posts by content_id
    const socialPostsMap = socialPosts.reduce((acc, post) => {
      if (!acc[post.content_id]) acc[post.content_id] = [];
      acc[post.content_id].push(post);
      return acc;
    }, {});

    // Enrich productions
    const enrichedProductions = productions.map(production => ({
      ...production,
      content_info: contentMap.get(production.content_id) || null,
      editor_info: editorMap.get(production.editor_id) || null,
      social_posts: socialPostsMap[production.content_id] || []
    }));

    res.json({
      productions: enrichedProductions,
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

// Get single production with full details
router.get("/:id", authRequired, requirePerm('content.production'), async (req, res, next) => {
  try {
    const productionId = Number(req.params.id);
    const production = await Production.findOne({ production_id: productionId }).lean();
    
    if (!production) {
      return res.status(404).json({ message: "Production not found" });
    }

    // Get related data
    const [content, editor, socialPosts] = await Promise.all([
      production.content_id ? Content.findOne({ content_id: production.content_id }).lean() : null,
      production.editor_id ? Employee.findOne({ employee_id: production.editor_id }).lean() : null,
      SocialMedia.find({ content_id: production.content_id }).lean()
    ]);

    const enrichedProduction = {
      ...production,
      content_info: content,
      editor_info: editor,
      social_posts: socialPosts
    };

    res.json(enrichedProduction);
  } catch (err) {
    next(err);
  }
});

// Create production
router.post("/", authRequired, requirePerm('content.production'), async (req, res, next) => {
  try {
    const {
      content_id,
      editor_id,
      production_status,
      completion_date,
      sent_to_social_team,
      notes
    } = req.body;

    if (!content_id) {
      return res.status(400).json({ message: "Content ID is required" });
    }

    // Validate content exists
    const content = await Content.findOne({ content_id });
    if (!content) {
      return res.status(400).json({ message: "Invalid content ID" });
    }

    // Validate editor if provided
    if (editor_id) {
      const editor = await Employee.findOne({ employee_id: editor_id });
      if (!editor) {
        return res.status(400).json({ message: "Invalid editor" });
      }
    }

    const production = await Production.create({
      content_id,
      editor_id: editor_id || null,
      production_status: production_status || "Editing",
      completion_date: completion_date ? new Date(completion_date) : null,
      sent_to_social_team: sent_to_social_team || false,
      notes
    });

    // Notify assigned editor
    if (editor_id) {
      const editorUser = await User.findOne({ employee_id: editor_id });
      if (editorUser) {
        await Notification.create({
          user_id: editorUser.user_id,
          title: "New Production Assignment",
          message: `You have been assigned to edit production #${production.production_id}`,
          type: "production_assignment"
        });
      }
    }

    res.status(201).json(production);
  } catch (err) {
    next(err);
  }
});

// Update production
router.put("/:id", authRequired, requirePerm('content.production'), async (req, res, next) => {
  try {
    const productionId = Number(req.params.id);
    const {
      content_id,
      editor_id,
      production_status,
      completion_date,
      sent_to_social_team,
      notes
    } = req.body;

    const production = await Production.findOne({ production_id: productionId });
    if (!production) {
      return res.status(404).json({ message: "Production not found" });
    }

    // Validate content if changing
    if (content_id !== undefined && content_id !== production.content_id) {
      if (content_id) {
        const content = await Content.findOne({ content_id });
        if (!content) {
          return res.status(400).json({ message: "Invalid content ID" });
        }
      }
    }

    // Validate editor if changing
    if (editor_id !== undefined && editor_id !== production.editor_id) {
      if (editor_id) {
        const editor = await Employee.findOne({ employee_id: editor_id });
        if (!editor) {
          return res.status(400).json({ message: "Invalid editor" });
        }
      }
    }

    const updates = {};
    if (content_id !== undefined) updates.content_id = content_id;
    if (editor_id !== undefined) updates.editor_id = editor_id;
    if (production_status !== undefined) updates.production_status = production_status;
    if (completion_date !== undefined) updates.completion_date = completion_date ? new Date(completion_date) : null;
    if (sent_to_social_team !== undefined) updates.sent_to_social_team = sent_to_social_team;
    if (notes !== undefined) updates.notes = notes;

    const updatedProduction = await Production.findOneAndUpdate(
      { production_id: productionId },
      updates,
      { new: true }
    );

    // Send notifications for important changes
    if (editor_id && editor_id !== production.editor_id) {
      const editorUser = await User.findOne({ employee_id: editor_id });
      if (editorUser) {
        await Notification.create({
          user_id: editorUser.user_id,
          title: "Production Reassigned",
          message: `Production #${productionId} has been assigned to you`,
          type: "production_assignment"
        });
      }
    }

    if (production_status && production_status !== production.production_status) {
      if (production.editor_id) {
        const editorUser = await User.findOne({ employee_id: production.editor_id });
        if (editorUser) {
          await Notification.create({
            user_id: editorUser.user_id,
            title: "Production Status Updated",
            message: `Production #${productionId} status changed to: ${production_status}`,
            type: "production_update"
          });
        }
      }
    }

    if (sent_to_social_team && !production.sent_to_social_team) {
      // Notify social media team (you might want to implement a social media team role)
      // For now, we'll just update the flag
    }

    res.json(updatedProduction);
  } catch (err) {
    next(err);
  }
});

// Delete production
router.delete("/:id", authRequired, requirePerm('content.production'), async (req, res, next) => {
  try {
    const productionId = Number(req.params.id);
    
    const deleted = await Production.findOneAndDelete({ production_id: productionId });
    if (!deleted) {
      return res.status(404).json({ message: "Production not found" });
    }

    res.json({ message: "Production deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// Get productions for specific content
router.get("/content/:contentId", authRequired, requirePerm('content.production'), async (req, res, next) => {
  try {
    const contentId = Number(req.params.contentId);
    
    const productions = await Production.find({ content_id: contentId })
      .sort({ createdAt: -1 })
      .lean();

    // Get editor details
    const editorIds = [...new Set(productions.map(p => p.editor_id).filter(Boolean))];
    const editors = await Employee.find({ employee_id: { $in: editorIds } })
      .select('employee_id name').lean();
    const editorMap = new Map(editors.map(e => [e.employee_id, e]));

    const enrichedProductions = productions.map(production => ({
      ...production,
      editor_info: editorMap.get(production.editor_id) || null
    }));

    res.json(enrichedProductions);
  } catch (err) {
    next(err);
  }
});

// Get my productions (productions assigned to current user)
router.get("/my/productions", authRequired, requirePerm('content.production'), async (req, res, next) => {
  try {
    // Get current user's employee_id
    const user = await User.findOne({ user_id: req.user.user_id });
    if (!user || !user.employee_id) {
      return res.json([]);
    }

    const { status } = req.query;
    const filters = { editor_id: user.employee_id };
    if (status) filters.production_status = status;

    const productions = await Production.find(filters)
      .sort({ updatedAt: -1 })
      .lean();

    // Get content details
    const contentIds = [...new Set(productions.map(p => p.content_id).filter(Boolean))];
    const content = await Content.find({ content_id: { $in: contentIds } }).lean();
    const contentMap = new Map(content.map(c => [c.content_id, c]));

    const enrichedProductions = productions.map(production => ({
      ...production,
      content_info: contentMap.get(production.content_id) || null
    }));

    res.json(enrichedProductions);
  } catch (err) {
    next(err);
  }
});

// Mark production as complete
router.put("/:id/complete", authRequired, requirePerm('content.production'), async (req, res, next) => {
  try {
    const productionId = Number(req.params.id);
    
    const production = await Production.findOne({ production_id: productionId });
    if (!production) {
      return res.status(404).json({ message: "Production not found" });
    }

    const updatedProduction = await Production.findOneAndUpdate(
      { production_id: productionId },
      { 
        production_status: 'Completed',
        completion_date: new Date()
      },
      { new: true }
    );

    // Notify relevant parties
    if (production.editor_id) {
      const editorUser = await User.findOne({ employee_id: production.editor_id });
      if (editorUser) {
        await Notification.create({
          user_id: editorUser.user_id,
          title: "Production Completed",
          message: `Production #${productionId} has been marked as completed`,
          type: "production_completed"
        });
      }
    }

    res.json(updatedProduction);
  } catch (err) {
    next(err);
  }
});

// Send to social team
router.put("/:id/send-to-social", authRequired, requirePerm('content.production'), async (req, res, next) => {
  try {
    const productionId = Number(req.params.id);
    
    const production = await Production.findOne({ production_id: productionId });
    if (!production) {
      return res.status(404).json({ message: "Production not found" });
    }

    if (production.production_status !== 'Completed') {
      return res.status(400).json({ message: "Production must be completed before sending to social team" });
    }

    const updatedProduction = await Production.findOneAndUpdate(
      { production_id: productionId },
      { sent_to_social_team: true },
      { new: true }
    );

    // Here you could notify the social media team
    // For now, we'll just update the flag

    res.json(updatedProduction);
  } catch (err) {
    next(err);
  }
});

// Get production statistics
router.get("/stats/overview", authRequired, requirePerm('content.production'), async (req, res, next) => {
  try {
    const { editor_id, date_from, date_to } = req.query;
    
    let matchFilter = {};
    if (editor_id) matchFilter.editor_id = Number(editor_id);
    
    if (date_from || date_to) {
      matchFilter.createdAt = {};
      if (date_from) matchFilter.createdAt.$gte = new Date(date_from);
      if (date_to) matchFilter.createdAt.$lte = new Date(date_to);
    }

    const stats = await Production.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          editing: { $sum: { $cond: [{ $eq: ["$production_status", "Editing"] }, 1, 0] } },
          review: { $sum: { $cond: [{ $eq: ["$production_status", "Review"] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ["$production_status", "Completed"] }, 1, 0] } },
          sent_to_social: { $sum: { $cond: ["$sent_to_social_team", 1, 0] } },
          with_completion_date: { $sum: { $cond: [{ $ne: ["$completion_date", null] }, 1, 0] } }
        }
      }
    ]);

    const result = stats[0] || {
      total: 0,
      editing: 0,
      review: 0,
      completed: 0,
      sent_to_social: 0,
      with_completion_date: 0
    };

    // Add calculated metrics
    result.completion_rate = result.total > 0 ? 
      ((result.completed / result.total) * 100).toFixed(2) : "0.00";
    result.social_delivery_rate = result.completed > 0 ? 
      ((result.sent_to_social / result.completed) * 100).toFixed(2) : "0.00";

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
