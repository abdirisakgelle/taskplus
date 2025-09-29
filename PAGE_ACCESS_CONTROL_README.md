# Page Access Control Enhancement

## Overview

The TaskPlus Management module now includes **granular page-level access control**, allowing administrators to restrict users to specific page numbers and sections within their permitted areas.

## New Features

### 🎯 Page-Level Restrictions
- **Specific Page Access**: Assign specific page numbers (e.g., pages 1, 3, 5) that a user can view
- **Maximum Page Limit**: Set a maximum page number limit (e.g., user can only see up to page 3)
- **Section Filtering**: Restrict users to specific departments or sections
- **Permission-Based Rules**: Apply different page restrictions for different permissions

### 🔧 Enhanced User Access Model

#### New UserAccess Fields
```javascript
{
  // Existing fields
  userId: ObjectId,
  roles: [String],
  permsExtra: [String], 
  permsDenied: [String],
  homeRoute: String,

  // NEW: Page-level access control
  pageAccess: [{
    permission: String,        // e.g., 'management.users'
    allowedPages: [Number],    // specific pages: [1, 2, 5]
    maxPages: Number,          // max page limit: 3
    sectionsAllowed: [String]  // section restrictions
  }],

  // NEW: Department/Section restrictions
  departmentRestrictions: [ObjectId],
  sectionRestrictions: [ObjectId]
}
```

## API Enhancements

### New Middleware
```javascript
// Check page-level access
requirePageAccess('management.users')

// Usage in routes
router.get('/', requirePageAccess('management.users'), async (req, res) => {
  // Only accessible if user has page access to current page number
});
```

### New Utility Functions
```javascript
// Check if user can access specific page
await canAccessPage(userId, 'management.users', 2, 'department-id');

// Get page restrictions for user
await getPageAccessRestrictions(userId, 'management.users');
```

### New API Endpoints
```bash
# Get page restrictions for user and permission
GET /api/access/page-restrictions/:userId/:permission

# Get departments for restriction selection
GET /api/access/departments

# Get sections for restriction selection  
GET /api/access/sections
```

## Frontend Enhancements

### Enhanced Permissions Page

#### Page Access Configuration
- **Add Page Rules**: Create rules for specific permissions
- **Allowed Pages**: Specify exact page numbers (comma-separated)
- **Max Pages**: Set maximum page number limit
- **Section Restrictions**: Choose allowed departments/sections

#### Visual Interface
```javascript
// Page Access Rule Example
{
  permission: "management.users",
  allowedPages: [1, 2, 5],     // Can only see pages 1, 2, and 5
  maxPages: 10,                // Cannot exceed page 10
  sectionsAllowed: ["dept-id"] // Only see specific departments
}
```

## Usage Examples

### 1. Restrict User to First 3 Pages
```javascript
// Backend: User can only access pages 1-3 of user management
pageAccess: [{
  permission: "management.users",
  maxPages: 3
}]

// Frontend: Pagination controls automatically hide pages > 3
// API calls to page 4+ return 403 PAGE_ACCESS_DENIED
```

### 2. Allow Specific Pages Only
```javascript
// User can only see pages 1, 3, and 5
pageAccess: [{
  permission: "management.employees", 
  allowedPages: [1, 3, 5]
}]
```

### 3. Department-Specific Access
```javascript
// User can only see employees from specific departments
departmentRestrictions: ["dept-id-1", "dept-id-2"]
```

### 4. Combined Restrictions
```javascript
// Complex example: Limited pages + section restrictions
pageAccess: [{
  permission: "management.users",
  allowedPages: [1, 2],
  sectionsAllowed: ["section-a", "section-b"]
}],
departmentRestrictions: ["marketing-dept"]
```

## Implementation Details

### Middleware Flow
1. **Authentication**: Verify JWT token
2. **Permission Check**: Verify base permission (e.g., `management.users`)
3. **Page Access Check**: Check page-level restrictions
4. **Section Check**: Verify department/section access if applicable

### Error Responses
```javascript
// Page access denied
{
  "ok": false,
  "error": {
    "message": "Access denied to this page or section",
    "code": "PAGE_ACCESS_DENIED", 
    "details": {
      "permission": "management.users",
      "page": 4,
      "section": "dept-id"
    }
  }
}
```

