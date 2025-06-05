import { Router } from "express";
import { validateToken } from "../middlewares/checkToken";
import { getGroupMessages, groupChatList } from "../controllers/groupChatController";
import { privateChatList, createPrivateChat, getPrivateMessages } from "../controllers/PrivateChatController";

const router = Router();

router.get("/my-group-chat", validateToken, groupChatList);
router.get('/messages/:groupId', validateToken, getGroupMessages);

router.post('/create-private-chat', validateToken, createPrivateChat);
router.get('/my-private-chat', validateToken, privateChatList);
router.get('/private-messages/:chatId', validateToken, getPrivateMessages);

export default router;