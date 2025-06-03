import mongoose from 'mongoose';

const groupMessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function (this: any) {
      return !this.isSystemMessage;
    }
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupChat',
    required: function (this: any) {
      return !this.privateChat && !this.isSystemMessage;
    }
  },
  content: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['edited', 'deleted']
  },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isSystemMessage: { type: Boolean },
  systemMessageType: {
    type: String,
    enum: ['user_joined', 'user_left', 'group_created'],
    required: function (this: any) {
      return this.isSystemMessage;
    }
  },
  systemMessageData: {
    type: mongoose.Schema.Types.Mixed,
    required: function (this: any) {
      return this.isSystemMessage;
    }
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

groupMessageSchema.index({ group: 1, createdAt: -1 });
groupMessageSchema.index({ sender: 1, createdAt: -1 });
groupMessageSchema.index({ isSystemMessage: 1 });

const GroupMessage = mongoose.models.GroupMessage || mongoose.model('GroupMessage', groupMessageSchema);

export default GroupMessage;