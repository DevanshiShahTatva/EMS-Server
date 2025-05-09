import { Router } from "express";
import { validateToken } from "../middlewares/checkToken";
import {
  postTicketBook,
  getTicketBooks,
  cancelBookedEvent,
} from "../controllers/eventBookCtrl";

const ticketBookRoutes = Router();

ticketBookRoutes.post("/", validateToken, postTicketBook);
ticketBookRoutes.get("/", validateToken, getTicketBooks);
ticketBookRoutes.put("/cancel/:bookingId", validateToken, cancelBookedEvent);

export default ticketBookRoutes;
