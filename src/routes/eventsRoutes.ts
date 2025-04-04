import { Router } from "express";
import { validateToken } from "../middlewares/checkToken";
import { getEvents, postEvent } from "../controllers/eventCtrl";

const eventsRoutes = Router();

eventsRoutes.post("/event", validateToken, postEvent);
eventsRoutes.get("/events", validateToken, getEvents);

export default eventsRoutes;