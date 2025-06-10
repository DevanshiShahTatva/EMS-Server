import { Router } from "express";
import { validateAdminToken } from "../middlewares/checkToken";
import { createSeatLayout, getSeatLayout } from "../controllers/seatLayoutCtrl";

const router = Router();

router.post("/create-seat-layout", validateAdminToken, createSeatLayout);
router.get("/get-seat-layout/:id", validateAdminToken, getSeatLayout);

export default router;