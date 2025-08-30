// src/controllers/newsletterController.js
import crypto from 'crypto';
import Subscriber from '../models/Subscriber.js';
import { sendMail } from '../utils/mailer.js';

const isEmail = (v = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const baseUrl = (process.env.BACKEND_URL || '').replace(/\/$/, ''); // trim trailing slash

// POST /api/newsletter/subscribe   Body: { email }
export const subscribe = async (req, res) => {
    try {
        const emailRaw = String(req.body?.email || '').trim().toLowerCase();
        if (!isEmail(emailRaw)) return res.status(400).json({ ok: false, message: 'Invalid email' });

        let doc = await Subscriber.findOne({ email: emailRaw });
        const prevStatus = doc?.status;

        if (!doc) {
            doc = await Subscriber.create({
                email: emailRaw,
                status: 'subscribed',
                unsubToken: crypto.randomBytes(24).toString('hex'),
            });
        } else if (doc.status === 'unsubscribed') {
            doc.status = 'subscribed';
            if (!doc.unsubToken) doc.unsubToken = crypto.randomBytes(24).toString('hex');
            await doc.save();
        } // if already subscribed → idempotent, do nothing

        // Send welcome only for new or re-subscribed
        if (!prevStatus || prevStatus === 'unsubscribed') {
            try {
                const unsubLink = `${baseUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(doc.unsubToken)}`;
                await sendMail({
                    to: doc.email,
                    subject: 'Welcome to SellPoint newsletter',
                    html: `
            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto">
              <h2>Thanks for subscribing 🎉</h2>
              <p>We’ll send you market tips & product updates.</p>
              <p style="color:#64748b;font-size:12px;margin-top:16px">
                To unsubscribe anytime, click <a href="${unsubLink}">this link</a>.
              </p>
            </div>
          `,
                });
            } catch { /* ignore email errors */ }
        }

        return res.json({ ok: true });
    } catch {
        return res.status(500).json({ ok: false, message: 'Subscribe failed' });
    }
};

// POST /api/newsletter/unsubscribe   Body: { email } OR { token }
// GET  /api/newsletter/unsubscribe?token=...
export const unsubscribe = async (req, res) => {
    try {
        const token = req.query.token || req.body?.token || null;
        const emailRaw = String(req.body?.email || '').trim().toLowerCase();

        let doc = null;
        if (token) {
            doc = await Subscriber.findOne({ unsubToken: token });
        } else if (isEmail(emailRaw)) {
            doc = await Subscriber.findOne({ email: emailRaw });
        }

        // Idempotent & privacy-friendly: don't leak existence
        if (!doc) {
            if (req.method === 'GET') return res.send('You have been unsubscribed. You can close this tab.');
            return res.json({ ok: true });
        }

        if (doc.status !== 'unsubscribed') {
            doc.status = 'unsubscribed';
            await doc.save();
        }

        if (req.method === 'GET') {
            return res.send('You have been unsubscribed. You can close this tab.');
        }
        return res.json({ ok: true });
    } catch {
        if (req.method === 'GET') return res.send('You have been unsubscribed. You can close this tab.');
        return res.status(500).json({ ok: false, message: 'Unsubscribe failed' });
    }
};

// GET /api/newsletter/status?email=...
export const status = async (req, res) => {
    try {
        const emailRaw = String(req.query.email || '').trim().toLowerCase();
        if (!isEmail(emailRaw)) return res.json({ subscribed: false });
        const doc = await Subscriber.findOne({ email: emailRaw });
        return res.json({ subscribed: !!doc && doc.status === 'subscribed' });
    } catch {
        return res.json({ subscribed: false });
    }
};
