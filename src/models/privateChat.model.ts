import mongoose from 'mongoose';

const privateChatSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'PrivateMessage' },
  senderVisible: { type: Boolean, default: false },
  receiverVisible: { type: Boolean, default: false },
  senderUnreadCount: { type: Number, default: 0, index: true },
  receiverUnreadCount: { type: Number, default: 0, index: true },
  hasMessages: { type: Boolean, default: false },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

privateChatSchema.index({ updatedAt: -1 });

const PrivateChat = mongoose.models.PrivateChat || mongoose.model('PrivateChat', privateChatSchema);

export default PrivateChat;