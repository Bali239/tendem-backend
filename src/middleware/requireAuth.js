import User from "../models/User.js";
import { ApiError } from "../utils/apiError.js";
import { findSession, getBearerToken } from "../utils/auth.js";

async function requireAuth(request, response, next) {
  try {
    const session = await findSession(getBearerToken(request));
    if (!session) return next(new ApiError(401, "Authentication required"));
    const user = await User.findById(session.user).select("name email avatar");
    if (!user) return next(new ApiError(401, "Authentication required"));
    request.user = user;
    request.session = session;
    return next();
  } catch (error) {
    return next(error);
  }
}

export { requireAuth };
