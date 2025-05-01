import { Router } from "express";
import { submitContactForm, getContacts, deleteContactById, deleteAllContacts } from "../controllers/contactController";
import { validateToken } from "../middlewares/checkToken";

const router = Router();

router.post("/", submitContactForm);
router.get("/", validateToken, getContacts);
router.delete('/:id', validateToken, deleteContactById);
router.delete('/', validateToken, deleteAllContacts);

export default router;