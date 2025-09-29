import mongoose from "mongoose";
import { nextId } from "../counters.js";

const schema = new mongoose.Schema({
  idea_id: { type: Number, unique: true, index: true },
  submission_date: { type: Date },
  title: { type: String, required: true },
  contributor: { type: Number, index: true },
  status: { type: String, default: "Draft" },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

schema.pre("save", async function (next) {
  if (this.isNew && (this.idea_id === undefined || this.idea_id === null)) {
    this.idea_id = await nextId("ideas");
  }
  this.updatedAt = new Date();
  next();
});

export const Idea = mongoose.model("ideas", schema);


