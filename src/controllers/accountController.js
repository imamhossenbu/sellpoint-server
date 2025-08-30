// src/controllers/accountController.js
import User from "../models/User.js";

export const myPlan = async (req, res) => {
    const u = await User.findById(req.user._id)
        .populate("activePlan", "name period priceBDT")
        .lean();

    if (!u) return res.status(404).json({ message: "User not found" });

    // Find latest relevant subscription (prefer active + matching activePlan)
    let sub = null;
    if (Array.isArray(u.subscriptions) && u.subscriptions.length) {
        const subs = [...u.subscriptions].sort(
            (a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0)
        );
        const activePlanId = u.activePlan?._id || u.activePlan;
        sub =
            subs.find(
                (s) =>
                    String(s.plan) === String(activePlanId || "") && s.status === "active"
            ) || subs[0];
    }

    const startedAt = sub?.startDate || u.sellerApprovedAt || null;
    const endsAt = u.sellerUntil || sub?.endDate || null;

    const now = Date.now();
    const msLeft = endsAt ? new Date(endsAt).getTime() - now : null;
    const daysLeft =
        msLeft == null ? null : Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

    // Progress (optional UI nicety)
    let progress = null;
    if (startedAt && endsAt) {
        const total = new Date(endsAt).getTime() - new Date(startedAt).getTime();
        const done = now - new Date(startedAt).getTime();
        progress = total > 0 ? Math.min(100, Math.max(0, Math.round((done / total) * 100))) : 0;
    }

    res.json({
        role: u.role,
        plan: u.activePlan || null, // { _id, name, period, priceBDT } if populated
        startedAt,
        endsAt,
        daysLeft,
        progress,
    });
};
