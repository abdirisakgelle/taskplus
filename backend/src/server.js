import "dotenv/config";
import { connectDB } from "./db.js";
import app from "./app.js";

const PORT = process.env.PORT || 8000;

// Connect to MongoDB first, then start server
async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => console.log(`🚀 taskplus-backend listening on :${PORT}`));
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB:", err.message);
    process.exit(1);
  }
}

startServer();


