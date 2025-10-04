# TaskPlus - Support Ticket Management System

A comprehensive full-stack support ticket management system built with React, Node.js, Express, and MongoDB. This application provides a complete solution for managing customer support tickets, follow-ups, and quality assurance reviews.

## 🚀 Features

### Support Tickets
- **Complete Ticket Management**: Create, view, edit, and delete support tickets
- **Auto-assignment**: Automatically assign tickets to the current logged-in user
- **Status Management**: Track ticket status (Pending, In-Progress, Completed)
- **First Call Resolution (FCR)**: Track and manage FCR metrics
- **Comprehensive Details**: View all ticket information in a detailed modal
- **Status Change**: Direct status updates without popups

### Follow-ups
- **Pending Follow-ups**: Track tickets that need follow-up
- **Follow-up Modal**: Comprehensive follow-up form with customer feedback
- **Issue Resolution Tracking**: Track if issues were solved and customer satisfaction
- **Repeated Issues**: Identify and track recurring problems

### Reviews & QA
- **Quality Assurance**: Review system for ticket quality control
- **Supervisor Reviews**: Track supervisor feedback and status
- **Comprehensive Review System**: Complete review workflow

### Technical Features
- **Authentication**: Secure JWT-based authentication
- **Role-based Access Control**: Different access levels for users
- **Real-time Updates**: Live data updates and notifications
- **Responsive Design**: Mobile-friendly interface
- **Error Handling**: Comprehensive error handling with field-level validation
- **Auto-incrementing IDs**: Automatic ticket ID generation
- **MongoDB Integration**: Robust database operations with Mongoose

## 🛠️ Tech Stack

### Frontend
- **React 18** with Vite
- **React Router** for navigation
- **React Bootstrap** for UI components
- **SweetAlert2** for modals and notifications
- **Font Awesome** for icons
- **SCSS** for styling

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **JWT** for authentication
- **bcryptjs** for password hashing
- **CORS** for cross-origin requests
- **Helmet** for security
- **Morgan** for logging

### Database
- **MongoDB Atlas** (cloud) or local MongoDB
- **Auto-incrementing counters** for ID generation
- **Comprehensive schemas** for tickets, follow-ups, reviews, users, and employees

## 📁 Project Structure

```
TaskPlus/
├── backend/
│   ├── src/
│   │   ├── models/          # MongoDB schemas
│   │   ├── routes/          # API routes
│   │   ├── middleware/      # Authentication & error handling
│   │   ├── utils/           # Utilities (counters, auth)
│   │   └── scripts/         # Database seeding
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/             # React pages
│   │   ├── components/      # Reusable components
│   │   ├── lib/             # API client
│   │   └── context/         # React context
│   └── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/abdirisakgelle/taskplus.git
   cd taskplus
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install backend dependencies
   cd backend
   npm install
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Create backend/.env file
   cd backend
   touch .env
   ```
   
   Add the following to `backend/.env`:
   ```
   PORT=8000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   ```

4. **Start the application**
   ```bash
   # Start backend (from backend directory)
   npm run dev
   
   # Start frontend (from frontend directory)
   npm run dev
   ```

### Default Login Credentials
- **Username**: `admin`
- **Password**: `Passw0rd!`

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Tickets
- `GET /api/tickets` - Get all tickets
- `POST /api/tickets` - Create new ticket
- `GET /api/tickets/:id` - Get ticket by ID
- `PATCH /api/tickets/:id` - Update ticket
- `DELETE /api/tickets/:id` - Delete ticket

### Follow-ups
- `GET /api/follow-ups/pending` - Get pending follow-ups
- `POST /api/follow-ups` - Create follow-up
- `PATCH /api/follow-ups/:id` - Update follow-up

### Reviews
- `GET /api/reviews` - Get all reviews
- `POST /api/reviews` - Create review
- `GET /api/reviews/stuck/tickets` - Get stuck tickets

## 🔧 Configuration

### MongoDB Setup
1. **Local MongoDB**: Install MongoDB locally and use `mongodb://localhost:27017/taskplus`
2. **MongoDB Atlas**: Create a cluster and use the connection string

### Environment Variables
- `PORT`: Backend server port (default: 8000)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT tokens

## 🎯 Key Features

### Ticket Management
- **Auto-assignment**: Tickets are automatically assigned to the current user
- **Status Tracking**: Pending → In-Progress → Completed
- **FCR Management**: First Call Resolution tracking
- **Comprehensive Details**: All ticket information in one view

### Follow-up System
- **Pending Follow-ups**: Track tickets needing follow-up
- **Customer Feedback**: Collect satisfaction and issue resolution data
- **Repeated Issues**: Identify recurring problems

### Quality Assurance
- **Review System**: Supervisor reviews for ticket quality
- **Status Tracking**: Track review status and feedback

## 🚀 Deployment

### Vercel Deployment
The project is configured for Vercel deployment with:
- Backend API routes
- Frontend static files
- Environment variables

### Manual Deployment
1. Build the frontend: `npm run build`
2. Start the backend: `npm run start`
3. Configure reverse proxy for API routes

## 👥 Contributors

**Abdirisak Gelle** - Lead Developer
- Full-stack development
- Database design and implementation
- API development and integration
- UI/UX design and implementation
- Authentication and security
- Testing and debugging

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

For support and questions, please contact:
- **Email**: [Your Email]
- **GitHub**: [@abdirisakgelle](https://github.com/abdirisakgelle)

---

**TaskPlus** - Comprehensive Support Ticket Management System
Built with ❤️ by Abdirisak Gelle