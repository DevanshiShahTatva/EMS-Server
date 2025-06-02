import { Router } from "express";
import { validateToken } from "../middlewares/checkToken";
import { getWitAiResponse } from "../controllers/chatbotController";

const router = Router();

router.post("/chat", validateToken, getWitAiResponse);

export default router;
