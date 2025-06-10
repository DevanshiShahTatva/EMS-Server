import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    unreadCount: { type: Number, default: 0, index: true }
  }],
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', index: true },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupMessage', index: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

groupSchema.index({ 'members.user': 1, updatedAt: -1 });
groupSchema.index({ '_id': 1, 'members.user': 1 });

const GroupChat = mongoose.models.GroupChat || mongoose.model('GroupChat', groupSchema);

export default GroupChat;