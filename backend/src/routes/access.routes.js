import express from 'express';
import { Permission } from '../models/permissions.js';
import { Role } from '../models/roles.js';
import { UserAccess } from '../models/user_access.js';
import { User } from '../models/users.js';
import { Department } from '../models/departments.js';
import { Section } from '../models/sections.js';
import { accessUpdate } from '../validation/schemas.js';
import { authRequired, requirePerm } from '../middleware/auth.js';
import { getPageAccessRestrictions } from '../utils/access.js';

const router = express.Router();

// All routes require authentication and settings.access.manage permission
router.use(authRequired);
router.use(requirePerm('settings.access.manage'));

/**
 * GET /api/access/permissions
 * Get all available permissions
 */
router.get('/permissions', async (req, res, next) => {
  try {
    const permissions = await Permission.find({})
      .select('key label group description')
      .sort({ group: 1, key: 1 })
      .lean();

    res.json({
      ok: true,
      data: permissions
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/access/roles
 * Get all role presets
 */
router.get('/roles', async (req, res, next) => {
  try {
    const roles = await Role.find({})
      .select('key label description permissions')
      .sort({ key: 1 })
      .lean();

    res.json({
      ok: true,
      data: roles
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/access/users/:userId
 * Get access configuration for a specific user
 */
router.get('/users/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Verify user exists
    const user = await User.findById(userId).select('username email').lean();
    if (!user) {
      return res.status(404).json({
        ok: false,
        error: { message: 'User not found' }
      });
    }

    // Get user access configuration with populated department/section restrictions
    const userAccess = await UserAccess.findOne({ userId })
      .populate('departmentRestrictions', 'name')
      .populate('sectionRestrictions', 'name')
      .lean();

    const accessConfig = userAccess || {
      userId,
      roles: [],
      permsExtra: [],
      permsDenied: [],
      homeRoute: undefined,
      pageAccess: [],
      departmentRestrictions: [],
      sectionRestrictions: []
    };

    res.json({
      ok: true,
      data: {
        user,
        access: accessConfig
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/access/users/:userId
 * Update access configuration for a specific user
 */
router.post('/users/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const validatedData = accessUpdate.parse(req.body);

    // Verify user exists
    const user = await User.findById(userId).select('username email').lean();
    if (!user) {
      return res.status(404).json({
        ok: false,
        error: { message: 'User not found' }
      });
    }

    // Validate that all roles exist
    if (validatedData.roles && validatedData.roles.length > 0) {
      const existingRoles = await Role.find({ 
        key: { $in: validatedData.roles } 
      }).select('key').lean();
      
      const existingRoleKeys = existingRoles.map(r => r.key);
      const invalidRoles = validatedData.roles.filter(r => !existingRoleKeys.includes(r));
      
      if (invalidRoles.length > 0) {
        return res.status(400).json({
          ok: false,
          error: { 
            message: 'Invalid roles specified',
            details: { invalidRoles }
          }
        });
      }
    }

    // Validate that all permissions exist
    const allPerms = [...(validatedData.permsExtra || []), ...(validatedData.permsDenied || [])];
    if (allPerms.length > 0) {
      const existingPerms = await Permission.find({ 
        key: { $in: allPerms } 
      }).select('key').lean();
      
      const existingPermKeys = existingPerms.map(p => p.key);
      const invalidPerms = allPerms.filter(p => !existingPermKeys.includes(p));
      
      if (invalidPerms.length > 0) {
        return res.status(400).json({
          ok: false,
          error: { 
            message: 'Invalid permissions specified',
            details: { invalidPerms }
          }
        });
      }
    }

    // Update or create user access
    const userAccess = await UserAccess.findOneAndUpdate(
      { userId },
      { ...validatedData, userId },
      { 
        new: true, 
        upsert: true, 
        runValidators: true 
      }
    ).lean();

    res.json({
      ok: true,
      data: {
        user,
        access: userAccess
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/access/page-restrictions/:userId/:permission
 * Get page access restrictions for a user and permission
 */
router.get('/page-restrictions/:userId/:permission', async (req, res, next) => {
  try {
    const { userId, permission } = req.params;

    // Verify user exists
    const user = await User.findById(userId).select('username email').lean();
    if (!user) {
      return res.status(404).json({
        ok: false,
        error: { message: 'User not found' }
      });
    }

    const restrictions = await getPageAccessRestrictions(userId, permission);

    res.json({
      ok: true,
      data: {
        user,
        permission,
        restrictions
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/access/departments
 * Get all departments for restriction selection
 */
router.get('/departments', async (req, res, next) => {
  try {
    const departments = await Department.find({})
      .select('name')
      .sort({ name: 1 })
      .lean();

    res.json({
      ok: true,
      data: departments
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/access/sections
 * Get all sections for restriction selection
 */
router.get('/sections', async (req, res, next) => {
  try {
    const sections = await Section.find({})
      .populate('departmentId', 'name')
      .select('name departmentId')
      .sort({ name: 1 })
      .lean();

    res.json({
      ok: true,
      data: sections
    });
  } catch (error) {
    next(error);
  }
});

export default router;
