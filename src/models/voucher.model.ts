import mongoose from "mongoose";

const VoucherSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  description: { type: String, required: true },
  expireTime: { type: Date, required: true },
  promoCode: { type: String, required: true },
  maxDiscount: { type: Number, required: true, default: 0 },
  percentage: { type: Number, required: true, default: 100 },
  used: { type: Boolean, required: true, default: false },
  appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  appliedAt: { type: Date, default: null },
},
  { timestamps: true }
);

const Voucher = mongoose.models.Vouchers || mongoose.model("Vouchers", VoucherSchema);

export default Voucher;