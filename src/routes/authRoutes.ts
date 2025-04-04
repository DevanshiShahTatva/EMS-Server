import { Router } from "express";
import { registerUser } from "../controllers/registerUserCtrl";

const authRoutes = Router();

authRoutes.post("/signup", registerUser);

export default authRoutes;