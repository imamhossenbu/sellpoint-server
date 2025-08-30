import Notification from '../models/Notification.js';
import ChatMessage from '../models/ChatMessage.js';
import User from '../models/User.js';

const serializeMsg = (m) => ({
    _id: m._id,
    listing: m.listing,
    from: String(m.from),
    to: String(m.to),
    text: m.text,
    createdAt: m.createdAt,
    readAt: m.readAt || null,
});

export function setupSocket(io) {
    // lightweight auth: expect userId in handshake.auth or query
    io.use((socket, next) => {
        const uid = socket.handshake.auth?.userId || socket.handshake.query?.userId;
        if (!uid) return next(new Error('unauthorized'));
        socket.userId = String(uid);
        next();
    });

    io.on('connection', (socket) => {
        // each user only joins their own user room
        socket.join(`user:${socket.userId}`);

        // optional listing room (for presence/typing). DO NOT join other users' rooms.
        socket.on('join', ({ listingId }) => {
            if (listingId) socket.join(`listing:${listingId}`);
        });

        // when someone opens chat (first time)
        socket.on('chat:started', async ({ listingId, sellerId }) => {
            if (!sellerId) return;
            const note = await Notification.create({
                user: sellerId,
                type: 'chat_started',
                title: 'New chat opened',
                body: 'A buyer opened the chat on your listing.',
                meta: { listingId, from: socket.userId },
            });
            io.to(`user:${sellerId}`).emit('notification:new', note);
        });

        // send message (with ACK). Server does NOT echo to sender; only recipient gets 'message:new'
        socket.on('message:send', async (payload, ack) => {
            try {
                const { listingId, to, text } = payload || {};
                const clean = String(text || '').trim();
                if (!to || !clean) return ack?.({ ok: false, error: 'bad_request' });

                // 1) persist
                const msg = await ChatMessage.create({
                    listing: listingId || null,
                    from: socket.userId,
                    to: String(to),
                    text: clean.slice(0, 2000),
                });

                const safe = serializeMsg(msg);

                // 2) deliver to recipient in realtime
                io.to(`user:${to}`).emit('message:new', safe);

                // (optional) broadcast to listing room for presence/other viewers, excluding sender
                if (listingId) socket.to(`listing:${listingId}`).emit('message:new', safe);

                // 3) notification for recipient
                const sender = await User.findById(socket.userId).select('name').lean();
                const note = await Notification.create({
                    user: String(to),
                    type: 'message',
                    title: 'New message',
                    body: `${sender?.name || 'A buyer'}: ${clean.slice(0, 80)}`,
                    meta: { listingId, from: socket.userId, messageId: msg._id },
                });
                io.to(`user:${to}`).emit('notification:new', note);

                // 4) ACK to sender so UI adds exactly once
                ack?.({ ok: true, msg: safe });
            } catch (e) {
                console.error('message:send error', e);
                ack?.({ ok: false, error: 'server_error' });
            }
        });
    });
}
