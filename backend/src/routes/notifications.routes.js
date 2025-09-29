import express from "express";
import { Notification } from "../models/notifications.js";
import { User } from "../models/users.js";
import { authRequired, requirePerm } from "../middleware/auth.js";

const router = express.Router();

// Get notifications for current user
router.get("/", authRequired, async (req, res, next) => {
  try {
    const {
      is_read,
      type,
      page = 1,
      limit = 20,
      sort_by = 'createdAt',
      sort_order = 'desc'
    } = req.query;

    // Build filters
    const filters = { user_id: req.user.user_id };
    if (is_read !== undefined) filters.is_read = is_read === 'true';
    if (type) filters.type = type;

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sortObj = {};
    sortObj[sort_by] = sort_order === 'asc' ? 1 : -1;

    // Execute query
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filters)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Notification.countDocuments(filters),
      Notification.countDocuments({ user_id: req.user.user_id, is_read: false })
    ]);

    res.json({
      notifications,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      unread_count: unreadCount
    });
  } catch (err) {
    next(err);
  }
});

// Get single notification
router.get("/:id", authRequired, async (req, res, next) => {
  try {
    const notificationId = Number(req.params.id);
    const notification = await Notification.findOne({ 
      notification_id: notificationId,
      user_id: req.user.user_id
    }).lean();
    
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json(notification);
  } catch (err) {
    next(err);
  }
});

// Create notification (admin only)
router.post("/", authRequired, requirePerm('operations.notifications'), async (req, res, next) => {
  try {
    const { user_id, title, message, type } = req.body;
    
    if (!user_id || !title || !message) {
      return res.status(400).json({ message: "user_id, title, and message are required" });
    }

    // Validate user exists
    const user = await User.findOne({ user_id });
    if (!user) {
      return res.status(400).json({ message: "Invalid user_id" });
    }

    const notification = await Notification.create({
      user_id,
      title,
      message,
      type: type || 'system'
    });

    res.status(201).json(notification);
  } catch (err) {
    next(err);
  }
});

// Broadcast notification to all users (admin only)
router.post("/broadcast", authRequired, requirePerm('operations.notifications'), async (req, res, next) => {
  try {
    const { title, message, type, user_filter } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ message: "title and message are required" });
    }

    // Get users based on filter
    let userFilter = {};
    if (user_filter) {
      if (user_filter.status) userFilter.status = user_filter.status;
      if (user_filter.employee_id) userFilter.employee_id = { $ne: null };
    }

    const users = await User.find(userFilter).select('user_id').lean();
    
    if (users.length === 0) {
      return res.status(400).json({ message: "No users found matching filter" });
    }

    // Create notifications for all users
    const notifications = users.map(user => ({
      user_id: user.user_id,
      title,
      message,
      type: type || 'system'
    }));

    const createdNotifications = await Notification.insertMany(notifications);
    
    res.status(201).json({
      message: `Broadcast sent to ${users.length} users`,
      notifications_created: createdNotifications.length
    });
  } catch (err) {
    next(err);
  }
});

// Mark notification as read
router.put("/:id/read", authRequired, async (req, res, next) => {
  try {
    const notificationId = Number(req.params.id);
    
    const notification = await Notification.findOneAndUpdate(
      { 
        notification_id: notificationId,
        user_id: req.user.user_id
      },
      { is_read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json(notification);
  } catch (err) {
    next(err);
  }
});

// Mark notification as unread
router.put("/:id/unread", authRequired, async (req, res, next) => {
  try {
    const notificationId = Number(req.params.id);
    
    const notification = await Notification.findOneAndUpdate(
      { 
        notification_id: notificationId,
        user_id: req.user.user_id
      },
      { is_read: false },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json(notification);
  } catch (err) {
    next(err);
  }
});

// Mark all notifications as read
router.put("/mark-all-read", authRequired, async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { user_id: req.user.user_id, is_read: false },
      { is_read: true }
    );

    res.json({ 
      message: `Marked ${result.modifiedCount} notifications as read` 
    });
  } catch (err) {
    next(err);
  }
});

// Delete notification
router.delete("/:id", authRequired, async (req, res, next) => {
  try {
    const notificationId = Number(req.params.id);
    
    const deleted = await Notification.findOneAndDelete({ 
      notification_id: notificationId,
      user_id: req.user.user_id
    });

    if (!deleted) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: "Notification deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// Delete all read notifications
router.delete("/cleanup/read", authRequired, async (req, res, next) => {
  try {
    const result = await Notification.deleteMany({
      user_id: req.user.user_id,
      is_read: true
    });

    res.json({ 
      message: `Deleted ${result.deletedCount} read notifications` 
    });
  } catch (err) {
    next(err);
  }
});

// Get unread count
router.get("/count/unread", authRequired, async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      user_id: req.user.user_id,
      is_read: false
    });

    res.json({ unread_count: count });
  } catch (err) {
    next(err);
  }
});

// Get notifications by type
router.get("/type/:type", authRequired, async (req, res, next) => {
  try {
    const type = req.params.type;
    const { is_read, limit = 10 } = req.query;
    
    const filters = { 
      user_id: req.user.user_id,
      type: type
    };
    
    if (is_read !== undefined) filters.is_read = is_read === 'true';

    const notifications = await Notification.find(filters)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

// Get recent notifications (last 24 hours)
router.get("/recent/today", authRequired, async (req, res, next) => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const notifications = await Notification.find({
      user_id: req.user.user_id,
      createdAt: { $gte: yesterday }
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

    const unreadCount = notifications.filter(n => !n.is_read).length;

    res.json({
      notifications,
      unread_count: unreadCount,
      total_recent: notifications.length
    });
  } catch (err) {
    next(err);
  }
});

// Get notification statistics (admin only)
router.get("/stats/overview", authRequired, requirePerm('operations.notifications'), async (req, res, next) => {
  try {
    const { date_from, date_to, type } = req.query;
    
    let matchFilter = {};
    
    if (date_from || date_to) {
      matchFilter.createdAt = {};
      if (date_from) matchFilter.createdAt.$gte = new Date(date_from);
      if (date_to) matchFilter.createdAt.$lte = new Date(date_to);
    }

    if (type) matchFilter.type = type;

    const stats = await Notification.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          read: { $sum: { $cond: ["$is_read", 1, 0] } },
          unread: { $sum: { $cond: [{ $not: "$is_read" }, 1, 0] } },
          by_type: {
            $push: "$type"
          }
        }
      }
    ]);

    // Get type distribution
    const typeStats = await Notification.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          read_count: { $sum: { $cond: ["$is_read", 1, 0] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const result = stats[0] || {
      total: 0,
      read: 0,
      unread: 0
    };

    // Add calculated metrics
    result.read_rate = result.total > 0 ? 
      ((result.read / result.total) * 100).toFixed(2) : "0.00";
    result.type_distribution = typeStats;

    // Remove the array to clean up response
    delete result.by_type;

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
