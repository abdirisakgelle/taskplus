import mongoose from "mongoose";

const schema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

// Unique index on name with case-insensitive collation
schema.index({ name: 1 }, { 
  unique: true,
  collation: { locale: 'en', strength: 2 }
});

export const Department = mongoose.model("Department", schema);