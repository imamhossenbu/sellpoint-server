// src/controllers/blogAdminController.js
import slugify from "slugify";
import BlogPost from "../models/BlogPost.js";

function toSort(sortStr = "-createdAt") {
    const spec = {};
    String(sortStr)
        .split(",")
        .forEach((chunk) => {
            const s = chunk.trim();
            if (!s) return;
            if (s.startsWith("-")) spec[s.slice(1)] = -1;
            else spec[s] = 1;
        });
    return Object.keys(spec).length ? spec : { createdAt: -1 };
}

/**
 * GET /api/admin/blogs
 * Query: q, status (published|draft|all), page, limit, sort
 */
export const listAdminBlogs = async (req, res) => {
    const {
        q = "",
        status = "all",
        page = 1,
        limit = 20,
        sort = "-createdAt",
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * perPage;
    const sortSpec = toSort(sort);

    const filter = {};
    if (q) {
        filter.$or = [
            { title: { $regex: q, $options: "i" } },
            { excerpt: { $regex: q, $options: "i" } },
            { content: { $regex: q, $options: "i" } },
        ];
    }
    if (status === "published") filter.isPublished = true;
    else if (status === "draft") filter.isPublished = false;

    const [items, total] = await Promise.all([
        BlogPost.find(filter).sort(sortSpec).skip(skip).limit(perPage),
        BlogPost.countDocuments(filter),
    ]);

    res.json({
        items,
        total,
        page: pageNum,
        pages: Math.max(1, Math.ceil(total / perPage)),
    });
};

/**
 * POST /api/admin/blogs
 * Body: { title, slug?, excerpt, content, coverUrl, tags[], readTime, isPublished }
 */
export const createBlog = async (req, res) => {
    const {
        title,
        slug,
        excerpt = "",
        content = "",
        coverUrl = "",
        tags = [],
        readTime = "",
        isPublished = false,
    } = req.body;

    if (!title) return res.status(400).json({ message: "Title is required" });

    let finalSlug =
        slug ||
        slugify(title, {
            lower: true,
            strict: true,
            trim: true,
        });

    // ensure unique slug
    let exists = await BlogPost.findOne({ slug: finalSlug });
    if (exists) finalSlug = `${finalSlug}-${Date.now().toString(36)}`;

    const doc = await BlogPost.create({
        title,
        slug: finalSlug,
        excerpt,
        content,
        coverUrl,
        tags,
        readTime,
        isPublished: !!isPublished,
        publishedAt: isPublished ? new Date() : undefined,
        author: req.user?._id, // optional if you attach auth
    });

    res.json(doc);
};

/**
 * PATCH /api/admin/blogs/:id
 */
export const updateBlog = async (req, res) => {
    const { id } = req.params;
    const body = { ...req.body };

    // if flipping to published
    if (typeof body.isPublished === "boolean" && body.isPublished) {
        body.publishedAt = body.publishedAt || new Date();
    }

    // if title changed and slug not provided, keep old slug unless you want auto-re-slug
    // If you want auto slug update when title changes, uncomment:
    // if (body.title && !body.slug) {
    //   body.slug = slugify(body.title, { lower: true, strict: true, trim: true });
    // }

    const doc = await BlogPost.findByIdAndUpdate(id, body, { new: true });
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
};

/**
 * PATCH /api/admin/blogs/:id/publish  (toggle)
 */
export const togglePublishBlog = async (req, res) => {
    const { id } = req.params;
    const doc = await BlogPost.findById(id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    doc.isPublished = !doc.isPublished;
    if (doc.isPublished && !doc.publishedAt) doc.publishedAt = new Date();
    await doc.save();
    res.json({ id: doc._id, isPublished: doc.isPublished });
};

/**
 * DELETE /api/admin/blogs/:id
 */
export const deleteBlog = async (req, res) => {
    const { id } = req.params;
    await BlogPost.findByIdAndDelete(id);
    res.json({ ok: true });
};
