import { Router } from "express";
import authRoutes from "./authRoutes";
import eventsRoutes from "./eventsRoutes";
import ticketBookRoutes from "./eventBookRoutes";
import dashboardRoutes from "./dashboardRoutes";
import contactRoutes from "./contactRoutes";
import faqRoutes from "./faqRoutes";
import termsRoutes from "./termsRoutes";
import feedbackRoutes from "./feedbackRoutes";
import ticketTypeRoutes from "./ticketTypeRoutes";
import pointSettingRoutes from "./pointSettingRoutes";
import ticketCategoryRoutes from "./ticketCategoryRoutes";
import adminConfigRoutes from "./adminConfigRoutes";
import voucherRoutes from "./voucherRoutes";
import chatRoutes from "./chatRoutes";
import notificationRoutes from './notificationRoutes';
import chatbotRoutes from "./chatbotRoutes";
import sponsorshipRoutes from "./sponsorshipRoutes";
import seatLayoutRoutes from "./seatLayoutRoutes";


const router = Router();
router.use(authRoutes);
router.use("/events", eventsRoutes);
router.use("/ticket/book", ticketBookRoutes);
router.use("/dashboard/analytics", dashboardRoutes);
router.use("/contact-us", contactRoutes);
router.use("/faq", faqRoutes);
router.use("/terms-and-conditions", termsRoutes);
router.use("/feedbacks", feedbackRoutes);
router.use('/ticket-types', ticketTypeRoutes);
router.use('/point-setting', pointSettingRoutes);
router.use('/ticket-categories', ticketCategoryRoutes);
router.use('/admin/setting', adminConfigRoutes);
router.use('/voucher', voucherRoutes);
router.use("/chat", chatRoutes);
router.use('/notification', notificationRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/organizer', sponsorshipRoutes);
router.use("/events", seatLayoutRoutes);


export default router;
