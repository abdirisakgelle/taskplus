// backend/src/db.js
import mongoose from 'mongoose'

export async function connectDB() {
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB || 'taskplus'
  if (!uri) throw new Error('MONGODB_URI is required')

  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState === 1) return
  if (mongoose.connection.readyState === 2) return

  await mongoose.connect(uri, {
    dbName,
    maxPoolSize: 1,
    serverSelectionTimeoutMS: 5000
  })

  console.log(`✅ Mongo connected → ${mongoose.connection.host} DB: ${dbName}`)
}