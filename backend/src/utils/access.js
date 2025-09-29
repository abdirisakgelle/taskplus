import { UserAccess } from '../models/user_access.js';
import { Role } from '../models/roles.js';

/**
 * Get effective permissions for a user
 * @param {string} userId - The user's MongoDB ObjectId
 * @returns {Promise<{permissions: string[], roles: string[], homeRoute?: string}>}
 */
export async function getEffectivePermissions(userId) {
  try {
    const userAccess = await UserAccess.findOne({ userId }).lean();
    
    if (!userAccess) {
      return { permissions: [], roles: [], homeRoute: undefined };
    }

    const { roles = [], permsExtra = [], permsDenied = [], homeRoute } = userAccess;

    // Get permissions from roles
    let rolePermissions = [];
    if (roles.length > 0) {
      const roleDocuments = await Role.find({ key: { $in: roles } }).lean();
      rolePermissions = roleDocuments.reduce((acc, role) => {
        return acc.concat(role.permissions || []);
      }, []);
    }

    // Combine role permissions with extra permissions
    const allPermissions = [...new Set([...rolePermissions, ...permsExtra])];
    
    // Remove denied permissions
    const effectivePermissions = allPermissions.filter(perm => !permsDenied.includes(perm));

    return {
      permissions: effectivePermissions,
      roles,
      homeRoute
    };
  } catch (error) {
    console.error('Error getting effective permissions:', error);
    return { permissions: [], roles: [], homeRoute: undefined };
  }
}

/**
 * Check if user has a specific permission
 * @param {string} userId - The user's MongoDB ObjectId
 * @param {string} permKey - The permission key to check
 * @returns {Promise<boolean>}
 */
export async function hasPerm(userId, permKey) {
  const { permissions } = await getEffectivePermissions(userId);
  return permissions.includes(permKey);
}

/**
 * Check if user has any of the specified permissions
 * @param {string} userId - The user's MongoDB ObjectId
 * @param {string[]} permKeys - Array of permission keys to check
 * @returns {Promise<boolean>}
 */
export async function hasAnyPerm(userId, permKeys) {
  const { permissions } = await getEffectivePermissions(userId);
  return permKeys.some(perm => permissions.includes(perm));
}

/**
 * Get default home route for user based on permissions
 * @param {string[]} permissions - User's effective permissions
 * @returns {string} Default route path
 */
export function getDefaultHomeRoute(permissions) {
  // Priority order for default routes
  if (permissions.includes('support.tickets')) return '/support/tickets';
  if (permissions.includes('content.ideas')) return '/content/ideas';
  if (permissions.includes('operations.view')) return '/operations/all';
  if (permissions.includes('management.view')) return '/management/departments';
  if (permissions.includes('dashboard.view')) return '/dashboard/admin';
  
  // Fallback
  return '/dashboard/admin';
}

/**
 * Check if user can access a specific page number for a permission
 * @param {string} userId - The user's MongoDB ObjectId
 * @param {string} permission - The permission key
 * @param {number} pageNumber - The page number to check
 * @param {string} section - Optional section/department filter
 * @returns {Promise<boolean>}
 */
export async function canAccessPage(userId, permission, pageNumber, section = null) {
  try {
    const userAccess = await UserAccess.findOne({ userId }).lean();
    
    if (!userAccess) {
      return false;
    }

    // First check if user has the base permission
    const { permissions } = await getEffectivePermissions(userId);
    if (!permissions.includes(permission)) {
      return false;
    }

    // Check page-level restrictions
    const pageAccessRule = userAccess.pageAccess?.find(pa => pa.permission === permission);
    
    if (pageAccessRule) {
      // Check specific allowed pages
      if (pageAccessRule.allowedPages && pageAccessRule.allowedPages.length > 0) {
        if (!pageAccessRule.allowedPages.includes(pageNumber)) {
          return false;
        }
      }
      
      // Check max pages limit
      if (pageAccessRule.maxPages && pageNumber > pageAccessRule.maxPages) {
        return false;
      }
      
      // Check section restrictions
      if (section && pageAccessRule.sectionsAllowed && pageAccessRule.sectionsAllowed.length > 0) {
        if (!pageAccessRule.sectionsAllowed.includes(section)) {
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking page access:', error);
    return false;
  }
}

/**
 * Get page access restrictions for a user and permission
 * @param {string} userId - The user's MongoDB ObjectId
 * @param {string} permission - The permission key
 * @returns {Promise<object|null>} Page access configuration or null
 */
export async function getPageAccessRestrictions(userId, permission) {
  try {
    const userAccess = await UserAccess.findOne({ userId }).lean();
    
    if (!userAccess || !userAccess.pageAccess) {
      return null;
    }

    return userAccess.pageAccess.find(pa => pa.permission === permission) || null;
  } catch (error) {
    console.error('Error getting page access restrictions:', error);
    return null;
  }
}
