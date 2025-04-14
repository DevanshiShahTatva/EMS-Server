import mongoose from "mongoose";

const signupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, "Password is required"],
  },
});

signupSchema.set("toJSON", {
  transform: function (_doc, ret, _options) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.models.User || mongoose.model("User", signupSchema);

export default User;
