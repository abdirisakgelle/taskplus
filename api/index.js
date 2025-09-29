import 'dotenv/config';
import { connectDB } from '../backend/src/db.js';
import app from '../backend/src/app.js';

// Cache connection across serverless invocations
let isConnected = false;

export default async function handler(req, res) {
  try {
    // Connect to MongoDB if not already connected
    if (!isConnected) {
      await connectDB();
      isConnected = true;
    }

    // Handle the request with Express app
    return app(req, res);
  } catch (error) {
    console.error('Serverless handler error:', error);
    return res.status(500).json({
      ok: false,
      error: { message: 'Internal server error' }
    });
  }
}
