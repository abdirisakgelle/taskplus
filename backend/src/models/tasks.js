import mongoose from "mongoose";
import { nextId } from "../counters.js";

const schema = new mongoose.Schema({
  task_id: { type: Number, unique: true, index: true },
  title: { type: String, required: true },
  description: { type: String },
  assigned_to: { type: Number, index: true },
  created_by: { type: Number, index: true },
  status: { type: String, default: "Not Started" },
  priority: { type: String, default: "Medium" },
  due_date: { type: Date, default: null },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

schema.pre("save", async function (next) {
  if (this.isNew && (this.task_id === undefined || this.task_id === null)) {
    this.task_id = await nextId("tasks");
  }
  this.updatedAt = new Date();
  next();
});

export const Task = mongoose.model("tasks", schema);


