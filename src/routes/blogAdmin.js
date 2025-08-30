// src/routes/blogAdmin.js
import { Router } from "express";
import {
    listAdminBlogs,
    createBlog,
    updateBlog,
    deleteBlog,
    togglePublishBlog,
} from "../controllers/blogAdminController.js";

// add your auth middleware for admins here (e.g., requireAdmin)
const router = Router();

router.get("/admin/blogs", listAdminBlogs);
router.post("/admin/blogs", createBlog);
router.patch("/admin/blogs/:id", updateBlog);
router.patch("/admin/blogs/:id/publish", togglePublishBlog);
router.delete("/admin/blogs/:id", deleteBlog);

export default router;
