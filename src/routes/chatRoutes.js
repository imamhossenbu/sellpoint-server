import express from "express";
import { protect } from "../middleware/auth.js";
import {
    conversations,
    start,
    listMessages,
    markRead,
    updateMessage,
    deleteMessage,
    deleteConversation,
    thread,
} from "../controllers/chatController.js";

const router = express.Router();

router.get("/conversations", protect, conversations);
router.post("/start", protect, start);

router.get("/thread", protect, thread);

router.patch("/message/:id", protect, updateMessage);
router.delete("/message/:id", protect, deleteMessage);

router.get("/:id/messages", protect, listMessages);
router.post("/:id/read", protect, markRead);

router.delete("/:id", protect, deleteConversation);

export default router;
