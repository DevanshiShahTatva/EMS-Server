import { Router } from "express";
import { validateToken } from "../middlewares/checkToken";
import { getGroupMessages, groupChatList } from "../controllers/chatController";

const router = Router();

router.get("/my-group", validateToken, groupChatList);
router.get('/messages/:groupId', validateToken, getGroupMessages);

export default router;