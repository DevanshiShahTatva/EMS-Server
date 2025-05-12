import { Router } from "express";
import { validateToken, validateStaffToken } from "../middlewares/checkToken";
import {
  postTicketBook,
  getTicketBooks,
  cancelBookedEvent,
  validateTicket
} from "../controllers/eventBookCtrl";

const ticketBookRoutes = Router();

ticketBookRoutes.post("/", validateToken, postTicketBook);
ticketBookRoutes.get("/", validateToken, getTicketBooks);
ticketBookRoutes.put("/cancel/:bookingId", validateToken, cancelBookedEvent);

ticketBookRoutes.post("/validate", validateStaffToken, validateTicket);

export default ticketBookRoutes;
