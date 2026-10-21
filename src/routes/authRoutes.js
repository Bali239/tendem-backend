import express from "express";
import asyncHandler from "../utils/wrapAsync.js";
import * as auth from "../controllers/authController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();
router.post("/register", asyncHandler(auth.register));
router.post("/login", asyncHandler(auth.login));
router.post("/google", asyncHandler(auth.googleLogin));
router.post("/logout", auth.logout);
router.get("/me", requireAuth, auth.me);

export default router;
