import express from "express";
import asyncHandler from "../utils/wrapAsync.js";
import { requireAuth } from "../middleware/requireAuth.js";
import * as conversations from "../controllers/conversationsController.js";

const router = express.Router();
router.use(requireAuth);
router.get("/", asyncHandler(conversations.listConversations));
router.post("/", asyncHandler(conversations.createConversation));
router.get("/:conversationId/messages", asyncHandler(conversations.getMessages));
router.post("/:conversationId/read", asyncHandler(conversations.markRead));

export default router;
