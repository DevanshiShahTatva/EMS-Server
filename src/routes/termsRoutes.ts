import { Router } from 'express';
import { getTerms, updateTerms, resetTerms } from '../controllers/termsController';
import { validateAdminToken } from '../middlewares/checkToken';

const router = Router();

router.get('/', getTerms);

// FOR ADMIN
router.put('/', validateAdminToken, updateTerms);
router.delete('/', validateAdminToken, resetTerms);

export default router;