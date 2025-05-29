import { Router } from "express";
import { getFaqs, getFaqById, createFaq, updateFaq, deleteFaq, generateFaqAnswer } from "../controllers/faqController";
import { validateAdminToken } from "../middlewares/checkToken";

const router = Router();

router.get("/", getFaqs);
router.get("/:id", getFaqById);

// FOR ADMIN
router.post("/", validateAdminToken, createFaq);
router.put('/:id', validateAdminToken, updateFaq);
router.delete('/:id', validateAdminToken, deleteFaq);
router.post('/generate/faq-answer', validateAdminToken, generateFaqAnswer);

export default router;