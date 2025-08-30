// src/routes/testimonialAdminRoutes.js
import { Router } from "express";
import { protect, requireRoles } from "../middleware/auth.js";
import {
    listTestimonialsAdmin, createTestimonial, updateTestimonial, deleteTestimonial, publishTestimonial
} from "../controllers/testimonialController.js";

const router = Router();
router.use(protect, requireRoles("admin"));
router.get("/", listTestimonialsAdmin);
router.post("/", createTestimonial);
router.patch("/:id", updateTestimonial);
router.patch("/:id/publish", publishTestimonial);
router.delete("/:id", deleteTestimonial);
export default router;
