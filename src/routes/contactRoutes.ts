import { Router } from "express";
import { submitContactForm, getContacts, deleteContacts, updateContactStatus } from "../controllers/contactController";
import { validateAdminToken } from "../middlewares/checkToken";

const router = Router();

router.post("/", submitContactForm);
router.get("/", validateAdminToken, getContacts);
router.delete('/', validateAdminToken, deleteContacts);
router.patch('/:id/status', validateAdminToken, updateContactStatus);

export default router;