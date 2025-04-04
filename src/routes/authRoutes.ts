import { Router } from "express";
import { loginUser, registerUser } from "../controllers/authUserCtrl";

const authRoutes = Router();

authRoutes.post("/signup", registerUser);
authRoutes.post("/login", loginUser);

export default authRoutes;