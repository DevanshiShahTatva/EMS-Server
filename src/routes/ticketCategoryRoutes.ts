import { Router } from 'express';
import multer from 'multer';
import {
    createTicketCategory,
    getAllTicketCategories,
    getTicketCategoryById,
    updateTicketCategory,
    deleteTicketCategory,
} from '../controllers/ticketCategoryCtrl';
import { validateAdminToken } from '../middlewares/checkToken';

const router = Router();

// Multer setup for single image upload
const upload = multer({ storage: multer.memoryStorage() });

// PUBLIC
router.get('/', getAllTicketCategories);
router.get('/:id', getTicketCategoryById);

// ADMIN ONLY
router.post('/', validateAdminToken, upload.single('icon'), createTicketCategory);
router.put('/:id', validateAdminToken, upload.single('icon'), updateTicketCategory);
router.delete('/:id', validateAdminToken, deleteTicketCategory);

export default router;
