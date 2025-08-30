import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { list, markRead } from '../controllers/notificationController.js';
const router = Router();
router.get('/', protect, list);
router.patch('/:id/read', protect, markRead);
export default router;