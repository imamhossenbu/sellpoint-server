import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import ChatMessage from "../models/ChatMessage.js";
import Notification from "../models/Notification.js";

const { Types } = mongoose;
const toId = (v) => (v instanceof Types.ObjectId ? v : new Types.ObjectId(String(v)));
const participantsKeyOf = (a, b) => [String(a), String(b)].sort().join(":");

export const ensureConversation = async ({ listingId, buyerId, sellerId }) => {
    const listId = toId(listingId);
    const buyer = toId(buyerId);
    const seller = toId(sellerId);
    if (String(buyer) === String(seller)) {
        throw Object.assign(new Error("Cannot start a chat with yourself."), { status: 400 });
    }
    const pKey = participantsKeyOf(buyer, seller);

    let conv =
        (await Conversation.findOne({ listing: listId, participantsKey: pKey })) ||
        (await Conversation.findOne({ listing: listId, participants: { $all: [buyer, seller] } }));

    if (!conv) {
        const unread = new Map();
        unread.set(String(buyer), 0);
        unread.set(String(seller), 0);
        conv = await Conversation.create({
            listing: listId,
            participants: [buyer, seller],
            participantsKey: pKey,
            unread,
            lastMessage: "",
            lastMessageAt: new Date(),
        });
    } else {
        let changed = false;
        if (!conv.participantsKey) {
            conv.participantsKey = pKey;
            changed = true;
        }
        if (!conv.unread) {
            const m = new Map();
            m.set(String(buyer), 0);
            m.set(String(seller), 0);
            conv.unread = m;
            changed = true;
        }
        if (changed) await conv.save();
    }
    return conv;
};

export const conversations = async (req, res) => {
    try {
        const uid = String(req.user?._id || "");
        const type = (req.query?.type || "all").toLowerCase();

        let convs = await Conversation.find({ participants: { $in: [uid] } })
            .populate({ path: "listing", select: "title type coverUrl images" })
            .populate({ path: "participants", select: "name email avatarUrl" })
            .lean();

        const existingKeys = new Set(
            convs.map((c) => {
                const a = c.participants?.[0]?._id;
                const b = c.participants?.[1]?._id;
                return String(c.listing?._id || "") + ":" + (c.participantsKey || participantsKeyOf(a, b));
            })
        );

        const recentMsgs = await ChatMessage.find({
            $or: [{ from: uid }, { to: uid }],
        })
            .sort({ createdAt: -1 })
            .limit(500)
            .lean();

        const seeds = new Map();
        for (const m of recentMsgs) {
            if (!m.listing) continue;
            const key = String(m.listing) + ":" + participantsKeyOf(m.from, m.to);
            if (existingKeys.has(key)) continue;
            if (!seeds.has(key)) seeds.set(key, m);
        }

        for (const [, m] of seeds) {
            const buyer = String(m.from) === uid ? uid : String(m.to);
            const seller = String(m.from) === uid ? String(m.to) : String(m.from);
            const conv = await ensureConversation({ listingId: m.listing, buyerId: buyer, sellerId: seller });
            conv.lastMessage = m.text || "";
            conv.lastMessageAt = m.createdAt;
            await conv.save();
        }

        convs = await Conversation.find({ participants: { $in: [uid] } })
            .populate({ path: "listing", select: "title type coverUrl images" })
            .populate({ path: "participants", select: "name email avatarUrl" })
            .lean();

        if (type === "rent" || type === "sale") {
            convs = convs.filter((c) => (c.listing?.type || "").toLowerCase() === type);
        }

        const unique = new Map();
        for (const c of convs) {
            const a = c.participants?.[0]?._id;
            const b = c.participants?.[1]?._id;
            const k = String(c.listing?._id || "") + ":" + (c.participantsKey || participantsKeyOf(a, b));
            const prev = unique.get(k);
            if (!prev) unique.set(k, c);
            else {
                const t1 = new Date(prev.lastMessageAt || prev.updatedAt || 0).getTime();
                const t2 = new Date(c.lastMessageAt || c.updatedAt || 0).getTime();
                if (t2 > t1) unique.set(k, c);
            }
        }

        const items = Array.from(unique.values()).sort((a, b) => {
            const ta = new Date(a.lastMessageAt || a.updatedAt || 0).getTime();
            const tb = new Date(b.lastMessageAt || b.updatedAt || 0).getTime();
            return tb - ta;
        });

        res.json({ items });
    } catch (err) {
        res.status(500).json({ message: err.message || "Failed to load conversations" });
    }
};

