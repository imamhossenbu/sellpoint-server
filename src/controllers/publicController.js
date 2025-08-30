// src/controllers/publicController.js
import dayjs from "dayjs";
import User from "../models/User.js";
import Listing from "../models/Listing.js";
import Transaction from "../models/Transaction.js";

let _BlogPost = null;
async function getBlogModel() {
    if (_BlogPost) return _BlogPost;
    try {
        const mod = await import("../models/BlogPost.js");
        _BlogPost = mod.default || mod;
        return _BlogPost;
    } catch {
        return null; // model not present
    }
}

export const publicStats = async (_req, res) => {
    const todayStart = dayjs().startOf("day").toDate();
    const todayEnd = dayjs().endOf("day").toDate();
    const monthStart = dayjs().startOf("month").toDate();
    const monthEnd = dayjs().endOf("month").toDate();

    const [totalSellers, verifiedSellersTry] = await Promise.all([
        User.countDocuments({ role: "seller" }),
        User.countDocuments({ role: "seller", isVerified: true }).catch(() => 0),
    ]);
    const verifiedSellers = verifiedSellersTry > 0 ? verifiedSellersTry : totalSellers;

    const [liveListings, newToday, monthSuccessCount] = await Promise.all([
        Listing.countDocuments({ status: "approved" }),
        Listing.countDocuments({
            status: "approved",
            createdAt: { $gte: todayStart, $lte: todayEnd },
        }),
        Transaction.countDocuments({
            status: "success",
            createdAt: { $gte: monthStart, $lte: monthEnd },
        }),
    ]);

    // blog count (safe)
    const BlogPost = await getBlogModel();
    const blogCount = BlogPost ? await BlogPost.countDocuments({ isPublished: true }) : 0;

    res.json({
        liveListings,
        verifiedSellers,
        monthSuccessCount,
        newToday,
        blogCount,
    });
};
