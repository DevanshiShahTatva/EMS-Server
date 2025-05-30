import { Router } from "express";
import {
  getAllNotification,
  postNotification,
  markAsReadNotification,
  markAsAllReadNotification,
} from "../controllers/notificationCtrl";
import { validateToken } from "../middlewares/checkToken";

const router = Router();

router.get("/get-all-notification", validateToken, getAllNotification);
router.post("/post-notification", validateToken, postNotification);
router.delete(
  "/mark-as-read/:notificationId",
  validateToken,
  markAsReadNotification
);
router.delete("/mark-as-all-read", validateToken, markAsAllReadNotification);

export default router;
