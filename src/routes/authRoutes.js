// src/routes/authRoutes.js
import { Router } from 'express';
import {
    register,
    login,
    me,
    updateMe,
    forgotPassword,
    verifyResetToken,
    resetPassword,
    changePassword,        // <-- add
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, me);
router.patch('/me', protect, updateMe);

router.post('/forgot', forgotPassword);
router.get('/verify-reset', verifyResetToken);
router.post('/reset', resetPassword);

// new endpoint (requires auth)
router.post('/change-password', protect, changePassword);

export default router;
