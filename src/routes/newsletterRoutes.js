import express from 'express';
import { subscribe, unsubscribe, status } from '../controllers/newsletterController.js';

const router = express.Router();

router.post('/subscribe', subscribe);
router.post('/unsubscribe', unsubscribe); // also supports GET via query token
router.get('/unsubscribe', unsubscribe);  // for one-click links in email
router.get('/status', status);           // optional helper

export default router;
