import { Router } from "express";
import {
  getAllNotification,
  postNotification,
  markAsReadNotification,
  markAsAllReadNotification,
  registerFcmToken,
  unregisterFCMToken,
  readNotification
} from "../controllers/notificationCtrl";
import { validateToken } from "../middlewares/checkToken";

const router = Router();

router.get("/get-all-notification", validateToken, getAllNotification);
router.post("/post-notification", validateToken, postNotification);
router.post("/register/fcm-token", validateToken, registerFcmToken);
router.post("/unregister/fcm-token", validateToken, unregisterFCMToken);
router.delete(
  "/mark-as-read/:notificationId",
  validateToken,
  markAsReadNotification
);
router.delete("/mark-as-all-read", validateToken, markAsAllReadNotification);
router.put("/read-notification/:id", validateToken, readNotification);

export default router;
