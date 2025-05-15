import { Router } from "express";
import { validateAdminToken, validateToken } from "../middlewares/checkToken";
import { putCancelCharge, getCancelCharge } from "../controllers/adminConfigCtrl";

const router = Router();

router.put("/cancel-charge", validateAdminToken, putCancelCharge);
router.get("/cancel-charge", validateAdminToken, getCancelCharge);
router.get("/cancel-charge", validateToken, getCancelCharge);

export default router;
