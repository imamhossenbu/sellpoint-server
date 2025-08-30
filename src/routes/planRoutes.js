// routes/planRoutes.js
import { Router } from "express";
import { protect, requireRoles } from "../middleware/auth.js";
import { listPublic, create, update, remove } from "../controllers/planController.js";

const router = Router();

// public list
router.get("/", listPublic);

// admin CRUD
router.post("/", protect, requireRoles("admin"), create);
router.patch("/:id", protect, requireRoles("admin"), update);
router.delete("/:id", protect, requireRoles("admin"), remove);

export default router;
