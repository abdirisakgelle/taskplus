# TaskPlus API Documentation

## Overview

TaskPlus is a comprehensive task and content management system with APIs for managing employees, departments, tasks, tickets, content workflow, and analytics. All APIs use JWT authentication and role-based permissions.

## Base URL
```
http://localhost:8000/api
```

## Authentication

### Headers
All authenticated endpoints require:
```
Authorization: Bearer <jwt_token>
```

### Authentication Endpoints

#### POST /auth/signup
Register a new user account.
```json
{
  "username": "john_doe",
  "password": "password123",
  "employee_id": 1 // optional
}
```

#### POST /auth/login
Authenticate and receive JWT token.
```json
{
  "username": "john_doe",
  "password": "password123"
}
```

#### GET /auth/profile
Get current user profile with permissions and employee details.

#### PUT /auth/profile
Update user profile information.

#### PUT /auth/change-password
Change user password.

#### POST /auth/refresh
Refresh JWT token.

#### POST /auth/logout
Logout (client-side token removal).

---

## Task Management APIs

### GET /tasks
Get tasks with advanced filtering and pagination.

**Query Parameters:**
- `status` - Filter by task status
- `priority` - Filter by priority level
- `assigned_to` - Filter by assigned user ID
- `created_by` - Filter by creator user ID
- `due_date_from` / `due_date_to` - Date range filtering
- `search` - Text search in title/description
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)
- `sort_by` - Sort field (default: createdAt)
- `sort_order` - asc/desc (default: desc)

### GET /tasks/:id
Get single task with full details including user and employee information.

### POST /tasks
Create a new task.
```json
{
  "title": "Complete API documentation",
  "description": "Write comprehensive API docs",
  "assigned_to": 1,
  "status": "Not Started",
  "priority": "High",
  "due_date": "2024-01-15T10:00:00Z"
}
```

### PUT /tasks/:id
Update task (only creator or assignee can update).

### DELETE /tasks/:id
Delete task (only creator can delete).

### GET /tasks/my/tasks
Get tasks assigned to or created by current user.

### GET /tasks/stats/overview
Get task statistics and metrics.

---

## Employee Management APIs

### GET /employees
Get employees with department and section details.

**Query Parameters:**
- `department` - Filter by department ID
- `section_id` - Filter by section ID
- `shift` - Filter by shift (Morning/Afternoon/Night)
- `search` - Search in name, title, or phone
- `page` / `limit` - Pagination

### GET /employees/:id
Get single employee with full details, user account, and assigned tasks.

### POST /employees
Create new employee.
```json
{
  "name": "John Doe",
  "shift": "Morning",
  "title": "Software Engineer",
  "department": 1,
  "section_id": 2,
  "phone": "+1234567890"
}
```

### PUT /employees/:id
Update employee information.

### DELETE /employees/:id
Delete employee (checks for dependencies).

### GET /employees/department/:departmentId
Get all employees in a specific department.

### GET /employees/section/:sectionId
Get all employees in a specific section.

### GET /employees/stats/overview
Get employee statistics and distribution.

---

## Department & Section APIs

### GET /departments
Get all departments with sections and employee counts.

### GET /departments/:id
Get single department with full details.

### POST /departments
Create new department.

### PUT /departments/:id
Update department name.

### DELETE /departments/:id
Delete department (checks for dependencies).

### GET /departments/hierarchy/tree
Get complete department hierarchy with sections and employees.

### GET /sections
Get sections with department info and employee counts.

### GET /sections/:id
Get single section with details.

### POST /sections
Create new section.

### PUT /sections/:id
Update section.

### DELETE /sections/:id
Delete section (checks for dependencies).

---

## Ticket Management System

### GET /tickets
Get tickets with advanced filtering.

**Query Parameters:**
- `status` - Resolution status
- `agent_id` - Assigned agent ID
- `communication_channel` - WhatsApp/Phone
- `device_type` - Device type filter
- `issue_type` - Issue category
- `first_call_resolution` - true/false
- `date_from` / `date_to` - Date range
- `search` - Search in customer info or description

### GET /tickets/:id
Get single ticket with follow-ups and reviews.

### POST /tickets
Create new support ticket.
```json
{
  "customer_phone": "+1234567890",
  "customer_location": "New York",
  "communication_channel": "WhatsApp",
  "device_type": "Mobile",
  "issue_type": "Technical",
  "issue_description": "App not loading",
  "agent_id": 5
}
```

