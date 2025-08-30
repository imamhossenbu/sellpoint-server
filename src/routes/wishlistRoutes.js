import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { toggle, mine } from '../controllers/wishlistController.js';
const router = Router();
router.post('/:listingId/toggle', protect, toggle);
router.get('/me', protect, mine);
export default router;