import express from "express";
import asyncHandler from "../utils/wrapAsync.js";
import { removeAvatar, searchUsers, updateAvatar, updateName } from "../controllers/usersController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { uploadAvatar } from "../middleware/multerm.middleware.js";

const router = express.Router();
router.get("/", requireAuth, asyncHandler(searchUsers));
router.patch("/name", requireAuth, asyncHandler(updateName));
router.post("/avatar", requireAuth, uploadAvatar, asyncHandler(updateAvatar));
router.delete("/avatar", requireAuth, asyncHandler(removeAvatar));

export default router;
