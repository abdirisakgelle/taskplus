export default function handler(_req, res) {
  res.status(200).json({
    has_MONGODB_URI: !!process.env.MONGODB_URI,
    MONGODB_DB: process.env.MONGODB_DB || null,
    NODE_ENV: process.env.NODE_ENV || null,
    on_vercel: !!process.env.VERCEL
  })
}
