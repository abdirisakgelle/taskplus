// Permission mappings for menu items
export const MENU_PERMISSIONS = {
  // Dashboard
  'dashboards': 'dashboard.view',
  'dashboard-admin': 'dashboard.view',

  // Management
  'management': 'management.view',
  'management-departments': 'management.departments',
  'management-sections': 'management.sections',
  'management-employees': 'management.employees',
  'management-users': 'management.users',
  'management-permissions': 'management.permissions',

  // Customer Support
  'support': 'support.tickets', // Show if has any support permission
  'support-tickets': 'support.tickets',
  'support-followups': 'support.followups',
  'support-reviews': 'support.reviews',

  // Operations/Tasks
  'operations': 'tasks.view', // Show operations menu if user can view tasks
  'operations-all': 'tasks.view',
  'operations-mine': 'tasks.mine',
  'operations-calendar': 'operations.calendar',
  'operations-notifications': 'operations.notifications',

  // Content Production
  'content': 'content.ideas', // Show if has any content permission
  'content-ideas': 'content.ideas',
  'content-scripts': 'content.scripts',
  'content-production-editing': 'content.production',
  'content-social': 'content.social',
  'content-library': 'content.library',

  // Analytics & Reports
  'reports': 'reports.support', // Show if has any reports permission
  'reports-support-kpis': 'reports.support',
  'reports-content-kpis': 'reports.content',
  'reports-operations': 'reports.operations',
  'reports-custom': 'reports.custom',

  // Settings
  'settings': 'settings.profile', // Everyone should see settings for profile
  'settings-profile': 'settings.profile',
  'settings-system': 'settings.system',
  'settings-access': 'settings.access.manage'
};

// Special cases where we check multiple permissions
export const MENU_MULTI_PERMISSIONS = {
  'support': ['support.tickets', 'support.followups', 'support.reviews'],
  'operations': ['tasks.view', 'tasks.mine', 'operations.calendar', 'operations.notifications'],
  'content': ['content.ideas', 'content.scripts', 'content.production', 'content.social', 'content.library'],
  'reports': ['reports.support', 'reports.content', 'reports.operations', 'reports.custom']
};

/**
 * Filter menu items based on user permissions
 * @param {Array} menuItems - Original menu items
 * @param {Array} userPermissions - User's permissions
 * @returns {Array} Filtered menu items
 */
export function filterMenuByPermissions(menuItems, userPermissions) {
  if (!userPermissions || !Array.isArray(userPermissions) || userPermissions.length === 0) {
    return [];
  }

  const hasPermission = (key) => {
    // Check multi-permissions first
    if (MENU_MULTI_PERMISSIONS[key]) {
      return MENU_MULTI_PERMISSIONS[key].some(perm => userPermissions.includes(perm));
    }
    
    // Check single permission
    const requiredPerm = MENU_PERMISSIONS[key];
    return requiredPerm ? userPermissions.includes(requiredPerm) : true;
  };

  const filterItems = (items) => {
    return items.reduce((acc, item) => {
      // Skip section titles - always show them if they have visible children
      if (item.isTitle) {
        acc.push(item);
        return acc;
      }

      // Check if user has permission for this item
      if (!hasPermission(item.key)) {
        return acc;
      }

      // If item has children, filter them recursively
      if (item.children && item.children.length > 0) {
        const filteredChildren = filterItems(item.children);
        
        // Only include parent if it has visible children
        if (filteredChildren.length > 0) {
          acc.push({
            ...item,
            children: filteredChildren
          });
        }
      } else {
        // Leaf item - include it
        acc.push(item);
      }

      return acc;
    }, []);
  };

  const filteredItems = filterItems(menuItems);
  
  // Remove section titles that have no following items
  return filteredItems.filter((item, index, arr) => {
    if (!item.isTitle) return true;
    
    // Check if there are any non-title items after this title
    for (let i = index + 1; i < arr.length; i++) {
      if (!arr[i].isTitle) return true;
      // If we hit another title, this section is empty
      if (arr[i].isTitle) break;
    }
    
    return false;
  });
}
