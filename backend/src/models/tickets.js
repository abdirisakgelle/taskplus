import mongoose from "mongoose";
import { nextId } from "../counters.js";

const schema = new mongoose.Schema({
  ticket_id: { type: Number, unique: true, index: true },
  customer_phone: { type: String },
  customer_location: { type: String },
  communication_channel: { type: String, enum: ["WhatsApp", "Phone"] },
  device_type: { type: String },
  issue_type: { type: String },
  issue_description: { type: String },
  agent_id: { type: Number, index: true },
  first_call_resolution: { type: Boolean, default: false },
  resolution_status: { type: String, default: "Open" },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

schema.pre("save", async function (next) {
  if (this.isNew && (this.ticket_id === undefined || this.ticket_id === null)) {
    this.ticket_id = await nextId("tickets");
  }
  this.updatedAt = new Date();
  next();
});

export const Ticket = mongoose.model("tickets", schema);