### PUT /tickets/:id
Update ticket information.

### DELETE /tickets/:id
Delete ticket and related records.

### GET /tickets/stats/overview
Get ticket statistics and metrics.

### GET /tickets/my/tickets
Get tickets assigned to current user.

---

## Follow-up Management

### GET /follow-ups
Get follow-ups with filtering.

### GET /follow-ups/:id
Get single follow-up with details.

### POST /follow-ups
Create follow-up for a ticket.
```json
{
  "ticket_id": 123,
  "follow_up_agent_id": 5,
  "follow_up_date": "2024-01-15T14:00:00Z",
  "issue_solved": true,
  "satisfied": true,
  "repeated_issue": false,
  "follow_up_notes": "Customer satisfied with resolution"
}
```

### PUT /follow-ups/:id
Update follow-up information.

### DELETE /follow-ups/:id
Delete follow-up.

### GET /follow-ups/ticket/:ticketId
Get all follow-ups for a specific ticket.

### GET /follow-ups/stats/overview
Get follow-up statistics and metrics.

---

## Review Management

### GET /reviews
Get reviews with filtering.

### GET /reviews/:id
Get single review with details.

### POST /reviews
Create review for a ticket.

### PUT /reviews/:id
Update review.

### DELETE /reviews/:id
Delete review.

### GET /reviews/ticket/:ticketId
Get all reviews for a specific ticket.

### GET /reviews/my/reviews
Get reviews created by current user.

### GET /reviews/stats/overview
Get review statistics.

---

## Content Workflow APIs

### Ideas Management

#### GET /ideas
Get ideas with filtering and pagination.

#### GET /ideas/:id
Get single idea with content details.

#### POST /ideas
Create new idea.
```json
{
  "title": "New Video Series Concept",
  "contributor": 10,
  "submission_date": "2024-01-15T10:00:00Z",
  "status": "Draft"
}
```

#### PUT /ideas/:id
Update idea.

#### DELETE /ideas/:id
Delete idea (checks for dependencies).

#### GET /ideas/my/ideas
Get ideas submitted by current user.

#### PUT /ideas/:id/approve
Approve an idea.

#### PUT /ideas/:id/reject
Reject an idea with optional reason.

#### GET /ideas/stats/overview
Get idea statistics.

### Content Management

#### GET /content
Get content with filtering and pagination.

#### GET /content/:id
Get single content with full details.

#### POST /content
Create content from approved idea.
```json
{
  "content_date": "2024-01-15T10:00:00Z",
  "idea_id": 5,
  "script_writer_employee_id": 12,
  "director_employee_id": 8,
  "filming_date": "2024-01-20T09:00:00Z",
  "cast_and_presenters": [15, 18, 22],
  "notes": "Outdoor shoot, weather dependent"
}
```

#### PUT /content/:id
Update content information.

#### DELETE /content/:id
Delete content (checks for dependencies).

#### GET /content/idea/:ideaId
Get all content for a specific idea.

#### GET /content/my/content
Get content assigned to current user.

#### GET /content/stats/overview
Get content statistics.

### Production Management

#### GET /production
Get productions with filtering.

#### GET /production/:id
Get single production with details.

#### POST /production
Create production for content.
```json
{
  "content_id": 15,
  "editor_id": 20,
  "production_status": "Editing",
  "completion_date": null,
  "sent_to_social_team": false,
  "notes": "Initial edit phase"
}
```

#### PUT /production/:id
Update production.

#### DELETE /production/:id
Delete production.

#### GET /production/content/:contentId
Get productions for specific content.

#### GET /production/my/productions
Get productions assigned to current user.

#### PUT /production/:id/complete
Mark production as completed.

#### PUT /production/:id/send-to-social
Send completed production to social team.

#### GET /production/stats/overview
Get production statistics.

### Social Media Management

#### GET /social-media
Get social media posts with filtering.

#### GET /social-media/:id
Get single post with details.

#### POST /social-media
Create social media post.
```json
{
  "content_id": 25,
  "platforms": "Instagram, Facebook",
  "post_type": "Video",
  "post_date": "2024-01-25T15:00:00Z",
  "caption": "Check out our latest video! #content",
  "status": "Draft",
  "approved": false,
  "notes": "Schedule for peak hours"
}
```

#### PUT /social-media/:id
Update social media post.

#### DELETE /social-media/:id
Delete social media post.

