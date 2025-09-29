# TaskPlus Deployment Guide - Vercel Single Platform

## 🚀 Overview
This guide covers deploying TaskPlus as a single platform on Vercel, with:
- **Frontend**: React/Vite served as static files
- **Backend**: Express API running as Vercel Serverless Functions
- **Database**: MongoDB Atlas (already configured)

## 📁 Project Structure (Post-Deployment Setup)
```
TaskPlus/
├── api/
│   └── index.js              # Vercel serverless handler
├── backend/
│   ├── src/
│   │   ├── app.js           # Express app (no listen)
│   │   ├── server.js        # Local dev only
│   │   └── ...              # Routes, models, etc.
│   └── package.json
├── frontend/
│   ├── src/
│   │   └── lib/api.js       # Updated for Vercel
│   └── package.json
├── vercel.json              # Vercel configuration
├── package.json             # Root build script
└── DEPLOYMENT_GUIDE.md      # This file
```

## 🔧 Pre-Deployment Steps

### 1. Seed Your Database (One Time)
Run this locally to populate your MongoDB Atlas database:

```bash
# Make sure your MongoDB Atlas URI is in backend/.env
cd backend
npm run seed
```

### 2. Test Locally (Optional)
```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

## 🌐 Vercel Deployment

### 1. Connect Repository
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. **Framework Preset**: Other
5. **Build Command**: `npm run build`
6. **Output Directory**: `frontend/dist`

### 2. Environment Variables
Add these in Vercel → Project Settings → Environment Variables:

#### Required Variables:
```bash
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB=taskplus

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
COOKIE_NAME=taskplus_token

# Environment
NODE_ENV=production
FRONTEND_URL=https://your-app-name.vercel.app

# Optional API Config
VITE_API_URL=/api
```

#### How to get FRONTEND_URL:
1. Deploy first without FRONTEND_URL
2. Note your Vercel domain (e.g., `https://taskplus-abc123.vercel.app`)
3. Add FRONTEND_URL with that exact URL
4. Redeploy

### 3. MongoDB Atlas Configuration
Ensure your Atlas cluster allows connections:
1. Go to MongoDB Atlas → Network Access
2. Add IP Address: `0.0.0.0/0` (Allow from anywhere)
   - Or add Vercel's specific IP ranges if you prefer

### 4. Deploy
1. Push your code to GitHub
2. Vercel will automatically deploy
3. First deployment may take 2-3 minutes

## ✅ Post-Deployment Testing

### 1. Health Check
Visit: `https://your-app.vercel.app/api/health`

Expected response:
```json
{
  "ok": true,
  "data": {
    "api": true,
    "db": {
      "readyState": 1,
      "stateText": "connected",
      "name": "taskplus",
      "host": "your-atlas-host",
      "ping": true
    }
  }
}
```

### 2. Login Test
1. Visit: `https://your-app.vercel.app`
2. Login with: `admin` / `Passw0rd!`
3. Verify you can access Management → Departments
4. Test permissions assignment

### 3. API Endpoints Test
All these should work:
- `GET /api/auth/me` - User profile
- `GET /api/departments` - List departments
- `GET /api/users` - List users (with permissions)
- `GET /api/access/permissions` - List all permissions

## 🔧 Configuration Details

### Vercel Serverless Function
- **Runtime**: Node.js 18.x
- **Memory**: 1024MB
- **Timeout**: 10 seconds (Vercel default)
- **Cold starts**: ~1-2 seconds for first request

### CORS Configuration
The backend automatically allows your Vercel domain via `FRONTEND_URL`. CORS is configured for:
- Credentials: `true` (for HttpOnly cookies)
- Origin: Your Vercel domain

### Cookie Security
- **HttpOnly**: ✅ Prevents XSS
- **Secure**: ✅ HTTPS only (automatic on Vercel)
- **SameSite**: `lax` (allows navigation)

## 🐛 Troubleshooting

### Common Issues

#### 1. "Network error" on login
**Cause**: CORS or API URL misconfiguration
**Fix**: 
- Check `FRONTEND_URL` matches your exact Vercel domain
- Verify `VITE_API_URL=/api` is set
- Check browser network tab for actual error

#### 2. "Internal server error" on API calls
**Cause**: Database connection or environment variables
**Fix**:
- Check Vercel Function Logs
- Verify `MONGODB_URI` and `MONGODB_DB` are correct
- Test database connection with MongoDB Compass

#### 3. "Access denied" on pages
**Cause**: User permissions not properly assigned
**Fix**:
- Re-run seed script: `npm run seed`
- Check user permissions in Management → Permissions
- Verify JWT_SECRET is consistent

#### 4. Slow API responses
**Cause**: Cold starts or database queries
**Fix**:
- Normal for first request after inactivity
- Consider upgrading to Vercel Pro for faster cold starts
- Optimize database queries with indexes

### Debug Commands

```bash
# Check database connection locally
cd backend
node -e "import('./src/db.js').then(({connectDB}) => connectDB().then(() => console.log('✅ DB Connected')))"

# Test API locally
curl http://localhost:8000/api/health

# Check production API
curl https://your-app.vercel.app/api/health
```

### Vercel Function Logs
1. Go to Vercel Dashboard → Your Project
2. Click "Functions" tab
3. Click on `/api/index.js`
4. View real-time logs for debugging

## 🔄 Updates & Redeployment

### Automatic Deployment
- Push to main branch → Vercel auto-deploys
- Environment variable changes → Requires manual redeploy

### Manual Redeploy
1. Vercel Dashboard → Your Project
2. "Deployments" tab
3. Click "..." on latest deployment
4. "Redeploy"

### Database Updates
- Schema changes: Update models and restart
- New permissions: Re-run `npm run seed`
- User changes: Use the Management interface

## 📊 Performance Considerations

### Serverless Function Limits
- **Memory**: 1024MB (can increase to 3GB on Pro)
- **Execution Time**: 10s (60s on Pro)
- **Concurrent Executions**: 1000 (unlimited on Pro)

### Optimization Tips
1. **Database Queries**: Use `.lean()` for read-only operations
2. **Caching**: Connection pooling is handled automatically
3. **Bundle Size**: Keep dependencies minimal
4. **Cold Starts**: Consider Vercel Pro for better performance

## 🔒 Security Checklist

- ✅ MongoDB Atlas IP whitelist configured
- ✅ JWT_SECRET is strong and unique
- ✅ HTTPS enforced (automatic on Vercel)
- ✅ HttpOnly cookies for authentication
- ✅ CORS restricted to your domain
- ✅ No secrets in client-side code
- ✅ Environment variables properly set

## 🎉 Success!

Your TaskPlus application is now deployed on Vercel with:
- ✅ Single platform hosting (frontend + API)
- ✅ MongoDB Atlas integration
- ✅ Secure authentication with HttpOnly cookies
- ✅ Role-based permissions system
- ✅ Page-level access control
- ✅ Complete management interface

**Live URLs:**
- **App**: `https://your-app.vercel.app`
- **API**: `https://your-app.vercel.app/api`
- **Health**: `https://your-app.vercel.app/api/health`

## 📞 Support

If you encounter issues:
1. Check Vercel Function logs
2. Verify environment variables
3. Test API endpoints directly
4. Review MongoDB Atlas connection settings

The deployment is now complete and ready for production use! 🚀