### Frontend Integration
- **Automatic Pagination**: Page controls hide inaccessible pages
- **API Error Handling**: Graceful handling of page access errors
- **Visual Indicators**: Show user's accessible page range
- **Smart Navigation**: Redirect to accessible pages when needed

## Configuration Examples

### Scenario 1: Junior Manager
- **Role**: `manager`
- **Page Access**: Can see first 5 pages of users, unlimited departments
- **Restriction**: None

```javascript
{
  roles: ["manager"],
  pageAccess: [{
    permission: "management.users",
    maxPages: 5
  }]
}
```

### Scenario 2: Department Supervisor  
- **Role**: `supervisor`
- **Page Access**: All pages, but only their department
- **Restriction**: Single department access

```javascript
{
  roles: ["supervisor"], 
  departmentRestrictions: ["their-dept-id"],
  pageAccess: [] // No page limits, but department restricted
}
```

### Scenario 3: Limited Agent
- **Role**: `agent`
- **Page Access**: Only pages 1-2 of tickets, specific sections
- **Restriction**: Section-level access

```javascript
{
  roles: ["agent"],
  pageAccess: [{
    permission: "support.tickets",
    allowedPages: [1, 2],
    sectionsAllowed: ["support-section-1"]
  }],
  sectionRestrictions: ["support-section-1"]
}
```

## Testing

### Backend Testing
```bash
# Test page access middleware
curl -X GET "http://localhost:8000/api/users?page=5" \
  -H "Authorization: Bearer <token>" \
  -b cookies.txt

# Expected: 403 if user cannot access page 5
```

### Frontend Testing
1. **Login as restricted user**
2. **Navigate to management pages**
3. **Verify pagination controls show only allowed pages**
4. **Test direct URL access to restricted pages**
5. **Confirm proper error messages**

## Migration

### Existing Users
- All existing users have **no page restrictions** by default
- Page access is **additive** - only restricts when rules are present
- Backward compatibility maintained

### Database Updates
```javascript
// Add page access to existing user
db.useraccess.updateOne(
  { userId: ObjectId("user-id") },
  { 
    $set: { 
      pageAccess: [{
        permission: "management.users",
        maxPages: 3
      }]
    }
  }
);
```

## Security Considerations

### Validation
- Page numbers must be positive integers
- Permission keys must exist in the system
- Department/section IDs must be valid ObjectIds

### Performance
- Page access checks are cached per request
- Minimal database queries for restriction checking
- Efficient middleware ordering

### Audit Trail
- Page access violations are logged
- User access changes are tracked
- Failed access attempts recorded

## Best Practices

### 1. Start Broad, Then Restrict
```javascript
// Good: Start with role, add page restrictions as needed
roles: ["manager"],
pageAccess: [{ permission: "management.users", maxPages: 5 }]

// Avoid: Too many specific page rules
```

### 2. Use Department Restrictions for Organizational Boundaries
```javascript
// Good: Restrict by department for data isolation
departmentRestrictions: ["sales-dept"]

// Better than: Complex section-by-section rules
```

### 3. Combine with Existing Permissions
```javascript
// Page access enhances, doesn't replace permission system
// User still needs base permission + page access
```

### 4. Test Edge Cases
- What happens at page boundaries?
- How does filtering affect page counts?
- What about empty result sets?

## Troubleshooting

### Common Issues

1. **"Access denied to this page"**
   - Check user's `pageAccess` rules
   - Verify page number is within allowed range
   - Confirm section restrictions

2. **Pagination not working**
   - Ensure frontend respects page access limits
   - Check API response for page restrictions
   - Verify pagination component integration

3. **Department restrictions not working**
   - Confirm department IDs are correct
   - Check if sections belong to allowed departments
   - Verify populate queries include restrictions

### Debug Commands
```bash
# Check user's page access
curl "http://localhost:8000/api/access/users/USER_ID" -b cookies.txt

# Test specific page access
curl "http://localhost:8000/api/access/page-restrictions/USER_ID/management.users" -b cookies.txt

# Verify page middleware
curl "http://localhost:8000/api/users?page=5" -b cookies.txt -v
```

---

The page access control system provides fine-grained control over user data access while maintaining the simplicity and security of the existing permission system. It's designed to be intuitive for administrators and transparent for end users.
