import mongoose from "mongoose";
import { nextId } from "../counters.js";

const schema = new mongoose.Schema({
  content_id: { type: Number, unique: true, index: true },
  content_date: { type: Date },
  idea_id: { type: Number, index: true },
  script_writer_employee_id: { type: Number, index: true },
  director_employee_id: { type: Number, index: true },
  filming_date: { type: Date, default: null },
  cast_and_presenters: { type: [Number], default: [] },
  notes: { type: String },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

schema.pre("save", async function (next) {
  if (this.isNew && (this.content_id === undefined || this.content_id === null)) {
    this.content_id = await nextId("content");
  }
  this.updatedAt = new Date();
  next();
});

export const Content = mongoose.model("content", schema);


