import { Router } from "express";
import { validateAdminToken } from "../middlewares/checkToken";
import { getPointSettings, updatePointSettings } from "../controllers/pointSettingController";

const router = Router();

router.get("/", validateAdminToken, getPointSettings);
router.put("/", validateAdminToken, updatePointSettings);

export default router;