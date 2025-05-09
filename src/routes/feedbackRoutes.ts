import { Router } from "express";
import { validateToken } from "../middlewares/checkToken";
import { getFeedbackByUserId } from "../controllers/feedbackEventCtrl";

const feedbackRoutes = Router();

feedbackRoutes.get("/",validateToken ,getFeedbackByUserId);

export default feedbackRoutes;