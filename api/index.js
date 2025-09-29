// api/index.js
import 'dotenv/config'
import { connectDB } from '../backend/src/db.js'
import app from '../backend/src/app.js'

let connected = false

export default async function handler(req, res) {
  try {
    const shouldConnect = process.env.SKIP_DB !== '1'

    if (shouldConnect && !connected) {
      if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI is missing')
        return res.status(500).json({ ok: false, error: 'MONGODB_URI missing' })
      }
      await connectDB()
      connected = true
      console.log('DB connected (cached).')
    }

    return app(req, res)
  } catch (err) {
    console.error('Handler error:', err?.stack || err?.message || err)
    return res.status(500).json({ ok: false, error: 'Internal server error' })
  }
}