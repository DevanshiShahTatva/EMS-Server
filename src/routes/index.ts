import { Router } from "express";
import authRoutes from "./authRoutes";
import eventsRoutes from "./eventsRoutes";
import ticketBookRoutes from "./eventBookRoutes";
import dashboardRoutes from "./dashboardRoutes";
import contactRoutes from "./contactRoutes";

const router = Router();
router.use(authRoutes);
router.use("/events", eventsRoutes);
router.use("/ticket/book", ticketBookRoutes);
router.use("/dashboard/analytics", dashboardRoutes);
router.use("/contact-us", contactRoutes);

export default router;
