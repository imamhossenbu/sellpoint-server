// routes/sellerRequestRoutes.js
import { Router } from "express";
import { protect, requireRoles } from "../middleware/auth.js";
import {
    createRequest,
    listRequests,
    approve,
    reject,
} from "../controllers/sellerRequestController.js";

const router = Router();

// buyer creates request
router.post("/", protect, createRequest);

// admin reviews
router.get("/", protect, requireRoles("admin"), listRequests);
router.post("/:id/approve", protect, requireRoles("admin"), approve);
router.post("/:id/reject", protect, requireRoles("admin"), reject);

export default router;
