import { Router } from "express";
import { getWitAiResponse } from "../controllers/chatbotController";

const router = Router();

router.post("/chat", getWitAiResponse);

export default router;
