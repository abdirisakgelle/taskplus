import mongoose from "mongoose";
import { nextId } from "../counters.js";

const schema = new mongoose.Schema({
  notification_id: { type: Number, unique: true, index: true },
  user_id: { type: Number, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: "system" },
  is_read: { type: Boolean, default: false },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

schema.pre("save", async function (next) {
  if (this.isNew && (this.notification_id === undefined || this.notification_id === null)) {
    this.notification_id = await nextId("notifications");
  }
  this.updatedAt = new Date();
  next();
});

export const Notification = mongoose.model("notifications", schema);


