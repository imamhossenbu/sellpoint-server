// src/controllers/sellerController.js
import dayjs from 'dayjs';
import mongoose from 'mongoose';
import Listing from '../models/Listing.js';
import Transaction from '../models/Transaction.js';
// Optional: create this model (schema shown below)
import SupportTicket from '../models/SupportTicket.js';

/**
 * GET /api/seller/listings
 * Query: q, status (approved|pending|rejected|expired), page, limit
 * Only returns listings that belong to the authenticated seller.
 */
export const listMine = async (req, res) => {
    const {
        q = '',
        status,                  // approved | pending | rejected | expired
        page = 1,
        limit = 10,
    } = req.query;

    const filter = { seller: req.user._id };
    if (status) filter.status = status;

    if (q) {
        // search by title/address/area (case-insensitive)
        filter.$or = [
            { title: { $regex: q, $options: 'i' } },
            { address: { $regex: q, $options: 'i' } },
            { area: { $regex: q, $options: 'i' } },
        ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
        Listing.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        Listing.countDocuments(filter),
    ]);

    res.json({
        items,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)) || 1,
    });
};

/**
 * PATCH /api/seller/listings/:id
 * Update own listing (basic, safe merge).
 */
export const updateMine = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ message: 'Not found' });
    if (String(listing.seller) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Forbidden' });
    }

    // allow updating these fields (add/remove as needed)
    const allowed = [
        'title', 'price', 'type', 'category', 'area',
        'address', 'images', 'description', 'status',
    ];
    for (const key of allowed) {
        if (key in req.body) {
            listing[key] = req.body[key];
        }
    }

    await listing.save();
    res.json(listing);
};

/**
 * DELETE /api/seller/listings/:id
 * Delete own listing.
 */
export const removeMine = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ message: 'Not found' });
    if (String(listing.seller) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    await listing.deleteOne();
    res.json({ ok: true });
};

/**
 * GET /api/seller/stats
 * Returns:
 *  - activeCount  (approved)
 *  - pendingCount (pending)
 *  - totalViews   (sum of views on all seller listings)
 *  - monthSales   (sum of successful transaction amounts this month)
 */
