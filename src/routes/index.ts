import { Router } from "express";
import authRoutes from "./authRoutes";
import eventsRoutes from "./eventsRoutes";
import ticketBookRoutes from "./eventBookRoutes";

const router = Router();
router.use(authRoutes);
router.use("/events", eventsRoutes);
router.use("/ticket/book", ticketBookRoutes);

export default router;
