// src/controllers/reviewController.js
import mongoose from "mongoose";
import Review from "../models/Review.js";
import Listing from "../models/Listing.js";

const { isValidObjectId, Types } = mongoose;

/* =======================================================================
 * GET /api/reviews/:listingId
 * Public — returns APPROVED reviews only (avg & count included)
 * Fields: user(_id+name via populate), authorName, avatarUrl, rating, comment, createdAt
 * ======================================================================= */
export const listReviewsForListing = async (req, res) => {
    const { listingId } = req.params;
    if (!isValidObjectId(listingId)) {
        return res.status(400).json({ message: "Invalid listing id" });
    }

    const items = await Review.find({
        listing: listingId,
        status: "approved",
    })
        .select("user authorName avatarUrl rating comment status createdAt")
        .populate("user", "name") // optional, keeps _id + name of the reviewer
        .sort({ createdAt: -1 })
        .lean();

    const [{ avg = 0, count = 0 } = {}] = await Review.aggregate([
        { $match: { listing: new Types.ObjectId(listingId), status: "approved" } },
        { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
        { $project: { _id: 0, avg: 1, count: 1 } },
    ]);

    res.json({ items, avg, count, average: avg });
};

/* =======================================================================
 * POST /api/reviews
 * Auth — create review (status=pending)
 * Body: { listingId, rating(1..5), comment?, authorName?, avatarUrl? }
 * Notes:
 *  - If authorName / avatarUrl are omitted, we fallback to req.user (if present)
 *  - Self-review blocked (seller cannot review their own listing)
 * ======================================================================= */
export const createReview = async (req, res) => {
    const { listingId, rating, comment, authorName, avatarUrl } = req.body;

    if (!listingId || rating == null) {
        return res.status(400).json({ message: "Missing fields" });
    }
    if (!isValidObjectId(listingId)) {
        return res.status(400).json({ message: "Invalid listing id" });
    }

    const rNum = Number(rating);
    if (!Number.isFinite(rNum) || rNum < 1 || rNum > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const listing = await Listing.findById(listingId).select("_id seller");
    if (!listing) return res.status(404).json({ message: "Listing not found" });

    // Optional: prevent seller from reviewing their own listing
    if (String(listing.seller) === String(req.user._id)) {
        return res.status(403).json({ message: "You cannot review your own listing." });
    }

    // sanitize optional fields
    const safeAuthorName =
        (authorName || req.user?.name || "").toString().trim() || undefined;
    const safeAvatarUrl =
        (avatarUrl || req.user?.avatarUrl || "").toString().trim() || undefined;

    try {
        const doc = await Review.create({
            listing: listing._id,
            user: req.user._id,
            rating: rNum,
            comment: (comment || "").trim(),
            authorName: safeAuthorName,
            avatarUrl: safeAvatarUrl,
            status: "pending",
        });

        // Return the created review with populated user name (nice for FE)
        const created = await Review.findById(doc._id)
            .select("user authorName avatarUrl rating comment status createdAt")
            .populate("user", "name")
            .lean();

        return res.status(201).json(created);
    } catch (err) {
        // If you enable a unique index on (listing,user), this catches duplicates
        if (err?.code === 11000) {
            return res.status(409).json({ message: "You already reviewed this listing." });
        }
        console.error("createReview error:", err);
        return res.status(500).json({ message: "Failed to create review" });
    }
};

/* =======================================================================
 * (Optional) Admin endpoints — unchanged except field selection includes
 * authorName & avatarUrl so admins can see what users submitted.
 * ======================================================================= */
export const listReviewsAdmin = async (req, res) => {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const items = await Review.find(filter)
        .select(
            "listing user authorName avatarUrl rating comment status createdAt moderatedBy moderatedAt"
        )
        .populate("listing", "title")
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .lean();

    res.json({ items });
};

export const setReviewStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected", "pending"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
    }

    const r = await Review.findByIdAndUpdate(
        id,
        { status, moderatedBy: req.user?._id, moderatedAt: new Date() },
        { new: true }
    ).select(
        "listing user authorName avatarUrl rating comment status createdAt moderatedBy moderatedAt"
    );

    if (!r) return res.status(404).json({ message: "Not found" });
    res.json(r);
};
