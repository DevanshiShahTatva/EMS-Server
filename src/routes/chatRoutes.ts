import { Router } from "express";
import { validateAdminToken, validateToken } from "../middlewares/checkToken";
import { getGroupMessages, groupChatList, addMembersInGroup, removeMemberFromGroup } from "../controllers/groupChatController";
import { privateChatList, createPrivateChat, getPrivateMessages } from "../controllers/PrivateChatController";

const router = Router();

router.get("/my-group-chat", validateToken, groupChatList);
router.get('/messages/:groupId', validateToken, getGroupMessages);
router.post('/add-members/:groupId', validateAdminToken, addMembersInGroup);
router.post('/remove-member/:groupId', validateAdminToken, removeMemberFromGroup);

router.post('/create-private-chat', validateToken, createPrivateChat);
router.get('/my-private-chat', validateToken, privateChatList);
router.get('/private-messages/:chatId', validateToken, getPrivateMessages);

export default router;