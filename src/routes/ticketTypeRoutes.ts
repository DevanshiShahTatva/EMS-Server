import { Router } from 'express';
import {
    createTicketType,
    getAllTicketTypes,
    getTicketTypeById,
    updateTicketType,
    deleteTicketType,
} from '../controllers/ticketTypeCtrl';
import { validateAdminToken } from '../middlewares/checkToken';

const router = Router();

// PUBLIC
router.get('/', getAllTicketTypes);
router.get('/:id', getTicketTypeById);

// ADMIN ONLY
router.post('/', validateAdminToken, createTicketType);
router.put('/:id', validateAdminToken, updateTicketType);
router.delete('/:id', validateAdminToken, deleteTicketType);

export default router;
