import express from "express";
import { validateToken } from "../middlewares/checkToken";
import { getUpcomingEvents, requestSponsorship, getAllSponsorshipRequests, updateSponsorshipStatus, generateSponsorBanner } from "../controllers/sponsorshipCtrl";
import multer from "multer";

const router = express.Router();
const upload = multer();

router.get("/upcoming-events", validateToken, getUpcomingEvents);
router.post('/sponsorship-request', validateToken, upload.single("file"), requestSponsorship); 
router.get('/sponsorship-request', getAllSponsorshipRequests)
router.patch('/sponsorship-request', validateToken, updateSponsorshipStatus);
router.post('/generate-ai-image', validateToken, generateSponsorBanner)

export default router;
