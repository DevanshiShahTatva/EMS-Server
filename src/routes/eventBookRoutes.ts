import { Router } from "express";
import { validateToken } from "../middlewares/checkToken";
import { postTicketBook, getTicketBooks } from "../controllers/eventBookCtrl";

const ticketBookRoutes = Router();

ticketBookRoutes.post("/", validateToken, postTicketBook);
ticketBookRoutes.get("/", validateToken, getTicketBooks);

export default ticketBookRoutes;