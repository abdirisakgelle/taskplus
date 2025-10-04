import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  ticket_id: {
    type: Number,
    unique: true,
    required: false
  },
  customer_phone: {
    type: String,
    required: true,
    trim: true
  },
  customer_location: {
    type: String,
    trim: true
  },
  communication_channel: {
    type: String,
    enum: ['WhatsApp', 'Phone', 'Email', 'In-App'],
    default: 'Phone'
  },
  device_type: {
    type: String,
    trim: true
  },
  issue_category: {
    type: String,
    required: true,
    enum: ['App', 'IPTV', 'Streaming', 'VOD', 'Subscription', 'OTP', 'Programming', 'Other']
  },
  issue_type: {
    type: String,
    trim: true
  },
  issue_description: {
    type: String,
    required: true,
    trim: true
  },
  agent_id: {
    type: mongoose.Schema.Types.Mixed,
    ref: 'Employee',
    required: false,
    default: null
  },
  first_call_resolution: {
    type: String,
    enum: ['Yes', 'No'],
    default: 'No'
  },
  resolution_status: {
    type: String,
    enum: ['Pending', 'In-Progress', 'Completed'],
    default: 'Pending'
  }
}, {
  timestamps: true
});

// Indexes for performance
ticketSchema.index({ ticket_id: 1 }, { unique: true });
ticketSchema.index({ createdAt: -1 });
ticketSchema.index({ resolution_status: 1 });
ticketSchema.index({ issue_category: 1 });
ticketSchema.index({ agent_id: 1 });
ticketSchema.index({ customer_phone: 1 });

// Virtual for computed ticket state
ticketSchema.virtual('ticket_state').get(function() {
  if (this.resolution_status === 'Completed') {
    return 'Closed';
  } else if (this.resolution_status === 'Pending' || this.resolution_status === 'In-Progress') {
    return 'Open';
  }
  return 'Unknown';
});

// Ensure virtual fields are serialized
ticketSchema.set('toJSON', { virtuals: true });
ticketSchema.set('toObject', { virtuals: true });

export const Ticket = mongoose.model('Ticket', ticketSchema);