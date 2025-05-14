import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    eventId : {type:mongoose.Schema.Types.ObjectId,ref:"Event",require:true},
    userId: {type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
    name: { type: String, required: true },
    email: { type: String, required: true },
    rating: { type: Number, required: true },
    description: { type: String },
    isEdited:{ type:Boolean, default:false },
    profileimage: { type: String} ,
  },
  { timestamps: true }
)

const Feedback =
  mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);

export default Feedback;