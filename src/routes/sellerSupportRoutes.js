import { Router } from 'express';
import { protect, requireRoles } from '../middleware/auth.js';
import {
    createTicket,
    listMyTickets,
    getMyTicket,
    replyMyTicket,
} from '../controllers/supportController.js';

const router = Router();
router.use(protect, requireRoles('seller', 'admin'));

router.post('/tickets', createTicket);
router.get('/tickets', listMyTickets);
router.get('/tickets/:id', getMyTicket);
router.post('/tickets/:id/replies', replyMyTicket);

export default router;
