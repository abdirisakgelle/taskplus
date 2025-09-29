import express from "express";
import mongoose from "mongoose";

const router = express.Router();

/**
 * Health check endpoint
 * Returns API status and MongoDB connection status with real ping
 * GET /api/health
 * 
 * Response format follows .cursorrules envelope:
 * { ok: true, data: { api: true, db: { readyState, stateText, name, host, ping } } }
 */
router.get("/", async (req, res, next) => {
  try {
    const connection = mongoose.connection;
    
    // Map readyState numbers to descriptive text
    const stateMap = {
      0: 'disconnected',
      1: 'connected', 
      2: 'connecting',
      3: 'disconnecting'
    };

    const readyState = connection.readyState;
    const stateText = stateMap[readyState] || 'unknown';
    const dbName = connection.name || 'unknown';
    const host = connection.host || 'unknown';

    // Perform real ping to MongoDB
    let ping = false;
    try {
      if (readyState === 1) { // Only ping if connected
        const result = await connection.db.admin().command({ ping: 1 });
        ping = result?.ok === 1;
      }
    } catch (pingError) {
      // Ping failed, but don't throw - just report ping: false
      ping = false;
    }

    // Return health status following envelope format
    res.json({
      ok: true,
      data: {
        api: true,
        db: {
          readyState,
          stateText,
          name: dbName,
          host,
          ping
        }
      }
    });

  } catch (err) {
    next(err);
  }
});

export default router;
