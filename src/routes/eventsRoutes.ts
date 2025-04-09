import { Router } from "express";
import { validateToken } from "../middlewares/checkToken";
import {
  deleteEvent,
  getEvents,
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
eventsRoutes.put(
  "/:id",
  validateToken,
  upload.array("images", 5),
  putEvent
);
eventsRoutes.delete("/:id", validateToken, deleteEvent);

export default eventsRoutes;
