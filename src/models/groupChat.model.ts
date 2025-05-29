import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

groupSchema.index({ members: 1 });

const GroupChat = mongoose.models.GroupChat || mongoose.model('GroupChat', groupSchema);

export default GroupChat;