import { Router } from 'express';
import { getTerms, updateTerms, resetTerms, generateTerms } from '../controllers/termsController';
import { validateAdminToken } from '../middlewares/checkToken';

const router = Router();

router.get('/', getTerms);

// FOR ADMIN
router.post('/generate-ai', validateAdminToken, generateTerms);
router.put('/', validateAdminToken, updateTerms);
router.delete('/', validateAdminToken, resetTerms);

export default router;