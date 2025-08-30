// src/routes/testimonialPublicRoutes.js
import { Router } from "express";
import { listPublishedTestimonials } from "../controllers/testimonialController.js";

const router = Router();

// Public endpoint → anyone can see published testimonials
router.get("/", listPublishedTestimonials);

export default router;
