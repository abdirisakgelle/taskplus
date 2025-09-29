import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { collection: "counters" }
);

export const Counter = mongoose.model("Counter", counterSchema);

export async function nextId(name) {
  const updated = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  ).lean();
  return updated.seq;
}


