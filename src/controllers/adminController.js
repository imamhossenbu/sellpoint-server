// src/controllers/adminController.js
import dayjs from 'dayjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Listing from '../models/Listing.js';
import Transaction from '../models/Transaction.js';

/* =========================
 *  Optional SupportTicket
 * ========================= */
let _SupportTicket = null;
async function getSupportTicketModel() {
    if (_SupportTicket) return _SupportTicket;
    try {
        const mod = await import('../models/SupportTicket.js');
        _SupportTicket = mod.default || mod;
        return _SupportTicket;
    } catch {
        return null; // model not present — endpoints that rely on it will handle gracefully
    }
}

/* =========================
 *         USERS
 * ========================= */

/**
 * GET /api/admin/users
 * Query: q, role (buyer|seller|admin), status (active|banned), page, limit, sort
 * Returns: { items, total, page, pages }
 */
export const listUsers = async (req, res) => {
    const {
        q = '',
        role,
        status,           // active | banned
        page = 1,
        limit = 20,
        sort = '-createdAt',
    } = req.query;

    const filter = {};
    if (q) {
        filter.$or = [
            { name: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } },
        ];
    }
    if (role && ['buyer', 'seller', 'admin'].includes(role)) {
        filter.role = role;
    }
    if (status === 'banned') filter.isActive = false;
    else if (status === 'active') filter.isActive = true;

    const pageNum = Math.max(1, Number(page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * perPage;

    const sortSpec = toSort(sort);

    const [items, total] = await Promise.all([
        User.find(filter)
            .sort(sortSpec)
            .skip(skip)
            .limit(perPage)
            .select('-password')
            .lean(),
        User.countDocuments(filter),
    ]);

    res.json({
        items,
        total,
        page: pageNum,
        pages: Math.max(1, Math.ceil(total / perPage)),
    });
};

/**
 * PATCH /api/admin/users/:id/toggle
 * Flips isActive (kept for backward compatibility)
 */
export const toggleUser = async (req, res) => {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ message: 'Not found' });
    if (u.role === 'admin') return res.status(403).json({ message: 'Cannot toggle another admin' });
    u.isActive = !u.isActive;
    await u.save();
    res.json({ id: u._id, isActive: u.isActive });
};

/**
 * PATCH /api/admin/users/:id/ban
 */
export const banUser = async (req, res) => {
    const { id } = req.params;
    if (String(req.user._id) === String(id)) {
        return res.status(400).json({ message: 'You cannot ban yourself.' });
    }
    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: 'Not found' });
    if (u.role === 'admin') return res.status(403).json({ message: 'Cannot ban another admin' });
    u.isActive = false;
    await u.save();
    res.json({ ok: true, id: u._id, isActive: u.isActive });
};

/**
 * PATCH /api/admin/users/:id/unban
 */
export const unbanUser = async (req, res) => {
    const { id } = req.params;
    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: 'Not found' });
    u.isActive = true;
    await u.save();
    res.json({ ok: true, id: u._id, isActive: u.isActive });
};

/**
 * DELETE /api/admin/users/:id
 */
export const deleteUser = async (req, res) => {
    const { id } = req.params;
    if (String(req.user._id) === String(id)) {
        return res.status(400).json({ message: 'You cannot delete your own account.' });
    }
    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: 'Not found' });
    if (u.role === 'admin') return res.status(403).json({ message: 'Cannot delete another admin' });
    await u.deleteOne();
    res.json({ ok: true });
};

/* =========================
 *        LISTINGS
 * ========================= */

/**
 * GET /api/admin/listings
 * Query: status, q, seller (id), page, limit, sort
 * Returns: { items, total, page, pages }
 */
