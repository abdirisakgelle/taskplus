import mongoose from 'mongoose';

const followUpSchema = new mongoose.Schema({
  follow_up_id: {
    type: Number,
    unique: true,
    required: true
  },
  ticket_id: {
    type: Number,
    ref: 'Ticket',
    required: true
  },
  follow_up_agent_id: {
    type: Number,
    ref: 'Employee',
    default: null
  },
  follow_up_date: {
    type: Date,
    default: Date.now
  },
  issue_solved: {
    type: Boolean,
    default: null
  },
  satisfied: {
    type: Boolean,
    default: null
  },
  repeated_issue: {
    type: Boolean,
    default: false
  },
  follow_up_notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for performance
followUpSchema.index({ follow_up_id: 1 }, { unique: true });
followUpSchema.index({ ticket_id: 1 });
followUpSchema.index({ follow_up_agent_id: 1 });
followUpSchema.index({ follow_up_date: -1 });

export const FollowUp = mongoose.model('FollowUp', followUpSchema);