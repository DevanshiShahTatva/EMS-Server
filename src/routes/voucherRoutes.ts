import { Router } from "express";
import { validateToken } from "../middlewares/checkToken";
import { applyPromoCode } from "../controllers/voucherController";

const router = Router();

router.post("/validate-promocode", validateToken, applyPromoCode);

export default router;