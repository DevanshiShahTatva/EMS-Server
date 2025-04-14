import { Router } from "express";
import {
  loginUser,
  registerUser,
  forgotPassword,
  ResetPassword
} from "../controllers/authUserCtrl";

const authRoutes = Router();

authRoutes.post("/signup", registerUser);
authRoutes.post("/login", loginUser);
authRoutes.post("/forgot_password", forgotPassword);
authRoutes.post("/reset_password", ResetPassword);

export default authRoutes;
