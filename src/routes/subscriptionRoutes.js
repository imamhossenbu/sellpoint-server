import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { start, cancel, mine } from '../controllers/subscriptionController.js';
const router = Router();
router.post('/start', protect, start);
router.post('/cancel', protect, cancel);
router.get('/me', protect, mine);
export default router;