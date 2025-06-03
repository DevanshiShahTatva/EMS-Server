import mongoose from 'mongoose';

const privateChatSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

privateChatSchema.index({ sender: 1, receiver: 1 }, { unique: true });

const PrivateChat = mongoose.models.PrivateChat || mongoose.model('PrivateChat', privateChatSchema);

export default PrivateChat;