export const start = async (req, res) => {
    try {
        const buyerId = req.user?._id;
        const { listingId, sellerId } = req.body || {};
        if (!buyerId) return res.status(401).json({ message: "Unauthorized" });
        if (!listingId || !sellerId) return res.status(400).json({ message: "listingId & sellerId required" });

        const conv = await ensureConversation({ listingId, buyerId, sellerId });
        const isParticipant = conv.participants.some((p) => String(p) === String(buyerId));
        if (!isParticipant) return res.status(403).json({ message: "Forbidden" });

        const [p0, p1] = conv.participants.map(String);
        const messages = await ChatMessage.find({
            listing: conv.listing,
            $or: [{ from: p0, to: p1 }, { from: p1, to: p0 }],
        })
            .sort({ createdAt: 1 })
            .limit(500)
            .lean();

        res.json({ conversation: conv, messages });
    } catch (err) {
        const code = err?.status || 500;
        res.status(code).json({ message: err.message || "Failed to start chat" });
    }
};

export const listMessages = async (req, res) => {
    try {
        const { id } = req.params;
        const { before, limit = 300 } = req.query;
        const conv = await Conversation.findById(id).select("listing participants").lean();
        if (!conv) return res.status(404).json({ message: "Conversation not found" });

        const uid = String(req.user?._id || "");
        const isParticipant = conv.participants.some((p) => String(p) === uid);
        if (!isParticipant) return res.status(403).json({ message: "Forbidden" });

        const [a, b] = conv.participants.map(String);
        const q = {
            listing: conv.listing,
            $or: [{ from: a, to: b }, { from: b, to: a }],
        };
        if (before) q.createdAt = { $lt: new Date(before) };

        const items = await ChatMessage.find(q)
            .sort({ createdAt: 1 })
            .limit(Math.max(1, Math.min(Number(limit) || 300, 1000)))
            .lean();

        const out = items.map((m) => ({
            _id: m._id,
            conversation: String(conv._id),
            from: String(m.from),
            to: String(m.to),
            text: m.text,
            createdAt: m.createdAt,
        }));

        res.json({ items: out });
    } catch (err) {
        res.status(500).json({ message: err.message || "Failed to load messages" });
    }
};

export const markRead = async (req, res) => {
    try {
        const { id } = req.params;
        const uid = String(req.user?._id || "");
        const conv = await Conversation.findById(id);
        if (!conv) return res.status(404).json({ message: "Conversation not found" });
        const isParticipant = conv.participants.some((p) => String(p) === uid);
        if (!isParticipant) return res.status(403).json({ message: "Forbidden" });

        const m = conv.unread instanceof Map ? conv.unread : new Map(conv.unread || []);
        m.set(uid, 0);
        conv.unread = m;
        await conv.save();

        await Notification.updateMany(
            {
                user: uid,
                read: false,
                type: { $in: ["chat_message", "message"] },
                $or: [
                    { "meta.conversationId": conv._id },
                    { "data.conversationId": conv._id },
                    { "meta.listingId": conv.listing },
                    { "data.listingId": conv.listing },
                ],
            },
            { $set: { read: true } }
        );

        const unreadCount = await Notification.countDocuments({ user: uid, read: false });
        const io = req.app.get("io");
        io?.to(`user:${uid}`).emit("notification:new", { unreadCount });

        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ message: err.message || "Failed to mark read" });
    }
};

export const thread = async (req, res) => {
    try {
        const me = String(req.user?._id || "");
        const { listingId, otherId, limit = 200, before } = req.query || {};
        if (!me || !listingId || !otherId) return res.status(400).json({ message: "listingId & otherId required" });

        const q = {
            listing: new Types.ObjectId(listingId),
            $or: [{ from: me, to: otherId }, { from: otherId, to: me }],
        };
        if (before) q.createdAt = { $lt: new Date(before) };

        const items = await ChatMessage.find(q)
            .sort({ createdAt: 1 })
            .limit(Math.max(1, Math.min(Number(limit) || 200, 500)))
            .lean();

        const out = items.map((m) => ({
            _id: String(m._id),
            listing: m.listing || null,
            from: String(m.from),
            to: String(m.to),
            text: m.text,
            createdAt: m.createdAt,
        }));

        res.json({ items: out });
    } catch (err) {
        res.status(500).json({ message: err.message || "Failed to load thread" });
    }
};

