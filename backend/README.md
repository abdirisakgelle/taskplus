## TaskPlus Backend

Express + Mongoose backend with authentication, authorization, and CRUD operations for departments, sections, employees, and users.

### Prerequisites
- Node.js 18+
- MongoDB Atlas connection string

### Environment Variables
Create `.env` file with the following variables:

```
# Database
MONGO_URI=mongodb://localhost:27017/taskplus
# OR for Atlas: mongodb+srv://USER:URL_ENCODED_PASS@cluster0.xxxxx.mongodb.net/taskplus

# Authentication
JWT_SECRET=change-me-to-a-secure-random-string
JWT_EXPIRES=7d
COOKIE_NAME=sid

# Server
NODE_ENV=development
PORT=8000
FRONTEND_URL=http://localhost:5175
```

### Install & Run
```
npm install
npm run init:indexes
npm run seed
npm run dev
```

### API Endpoints

#### Authentication
- `POST /api/auth/login` - Login with username/email and password
- `POST /api/auth/logout` - Logout (clear cookie)
- `GET /api/auth/me` - Get current user profile and permissions

#### Core Management
- `GET|POST|PUT|DELETE /api/departments` - Department CRUD
- `GET|POST|PUT|DELETE /api/sections` - Section CRUD  
- `GET|POST|PUT|DELETE /api/employees` - Employee CRUD
- `GET|POST|PUT|DELETE /api/users` - User CRUD
- `GET /api/employees/unassigned` - Get employees without user accounts

#### Access Control
- `GET /api/access/permissions` - List all permissions
- `GET /api/access/roles` - List all role presets
- `GET|POST /api/access/users/:userId` - Get/update user access

### Sample cURL Commands
```bash
# Health check
curl -s http://localhost:8000/health

# Login (sets HTTP-only cookie)
curl -s -X POST http://localhost:8000/api/auth/login \
 -H 'Content-Type: application/json' \
 -d '{"identifier":"admin","password":"Passw0rd!"}'

# Get current user (requires cookie)
curl -s http://localhost:8000/api/auth/me \
 -H 'Cookie: sid=YOUR_JWT_TOKEN'

# Create department (requires auth + permission)
curl -s -X POST http://localhost:8000/api/departments \
 -H 'Content-Type: application/json' \
 -H 'Cookie: sid=YOUR_JWT_TOKEN' \
 -d '{"name":"Marketing"}'
```

### Default Admin Account
After running the seed script:
- **Username:** `admin`
- **Email:** `admin@example.com`  
- **Password:** `Passw0rd!`

### Notes
- Auto-increment integer PKs via `counters` collection; timestamps on all models; indexes via `npm run init:indexes`.


