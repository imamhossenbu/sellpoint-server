// src/routes/reviewRoutes.js
import { Router } from "express";
import { protect, requireRoles } from "../middleware/auth.js";
import { createReview, listReviewsForListing } from "../controllers/reviewController.js";

const router = Router();
router.get("/:listingId", listReviewsForListing); // GET /api/reviews/:listingId
router.post("/", protect, requireRoles("buyer", "seller"), createReview); // POST /api/reviews
export default router;
