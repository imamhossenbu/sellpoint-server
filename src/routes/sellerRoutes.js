// src/routes/sellerRoutes.js
import { Router } from 'express';
import { protect, requireRoles } from '../middleware/auth.js';
import {
    listMine, updateMine, removeMine, stats,
    transactions, analytics,
    listTickets, createTicket
} from '../controllers/sellerController.js';

const router = Router();
router.use(protect, requireRoles('seller', 'admin'));

router.get('/listings', listMine);
router.patch('/listings/:id', updateMine);
router.delete('/listings/:id', removeMine);
router.get('/stats', stats);

router.get('/transactions', transactions);

// NEW
router.get('/analytics', analytics);

// NEW Support
router.get('/support/tickets', listTickets);
router.post('/support/tickets', createTicket);

export default router;