export const stats = async (req, res) => {
    const sellerId = new mongoose.Types.ObjectId(req.user._id);

    // counts by status
    const [activeCount, pendingCount] = await Promise.all([
        Listing.countDocuments({ seller: sellerId, status: 'approved' }),
        Listing.countDocuments({ seller: sellerId, status: 'pending' }),
    ]);

    // sum views across seller listings
    const viewsAgg = await Listing.aggregate([
        { $match: { seller: sellerId } },
        { $group: { _id: null, total: { $sum: '$views' } } },
        { $project: { _id: 0, total: 1 } },
    ]);
    const totalViews = viewsAgg[0]?.total || 0;

    // sum successful transactions for this month
    const start = dayjs().startOf('month').toDate();
    const end = dayjs().endOf('month').toDate();
    const salesAgg = await Transaction.aggregate([
        {
            $match: {
                seller: sellerId,
                status: 'success',
                createdAt: { $gte: start, $lte: end },
            }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
        { $project: { _id: 0, total: 1 } },
    ]);
    const monthSales = salesAgg[0]?.total || 0;

    res.json({ activeCount, pendingCount, totalViews, monthSales });
};

/**
 * GET /api/seller/transactions
 * Query:
 *  - period: "today" | "week" | "month" | "all" | "custom" (default: "month")
 *  - status: "initiated" | "success" | "failed" | "canceled" (optional)
 *  - start, end: ISO strings (required when period="custom")
 *  - page: number (default 1)
 *  - limit: number (default 10)
 *  - sort: string (e.g. "-createdAt" or "amount,-createdAt")
 *
 * Response:
 * {
 *   items: [{ _id, listing, amount, status, gateway, tranId, createdAt }],
 *   total, page, pages, sum
 * }
 */
export const transactions = async (req, res) => {
    const sellerId = new mongoose.Types.ObjectId(req.user._id);

    const {
        period = 'month',
        status, // optional
        start,
        end,
        page = 1,
        limit = 10,
        sort = '-createdAt',
    } = req.query;

    const filter = { seller: sellerId };
    if (status && ['initiated', 'success', 'failed', 'canceled'].includes(status)) {
        filter.status = status;
    }

    const { startDate, endDate } = resolvePeriod(period, { start, end });
    if (startDate && endDate) {
        filter.createdAt = { $gte: startDate, $lte: endDate };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortSpec = toSort(sort);

    const [items, total, sumAgg] = await Promise.all([
        Transaction.find(filter)
            .sort(sortSpec)
            .skip(skip)
            .limit(Number(limit))
            .populate({ path: 'listing', select: 'title' })
            .lean(),
        Transaction.countDocuments(filter),
        Transaction.aggregate([
            { $match: filter },
            { $group: { _id: null, total: { $sum: '$amount' } } },
            { $project: { _id: 0, total: 1 } },
        ]),
    ]);

    const pages = Math.max(1, Math.ceil(total / Number(limit)));
    const sum = sumAgg[0]?.total || 0;

    res.json({ items, total, page: Number(page), pages, sum });
};

/**
 * GET /api/seller/analytics
 * Query: period=today|week|month|all
 *
 * Returns:
 * {
 *   series: [{date: 'YYYY-MM-DD', views: Number, leads: Number}],
 *   byListing: [{ listingId, title, views, leads }],
 *   totals: { views, leads }
 * }
 *
 * Notes:
 * - Views per listing are taken from Listing.views (total).
 * - Leads are approximated as number of Transactions (any status) per listing.
 * - The time series uses daily buckets of Transactions for "leads";
 *   "views" per day defaults to 0 unless you later store daily view logs.
 */
export const analytics = async (req, res) => {
    const sellerId = new mongoose.Types.ObjectId(req.user._id);
    const { period = 'month' } = req.query;

    const { startDate, endDate } = resolvePeriod(period, {});
    // ---- per-listing
    const [listings, leadsPerListingAgg] = await Promise.all([
        Listing.find({ seller: sellerId }).select('_id title views').lean(),
        Transaction.aggregate([
            { $match: { seller: sellerId, ...(startDate && endDate ? { createdAt: { $gte: startDate, $lte: endDate } } : {}) } },
            { $group: { _id: '$listing', leads: { $sum: 1 } } },
        ]),
    ]);

    const leadsMap = new Map();
    leadsPerListingAgg.forEach((r) => leadsMap.set(String(r._id), r.leads));

    const byListing = listings.map((l) => ({
        listingId: String(l._id),
        title: l.title || 'Untitled',
        views: Number(l.views || 0),
        leads: Number(leadsMap.get(String(l._id)) || 0),
    }));

    // ---- totals
    const totals = {
        views: byListing.reduce((a, b) => a + (b.views || 0), 0),
        leads: byListing.reduce((a, b) => a + (b.leads || 0), 0),
    };

    // ---- time series (daily) for LEADS from transactions
    // build date buckets between startDate..endDate (or last 30 days if 'all')
    const range = buildDateRange(period, startDate, endDate);
    const leadsSeriesAgg = await Transaction.aggregate([
        {
            $match: {
                seller: sellerId,
                ...(range.start && range.end ? { createdAt: { $gte: range.start, $lte: range.end } } : {}),
            }
        },
        {
            $group: {
                _id: {
                    y: { $year: '$createdAt' },
                    m: { $month: '$createdAt' },
                    d: { $dayOfMonth: '$createdAt' },
                },
                leads: { $sum: 1 },
            }
        },
        { $project: { _id: 0, date: { $dateFromParts: { year: '$y', month: '$m', day: '$d' } }, leads: 1 } },
        { $sort: { date: 1 } },
    ]);

    const leadsByDate = new Map();
    leadsSeriesAgg.forEach((r) => {
        const key = dayjs(r.date).format('YYYY-MM-DD');
        leadsByDate.set(key, r.leads);
    });

    const series = range.days.map((d) => ({
        date: d,
        views: 0, // keep 0 unless you later record daily view logs
        leads: Number(leadsByDate.get(d) || 0),
    }));

    res.json({ series, byListing, totals });
};

/**
 * GET /api/seller/support/tickets
 * Query: page=1, limit=50
 * Response: { items: [{_id, subject, category, status, createdAt}], total, page, pages }
 */
export const listTickets = async (req, res) => {
    const sellerId = new mongoose.Types.ObjectId(req.user._id);
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50);
    const skip = (page - 1) * limit;

    const filter = { seller: sellerId };
    const [items, total] = await Promise.all([
        SupportTicket.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('_id subject category status createdAt')
            .lean(),
        SupportTicket.countDocuments(filter),
    ]);

    res.json({
        items,
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
    });
};

/**
 * POST /api/seller/support/tickets
 * Body: { subject, category, message }
 */
// in createTicket (src/controllers/sellerController.js)
export const createTicket = async (req, res) => {
    const sellerId = new mongoose.Types.ObjectId(req.user._id);
    const { subject, category = 'general', message, attachments = [] } = req.body || {};

    if (!subject || !subject.trim() || !message || !message.trim()) {
        return res.status(400).json({ message: 'Subject and message are required.' });
    }

    const doc = await SupportTicket.create({
        seller: sellerId,
        subject: subject.trim(),
        category,
        message: message.trim(),
        status: 'open',
        attachments: Array.isArray(attachments) ? attachments.slice(0, 5) : [],
    });

    res.status(201).json({ _id: doc._id, ok: true });
};


/* ---------------- Helpers ---------------- */

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

function toSort(sortStr = '') {
    if (!sortStr) return { createdAt: -1 };
    const spec = {};
    sortStr.split(',').forEach((chunk) => {
        const s = chunk.trim();
        if (!s) return;
        if (s.startsWith('-')) spec[s.slice(1)] = -1;
        else spec[s] = 1;
    });
    return Object.keys(spec).length ? spec : { createdAt: -1 };
}

/**
 * Build a daily range (YYYY-MM-DD strings) for the chosen period.
 * For "all", we default to the last 30 days.
 */
function buildDateRange(period, startDate, endDate) {
    let start = startDate, end = endDate;
    if (!start || !end) {
        // default 30 days window for "all" or unspecified
        end = dayjs().endOf('day').toDate();
        start = dayjs(end).subtract(29, 'day').startOf('day').toDate();
    }
    const days = [];
    let cur = dayjs(start);
    const last = dayjs(end).startOf('day');
    while (cur.isBefore(last) || cur.isSame(last)) {
        days.push(cur.format('YYYY-MM-DD'));
        cur = cur.add(1, 'day');
    }
    return { start, end, days };
}
