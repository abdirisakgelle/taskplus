import { verifyToken, getCookieName } from '../utils/auth.js';
import { getEffectivePermissions, hasAnyPerm, canAccessPage } from '../utils/access.js';

/**
 * Middleware to require authentication
 * Reads JWT from cookie and sets req.user
 */
export async function authRequired(req, res, next) {
  try {
    const token = req.cookies[getCookieName()];
    
    if (!token) {
      return res.status(401).json({
        ok: false,
        error: { message: 'Authentication required' }
      });
    }

    const payload = verifyToken(token);
    if (!payload || !payload.sub) {
      return res.status(401).json({
        ok: false,
        error: { message: 'Invalid or expired token' }
      });
    }

    // Set user ID on request object
    req.user = { id: payload.sub };
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      ok: false,
      error: { message: 'Authentication failed' }
    });
  }
}

/**
 * Middleware factory to require a specific permission
 * @param {string} permKey - Required permission key
 */
export function requirePerm(permKey) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          ok: false,
          error: { message: 'Authentication required' }
        });
      }

      const { permissions } = await getEffectivePermissions(req.user.id);
      
      if (!permissions.includes(permKey)) {
        return res.status(403).json({
          ok: false,
          error: { 
            message: 'Insufficient permissions',
            code: 'FORBIDDEN',
            details: { required: permKey }
          }
        });
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      return res.status(500).json({
        ok: false,
        error: { message: 'Permission check failed' }
      });
    }
  };
}

/**
 * Middleware factory to require any of the specified permissions
 * @param {string[]} permKeys - Array of permission keys (user needs at least one)
 */
export function requireAnyPerm(permKeys) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          ok: false,
          error: { message: 'Authentication required' }
        });
      }

      const hasPermission = await hasAnyPerm(req.user.id, permKeys);
      
      if (!hasPermission) {
        return res.status(403).json({
          ok: false,
          error: { 
            message: 'Insufficient permissions',
            code: 'FORBIDDEN',
            details: { required: permKeys }
          }
        });
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      return res.status(500).json({
        ok: false,
        error: { message: 'Permission check failed' }
      });
    }
  };
}

/**
 * Middleware factory to check page-level access
 * @param {string} permission - Required permission key
 * @param {object} options - Options for page access check
 */
export function requirePageAccess(permission, options = {}) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          ok: false,
          error: { message: 'Authentication required' }
        });
      }

      // Extract page number from query params
      const page = parseInt(req.query.page) || 1;
      const section = req.query.departmentId || req.query.sectionId || options.section;

      const hasAccess = await canAccessPage(req.user.id, permission, page, section);
      
      if (!hasAccess) {
        return res.status(403).json({
          ok: false,
          error: { 
            message: 'Access denied to this page or section',
            code: 'PAGE_ACCESS_DENIED',
            details: { 
              permission, 
              page, 
              section: section || null 
            }
          }
        });
      }

      next();
    } catch (error) {
      console.error('Page access middleware error:', error);
      return res.status(500).json({
        ok: false,
        error: { message: 'Page access check failed' }
      });
    }
  };
}