import mongoose, { Schema } from 'mongoose';

const PointSettingSchema = new Schema({
  conversionRate: { type: Number, required: true, default: 10 },
}, {
  timestamps: true,
});

const PointSettingModal = mongoose.models.PointSettingModal || mongoose.model('PointSetting', PointSettingSchema);

export default PointSettingModal;