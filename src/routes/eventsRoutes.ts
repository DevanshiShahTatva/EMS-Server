import { Router } from "express";
import { validateAdminToken, validateToken } from "../middlewares/checkToken";
import {
  deleteEvent,
  getEventById,
  getEvents,
  likeEvent,
  postEvent,
  putEvent,
} from "../controllers/eventCtrl";
import { feedbackEvent, getFeedbackByEventId, getFeedbackByUserId } from "../controllers/feedbackEventCtrl";
import multer from "multer";

const upload = multer();

const eventsRoutes = Router();

// PUBLIC
eventsRoutes.get("/", validateToken, getEvents);
eventsRoutes.get("/:id", validateToken, getEventById);
eventsRoutes.post("/:id/like", validateToken, likeEvent);
eventsRoutes.post("/:id/feedback", validateToken, feedbackEvent);
eventsRoutes.get("/:id/feedbacks",validateToken,getFeedbackByEventId);

// ADMIN ONLY
eventsRoutes.post("/", validateAdminToken, upload.array("images", 5), postEvent);
eventsRoutes.put("/:id", validateAdminToken, upload.array("images", 5), putEvent);
eventsRoutes.delete("/:id", validateAdminToken, deleteEvent);

export default eventsRoutes;
