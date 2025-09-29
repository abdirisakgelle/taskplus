export const MENU_ITEMS = [{
  key: 'main-section',
  label: 'MAIN',
  isTitle: true
}, {
  // Dashboards group - collapsible with multiple dashboard types
  key: 'dashboards',
  icon: 'solar:widget-2-broken',
  label: 'Dashboards',
  children: [{
    key: 'dashboard-admin',
    label: 'Admin Dashboard',
    url: '/dashboard/admin',
    parentKey: 'dashboards'
  }]
}, {
  key: 'management-section',
  label: 'MANAGEMENT',
  isTitle: true
}, {
  // Management group - organizational structure and user management
  key: 'management',
  icon: 'solar:buildings-3-broken',
  label: 'Management',
  children: [{
    key: 'management-departments',
    label: 'Departments',
    url: '/management/departments',
    parentKey: 'management'
  }, {
    key: 'management-sections',
    label: 'Sections',
    url: '/management/sections',
    parentKey: 'management'
  }, {
    key: 'management-employees',
    label: 'Employees',
    url: '/management/employees',
    parentKey: 'management'
  }, {
    key: 'management-users',
    label: 'Users',
    url: '/management/users',
    parentKey: 'management'
  }, {
    key: 'management-permissions',
    label: 'Permissions',
    url: '/management/permissions',
    parentKey: 'management'
  }]
}, {
  key: 'support-section',
  label: 'CUSTOMER SUPPORT',
  isTitle: true
}, {
  // Customer Support group - tickets, follow-ups, reviews
  key: 'support',
  icon: 'solar:headphones-round-sound-broken',
  label: 'Customer Support',
  children: [{
    key: 'support-tickets',
    label: 'Tickets',
    url: '/support/tickets',
    parentKey: 'support'
  }, {
    key: 'support-followups',
    label: 'Follow-ups',
    url: '/support/followups',
    parentKey: 'support'
  }, {
    key: 'support-reviews',
    label: 'Reviews (QA)',
    url: '/support/reviews',
    parentKey: 'support'
  }]
}, {
  key: 'operations-section',
  label: 'OPERATIONS',
  isTitle: true
}, {
  // Operations group - task management and operations
  key: 'operations',
  icon: 'solar:settings-broken',
  label: 'Operations',
  children: [{
    key: 'operations-all',
    label: 'Tasks',
    url: '/operations/all',
    parentKey: 'operations'
  }, {
    key: 'operations-mine',
    label: 'My Tasks',
    url: '/operations/mine',
    parentKey: 'operations'
  }, {
    key: 'operations-calendar',
    label: 'Calendar',
    url: '/operations/calendar',
    parentKey: 'operations'
  }, {
    key: 'operations-notifications',
    label: 'Notifications',
    url: '/operations/notifications',
    parentKey: 'operations'
  }]
}, {
  key: 'content-section',
  label: 'CONTENT PRODUCTION',
  isTitle: true
}, {
  // Content Production group - creative workflow
  key: 'content',
  icon: 'solar:videocamera-broken',
  label: 'Content Production',
  children: [{
    key: 'content-ideas',
    label: 'Ideas',
    url: '/content/ideas',
    parentKey: 'content'
  }, {
    key: 'content-scripts',
    label: 'Content (Scripts & Filming)',
    url: '/content/scripts',
    parentKey: 'content'
  }, {
    key: 'content-production-editing',
    label: 'Production (Editing)',
    url: '/content/production',
    parentKey: 'content'
  }, {
    key: 'content-social',
    label: 'Social Media',
    url: '/content/social',
    parentKey: 'content'
  }, {
    key: 'content-library',
    label: 'VOD Library',
    url: '/content/library',
    parentKey: 'content'
  }]
}, {
  key: 'reports-section',
  label: 'ANALYTICS & REPORTS',
  isTitle: true
}, {
  // Analytics & Reports group - business intelligence
  key: 'reports',
  icon: 'solar:chart-2-broken',
  label: 'Analytics & Reports',
  children: [{
    key: 'reports-support-kpis',
    label: 'Support KPIs',
    url: '/reports/support-kpis',
    parentKey: 'reports'
  }, {
    key: 'reports-content-kpis',
    label: 'Content KPIs',
    url: '/reports/content-kpis',
    parentKey: 'reports'
  }, {
    key: 'reports-operations',
    label: 'Operations & Productivity',
    url: '/reports/operations',
    parentKey: 'reports'
  }, {
    key: 'reports-custom',
    label: 'Custom Reports',
    url: '/reports/custom',
    parentKey: 'reports'
  }]
}, {
  key: 'system-section',
  label: 'SYSTEM',
  isTitle: true
}, {
  // Settings group - system configuration
  key: 'settings',
  icon: 'solar:settings-minimalistic-broken',
  label: 'Settings',
  children: [{
    key: 'settings-profile',
    label: 'Profile',
    url: '/settings/profile',
    parentKey: 'settings'
  }, {
    key: 'settings-system',
    label: 'System Settings',
    url: '/settings/system',
    parentKey: 'settings'
  }, {
    key: 'settings-access',
    label: 'Access Control',
    url: '/settings/access',
    parentKey: 'settings'
  }]
}];