import mongoose from "mongoose";
import { nextId } from "../counters.js";

const schema = new mongoose.Schema({
  production_id: { type: Number, unique: true, index: true },
  content_id: { type: Number, index: true },
  editor_id: { type: Number, index: true },
  production_status: { type: String, default: "Editing" },
  completion_date: { type: Date, default: null },
  sent_to_social_team: { type: Boolean, default: false },
  notes: { type: String },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

schema.pre("save", async function (next) {
  if (this.isNew && (this.production_id === undefined || this.production_id === null)) {
    this.production_id = await nextId("production");
  }
  this.updatedAt = new Date();
  next();
});

export const Production = mongoose.model("production", schema);


