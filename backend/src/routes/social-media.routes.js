import express from "express";
import { SocialMedia } from "../models/social_media.js";
import { Content } from "../models/content.js";
import { Production } from "../models/production.js";
import { User } from "../models/users.js";
import { Notification } from "../models/notifications.js";
import { authRequired, requirePerm } from "../middleware/auth.js";

const router = express.Router();

// Get social media posts with filtering and pagination
router.get("/", authRequired, requirePerm('content.social'), async (req, res, next) => {
  try {
    const {
      content_id,
      platforms,
      post_type,
      status,
      approved,
      post_date_from,
      post_date_to,
      search,
      page = 1,
      limit = 20,
      sort_by = 'createdAt',
      sort_order = 'desc'
    } = req.query;

    // Build filters
    const filters = {};
    if (content_id) filters.content_id = Number(content_id);
    if (platforms) filters.platforms = platforms;
    if (post_type) filters.post_type = post_type;
    if (status) filters.status = status;
    if (approved !== undefined) filters.approved = approved === 'true';
    
    // Post date range filtering
    if (post_date_from || post_date_to) {
      filters.post_date = {};
      if (post_date_from) filters.post_date.$gte = new Date(post_date_from);
      if (post_date_to) filters.post_date.$lte = new Date(post_date_to);
    }

    // Search in caption
    if (search) {
      filters.$or = [
        { caption: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
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
    const [posts, total] = await Promise.all([
      SocialMedia.find(filters)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      SocialMedia.countDocuments(filters)
    ]);

    // Get content details
    const contentIds = [...new Set(posts.map(p => p.content_id).filter(Boolean))];
    const content = await Content.find({ content_id: { $in: contentIds } }).lean();
    const contentMap = new Map(content.map(c => [c.content_id, c]));

    // Enrich posts
    const enrichedPosts = posts.map(post => ({
      ...post,
      content_info: contentMap.get(post.content_id) || null
    }));

    res.json({
      posts: enrichedPosts,
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

// Get single social media post with full details
router.get("/:id", authRequired, requirePerm('content.social'), async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    const post = await SocialMedia.findOne({ post_id: postId }).lean();
    
    if (!post) {
      return res.status(404).json({ message: "Social media post not found" });
    }

    // Get content and production details
    const [content, production] = await Promise.all([
      post.content_id ? Content.findOne({ content_id: post.content_id }).lean() : null,
      post.content_id ? Production.findOne({ content_id: post.content_id }).lean() : null
    ]);

    const enrichedPost = {
      ...post,
      content_info: content,
      production_info: production
    };

    res.json(enrichedPost);
  } catch (err) {
    next(err);
  }
});

// Create social media post
router.post("/", authRequired, requirePerm('content.social'), async (req, res, next) => {
  try {
    const {
      content_id,
      platforms,
      post_type,
      post_date,
      caption,
      status,
      approved,
      notes
    } = req.body;

    // Validate content if provided
    if (content_id) {
      const content = await Content.findOne({ content_id });
      if (!content) {
        return res.status(400).json({ message: "Invalid content ID" });
      }

      // Check if content has completed production
      const production = await Production.findOne({ content_id });
      if (!production || production.production_status !== 'Completed') {
        return res.status(400).json({ message: "Content must have completed production before creating social media posts" });
      }
    }

    const post = await SocialMedia.create({
      content_id: content_id || null,
      platforms: platforms || '',
      post_type: post_type || '',
      post_date: post_date ? new Date(post_date) : null,
      caption: caption || '',
      status: status || "Draft",
      approved: approved || false,
      notes: notes || ''
    });

    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
});

// Update social media post
router.put("/:id", authRequired, requirePerm('content.social'), async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    const {
      content_id,
      platforms,
      post_type,
      post_date,
      caption,
      status,
      approved,
      notes
    } = req.body;

    const post = await SocialMedia.findOne({ post_id: postId });
    if (!post) {
      return res.status(404).json({ message: "Social media post not found" });
    }

    // Validate content if changing
    if (content_id !== undefined && content_id !== post.content_id) {
      if (content_id) {
        const content = await Content.findOne({ content_id });
        if (!content) {
          return res.status(400).json({ message: "Invalid content ID" });
        }

        const production = await Production.findOne({ content_id });
        if (!production || production.production_status !== 'Completed') {
          return res.status(400).json({ message: "Content must have completed production" });
        }
      }
    }

    const updates = {};
    if (content_id !== undefined) updates.content_id = content_id;
    if (platforms !== undefined) updates.platforms = platforms;
    if (post_type !== undefined) updates.post_type = post_type;
    if (post_date !== undefined) updates.post_date = post_date ? new Date(post_date) : null;
    if (caption !== undefined) updates.caption = caption;
    if (status !== undefined) updates.status = status;
    if (approved !== undefined) updates.approved = approved;
    if (notes !== undefined) updates.notes = notes;

    const updatedPost = await SocialMedia.findOneAndUpdate(
      { post_id: postId },
      updates,
      { new: true }
    );

    // Send notification if post was approved
    if (approved && !post.approved) {
      // You might want to notify the content creator or social media team
      // For now, we'll just update the status
    }

    res.json(updatedPost);
  } catch (err) {
    next(err);
  }
});

// Delete social media post
router.delete("/:id", authRequired, requirePerm('content.social'), async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    
    const deleted = await SocialMedia.findOneAndDelete({ post_id: postId });
    if (!deleted) {
      return res.status(404).json({ message: "Social media post not found" });
    }

    res.json({ message: "Social media post deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// Get social media posts for specific content
router.get("/content/:contentId", authRequired, requirePerm('content.social'), async (req, res, next) => {
  try {
    const contentId = Number(req.params.contentId);
    
    const posts = await SocialMedia.find({ content_id: contentId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(posts);
  } catch (err) {
    next(err);
  }
});

// Get posts by platform
router.get("/platform/:platform", authRequired, requirePerm('content.social'), async (req, res, next) => {
  try {
    const platform = req.params.platform;
    const { status, approved } = req.query;
    
    const filters = { platforms: { $regex: platform, $options: 'i' } };
    if (status) filters.status = status;
    if (approved !== undefined) filters.approved = approved === 'true';

    const posts = await SocialMedia.find(filters)
      .sort({ post_date: -1 })
      .lean();

    // Get content details
    const contentIds = [...new Set(posts.map(p => p.content_id).filter(Boolean))];
    const content = await Content.find({ content_id: { $in: contentIds } }).lean();
    const contentMap = new Map(content.map(c => [c.content_id, c]));

    const enrichedPosts = posts.map(post => ({
      ...post,
      content_info: contentMap.get(post.content_id) || null
    }));

    res.json(enrichedPosts);
  } catch (err) {
    next(err);
  }
});

// Get posts scheduled for today
router.get("/schedule/today", authRequired, requirePerm('content.social'), async (req, res, next) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const posts = await SocialMedia.find({
      post_date: {
        $gte: startOfDay,
        $lt: endOfDay
      },
      status: { $ne: 'Published' }
    }).sort({ post_date: 1 }).lean();

    // Get content details
    const contentIds = [...new Set(posts.map(p => p.content_id).filter(Boolean))];
    const content = await Content.find({ content_id: { $in: contentIds } }).lean();
    const contentMap = new Map(content.map(c => [c.content_id, c]));

    const enrichedPosts = posts.map(post => ({
      ...post,
      content_info: contentMap.get(post.content_id) || null
    }));

    res.json(enrichedPosts);
  } catch (err) {
    next(err);
  }
});

// Approve post
router.put("/:id/approve", authRequired, requirePerm('content.social'), async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    
    const post = await SocialMedia.findOne({ post_id: postId });
    if (!post) {
      return res.status(404).json({ message: "Social media post not found" });
    }

    const updatedPost = await SocialMedia.findOneAndUpdate(
      { post_id: postId },
      { approved: true, status: 'Approved' },
      { new: true }
    );

    res.json(updatedPost);
  } catch (err) {
    next(err);
  }
});

// Publish post
router.put("/:id/publish", authRequired, requirePerm('content.social'), async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    
    const post = await SocialMedia.findOne({ post_id: postId });
    if (!post) {
      return res.status(404).json({ message: "Social media post not found" });
    }

    if (!post.approved) {
      return res.status(400).json({ message: "Post must be approved before publishing" });
    }

    const updatedPost = await SocialMedia.findOneAndUpdate(
      { post_id: postId },
      { status: 'Published', post_date: new Date() },
      { new: true }
    );

    res.json(updatedPost);
  } catch (err) {
    next(err);
  }
});

// Get social media statistics
router.get("/stats/overview", authRequired, requirePerm('content.social'), async (req, res, next) => {
  try {
    const { date_from, date_to, platform } = req.query;
    
    let matchFilter = {};
    
    if (date_from || date_to) {
      matchFilter.post_date = {};
      if (date_from) matchFilter.post_date.$gte = new Date(date_from);
      if (date_to) matchFilter.post_date.$lte = new Date(date_to);
    }

    if (platform) {
      matchFilter.platforms = { $regex: platform, $options: 'i' };
    }

    const stats = await SocialMedia.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          draft: { $sum: { $cond: [{ $eq: ["$status", "Draft"] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] } },
          published: { $sum: { $cond: [{ $eq: ["$status", "Published"] }, 1, 0] } },
          scheduled: { $sum: { $cond: [{ $eq: ["$status", "Scheduled"] }, 1, 0] } },
          approved_count: { $sum: { $cond: ["$approved", 1, 0] } }
        }
      }
    ]);

    // Get platform distribution
    const platformStats = await SocialMedia.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$platforms",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get post type distribution
    const typeStats = await SocialMedia.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$post_type",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const result = stats[0] || {
      total: 0,
      draft: 0,
      approved: 0,
      published: 0,
      scheduled: 0,
      approved_count: 0
    };

    // Add calculated metrics
    result.approval_rate = result.total > 0 ? 
      ((result.approved_count / result.total) * 100).toFixed(2) : "0.00";
    result.publish_rate = result.total > 0 ? 
      ((result.published / result.total) * 100).toFixed(2) : "0.00";

    result.platform_distribution = platformStats;
    result.type_distribution = typeStats;

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Get content workflow status (idea -> content -> production -> social)
router.get("/workflow/:contentId", authRequired, requirePerm('content.social'), async (req, res, next) => {
  try {
    const contentId = Number(req.params.contentId);
    
    // Get the complete workflow status
    const [content, production, socialPosts] = await Promise.all([
      Content.findOne({ content_id: contentId }).lean(),
      Production.findOne({ content_id: contentId }).lean(),
      SocialMedia.find({ content_id: contentId }).lean()
    ]);

    if (!content) {
      return res.status(404).json({ message: "Content not found" });
    }

    // Get idea details if linked
    const idea = content.idea_id ? 
      await Idea.findOne({ idea_id: content.idea_id }).lean() : null;

    const workflow = {
      idea: idea ? {
        id: idea.idea_id,
        title: idea.title,
        status: idea.status,
        contributor: idea.contributor
      } : null,
      content: {
        id: content.content_id,
        content_date: content.content_date,
        filming_date: content.filming_date,
        script_writer: content.script_writer_employee_id,
        director: content.director_employee_id,
        cast: content.cast_and_presenters
      },
      production: production ? {
        id: production.production_id,
        status: production.production_status,
        editor: production.editor_id,
        completion_date: production.completion_date,
        sent_to_social_team: production.sent_to_social_team
      } : null,
      social_media: socialPosts.map(post => ({
        id: post.post_id,
        platforms: post.platforms,
        post_type: post.post_type,
        status: post.status,
        approved: post.approved,
        post_date: post.post_date
      }))
    };

    res.json(workflow);
  } catch (err) {
    next(err);
  }
});

export default router;
