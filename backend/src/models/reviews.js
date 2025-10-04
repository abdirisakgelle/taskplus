import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  review_id: {
    type: Number,
    unique: true,
    required: true
  },
  ticket_id: {
    type: Number,
    ref: 'Ticket',
    required: true
  },
  reviewer_id: {
    type: Number,
    ref: 'Employee',
    required: true
  },
  review_date: {
    type: Date,
    default: Date.now
  },
  issue_status: {
    type: String,
    required: true,
    trim: true
  },
  resolved: {
    type: Boolean,
    required: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for performance
reviewSchema.index({ review_id: 1 }, { unique: true });
reviewSchema.index({ ticket_id: 1 });
reviewSchema.index({ reviewer_id: 1 });
reviewSchema.index({ review_date: -1 });

export const Review = mongoose.model('Review', reviewSchema);