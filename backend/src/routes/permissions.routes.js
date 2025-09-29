import express from "express";
import { Permission } from "../models/permissions.js";
import { User } from "../models/users.js";
import { Employee } from "../models/employees.js";
import { authRequired, requirePerm } from "../middleware/auth.js";

const router = express.Router();

// Get permissions with filtering (admin only)
router.get("/", authRequired, requirePerm('management.permissions'), async (req, res, next) => {
  try {
    const {
      user_id,
      page_name,
      can_access,
      page = 1,
      limit = 50
    } = req.query;

    // Build filters
    const filters = {};
    if (user_id) filters.user_id = Number(user_id);
    if (page_name) filters.page_name = page_name;
    if (can_access !== undefined) filters.can_access = can_access === 'true';

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const [permissions, total] = await Promise.all([
      Permission.find(filters)
        .sort({ user_id: 1, page_name: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Permission.countDocuments(filters)
    ]);

    // Get user details
    const userIds = [...new Set(permissions.map(p => p.user_id))];
    const users = await User.find({ user_id: { $in: userIds } })
      .select('user_id username employee_id').lean();
    const userMap = new Map(users.map(u => [u.user_id, u]));

    // Get employee details
    const employeeIds = users.map(u => u.employee_id).filter(Boolean);
    const employees = await Employee.find({ employee_id: { $in: employeeIds } })
      .select('employee_id name').lean();
    const employeeMap = new Map(employees.map(e => [e.employee_id, e]));

    // Enrich permissions
    const enrichedPermissions = permissions.map(permission => {
      const user = userMap.get(permission.user_id);
      return {
        ...permission,
        user_info: user ? {
          ...user,
          employee_name: user.employee_id ? employeeMap.get(user.employee_id)?.name : null
        } : null
      };
    });

    res.json({
      permissions: enrichedPermissions,
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

// Get permissions for a specific user (admin only)
router.get("/user/:userId", authRequired, requirePerm('management.permissions'), async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    
    // Validate user exists
    const user = await User.findOne({ user_id: userId }).select('user_id username').lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const permissions = await Permission.find({ user_id: userId })
      .sort({ page_name: 1 })
      .lean();

    res.json({
      user_info: user,
      permissions
    });
  } catch (err) {
    next(err);
  }
});

// Get available pages/permissions (admin only)
router.get("/pages/available", authRequired, requirePerm('management.permissions'), async (req, res, next) => {
  try {
    // Define available pages/permissions
    const availablePages = [
      'dashboard',
      'profile',
      'tasks',
      'employees', 
      'departments',
      'sections',
      'tickets',
      'follow_ups',
      'reviews',
      'ideas',
      'content',
      'production',
      'social_media',
      'analytics',
      'admin'
    ];

    // Get usage statistics for each page
    const pageStats = await Permission.aggregate([
      {
        $group: {
          _id: "$page_name",
          total_users: { $sum: 1 },
          granted_users: { $sum: { $cond: ["$can_access", 1, 0] } }
        }
      }
    ]);

    const pageStatsMap = new Map(pageStats.map(ps => [ps._id, ps]));

    const pagesWithStats = availablePages.map(page => ({
      page_name: page,
      total_users: pageStatsMap.get(page)?.total_users || 0,
      granted_users: pageStatsMap.get(page)?.granted_users || 0
    }));

    res.json({
      available_pages: pagesWithStats
    });
  } catch (err) {
    next(err);
  }
});

// Create or update permission (admin only)
router.post("/", authRequired, requirePerm('management.permissions'), async (req, res, next) => {
  try {
    const { user_id, page_name, can_access } = req.body;
    
    if (!user_id || !page_name || can_access === undefined) {
      return res.status(400).json({ message: "user_id, page_name, and can_access are required" });
    }

    // Validate user exists
    const user = await User.findOne({ user_id });
    if (!user) {
      return res.status(400).json({ message: "Invalid user_id" });
    }

    // Create or update permission
    const permission = await Permission.findOneAndUpdate(
      { user_id, page_name },
      { can_access },
      { upsert: true, new: true }
    );

    res.status(201).json(permission);
  } catch (err) {
    next(err);
  }
});

// Bulk update permissions for a user (admin only)
router.put("/user/:userId/bulk", authRequired, requirePerm('management.permissions'), async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    const { permissions } = req.body;
    
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: "permissions must be an array" });
    }

    // Validate user exists
    const user = await User.findOne({ user_id: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate permission format
    for (const perm of permissions) {
      if (!perm.page_name || perm.can_access === undefined) {
        return res.status(400).json({ message: "Each permission must have page_name and can_access" });
      }
    }

    // Update permissions
    const updateOperations = permissions.map(perm => ({
      updateOne: {
        filter: { user_id: userId, page_name: perm.page_name },
        update: { can_access: perm.can_access },
        upsert: true
      }
    }));

    await Permission.bulkWrite(updateOperations);

    // Return updated permissions
    const updatedPermissions = await Permission.find({ user_id: userId })
      .sort({ page_name: 1 })
      .lean();

    res.json({
      message: `Updated ${permissions.length} permissions for user ${userId}`,
      permissions: updatedPermissions
    });
  } catch (err) {
    next(err);
  }
});

// Update single permission (admin only)
router.put("/:id", authRequired, requirePerm('management.permissions'), async (req, res, next) => {
  try {
    const permissionId = Number(req.params.id);
    const { can_access } = req.body;
    
    if (can_access === undefined) {
      return res.status(400).json({ message: "can_access is required" });
    }

    const permission = await Permission.findOneAndUpdate(
      { permission_id: permissionId },
      { can_access },
      { new: true }
    );

    if (!permission) {
      return res.status(404).json({ message: "Permission not found" });
    }

    res.json(permission);
  } catch (err) {
    next(err);
  }
});

// Delete permission (admin only)
router.delete("/:id", authRequired, requirePerm('management.permissions'), async (req, res, next) => {
  try {
    const permissionId = Number(req.params.id);
    
    const deleted = await Permission.findOneAndDelete({ permission_id: permissionId });
    if (!deleted) {
      return res.status(404).json({ message: "Permission not found" });
    }

    res.json({ message: "Permission deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// Copy permissions from one user to another (admin only)
router.post("/copy", authRequired, requirePerm('management.permissions'), async (req, res, next) => {
  try {
    const { from_user_id, to_user_id, overwrite = false } = req.body;
    
    if (!from_user_id || !to_user_id) {
      return res.status(400).json({ message: "from_user_id and to_user_id are required" });
    }

    // Validate both users exist
    const [fromUser, toUser] = await Promise.all([
      User.findOne({ user_id: from_user_id }),
      User.findOne({ user_id: to_user_id })
    ]);

    if (!fromUser) {
      return res.status(400).json({ message: "Source user not found" });
    }
    if (!toUser) {
      return res.status(400).json({ message: "Target user not found" });
    }

    // Get source user permissions
    const sourcePermissions = await Permission.find({ user_id: from_user_id }).lean();
    
    if (sourcePermissions.length === 0) {
      return res.status(400).json({ message: "Source user has no permissions to copy" });
    }

    // If overwrite is true, delete existing permissions for target user
    if (overwrite) {
      await Permission.deleteMany({ user_id: to_user_id });
    }

    // Create new permissions for target user
    const newPermissions = sourcePermissions.map(perm => ({
      user_id: to_user_id,
      page_name: perm.page_name,
      can_access: perm.can_access
    }));

    // Use upsert to avoid conflicts
    const updateOperations = newPermissions.map(perm => ({
      updateOne: {
        filter: { user_id: perm.user_id, page_name: perm.page_name },
        update: { can_access: perm.can_access },
        upsert: true
      }
    }));

    await Permission.bulkWrite(updateOperations);

    // Return copied permissions
    const copiedPermissions = await Permission.find({ user_id: to_user_id })
      .sort({ page_name: 1 })
      .lean();

    res.json({
      message: `Copied ${sourcePermissions.length} permissions from user ${from_user_id} to user ${to_user_id}`,
      permissions: copiedPermissions
    });
  } catch (err) {
    next(err);
  }
});

// Get permission statistics (admin only)
router.get("/stats/overview", authRequired, requirePerm('management.permissions'), async (req, res, next) => {
  try {
    const stats = await Permission.aggregate([
      {
        $group: {
          _id: null,
          total_permissions: { $sum: 1 },
          granted_permissions: { $sum: { $cond: ["$can_access", 1, 0] } },
          denied_permissions: { $sum: { $cond: [{ $not: "$can_access" }, 1, 0] } }
        }
      }
    ]);

    // Get permission distribution by page
    const pageDistribution = await Permission.aggregate([
      {
        $group: {
          _id: "$page_name",
          total: { $sum: 1 },
          granted: { $sum: { $cond: ["$can_access", 1, 0] } }
        }
      },
      {
        $addFields: {
          grant_rate: {
            $cond: [
              { $eq: ["$total", 0] },
              0,
              { $multiply: [{ $divide: ["$granted", "$total"] }, 100] }
            ]
          }
        }
      },
      { $sort: { granted: -1 } }
    ]);

    // Get users with most permissions
    const userPermissions = await Permission.aggregate([
      { $match: { can_access: true } },
      {
        $group: {
          _id: "$user_id",
          permission_count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "user_id",
          as: "user"
        }
      },
      {
        $project: {
          user_id: "$_id",
          permission_count: 1,
          username: { $arrayElemAt: ["$user.username", 0] }
        }
      },
      { $sort: { permission_count: -1 } },
      { $limit: 10 }
    ]);

    const result = stats[0] || {
      total_permissions: 0,
      granted_permissions: 0,
      denied_permissions: 0
    };

    // Add calculated metrics
    result.grant_rate = result.total_permissions > 0 ? 
      ((result.granted_permissions / result.total_permissions) * 100).toFixed(2) : "0.00";

    result.page_distribution = pageDistribution;
    result.top_users = userPermissions;

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
