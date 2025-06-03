import express from "express";
import { validateToken } from "../middlewares/checkToken";
import { getUpcomingEvents, requestSponsorship, getAllSponsorshipRequests, updateSponsorshipStatus } from "../controllers/sponsorshipCtrl";

const router = express.Router();

router.get("/upcoming-events", validateToken, getUpcomingEvents);
router.post('/sponsorship-request', validateToken, requestSponsorship); 
router.get('/sponsorship-request', getAllSponsorshipRequests)
router.patch('/sponsorship-request', validateToken, updateSponsorshipStatus);




export default router;
