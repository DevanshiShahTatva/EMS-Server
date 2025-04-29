import { Router } from "express";
import { validateToken } from "../middlewares/checkToken";
import {
  deleteEvent,
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
eventsRoutes.get("/reset_setting_password", validateToken, () => { console.log("called")});

export default eventsRoutes;
