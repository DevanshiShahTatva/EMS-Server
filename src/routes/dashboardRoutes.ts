import { Router } from "express";
import { validateAdminToken } from "../middlewares/checkToken";
import {
  topLikedEvents,
  dashboardOverview,
  totalRevenue,
  totalBookingValue,
  topRevenueEvents,
  repeateCustomer,
  bookingsByTicketType,
  bookingsTimeTrends,
  topLocations,
  getCancellationRate,
  topAttendedEvents,
  userBadgeInfo,
  getEventFeedbackAnalytics,
  getEventFeedbackDistribution,
  getFeedbackOverviewRatings,
  getEventOverviewFeedback,
  getOverallFeedbackDistribution,
} from "../controllers/dashboardCtrl";

const dashboardRoutes = Router();

dashboardRoutes.get("/dashboard-overview", validateAdminToken, dashboardOverview);
dashboardRoutes.get("/top-liked-events", validateAdminToken, topLikedEvents);
dashboardRoutes.get("/total-revenue", validateAdminToken, totalRevenue); // filter
dashboardRoutes.get("/average-booking-value", validateAdminToken, totalBookingValue); // filter
dashboardRoutes.get("/top-revenue-events", validateAdminToken, topRevenueEvents);
dashboardRoutes.get("/repeat-customers", validateAdminToken, repeateCustomer);
dashboardRoutes.get("/bookings-by-ticket-type", validateAdminToken, bookingsByTicketType);
dashboardRoutes.get("/bookings-time-trends", validateAdminToken, bookingsTimeTrends);
dashboardRoutes.get("/top-locations", validateAdminToken, topLocations);
dashboardRoutes.get("/cancellation-ratio", validateAdminToken, getCancellationRate);
dashboardRoutes.get("/top-attended-events", validateAdminToken, topAttendedEvents);
dashboardRoutes.get("/user-badge-info", validateAdminToken, userBadgeInfo);
dashboardRoutes.get("/feedback-analytics",validateAdminToken, getEventFeedbackAnalytics);
dashboardRoutes.get("/feedback-analytics/:id",validateAdminToken,getEventFeedbackDistribution);
dashboardRoutes.get("/feedback-overview",validateAdminToken, getFeedbackOverviewRatings);
dashboardRoutes.get("/feedback-details",validateAdminToken, getEventOverviewFeedback);
dashboardRoutes.get("/feedback-all-feedbacks",validateAdminToken,getOverallFeedbackDistribution);
export default dashboardRoutes;
