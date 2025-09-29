import mongoose from "mongoose";

const schema = new mongoose.Schema({
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

// Compound unique index: same section name can exist in different departments
schema.index(
  { departmentId: 1, name: 1 }, 
  { 
    unique: true,
    collation: { locale: 'en', strength: 2 }
  }
);

export const Section = mongoose.model("Section", schema);