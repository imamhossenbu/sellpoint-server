// src/controllers/sellerRequestController.js
import dayjs from "dayjs";
import SellerRequest from "../models/SellerRequest.js";
import User from "../models/User.js";
import Plan from "../models/Plan.js";
import Notification from "../models/Notification.js";

/** helper: compute end date based on plan.period */
function endDateFromPeriod(period = "month", start = new Date()) {
    const d = dayjs(start);
    if (period === "year") return d.add(1, "year").toDate();
    if (period === "one_time") {
        // treat as "lifetime" (you can customize)
        return d.add(50, "year").toDate();
    }
    return d.add(1, "month").toDate(); // default
}

export const createRequest = async (req, res) => {
    const uid = req.user?._id;
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const { planId } = req.body || {};
    if (!planId) return res.status(400).json({ message: "planId required" });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "seller" || user.role === "admin") {
        return res.status(400).json({ message: "You already have seller access" });
    }

    // optional: one pending request at a time
    const existing = await SellerRequest.findOne({ user: uid, status: "pending" });
    if (existing) return res.status(400).json({ message: "You already have a pending request" });

    // (Optional) ensure plan exists & active; if you want to enforce
    const plan = await Plan.findById(planId);
    if (!plan || plan.isActive === false) {
        return res.status(400).json({ message: "Invalid or inactive plan" });
    }

    const doc = await SellerRequest.create({ user: uid, plan: planId });

    // notify admins (optional)
    try {
        await Notification.create({
            user: null, // or route to specific admin(s)
            type: "seller_request",
            title: "New seller upgrade request",
            body: `${user.name || user.email} requested seller upgrade`,
            read: false,
            data: { requestId: doc._id, userId: uid, planId },
        });
    } catch { }

    res.status(201).json({ request: doc });
};

export const listRequests = async (req, res) => {
    const items = await SellerRequest.find({})
        .populate("user", "name email role")
        .populate("plan", "name priceBDT period")
        .sort({ createdAt: -1 })
        .lean();

    res.json({ items });
};

export const approve = async (req, res) => {
    const { id } = req.params;
    const adminId = req.user?._id;

    const doc = await SellerRequest.findById(id);
    if (!doc) return res.status(404).json({ message: "Request not found" });
    if (doc.status !== "pending") return res.status(400).json({ message: "Already reviewed" });

    // load plan to compute sellerUntil
    const plan = await Plan.findById(doc.plan);
    if (!plan) return res.status(400).json({ message: "Plan not found" });

    const user = await User.findById(doc.user);
    if (!user) return res.status(404).json({ message: "User not found" });

    const start = new Date();
    const end = endDateFromPeriod(plan.period, start);

    // Mark request
    doc.status = "approved";
    doc.reviewedBy = adminId;
    doc.reviewedAt = new Date();
    await doc.save();

    // Grant seller access
    user.role = "seller";
    user.sellerApprovedAt = start;
    user.activePlan = plan._id;
    user.sellerUntil = end;

    // track in subscriptions history
    user.subscriptions = user.subscriptions || [];
    user.subscriptions.push({
        plan: plan._id,
        startDate: start,
        endDate: end,
        status: "active",
    });

    await user.save();

    // notify user
    try {
        await Notification.create({
            user: String(user._id),
            type: "system",
            title: "Seller access approved",
            body: `Your seller access is active until ${end.toDateString()}.`,
            read: false,
            data: { redirect: "/seller/dashboard" },
        });
    } catch { }

    // optional: socket push
    const io = req.app.get("io");
    io?.to(`user:${String(user._id)}`).emit("notification:new", { unreadCount: undefined });

    res.json({ ok: true, request: doc });
};

export const reject = async (req, res) => {
    const { id } = req.params;
    const { note = "" } = req.body || {};

    const doc = await SellerRequest.findById(id);
    if (!doc) return res.status(404).json({ message: "Request not found" });
    if (doc.status !== "pending") return res.status(400).json({ message: "Already reviewed" });

    doc.status = "rejected";
    doc.note = note;
    doc.reviewedBy = req.user?._id;
    doc.reviewedAt = new Date();
    await doc.save();

    // optional notify
    try {
        await Notification.create({
            user: String(doc.user),
            type: "system",
            title: "Seller access update",
            body: "Your seller upgrade request was not approved this time.",
            read: false,
        });
    } catch { }

    res.json({ ok: true, request: doc });
};
