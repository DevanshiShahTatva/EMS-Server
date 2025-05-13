import { Router } from "express";
import { validateToken } from "../middlewares/checkToken";
import { deleteFeedback, editFeedback, getFeedbackByUserId } from "../controllers/feedbackEventCtrl";

const feedbackRoutes = Router();

feedbackRoutes.get("/",validateToken ,getFeedbackByUserId);
feedbackRoutes.put("/:id",validateToken,editFeedback);
feedbackRoutes.delete("/:id",validateToken,deleteFeedback);

export default feedbackRoutes;