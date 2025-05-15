import mongoose, { Schema } from 'mongoose';

const PointSettingSchema = new Schema({
  conversionRate: { type: Number, required: true, default: 10 },
}, {
  timestamps: true,
});

const PointSetting = mongoose.models.PointSettingModal || mongoose.model('PointSetting', PointSettingSchema);

export default PointSetting;