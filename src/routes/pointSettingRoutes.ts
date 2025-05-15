import { Router } from "express";
import { validateAdminToken, validateToken } from "../middlewares/checkToken";
import { getPointHistory, getPointSettings, updatePointSettings } from "../controllers/pointSettingController";

const router = Router();

router.get("/", validateAdminToken, getPointSettings);
router.put("/", validateAdminToken, updatePointSettings);
router.get("/reward-history", validateToken, getPointHistory);

export default router;