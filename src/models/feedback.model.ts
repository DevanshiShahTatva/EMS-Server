import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    eventId : {type:mongoose.Schema.Types.ObjectId,ref:"Event",require:true},
    name: { type: String, required: true },
    email: { type: String, required: true },
    rating: { type: Number, required: true },
    description: { type: String },
  },
  { timestamps: true }
)

export const FeedbackModel = mongoose.model('Feedback', feedbackSchema)