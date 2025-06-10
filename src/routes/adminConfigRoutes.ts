import { Router } from "express";
import { validateAdminToken, validateToken } from "../middlewares/checkToken";
import { putCancelCharge, getCancelCharge } from "../controllers/adminConfigCtrl";

const router = Router();

router.get("/cancel-charge", getCancelCharge);
router.put("/cancel-charge", validateAdminToken, putCancelCharge);
router.get("/cancel-charge", validateAdminToken, getCancelCharge);

export default router;
