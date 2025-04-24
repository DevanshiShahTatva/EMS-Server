import { Router } from "express";
import {
  loginUser,
  registerUser,
  forgotPassword,
  resetPassword,
  logoutUser,
  userDetails
} from "../controllers/authUserCtrl";
import { validateToken } from "../middlewares/checkToken";

const authRoutes = Router();

authRoutes.post("/signup", registerUser);
authRoutes.post("/login", loginUser);
authRoutes.post("/forgot_password", forgotPassword);
authRoutes.post("/reset_password", resetPassword);
authRoutes.get("/logout", logoutUser);
authRoutes.get("/user_details", validateToken, userDetails);

export default authRoutes;
