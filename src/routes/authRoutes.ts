import { Router } from "express";
import {
  loginUser,
  registerUser,
  forgotPassword,
  resetPassword,
  logoutUser
} from "../controllers/authUserCtrl";

const authRoutes = Router();

authRoutes.post("/signup", registerUser);
authRoutes.post("/login", loginUser);
authRoutes.post("/forgot_password", forgotPassword);
authRoutes.post("/reset_password", resetPassword);
authRoutes.get("/logout", logoutUser);

export default authRoutes;
