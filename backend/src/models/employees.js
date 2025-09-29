import mongoose from "mongoose";
import { nextId } from "../counters.js";

const schema = new mongoose.Schema({
  employee_id: { type: Number, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  shift: { type: String, enum: ["Morning", "Afternoon", "Night"] },
  title: { type: String },
  departmentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Department', 
    required: true 
  },
  sectionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Section', 
    required: true 
  },
  phone: { type: String },
}, {
  timestamps: true
});

schema.pre("save", async function (next) {
  if (this.isNew && (this.employee_id === undefined || this.employee_id === null)) {
    this.employee_id = await nextId("employees");
  }
  next();
});

export const Employee = mongoose.model("Employee", schema);


