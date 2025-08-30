// src/routes/blogPublic.js
import { Router } from "express";
import {
    listPublicBlog,
    getPublicBlogBySlug,
    latestPublicBlog,
    listAvailableTags, // <-- new
} from "../controllers/blogPublicController.js";

const router = Router();

router.get("/blog", listPublicBlog);
router.get("/blog/latest", latestPublicBlog);
router.get("/blog/tags", listAvailableTags); // <-- dynamic tags from DB
router.get("/blog/:slug", getPublicBlogBySlug);

export default router;
