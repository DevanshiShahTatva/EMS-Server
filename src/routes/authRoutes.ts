import { Router } from "express";
import {
  loginUser,
  registerUser,
  forgotPassword,
  resetPassword,
  logoutUser,
  userDetails,
  updateUser,
  settingResetPassword,
  settingResetEmail,
  settingVerifyEmail
} from "../controllers/authUserCtrl";
import { validateToken } from "../middlewares/checkToken";
import multer from "multer";

const upload = multer();
const authRoutes = Router();

authRoutes.post("/signup", registerUser);
authRoutes.post("/login", loginUser);
authRoutes.post("/forgot_password", forgotPassword);
authRoutes.post("/reset_password", resetPassword);
authRoutes.get("/logout", logoutUser);
authRoutes.get("/user_details", validateToken, userDetails);
authRoutes.put(
  "/update/user",
  validateToken,
  upload.array("images", 1),
  updateUser
);
authRoutes.put("/reset_setting_password", validateToken, settingResetPassword);
authRoutes.put("/reset_setting_email", validateToken, settingResetEmail);
authRoutes.put("/verify_setting_email", validateToken, settingVerifyEmail);

export default authRoutes;
