import mongoose from "mongoose";

const schema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  roles: [{
    type: String
  }],
  permsExtra: [{
    type: String
  }],
  permsDenied: [{
    type: String
  }],
  homeRoute: {
    type: String
  },
  // Page-level access control
  pageAccess: [{
    permission: { type: String, required: true }, // e.g., 'management.users'
    allowedPages: [{ type: Number, min: 1 }], // specific page numbers user can access
    maxPages: { type: Number, min: 1 }, // maximum pages user can view (if not specified, no limit)
    sectionsAllowed: [{ type: String }] // specific sections/departments user can access
  }],
  // Department/Section restrictions
  departmentRestrictions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  }],
  sectionRestrictions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section'
  }]
}, {
  timestamps: true
});

export const UserAccess = mongoose.model("UserAccess", schema);
