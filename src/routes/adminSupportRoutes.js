import { Router } from 'express';
import { protect, requireRoles } from '../middleware/auth.js';
import {
    listTicketsAdmin,
    getTicketAdmin,
    replyTicketAdmin,
    setTicketStatusAdmin,
} from '../controllers/supportController.js';

const router = Router();
router.use(protect, requireRoles('admin'));

router.get('/tickets', listTicketsAdmin);
router.get('/tickets/:id', getTicketAdmin);
router.post('/tickets/:id/replies', replyTicketAdmin);
router.patch('/tickets/:id/status', setTicketStatusAdmin);

export default router;
