import mongoose from "mongoose";
import { nextId } from "../counters.js";

const schema = new mongoose.Schema({
  vod_id: { type: Number, unique: true, index: true },
  title: { type: String, required: true },
  category: { type: String },
  channel: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

schema.pre("save", async function (next) {
  if (this.isNew && (this.vod_id === undefined || this.vod_id === null)) {
    this.vod_id = await nextId("vod");
  }
  this.updatedAt = new Date();
  next();
});

export const Vod = mongoose.model("vod", schema);


