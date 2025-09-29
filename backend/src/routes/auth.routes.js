import express from 'express';
import rateLimit from 'express-rate-limit';
import { User } from '../models/users.js';
import { loginSchema } from '../validation/schemas.js';
import { signToken, setAuthCookie, clearAuthCookie } from '../utils/auth.js';
import { getEffectivePermissions, getDefaultHomeRoute } from '../utils/access.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// Rate limit for login attempts
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 attempts per minute per IP
  message: {
    ok: false,
    error: { message: 'Too many login attempts, please try again later' }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/auth/login
 * Login with username or email
 */
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { identifier, password } = validatedData;

    // Find user by username OR email (case-insensitive for email)
    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier.toLowerCase() }
      ],
      status: 'active'
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        ok: false,
        error: { message: 'Invalid credentials' }
      });
    }

    // Check password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        ok: false,
        error: { message: 'Invalid credentials' }
      });
    }

    // Generate token and set cookie
    const token = signToken(user._id.toString());
    setAuthCookie(res, token);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Get effective permissions and home route
    const { permissions, homeRoute } = await getEffectivePermissions(user._id);
    const defaultRoute = homeRoute || getDefaultHomeRoute(permissions);

    res.json({
      ok: true,
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        employeeId: user.employeeId,
        permissions,
        homeRoute: defaultRoute
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Clear authentication cookie
 */
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

/**
 * GET /api/auth/me
 * Get current user profile and permissions
 */
router.get('/me', authRequired, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('employeeId', 'name employee_id')
      .lean();

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: { message: 'User not found' }
      });
    }

    // Get effective permissions and home route
    const { permissions, homeRoute } = await getEffectivePermissions(user._id);
    const defaultRoute = homeRoute || getDefaultHomeRoute(permissions);

    res.json({
      ok: true,
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        employeeId: user.employeeId,
        employee: user.employeeId,
        permissions,
        homeRoute: defaultRoute
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;