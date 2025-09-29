import mongoose from "mongoose";

export async function connectDB() {
  // Support both MONGODB_URI and MONGO_URI environment variables
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  
  if (!uri) {
    throw new Error("MongoDB URI is required. Please set MONGODB_URI or MONGO_URI environment variable.");
  }

  mongoose.set("strictQuery", true);

  // Connect with optional dbName from environment
  const connectOptions = {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  };

  // If MONGODB_DB is set, add it to connection options
  if (process.env.MONGODB_DB) {
    connectOptions.dbName = process.env.MONGODB_DB;
  }

  await mongoose.connect(uri, connectOptions);

  // Get connection info for logging
  const connection = mongoose.connection;
  const host = connection.host || 'unknown';
  const dbName = connection.name || process.env.MONGODB_DB || 'default';

  console.log(`✅ Mongo connected → ${host} DB: ${dbName}`);

  // Add connection event listeners
  connection.on('error', (e) => {
    console.error('❌ Mongo error:', e.message);
  });

  connection.on('disconnected', () => {
    console.warn('⚠️ Mongo disconnected');
  });

  return connection;
}


