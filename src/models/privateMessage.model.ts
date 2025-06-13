import mongoose from 'mongoose';

const privateMessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  privateChat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PrivateChat',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  msgType: {
    type: String,
    enum: ['text', 'image']
  },
  status: {
    type: String,
    enum: ['edited', 'deleted']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

privateMessageSchema.index({ sender: 1, createdAt: -1 });

const PrivateMessage = mongoose.models.PrivateMessage || mongoose.model('PrivateMessage', privateMessageSchema);

export default PrivateMessage;