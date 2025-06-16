import mongoose from 'mongoose';

const groupMessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function (this: any) {
      return !this.isSystemMessage;
    },
    index: true
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupChat',
    required: function (this: any) {
      return !this.privateChat && !this.isSystemMessage;
    },
    index: true
  },
  content: { type: String, required: true, trim: true },
  imageId: { type: String },
  msgType: {
    type: String,
    enum: ['text', 'image']
  },
  status: {
    type: String,
    enum: ['edited', 'deleted'],
    index: true
  },
  isSystemMessage: { type: Boolean, index: true },
  systemMessageType: {
    type: String,
    enum: ['user_joined', 'user_left', 'user_added', 'user_removed'],
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

const GroupMessage = mongoose.models.GroupMessage || mongoose.model('GroupMessage', groupMessageSchema);

export default GroupMessage;