import mongoose from "mongoose";

const PointTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  activityType: { type: String, enum: ['EARN', 'REDEEM'], required: true },
  description: { type: String, required: true },
  points: { type: Number, required: true },
},
  { timestamps: true }
);

const PointTransaction = mongoose.models.PointTransaction || mongoose.model("PointTransaction", PointTransactionSchema);

export default PointTransaction;