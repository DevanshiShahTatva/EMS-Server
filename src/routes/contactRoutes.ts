import { Router } from "express";
import { submitContactForm, getContacts, deleteContacts } from "../controllers/contactController";
import { validateToken } from "../middlewares/checkToken";

const router = Router();

router.post("/", submitContactForm);
router.get("/", validateToken, getContacts);
router.delete('/', validateToken, deleteContacts);

export default router;