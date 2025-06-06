import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, default: Date.now },
    unreadCount: { type: Number, default: 0 }
  }],
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupMessage' },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

groupSchema.index({ members: 1, updatedAt: -1 });
groupSchema.index({ 'lastMessage.createdAt': -1 });
groupSchema.index({ lastMessage: -1 });
groupSchema.index({ updatedAt: -1 });

const GroupChat = mongoose.models.GroupChat || mongoose.model('GroupChat', groupSchema);

export default GroupChat;