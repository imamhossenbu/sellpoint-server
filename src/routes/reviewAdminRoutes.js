// src/routes/reviewAdminRoutes.js
import { Router } from "express";
import { protect, requireRoles } from "../middleware/auth.js";
import { listReviewsAdmin, setReviewStatus } from "../controllers/reviewController.js";

const router = Router();
router.use(protect, requireRoles("admin"));
router.get("/", listReviewsAdmin);                 // ?status=pending
router.patch("/:id/status", setReviewStatus);      // { status: "approved" }
export default router;