#### GET /social-media/content/:contentId
Get posts for specific content.

#### GET /social-media/platform/:platform
Get posts for specific platform.

#### GET /social-media/schedule/today
Get posts scheduled for today.

#### PUT /social-media/:id/approve
Approve social media post.

#### PUT /social-media/:id/publish
Publish approved post.

#### GET /social-media/stats/overview
Get social media statistics.

#### GET /social-media/workflow/:contentId
Get complete workflow status for content.

---

## Notifications API

### GET /notifications
Get notifications for current user with pagination.

### GET /notifications/:id
Get single notification.

### POST /notifications
Create notification (admin only).

### POST /notifications/broadcast
Broadcast notification to all users (admin only).

### PUT /notifications/:id/read
Mark notification as read.

### PUT /notifications/:id/unread
Mark notification as unread.

### PUT /notifications/mark-all-read
Mark all notifications as read.

### DELETE /notifications/:id
Delete notification.

### DELETE /notifications/cleanup/read
Delete all read notifications.

### GET /notifications/count/unread
Get unread notification count.

### GET /notifications/type/:type
Get notifications by type.

### GET /notifications/recent/today
Get recent notifications (last 24 hours).

### GET /notifications/stats/overview
Get notification statistics (admin only).

---

## Analytics & Reporting APIs

### GET /analytics/dashboard/overview
Get comprehensive dashboard statistics.

**Query Parameters:**
- `date_from` / `date_to` - Date range filter

**Response includes:**
- Task statistics (total, completed, in progress, overdue)
- Ticket statistics (resolution rates, FCR rates)
- Content workflow metrics
- Employee and department counts
- User activity metrics

### GET /analytics/tasks/performance
Get task performance analytics over time.

**Query Parameters:**
- `date_from` / `date_to` - Date range
- `group_by` - hour/day/week/month (default: day)

### GET /analytics/employees/productivity
Get employee productivity analytics.

**Query Parameters:**
- `date_from` / `date_to` - Date range
- `department_id` - Filter by department

### GET /analytics/tickets/resolution
Get ticket resolution analytics.

**Response includes:**
- Average resolution time
- Channel distribution
- Issue type analysis
- Agent performance metrics

### GET /analytics/content/workflow
Get content workflow analytics.

**Response includes:**
- Idea approval rates
- Content production rates
- Social media publishing rates
- Workflow completion metrics

### GET /analytics/departments/overview
Get department analytics with employee distribution.

### GET /analytics/system/usage
Get system usage analytics.

**Response includes:**
- User activity metrics
- Data creation trends
- System utilization statistics

---

## Error Responses

All APIs return consistent error responses:

```json
{
  "message": "Error description",
  "status": 400
}
```

### Common HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error

---

## Permissions

The system uses role-based permissions. Users need specific permissions to access different API endpoints:

- `tasks` - Task management
- `employees` - Employee management
- `departments` - Department management
- `sections` - Section management
- `tickets` - Ticket management
- `follow_ups` - Follow-up management
- `reviews` - Review management
- `ideas` - Idea management
- `content` - Content management
- `production` - Production management
- `social_media` - Social media management
- `analytics` - Analytics access
- `admin` - Administrative functions

---

## Rate Limiting

- All endpoints have pagination with configurable limits
- Maximum items per page: 100
- Default page size: 10-20 depending on endpoint

---

## Data Relationships

The system maintains referential integrity:

1. **Users** can be linked to **Employees**
2. **Employees** belong to **Departments** and **Sections**
3. **Tasks** are assigned to **Users** and created by **Users**
4. **Tickets** are handled by **Employees** (agents)
5. **Ideas** → **Content** → **Production** → **Social Media** (workflow)
6. **Follow-ups** and **Reviews** are linked to **Tickets**
7. **Notifications** are sent to **Users**

---

## Webhook Support

The system sends notifications for key events:
- Task assignments and status changes
- Ticket assignments and resolutions
- Content workflow status changes
- Idea approvals/rejections
- Production completions

---

## Best Practices

1. Always include proper authentication headers
2. Use pagination for large data sets
3. Implement proper error handling
4. Cache frequently accessed data
5. Use appropriate HTTP methods (GET, POST, PUT, DELETE)
6. Validate input data before sending requests
7. Handle rate limiting gracefully
8. Use filters and search parameters to reduce data transfer

---

## Support

For API support and questions, please contact the development team or refer to the source code documentation.
