// src/routes/paymentRoutes.js
import { Router } from 'express';
import { protect, requireRoles } from '../middleware/auth.js';
import { sslInitiate, sslSuccess, sslCancel, sslIPN } from '../controllers/paymentController.js';

const router = Router();

router.post('/ssl/initiate', protect, requireRoles('seller', 'admin'), sslInitiate);

// SSLCommerz can call these as POST; allow both:
router.all('/ssl/success', sslSuccess);
router.all('/ssl/cancel', sslCancel);

router.post('/ssl/ipn', sslIPN);

export default router;
