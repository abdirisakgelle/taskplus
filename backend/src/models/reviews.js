import mongoose from "mongoose";
import { nextId } from "../counters.js";

const schema = new mongoose.Schema({
  review_id: { type: Number, unique: true, index: true },
  ticket_id: { type: Number, index: true },
  reviewer_id: { type: Number, index: true },
  review_date: { type: Date },
  issue_status: { type: String },
  resolved: { type: Boolean },
  notes: { type: String },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

schema.pre("save", async function (next) {
  if (this.isNew && (this.review_id === undefined || this.review_id === null)) {
    this.review_id = await nextId("reviews");
  }
  this.updatedAt = new Date();
  next();
});

export const Review = mongoose.model("reviews", schema);


