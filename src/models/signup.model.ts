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
  profileimage: {
    type: {
      imageId: String,
      url: String,
    },
    default: null
  },
  address: { type: String, default: null },
  country: { type: String, default: null },
  state: { type: String, default: null },
  city: { type: String, default: null },
  zipcode: { type: String, default: null },
  latitude: { type: String, default: null },
  longitude: { type: String, default: null },
  otp: { type: String },
  otp_expiry: { type: Date },
  email_otp: { type: String },
  email_otp_expiry: { type: Date },
  role: {
    type: String,
    enum: ["user", "organizer"],
    default: "user",
  }
});

signupSchema.set("toJSON", {
  transform: function (_doc, ret, _options) {
    delete ret.password;
    delete ret.__v;
    delete ret.otp;
    delete ret.otp_expiry;
    return ret;
  },
});

const User = mongoose.models.User || mongoose.model("User", signupSchema);

export default User;
