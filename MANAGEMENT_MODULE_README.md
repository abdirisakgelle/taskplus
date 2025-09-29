# TaskPlus Management Module

## Overview

The Management module provides comprehensive CRUD operations and permission-based access control for:

- **Departments**: Organizational units (unique names, case-insensitive)
- **Sections**: Sub-units within departments (unique per department)
- **Employees**: Staff members linked to departments and sections
- **Users**: System accounts linked to employees with authentication
- **Permissions**: Role-based access control with granular permission management

## Features

### ✅ Backend (Node.js + Express + Mongoose)

#### Models
- `Department`: Unique names with case-insensitive collation
- `Section`: Belongs to department, unique per department
- `Employee`: References department + section with validation
- `User`: One user per employee, bcrypt password hashing
- `Permission`: Permission registry with groups
- `Role`: Permission bundles/presets
- `UserAccess`: Per-user access control (roles + direct grants/denials)

#### API Endpoints
- **Departments**: `/api/departments` - Full CRUD with usage validation
- **Sections**: `/api/sections` - CRUD with department filtering
- **Employees**: `/api/employees` - CRUD with cascading department/section selects
- **Users**: `/api/users` - CRUD with employee linking and password management
- **Access Control**: `/api/access/*` - Permission and role management

#### Security & Validation
- JWT authentication via HttpOnly cookies
- Permission-based route protection
- Zod validation schemas
- Centralized error handling with proper envelopes
- Rate limiting on sensitive endpoints

### ✅ Frontend (React + Bootstrap)

#### Pages
- **Departments**: Table view with add/edit modals, delete protection
- **Sections**: Filterable by department, cascading selects
- **Employees**: Advanced filtering, department-section validation
- **Users**: Employee linking, password management, status control
- **Permissions**: Two-tab interface (User Access + Permission Registry)

#### Features
- Permission-based navigation filtering
- Real-time form validation
- Loading states and error handling
- Responsive design using Bootstrap components
- Toast notifications for user feedback

## Environment Variables

```env
# Database
MONGODB_URI=mongodb+srv://...
MONGODB_DB=taskplus  # Optional if not in URI

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES=7d
COOKIE_NAME=sid

# CORS
FRONTEND_URL=http://localhost:5175
```

## Permission Keys

### Management
- `management.view` - Access to management section
- `management.departments` - Department CRUD
- `management.sections` - Section CRUD  
- `management.employees` - Employee CRUD
- `management.users` - User CRUD
- `management.permissions` - Access control management

### Other Modules
- `dashboard.view` - Dashboard access
- `support.*` - Customer support permissions
- `operations.*` - Operations permissions
- `content.*` - Content creation permissions
- `reports.*` - Analytics and reporting
- `settings.*` - System settings

## Default Roles

### Admin
- All permissions (25 total)
- Home route: `/dashboard/admin`

### Manager  
- Management, support, operations, reports, content (19 permissions)
- Suitable for department managers

### Supervisor
- Support operations and reporting (8 permissions)
- Team supervision focus

### Agent
- Basic support ticket access (3 permissions)
- Front-line support staff

### Follow-up Agent
- Follow-up management (3 permissions)
- Specialized support role

### Digital Media
- Content creation permissions (7 permissions)
- Creative team members

## Usage

### 1. Start Backend
```bash
cd backend
npm install
npm run seed  # Populate with sample data
npm start
```

### 2. Start Frontend  
```bash
cd frontend
npm install
npm run dev
```

### 3. Login
- **Admin**: admin@example.com / Passw0rd!
- **Manager**: manager@example.com / Passw0rd!
- **Supervisor**: supervisor@example.com / Passw0rd!

### 4. Access Management
Navigate to `/management/*` - menu items are filtered by permissions.

## API Examples

### Create Department
```bash
curl -X POST http://localhost:8000/api/departments \
  -H "Content-Type: application/json" \
  -d '{"name": "Engineering"}' \
  -b cookies.txt
```

### Create Section
```bash
curl -X POST http://localhost:8000/api/sections \
  -H "Content-Type: application/json" \
  -d '{"departmentId": "...", "name": "Backend Team"}' \
  -b cookies.txt
```

### Create Employee
```bash
curl -X POST http://localhost:8000/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "shift": "Morning", 
    "title": "Software Engineer",
    "departmentId": "...",
    "sectionId": "...",
    "phone": "+1234567890"
  }' \
  -b cookies.txt
```

### Update User Access
```bash
curl -X POST http://localhost:8000/api/access/users/USER_ID \
  -H "Content-Type: application/json" \
  -d '{
    "roles": ["manager"],
    "permsExtra": ["reports.custom"],
    "permsDenied": ["management.users"],
    "homeRoute": "/dashboard/admin"
  }' \
  -b cookies.txt
```

## Database Schema

### Key Relationships
```
Department (1) -> (N) Section
Department (1) -> (N) Employee  
Section (1) -> (N) Employee
Employee (1) -> (0..1) User
User (1) -> (0..1) UserAccess
Role (1) -> (N) UserAccess.roles
Permission (1) -> (N) Role.permissions
```

### Indexes
- `Department.name` (unique, case-insensitive)
- `Section.{departmentId, name}` (compound unique, case-insensitive)
- `Employee.employee_id` (unique, auto-increment)
- `User.username` (unique)
- `User.email` (unique) 
- `User.employeeId` (unique, sparse)
- `Permission.key` (unique)
- `Role.key` (unique)
- `UserAccess.userId` (unique)

## Error Handling

### Common Errors
- **409**: Duplicate names, employee already has user
- **400**: Invalid department-section relationships
- **403**: Insufficient permissions
- **404**: Resource not found

### Error Format
```json
{
  "ok": false,
  "error": {
    "message": "Human readable message",
    "code": "ERROR_CODE",
    "details": { "field": "value" }
  }
}
```

## Testing

### Backend
```bash
cd backend
npm test  # Run API tests
```

### Frontend  
```bash
cd frontend
npm test  # Run component tests
```

### Manual Testing
1. Create department → sections → employees → users
2. Test permission-based navigation
3. Verify cascading deletes are blocked appropriately
4. Test access control assignments

## Production Considerations

### Security
- Use strong JWT secrets
- Enable HTTPS in production
- Set secure cookie flags
- Implement rate limiting
- Regular security audits

### Performance
- Database indexes are optimized
- API responses use lean queries
- Pagination limits large datasets
- Frontend uses efficient state management

### Monitoring
- Health endpoint: `GET /api/health`
- Database connection monitoring
- Error tracking and logging
- Performance metrics

## Troubleshooting

### Common Issues

1. **"Authentication required"**
   - Check JWT secret configuration
   - Verify cookie settings
   - Ensure CORS allows credentials

2. **"Section does not belong to department"**
   - Verify department-section relationships
   - Check form validation logic

3. **"Employee already has user account"**
   - Use unassigned employees endpoint
   - Check existing user-employee links

4. **Permission denied errors**
   - Verify user roles and permissions
   - Check menu permission mappings
   - Ensure access control is properly configured

### Debug Commands
```bash
# Check database connection
curl http://localhost:8000/api/health

# Verify authentication
curl -b cookies.txt http://localhost:8000/api/auth/me

# List permissions
curl -b cookies.txt http://localhost:8000/api/access/permissions
```

---

The Management module is now fully functional with comprehensive CRUD operations, permission-based access control, and a modern React interface following the admin template design patterns.
