import "dotenv/config";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });

try {
  await client.connect();
  const ping = await client.db().admin().ping();
  console.log("✅ Connected & ping ok", ping);
} catch (e) {
  console.error("❌ Connect error", { name: e.name, code: e.code, codeName: e.codeName, message: e.message });
} finally {
  await client.close();
}


