import mongoose from 'mongoose';

const SponsorshipSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  organizerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organizer', // or User
    required: true
  },
  image: {
    type: String, 
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  appliedAt: {
    type: Date,
    default: Date.now
  },
  decisionAt: {
    type: Date
  }
});

export default mongoose.model('Sponsorship', SponsorshipSchema);
