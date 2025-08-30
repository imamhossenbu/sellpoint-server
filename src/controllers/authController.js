// src/controllers/authController.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import PasswordReset from '../models/PasswordReset.js';
import { sendMail } from '../utils/mailer.js';

const tokenFor = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const sha256 = (val) => crypto.createHash('sha256').update(val).digest('hex');

// ---------- Auth: Register ----------
export const register = async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already in use' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash, role: role || 'buyer' });
    res.json({
        token: tokenFor(user._id),
        user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
};

// ---------- Auth: Login ----------
export const login = async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' });
    res.json({
        token: tokenFor(user._id),
        user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
};

// ---------- Auth: Me ----------
export const me = async (req, res) => {
    const u = req.user;
    // Return extended profile fields so frontend can render profile
    res.json({
        user: {
            id: u._id,
            name: u.name,
            email: u.email,
            role: u.role,
            avatarUrl: u.avatarUrl || '',
            phone: u.phone || '',
            about: u.about || '',
            city: u.city || '',
            country: u.country || ''
        }
    });
};

// ---------- Profile: Update Me ----------
export const updateMe = async (req, res) => {
    const u = await User.findById(req.user._id);
    if (!u) return res.status(404).json({ message: 'User not found' });

    const { name, phone, about, city, country, avatarUrl } = req.body;

    if (name !== undefined) u.name = name;
    if (phone !== undefined) u.phone = phone;
    if (about !== undefined) u.about = about;
    if (city !== undefined) u.city = city;
    if (country !== undefined) u.country = country;
    if (avatarUrl !== undefined) u.avatarUrl = avatarUrl; // Cloudinary URL from frontend

    await u.save();

    return res.json({
        user: {
            id: u._id,
            name: u.name,
            email: u.email,
            role: u.role,
            avatarUrl: u.avatarUrl || '',
            phone: u.phone || '',
            about: u.about || '',
            city: u.city || '',
            country: u.country || ''
        }
    });
};

// ---------- Forgot Password ----------
export const forgotPassword = async (req, res) => {
    const { email } = req.body || {};
    try {
        const user = await User.findOne({ email });
        if (user) {
            const raw = crypto.randomBytes(32).toString('hex');
            const tokenHash = sha256(raw);
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

            await PasswordReset.deleteMany({ user: user._id });
            await PasswordReset.create({ user: user._id, tokenHash, expiresAt });

            const url = `${process.env.FRONTEND_URL}/reset-password?token=${raw}`;
            await sendMail({
                to: user.email,
                subject: 'Reset your SellPoint password',
                html: `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto">
            <h2>Reset your password</h2>
            <p>Click the button below to reset your password. This link expires in 15 minutes.</p>
            <p><a href="${url}" style="display:inline-block;padding:10px 16px;background:#3B38A0;color:#fff;border-radius:8px;text-decoration:none">Reset Password</a></p>
            <p>Or copy this link:<br/><a href="${url}">${url}</a></p>
          </div>
        `,
            });
        }
    } catch (_) {
        // do not leak info
    }
    return res.json({ ok: true });
};

// ---------- Verify Reset Token (optional UX) ----------
export const verifyResetToken = async (req, res) => {
    const { token } = req.query || {};
    if (!token) return res.status(400).json({ valid: false, message: 'Missing token' });
    const doc = await PasswordReset.findOne({
        tokenHash: sha256(token),
        usedAt: null,
        expiresAt: { $gt: new Date() },
    }).populate('user', 'email');
    if (!doc) return res.json({ valid: false });
    return res.json({ valid: true, email: doc.user.email });
};

// ---------- Reset Password ----------
export const resetPassword = async (req, res) => {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ message: 'Missing fields' });

    const pr = await PasswordReset.findOne({
        tokenHash: sha256(token),
        usedAt: null,
        expiresAt: { $gt: new Date() },
    });
    if (!pr) return res.status(400).json({ message: 'Invalid or expired token' });

    const user = await User.findById(pr.user);
    if (!user) return res.status(400).json({ message: 'Invalid token' });

    user.password = await bcrypt.hash(password, 10);
    user.passwordChangedAt = new Date(); // invalidate existing JWTs
    await user.save();

    pr.usedAt = new Date();
    await pr.save();

    return res.json({ ok: true });
};

// ---------- Change Password (authenticated) ----------
export const changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: 'Missing fields' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ok = await bcrypt.compare(oldPassword, user.password);
    if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordChangedAt = new Date(); // invalidate existing JWTs issued before this
    await user.save();

    return res.json({ ok: true });
};
