// src/routes/accountRoutes.js
import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { myPlan } from "../controllers/accountController.js";

const router = Router();
router.get("/me/plan", protect, myPlan);

export default router;
