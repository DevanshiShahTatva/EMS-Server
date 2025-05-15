import mongoose from "mongoose";

const cancelChargeSchema = new mongoose.Schema({
  charge: {
    type: Number,
    default: 0,
  },
});

export const CancelCharge =
  mongoose.models.CancelCharge ||
  mongoose.model("CancelCharge", cancelChargeSchema);
