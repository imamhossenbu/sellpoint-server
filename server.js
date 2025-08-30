import http from "http";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { Server } from "socket.io";
import "./src/config/db.js";

/* routes */
import authRoutes from "./src/routes/authRoutes.js";
import listingRoutes from "./src/routes/listingRoutes.js";
import paymentRoutes from "./src/routes/paymentRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";
import subscriptionRoutes from "./src/routes/subscriptionRoutes.js";
import wishlistRoutes from "./src/routes/wishlistRoutes.js";
import notificationRoutes from "./src/routes/notificationRoutes.js";
import newsletterRoutes from "./src/routes/newsletterRoutes.js";
import sellerRoutes from "./src/routes/sellerRoutes.js";
import sellerSupportRoutes from "./src/routes/sellerSupportRoutes.js";
import adminSupportRoutes from "./src/routes/adminSupportRoutes.js";
import testimonialPublic from "./src/routes/testimonialPublicRoutes.js";
import testimonialAdmin from "./src/routes/testimonialAdminRoutes.js";
import reviewPublic from "./src/routes/reviewRoutes.js";
import reviewAdmin from "./src/routes/reviewAdminRoutes.js";
import publicRoutes from "./src/routes/public.js";
import blogPublic from "./src/routes/blogPublic.js";
import blogAdmin from "./src/routes/blogAdmin.js";
import chatRoutes from "./src/routes/chatRoutes.js";
import accountRoutes from "./src/routes/accountRoutes.js";

/* NEW */
import planRoutes from "./src/routes/planRoutes.js";
import sellerRequestRoutes from "./src/routes/sellerRequestRoutes.js";

import { errorHandler, notFound } from "./src/middleware/error.js";
import { ensureConversation, sendMessageFromSocket } from "./src/controllers/chatController.js";
import Notification from "./src/models/Notification.js";

dotenv.config();

/* ---------- CORS helpers ---------- */
const normalizeOrigins = (s = "") =>
    s.split(",").map((x) => x.trim().replace(/\/$/, "")).filter(Boolean);

const allowOrigins = normalizeOrigins(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "");

// Open these paths (SSLCommerz will hit them; don’t hard-fail on unknown Origin)
const openCorsPaths = [
    "/api/payments/ssl/success",
    "/api/payments/ssl/cancel",
    "/api/payments/ssl/ipn",
];

const app = express();
app.set("trust proxy", 1);

/* Per-request CORS: never throw; simply omit headers for disallowed origins */
app.use(cors((req, cb) => {
    const origin = (req.headers.origin || "").replace(/\/$/, "");

    // Always allow payment callback endpoints
    if (openCorsPaths.some((p) => req.path.startsWith(p))) {
        return cb(null, { origin: true, credentials: true });
    }

    // Allow requests with no Origin (direct nav/server-to-server)
    if (!origin) return cb(null, { origin: true, credentials: true });

    // Allow known frontends
    if (allowOrigins.includes(origin)) {
        return cb(null, { origin: true, credentials: true });
    }

    // Disallow silently (no exception)
    return cb(null, { origin: false });
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/", (_req, res) => res.json({ ok: true, name: "SellPoint API" }));
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

/* routes */
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/seller", sellerRoutes);
app.use("/api/seller/support", sellerSupportRoutes);
app.use("/api/admin/support", adminSupportRoutes);
app.use("/api/testimonials", testimonialPublic);
app.use("/api/admin/testimonials", testimonialAdmin);
app.use("/api/reviews", reviewPublic);
app.use("/api/admin/reviews", reviewAdmin);
app.use("/api", publicRoutes);
app.use("/api", blogPublic);
app.use("/api", blogAdmin);
app.use("/api/chat", chatRoutes);

/* NEW */
app.use("/api/plans", planRoutes);
app.use("/api/seller-requests", sellerRequestRoutes);
app.use("/api/account", accountRoutes);

app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);

/* Socket.IO: don’t throw on unknown origins either */
const io = new Server(server, {
    cors: {
        origin(origin, cb) {
            if (!origin) return cb(null, true);
            const o = origin.replace(/\/$/, "");
            if (allowOrigins.includes(o)) return cb(null, true);
            return cb(null, false);
        },
        credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 20000,
});

app.set("io", io);

io.use((socket, next) => {
    const uid = socket.handshake?.auth?.userId || socket.handshake?.query?.userId;
    if (!uid) return next(new Error("unauthorized"));
    socket.userId = String(uid);
    next();
});

io.on("connection", (socket) => {
    socket.join(`user:${socket.userId}`);

    socket.on("chat:started", async ({ listingId, sellerId }) => {
        try {
            if (!sellerId) return;
            await Notification.create({
                user: String(sellerId),
                type: "chat_started",
                title: "New chat opened",
                body: "A buyer opened the chat on your listing.",
                read: false,
                meta: { listingId, from: socket.userId },
            });
            const unreadCount = await Notification.countDocuments({ user: String(sellerId), read: false });
            io.to(`user:${sellerId}`).emit("notification:new", { unreadCount });
        } catch { }
    });

    socket.on("message:send", async (payload, ack) => {
        try {
            const { conversationId, text, listingId, to } = payload || {};
            let out;
            if (conversationId) {
                out = await sendMessageFromSocket(io, { fromId: socket.userId, conversationId, text });
            } else if (listingId && to) {
                const conv = await ensureConversation({ listingId, buyerId: socket.userId, sellerId: to });
                out = await sendMessageFromSocket(io, { fromId: socket.userId, conversationId: conv._id, text });
            } else {
                return ack?.({ ok: false, error: "bad_request" });
            }
            ack?.({ ok: true, msg: out });
        } catch (e) {
            ack?.({ ok: false, error: e?.message || "server_error" });
        }
    });
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
    const origins = allowOrigins.length ? allowOrigins.join(", ") : "(none configured)";
    console.log(`API running on http://${HOST}:${PORT}`);
    console.log(`CORS allowed origins: ${origins}`);
});

server.on("error", (err) => {
    console.error("Server error:", err);
});
