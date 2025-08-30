import mongoose from 'mongoose';
import SupportTicket from '../models/SupportTicket.js';

/* =========================
 *      SELLER ENDPOINTS
 * ========================= */

// POST /api/seller/support/tickets
export const createTicket = async (req, res) => {
    const { subject, category = 'general', message = '', attachments = [] } = req.body || {};
    if (!subject?.trim() || !message?.trim()) {
        return res.status(400).json({ message: 'Subject and message are required' });
    }
    const doc = await SupportTicket.create({
        seller: req.user._id,
        subject: subject.trim(),
        category,
        messages: [{
            authorType: 'seller',
            author: req.user._id,
            body: message.trim(),
            attachments: attachments?.slice?.(0, 5) || [],
        }],
    });
    res.status(201).json({ id: doc._id });
};

// GET /api/seller/support/tickets?q=&status=&page=&limit=
export const listMyTickets = async (req, res) => {
    const {
        q = '',
        status,               // optional: open|pending|resolved|closed
        page = 1,
        limit = 20,
    } = req.query;

    const filter = { seller: req.user._id };
    if (status) filter.status = status;
    if (q) filter.subject = { $regex: q, $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
        SupportTicket.find(filter)
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .select('subject category status createdAt updatedAt'),
        SupportTicket.countDocuments(filter),
    ]);

    res.json({
        items,
        total,
        page: Number(page),
        pages: Math.max(1, Math.ceil(total / Number(limit))),
    });
};

// GET /api/seller/support/tickets/:id
export const getMyTicket = async (req, res) => {
    const { id } = req.params;
    const t = await SupportTicket.findById(id)
        .populate('messages.author', 'name email role')
        .lean();
    if (!t || String(t.seller) !== String(req.user._id)) {
        return res.status(404).json({ message: 'Not found' });
    }
    res.json(t);
};

// POST /api/seller/support/tickets/:id/replies
export const replyMyTicket = async (req, res) => {
    const { id } = req.params;
    const { message = '', attachments = [] } = req.body || {};
    const t = await SupportTicket.findById(id);
    if (!t || String(t.seller) !== String(req.user._id)) {
        return res.status(404).json({ message: 'Not found' });
    }
    if (!message.trim() && !(attachments?.length)) {
        return res.status(400).json({ message: 'Empty message' });
    }
    t.messages.push({
        authorType: 'seller',
        author: req.user._id,
        body: message.trim(),
        attachments: attachments?.slice?.(0, 5) || [],
    });
    // auto-bounce status: if resolved/closed, reopen to open
    if (t.status === 'resolved' || t.status === 'closed') t.status = 'open';
    await t.save();
    res.json({ ok: true });
};

/* =========================
 *       ADMIN ENDPOINTS
 * ========================= */

// GET /api/admin/support/tickets?status=&q=&page=&limit=
export const listTicketsAdmin = async (req, res) => {
    const { status, q = '', page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (q) filter.subject = { $regex: q, $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
        SupportTicket.find(filter)
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate('seller', 'name email')
            .select('subject status createdAt updatedAt seller'),
        SupportTicket.countDocuments(filter),
    ]);

    res.json({
        items: items.map(it => ({
            _id: it._id,
            subject: it.subject,
            status: it.status,
            createdAt: it.createdAt,
            updatedAt: it.updatedAt,
            sellerName: it?.seller?.name || it?.seller?.email || 'Seller',
        })),
        total,
        page: Number(page),
        pages: Math.max(1, Math.ceil(total / Number(limit))),
    });
};

// GET /api/admin/support/tickets/:id
export const getTicketAdmin = async (req, res) => {
    const t = await SupportTicket.findById(req.params.id)
        .populate('seller', 'name email')
        .populate('messages.author', 'name email role')
        .lean();
    if (!t) return res.status(404).json({ message: 'Not found' });
    res.json(t);
};

// POST /api/admin/support/tickets/:id/replies
export const replyTicketAdmin = async (req, res) => {
    const { id } = req.params;
    const { message = '', attachments = [] } = req.body || {};
    if (!message.trim() && !(attachments?.length)) {
        return res.status(400).json({ message: 'Empty message' });
    }
    const t = await SupportTicket.findById(id);
    if (!t) return res.status(404).json({ message: 'Not found' });

    t.messages.push({
        authorType: 'admin',
        author: req.user._id,
        body: message.trim(),
        attachments: attachments?.slice?.(0, 5) || [],
    });
    // auto-progress status
    if (t.status === 'open') t.status = 'pending';
    await t.save();
    res.json({ ok: true });
};

// PATCH /api/admin/support/tickets/:id/status { status }
export const setTicketStatusAdmin = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!['open', 'pending', 'resolved', 'closed'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }
    const t = await SupportTicket.findById(id);
    if (!t) return res.status(404).json({ message: 'Not found' });
    t.status = status;
    await t.save();
    res.json({ ok: true, status: t.status });
};
