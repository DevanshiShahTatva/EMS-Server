import { Router } from "express";
import authRoutes from "./authRoutes";
import eventsRoutes from "./eventsRoutes";

const router = Router();
router.use(authRoutes);
router.use("/events", eventsRoutes);

export default router;