export const updateMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const uid = String(req.user?._id || "");
        const { text } = req.body || {};
        const clean = String(text || "").trim().slice(0, 2000);
        if (!clean) return res.status(400).json({ message: "Text required" });

        const msg = await ChatMessage.findById(id);
        if (!msg) return res.status(404).json({ message: "Message not found" });
        if (String(msg.from) !== uid) return res.status(403).json({ message: "Forbidden" });

        msg.text = clean;
        await msg.save();

        const conv = await Conversation.findOne({
            listing: msg.listing,
            participantsKey: participantsKeyOf(msg.from, msg.to),
        });
        if (conv) {
            const last = await ChatMessage.find({
                listing: conv.listing,
                $or: [{ from: msg.from, to: msg.to }, { from: msg.to, to: msg.from }],
            })
                .sort({ createdAt: -1 })
                .limit(1);
            if (last[0]) {
                conv.lastMessage = last[0].text;
                conv.lastMessageAt = last[0].createdAt;
                await conv.save();
            }
        }

        const io = req.app.get("io");
        const out = { _id: String(msg._id), text: msg.text };
        io?.to(`user:${String(msg.to)}`).emit("message:updated", out);
        io?.to(`user:${String(msg.from)}`).emit("message:updated", out);

        res.json({ ok: true, message: out });
    } catch (e) {
        res.status(500).json({ message: e.message || "Failed to update message" });
    }
};

export const deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const uid = String(req.user?._id || "");
        const msg = await ChatMessage.findById(id);
        if (!msg) return res.status(404).json({ message: "Message not found" });
        if (String(msg.from) !== uid) return res.status(403).json({ message: "Forbidden" });

        const listingId = msg.listing;
        const a = String(msg.from);
        const b = String(msg.to);
        await msg.deleteOne();

        const conv = await Conversation.findOne({
            listing: listingId,
            participantsKey: participantsKeyOf(a, b),
        });
        if (conv) {
            const last = await ChatMessage.find({
                listing: listingId,
                $or: [{ from: a, to: b }, { from: b, to: a }],
            })
                .sort({ createdAt: -1 })
                .limit(1);
            if (last[0]) {
                conv.lastMessage = last[0].text;
                conv.lastMessageAt = last[0].createdAt;
            } else {
                conv.lastMessage = "";
                conv.lastMessageAt = new Date(conv.updatedAt || Date.now());
            }
            await conv.save();
        }

        const io = req.app.get("io");
        io?.to(`user:${b}`).emit("message:deleted", { _id: String(id) });
        io?.to(`user:${a}`).emit("message:deleted", { _id: String(id) });

        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ message: e.message || "Failed to delete message" });
    }
};

export const deleteConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const uid = String(req.user?._id || "");
        const conv = await Conversation.findById(id);
        if (!conv) return res.status(404).json({ message: "Conversation not found" });
        const isParticipant = conv.participants.some((p) => String(p) === uid);
        if (!isParticipant) return res.status(403).json({ message: "Forbidden" });

        const [a, b] = conv.participants.map(String);
        await ChatMessage.deleteMany({
            listing: conv.listing,
            $or: [{ from: a, to: b }, { from: b, to: a }],
        });
        await conv.deleteOne();

        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ message: e.message || "Failed to delete conversation" });
    }
};

export const sendMessageFromSocket = async (io, { fromId, conversationId, text }) => {
    const conv = await Conversation.findById(conversationId);
    if (!conv) throw Object.assign(new Error("Conversation not found"), { status: 404 });

    const from = String(fromId);
    const [p0, p1] = conv.participants.map(String);
    if (from !== p0 && from !== p1) throw Object.assign(new Error("Not a participant"), { status: 403 });

    const toId = from === p0 ? p1 : p0;
    const safeText = String(text || "").trim().slice(0, 2000);
    if (!safeText) throw Object.assign(new Error("Empty message"), { status: 400 });

    const saved = await ChatMessage.create({
        listing: conv.listing,
        from,
        to: toId,
        text: safeText,
    });

    conv.lastMessage = saved.text;
    conv.lastMessageAt = saved.createdAt;
    const unread = conv.unread instanceof Map ? conv.unread : new Map(conv.unread || []);
    unread.set(String(toId), Number(unread.get(String(toId)) || 0) + 1);
    conv.unread = unread;
    await conv.save();

    try {
        await Notification.create({
            user: toId,
            type: "chat_message",
            title: "New message",
            body: saved.text.slice(0, 140),
            read: false,
            meta: { conversationId: conv._id, listingId: conv.listing, from },
        });
    } catch {
        try {
            await Notification.create({
                user: toId,
                type: "chat_message",
                message: saved.text.slice(0, 140),
                read: false,
                data: { conversationId: conv._id, listingId: conv.listing, from },
            });
        } catch { }
    }

    const out = {
        _id: saved._id,
        conversation: String(conv._id),
        from: String(saved.from),
        to: String(saved.to),
        text: saved.text,
        createdAt: saved.createdAt,
    };

    const unreadCount = await Notification.countDocuments({ user: toId, read: false });

    io.to(`user:${toId}`).emit("message:new", out);
    io.to(`user:${toId}`).emit("notification:new", {
        type: "chat_message",
        conversationId: String(conv._id),
        listingId: String(conv.listing),
        from,
        at: saved.createdAt,
        unreadCount,
    });

    return out;
};
