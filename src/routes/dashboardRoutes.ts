import { Router } from "express";
import { validateToken } from "../middlewares/checkToken";
import {
  topLikedEvents,
  totalRevenue,
  averageBookingValue,
  topRevenueEvents,
  repeateCustomer,
  bookingsByTicketType,
  bookingsTimeTrends,
  topLocations
} from "../controllers/dashboardCtrl";

const dashboardRoutes = Router();

dashboardRoutes.get("/top-liked-events", validateToken, topLikedEvents);
dashboardRoutes.get("/total-revenue", validateToken, totalRevenue);
dashboardRoutes.get(
  "/average-booking-value",
  validateToken,
  totalRevenue
);
dashboardRoutes.get("/top-revenue-events", validateToken, topRevenueEvents);
dashboardRoutes.get("/repeat-customers", validateToken, repeateCustomer);
dashboardRoutes.get(
  "/bookings-by-ticket-type",
  validateToken,
  bookingsByTicketType
);
dashboardRoutes.get("/bookings-time-trends", validateToken, bookingsTimeTrends);
dashboardRoutes.get("/top-locations", validateToken, topLocations);

export default dashboardRoutes;
