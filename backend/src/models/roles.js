import mongoose from "mongoose";

const schema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  label: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  permissions: [{
    type: String,
    required: true
  }]
}, {
  timestamps: true
});

export const Role = mongoose.model("Role", schema);
