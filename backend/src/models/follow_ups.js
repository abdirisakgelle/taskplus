import mongoose from "mongoose";
import { nextId } from "../counters.js";

const schema = new mongoose.Schema({
  follow_up_id: { type: Number, unique: true, index: true },
  ticket_id: { type: Number, index: true },
  follow_up_agent_id: { type: Number, index: true, default: null },
  follow_up_date: { type: Date },
  issue_solved: { type: Boolean },
  satisfied: { type: Boolean },
  repeated_issue: { type: Boolean },
  follow_up_notes: { type: String },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

schema.pre("save", async function (next) {
  if (this.isNew && (this.follow_up_id === undefined || this.follow_up_id === null)) {
    this.follow_up_id = await nextId("follow_ups");
  }
  this.updatedAt = new Date();
  next();
});

export const FollowUp = mongoose.model("follow_ups", schema);


