import { Router } from "express";
import { validateToken } from "../middlewares/checkToken";
import {
  deleteEvent,
  feedbackEvent,
  getEventById,
  getEvents,
  likeEvent,
  postEvent,
  putEvent,
} from "../controllers/eventCtrl";
import multer from "multer";

const upload = multer();

const eventsRoutes = Router();

eventsRoutes.post(
  "/",
  validateToken,
  upload.array("images", 5),
  postEvent
);
eventsRoutes.get("/", validateToken, getEvents);
eventsRoutes.get("/:id", validateToken, getEventById);
eventsRoutes.put(
  "/:id",
  validateToken,
  upload.array("images", 5),
  putEvent
);
eventsRoutes.delete("/:id", validateToken, deleteEvent);
eventsRoutes.post("/:id/like", validateToken, likeEvent);
eventsRoutes.post("/:id/feedback", validateToken, feedbackEvent);

export default eventsRoutes;
