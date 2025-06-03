import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function (this: any) {
      return !this.isSystemMessage;
    }
  },
  privateChat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PrivateChat',
    required: function (this: any) {
      return !this.group && !this.isSystemMessage;
    },
    validate: {
      validator: function (this: any, value: mongoose.Types.ObjectId) {
        return !this.group;
      },
      message: 'Cannot specify both privateChat and group'
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

messageSchema.index({ group: 1, createdAt: -1 });
messageSchema.index({ sender: 1, privateChat: 1, createdAt: -1 });
messageSchema.index({ isSystemMessage: 1 });

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

export default Message;