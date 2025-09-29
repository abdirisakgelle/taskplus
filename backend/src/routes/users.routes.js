import express from 'express';
import { User } from '../models/users.js';
import { Employee } from '../models/employees.js';
import { userCreate, userUpdate, paginationSchema } from '../validation/schemas.js';
import { authRequired, requirePerm, requirePageAccess } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication and management.users permission
router.use(authRequired);
router.use(requirePerm('management.users'));

/**
 * GET /api/users
 * Get paginated list of users (exclude password)
 * Now includes page-level access control
 */
router.get('/', requirePageAccess('management.users'), async (req, res, next) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({})
        .populate({
          path: 'employeeId',
          populate: [
            { path: 'departmentId', select: 'name' },
            { path: 'sectionId', select: 'name' }
          ]
        })
        .select('-password')
        .sort({ username: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments({})
    ]);

    res.json({
      ok: true,
      data: users,
      meta: { total, page, limit }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/:id
 * Get single user by ID (exclude password)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .populate({
        path: 'employeeId',
        populate: [
          { path: 'departmentId', select: 'name' },
          { path: 'sectionId', select: 'name' }
        ]
      })
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: { message: 'User not found' }
      });
    }

    res.json({
      ok: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/users
 * Create new user with employee validation
 */
router.post('/', async (req, res, next) => {
  try {
    const validatedData = userCreate.parse(req.body);

    // Verify employee exists and is not already linked to a user
    const employee = await Employee.findById(validatedData.employeeId);
    if (!employee) {
      return res.status(400).json({
        ok: false,
        error: { message: 'Employee not found' }
      });
    }

    // Check if employee is already linked to another user
    const existingUser = await User.findOne({ employeeId: validatedData.employeeId });
    if (existingUser) {
      return res.status(409).json({
        ok: false,
        error: { 
          message: 'Employee is already linked to another user',
          details: { field: 'employeeId', value: validatedData.employeeId }
        }
      });
    }

    const user = new User(validatedData);
    await user.save();

    // Return user without password
    const userResponse = await User.findById(user._id)
      .populate({
        path: 'employeeId',
        populate: [
          { path: 'departmentId', select: 'name' },
          { path: 'sectionId', select: 'name' }
        ]
      })
      .select('-password')
      .lean();

    res.status(201).json({
      ok: true,
      data: userResponse
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/users/:id
 * Update user (rehash password if provided)
 */
router.put('/:id', async (req, res, next) => {
  try {
    const validatedData = userUpdate.parse(req.body);

    const user = await User.findByIdAndUpdate(
      req.params.id,
      validatedData,
      { new: true, runValidators: true }
    )
      .populate({
        path: 'employeeId',
        populate: [
          { path: 'departmentId', select: 'name' },
          { path: 'sectionId', select: 'name' }
        ]
      })
      .select('-password');

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: { message: 'User not found' }
      });
    }

    res.json({
      ok: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/users/:id
 * Delete user
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: { message: 'User not found' }
      });
    }

    res.json({
      ok: true,
      data: { message: 'User deleted successfully' }
    });
  } catch (error) {
    next(error);
  }
});

export default router;