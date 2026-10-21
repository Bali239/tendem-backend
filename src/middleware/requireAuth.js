import { COOKIE_NAME, verifyToken } from "../utils/auth.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/apiError.js";

async function requireAuth(request, response, next) {
  try {
    const token = request.cookies[COOKIE_NAME];
    if (!token) {
      return next(new ApiError(401, "Authentication required"));
    }
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub).select("name email avatar");
    if (!user) {
      return next(new ApiError(401, "Authentication required"));
    }
    request.user = user;
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return next(new ApiError(401, "Authentication required"));
    }
    return next(error);
  }
}

export { requireAuth };
