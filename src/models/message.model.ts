import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function (this: any) { return !this.isSystemMessage; }
  },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupChat', required: true },
  content: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['edited', 'deleted']
  },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isSystemMessage: { type: Boolean },
  systemMessageData: { type: mongoose.Schema.Types.Mixed },
  systemMessageType: {
    type: String,
    enum: ['user_joined', 'user_left', 'group_created'],
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

messageSchema.index({ group: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ isSystemMessage: 1 });

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

export default Message;