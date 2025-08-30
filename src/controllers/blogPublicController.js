// src/controllers/blogPublicController.js
import BlogPost from "../models/BlogPost.js";

/* ------------------------------
 * Helpers
 * ------------------------------ */

// Safely build a case-insensitive regex from user input
function safeRegex(q) {
    try {
        return new RegExp(q, "i");
    } catch {
        return new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }
}

// Split "tag=a,b,c" -> ["a","b","c"] (trim, dedupe, non-empty)
function parseTags(tagParam) {
    if (!tagParam) return [];
    const arr = String(tagParam)
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    return Array.from(new Set(arr));
}

/* =========================================================
 * GET /api/blog
 * Query:
 *   - q:     string (search title/excerpt/content; case-insensitive)
 *   - tag:   string | "tag1,tag2" (only matches tags that exist in posts)
 *   - page:  number (default 1)
 *   - limit: number (default 9, max 50)
 * Note: Only returns isPublished:true posts.
 * Sort: latest first (publishedAt desc, then createdAt desc)
 * ========================================================= */
export const listPublicBlog = async (req, res) => {
    const {
        q = "",
        tag = "",
        page = 1,
        limit = 9,
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const perPage = Math.min(50, Math.max(1, Number(limit) || 9));
    const skip = (pageNum - 1) * perPage;

    const filter = { isPublished: true };

    // Search
    if (q && String(q).trim().length) {
        const rx = safeRegex(String(q).trim());
        filter.$or = [{ title: rx }, { excerpt: rx }, { content: rx }];
    }

    // Tag filter (use case-insensitive exact matches)
    const tags = parseTags(tag);
    if (tags.length) {
        // Turn each tag into a ^tag$ regex (case-insensitive) so "Mortgage" and "mortgage" match the same
        const regexes = tags.map((t) => {
            const esc = String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            return new RegExp(`^${esc}$`, "i");
        });
        filter.tags = { $in: regexes };
    }

    const [items, total] = await Promise.all([
        BlogPost.find(filter)
            .sort({ publishedAt: -1, createdAt: -1 })
            .skip(skip)
            .limit(perPage)
            .select("title slug excerpt coverUrl readTime tags publishedAt createdAt views")
            .lean(),
        BlogPost.countDocuments(filter),
    ]);

    res.json({
        items,
        total,
        page: pageNum,
        pages: Math.max(1, Math.ceil(total / perPage)),
    });
};

/* =========================================================
 * GET /api/blog/:slug
 * Returns one published post and increments views
 * ========================================================= */
export const getPublicBlogBySlug = async (req, res) => {
    const { slug } = req.params;
    const post = await BlogPost.findOne({ slug, isPublished: true });
    if (!post) return res.status(404).json({ message: "Not found" });

    // increment views (non-blocking)
    BlogPost.updateOne({ _id: post._id }, { $inc: { views: 1 } }).catch(() => { });
    res.json(post);
};

/* =========================================================
 * GET /api/blog/latest?limit=3
 * For homepage widget (latest published)
 * ========================================================= */
export const latestPublicBlog = async (req, res) => {
    const limit = Math.min(12, Number(req.query.limit || 3));
    const items = await BlogPost.find({ isPublished: true })
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(limit)
        .select("title slug excerpt coverUrl readTime publishedAt")
        .lean();
    res.json({ items });
};

/* =========================================================
 * GET /api/blog/tags
 * Returns distinct tags from published posts.
 *   - If you want counts: pass ?withCounts=1
 * ========================================================= */
export const listAvailableTags = async (req, res) => {
    const withCounts = String(req.query.withCounts || "") === "1";

    if (!withCounts) {
        const items = await BlogPost.distinct("tags", { isPublished: true });
        // Clean & sort case-insensitively
        const clean = items
            .filter((t) => typeof t === "string" && t.trim().length)
            .map((t) => t.trim())
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
        return res.json({ items: clean });
    }

    // With counts
    const agg = await BlogPost.aggregate([
        { $match: { isPublished: true, tags: { $type: "string" } } },
        { $project: { tags: 1 } },
        { $unwind: "$tags" },
        { $group: { _id: { $toLower: { $trim: { input: "$tags" } } }, count: { $sum: 1 } } },
        { $project: { _id: 0, tag: "$_id", count: 1 } },
        { $sort: { tag: 1 } },
    ]);

    // Optional: return original-casing too (best-effort) by picking one sample per lowercased tag
    // If you store canonical casing already, you can skip this and just return {tag, count}.
    const distinctRaw = await BlogPost.distinct("tags", { isPublished: true });
    const mapCase = new Map();
    for (const t of distinctRaw) {
        if (typeof t !== "string") continue;
        const key = t.trim().toLowerCase();
        if (key && !mapCase.has(key)) mapCase.set(key, t.trim());
    }
    const items = agg.map((x) => ({
        tag: mapCase.get(x.tag) || x.tag,
        count: x.count,
    }));

    res.json({ items });
};