export const listAdminListings = async (req, res) => {
    const {
        status,
        q = '',
        seller,          // seller user id
        page = 1,
        limit = 20,
        sort = '-createdAt',
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (seller) filter.seller = new mongoose.Types.ObjectId(seller);
    if (q) {
        filter.$or = [
            { title: { $regex: q, $options: 'i' } },
            { address: { $regex: q, $options: 'i' } },
            { area: { $regex: q, $options: 'i' } },
        ];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * perPage;
    const sortSpec = toSort(sort);

    const [items, total] = await Promise.all([
        Listing.find(filter)
            .populate('seller', 'name email')
            .sort(sortSpec)
            .skip(skip)
            .limit(perPage),
        Listing.countDocuments(filter),
    ]);

    res.json({
        items,
        total,
        page: pageNum,
        pages: Math.max(1, Math.ceil(total / perPage)),
    });
};

/**
 * GET /api/admin/listings/:id
 */
export const getListingAdmin = async (req, res) => {
    const it = await Listing.findById(req.params.id).populate('seller', 'name email');
    if (!it) return res.status(404).json({ message: 'Not found' });
    res.json(it);
};

export const approveListing = async (req, res) => {
    const item = await Listing.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    item.status = 'approved';
    await item.save();
    res.json(item);
};

export const rejectListing = async (req, res) => {
    const item = await Listing.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    item.status = 'rejected';
    await item.save();
    res.json(item);
};

/**
 * GET /api/admin/review/pending
 * Query: limit=5
 * Returns most recent pending listings for dashboard
 */
export const reviewPending = async (req, res) => {
    const limit = Math.min(50, Number(req.query.limit || 5));
    const items = await Listing.find({ status: 'pending' })
        .populate('seller', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    const total = await Listing.countDocuments({ status: 'pending' });
    res.json({ items, total });
};

/* =========================
 *      TRANSACTIONS
 * ========================= */

/**
 * GET /api/admin/transactions
 * Query:
 *  - period: today|week|month|all|custom
 *  - status: initiated|success|failed|canceled
 *  - start, end: ISO strings (required when period=custom)
 *  - page, limit, sort
 * Returns: { items, total, page, pages, sum }
 */
export const listTransactions = async (req, res) => {
    const {
        period = 'month',
        status,
        start,
        end,
        page = 1,
        limit = 20,
        sort = '-createdAt',
    } = req.query;

    const filter = {};
    if (status && ['initiated', 'success', 'failed', 'canceled'].includes(status)) {
        filter.status = status;
    }

    const { startDate, endDate } = resolvePeriod(period, { start, end });
    if (startDate && endDate) {
        filter.createdAt = { $gte: startDate, $lte: endDate };
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * perPage;
    const sortSpec = toSort(sort);

    const [items, total, sumAgg] = await Promise.all([
        Transaction.find(filter)
            .populate('seller', 'name email')
            .populate('listing', 'title')
            .sort(sortSpec)
            .skip(skip)
            .limit(perPage)
            .lean(),
        Transaction.countDocuments(filter),
        Transaction.aggregate([
            { $match: normalizeMatch(filter) }, // ensure same filter format for aggregate
            { $group: { _id: null, total: { $sum: '$amount' } } },
            { $project: { _id: 0, total: 1 } },
        ]),
    ]);

    const pages = Math.max(1, Math.ceil(total / perPage));
    const sum = sumAgg[0]?.total || 0;

    res.json({ items, total, page: pageNum, pages, sum });
};

/* =========================
 *       ADMIN STATS
 * ========================= */

/**
 * GET /api/admin/stats
 * Returns dashboard totals.
 */
export const adminStats = async (_req, res) => {
    const SupportTicket = await getSupportTicketModel();

    const [totalSellers, approvedListings, pendingListings, viewsAgg, monthRevenueAgg, openTickets] =
        await Promise.all([
            User.countDocuments({ role: 'seller' }),
            Listing.countDocuments({ status: 'approved' }),
            Listing.countDocuments({ status: 'pending' }),
            Listing.aggregate([
                { $group: { _id: null, total: { $sum: '$views' } } },
                { $project: { _id: 0, total: 1 } },
            ]),
            (async () => {
                const s = dayjs().startOf('month').toDate();
                const e = dayjs().endOf('month').toDate();
                const agg = await Transaction.aggregate([
                    { $match: { status: 'success', createdAt: { $gte: s, $lte: e } } },
                    { $group: { _id: null, total: { $sum: '$amount' } } },
                    { $project: { _id: 0, total: 1 } },
                ]);
                return agg;
            })(),
            (async () => {
                if (!SupportTicket) return 0;
                return SupportTicket.countDocuments({ status: { $in: ['open', 'pending'] } });
            })(),
        ]);

    res.json({
        totalSellers,
        approvedListings,
        pendingListings,
        totalViews: viewsAgg[0]?.total || 0,
        monthRevenue: monthRevenueAgg[0]?.total || 0,
        openTickets: openTickets || 0,
    });
};

/**
 * GET /api/admin/support/tickets
 * Query: limit=5, page=1, status? (open|pending|resolved|closed)
 * Returns recent tickets (across sellers), if SupportTicket model exists.
 */
export const listSupportTicketsAdmin = async (req, res) => {
    const SupportTicket = await getSupportTicketModel();
    if (!SupportTicket) return res.json({ items: [], total: 0, page: 1, pages: 1 });

    const pageNum = Math.max(1, Number(req.query.page || 1));
    const perPage = Math.min(50, Math.max(1, Number(req.query.limit || 5)));
    const status = req.query.status;
    const skip = (pageNum - 1) * perPage;

    const filter = {};
    if (status) filter.status = status;

    const [list, total] = await Promise.all([
        SupportTicket.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(perPage)
            .populate('seller', 'name email')
            .lean(),
        SupportTicket.countDocuments(filter),
    ]);

    const items = list.map(t => ({
        _id: t._id,
        subject: t.subject,
        status: t.status,
        sellerName: t.seller?.name || t.seller?.email || 'Seller',
        createdAt: t.createdAt,
    }));

    res.json({
        items,
        total,
        page: pageNum,
        pages: Math.max(1, Math.ceil(total / perPage)),
    });
};

/* =========================
 *         HELPERS
 * ========================= */

function toSort(sortStr = '') {
    if (!sortStr) return { createdAt: -1 };
    const spec = {};
    String(sortStr)
        .split(',')
        .forEach((chunk) => {
            const s = chunk.trim();
            if (!s) return;
            if (s.startsWith('-')) spec[s.slice(1)] = -1;
            else spec[s] = 1;
        });
    return Object.keys(spec).length ? spec : { createdAt: -1 };
}

// Aggregation pipelines need plain values (no RegExp or functions).
// This normalizes a "find"-style filter to an $match-friendly object.
function normalizeMatch(filter = {}) {
    const out = { ...filter };
    // If you ever add RegExp in filters for aggregate, you’ll need to convert them,
    // but current usage uses date/status only in aggregation call above.
    return out;
}

function resolvePeriod(period, { start, end }) {
    switch (period) {
        case 'today': {
            const s = dayjs().startOf('day').toDate();
            const e = dayjs().endOf('day').toDate();
            return { startDate: s, endDate: e };
        }
        case 'week': {
            const s = dayjs().startOf('week').toDate();
            const e = dayjs().endOf('week').toDate();
            return { startDate: s, endDate: e };
        }
        case 'month': {
            const s = dayjs().startOf('month').toDate();
            const e = dayjs().endOf('month').toDate();
            return { startDate: s, endDate: e };
        }
        case 'custom': {
            if (!start || !end) return { startDate: null, endDate: null };
            const s = new Date(start);
            const e = new Date(end);
            if (isNaN(s) || isNaN(e)) return { startDate: null, endDate: null };
            return { startDate: s, endDate: e };
        }
        case 'all':
        default:
            return { startDate: null, endDate: null };
    }
}
