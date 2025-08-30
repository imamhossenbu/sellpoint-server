// src/models/BlogPost.js
import mongoose from "mongoose";

const BlogPostSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, index: true },
        excerpt: { type: String, default: "" },
        content: { type: String, default: "" }, // markdown or html (your choice)
        coverUrl: { type: String, default: "" },
        tags: [{ type: String }],
        readTime: { type: String, default: "" }, // e.g., "5 min read"
        isPublished: { type: Boolean, default: false },
        publishedAt: { type: Date },
        author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        views: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export default mongoose.models.BlogPost || mongoose.model("BlogPost", BlogPostSchema);
