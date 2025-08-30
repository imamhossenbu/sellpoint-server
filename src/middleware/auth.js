// src/middleware/auth.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * protect: verifies JWT, loads user, and auto-downgrades expired sellers.
 */
export const protect = async (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token' });
    }

    const token = auth.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user || !user.isActive) return res.status(401).json({ message: 'Invalid user' });

        // Invalidate tokens issued before last password change
        if (user.passwordChangedAt && decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
            return res.status(401).json({ message: 'Token expired' });
        }

        // NEW: auto-downgrade expired sellers
        if (user.role === 'seller' && user.sellerUntil && new Date() > new Date(user.sellerUntil)) {
            user.role = 'buyer';
            user.activePlan = null;

            // mark the latest subscription as expired if applicable
            if (Array.isArray(user.subscriptions) && user.subscriptions.length) {
                const last = user.subscriptions[user.subscriptions.length - 1];
                if (last && last.endDate && new Date() > new Date(last.endDate)) {
                    last.status = 'expired';
                }
            }
            await user.save();
        }

        req.user = user;
        next();
    } catch {
        return res.status(401).json({ message: 'Token failed' });
    }
};

export const requireRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        next();
    };
};
