import { Router } from "express";
import { validateAdminToken, validateToken } from "../middlewares/checkToken";
import {
  createSeatLayout,
  getSeatLayout,
  updateSeatLayout,
} from "../controllers/seatLayoutCtrl";

const router = Router();

router.post("/create-seat-layout", validateAdminToken, createSeatLayout);
router.get("/get-seat-layout/:id", validateAdminToken, getSeatLayout);
router.get("/event-seat-layout/:id", validateToken, getSeatLayout);
router.put("/update-seat-layout/:id", validateAdminToken, updateSeatLayout);

export default router;
