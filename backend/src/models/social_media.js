import mongoose from "mongoose";
import { nextId } from "../counters.js";

const schema = new mongoose.Schema({
  post_id: { type: Number, unique: true, index: true },
  content_id: { type: Number, index: true },
  platforms: { type: String },
  post_type: { type: String },
  post_date: { type: Date },
  caption: { type: String },
  status: { type: String, default: "Draft" },
  approved: { type: Boolean },
  notes: { type: String },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

schema.pre("save", async function (next) {
  if (this.isNew && (this.post_id === undefined || this.post_id === null)) {
    this.post_id = await nextId("social_media");
  }
  this.updatedAt = new Date();
  next();
});

export const SocialMedia = mongoose.model("social_media", schema);


