// src/routes/public.js
import { Router } from "express";
import { publicStats } from "../controllers/publicController.js";

const router = Router();
router.get("/stats", publicStats);

export default router;
