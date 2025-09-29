import mongoose from "mongoose";

const schema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  label: {
    type: String,
    required: true
  },
  group: {
    type: String
  },
  description: {
    type: String
  }
}, {
  timestamps: true
});

export const Permission = mongoose.model("Permission", schema);