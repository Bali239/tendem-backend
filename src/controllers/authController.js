import bcrypt from "bcrypt";
import googleAuth from "google-auth-library";
import User from "../models/User.js";
import { registerSchema, loginSchema, googleSchema } from "../schemas/authSchemas.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { createSession, deleteSession, getBearerToken } from "../utils/auth.js";

const { OAuth2Client } = googleAuth;
const googleClient = new OAuth2Client();

function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    avatar: user.avatar || ""
  };
}

async function finishLogin(response, user, status = 200) {
  const session = await createSession(user._id);
  return response.status(status).json(new ApiResponse({
    user: publicUser(user),
    token: session.token,
    expiresAt: session.expiresAt
  }));
}

async function register(request, response) {
  
  const input = registerSchema.parse(request.body);
  const existing = await User.findOne({ email: input.email });
if (existing) {
  throw new ApiError(409, "An account with this email already exists");
}
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash
  });
  return finishLogin(response, user, 201);
}

async function login(request, response) {
  const input = loginSchema.parse(request.body);
  const user = await User.findOne({ email: input.email }).select("+passwordHash");
  if (!user || !user.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new ApiError(401, "Email or password is incorrect");
  }
  return finishLogin(response, user);
}

async function googleLogin(request, response) {
  const { credential } = googleSchema.parse(request.body);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new ApiError(503, "Google sign-in is not configured");
  }
  const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email || !payload.email_verified) {
    throw new ApiError(401, "Google account could not be verified");
  }
  let user = await User.findOne({ googleId: payload.sub }).select("+googleAvatar");
  if (!user) {
    user = await User.findOne({ email: payload.email.toLowerCase() }).select("+googleId +googleAvatar");
    if (user) {
      user.googleId = payload.sub;
      if (payload.picture && !user.googleAvatar) user.googleAvatar = payload.picture;
      if (!user.avatar && payload.picture) user.avatar = payload.picture;
      await user.save();
    } else {
      user = await User.create({
        name: payload.name || payload.email.split("@")[0],
        email: payload.email,
        googleId: payload.sub,
        avatar: payload.picture || "",
        googleAvatar: payload.picture || ""
      });
    }
  } else if (payload.picture && !user.googleAvatar) {
    user.googleAvatar = payload.picture;
    if (!user.avatar) user.avatar = payload.picture;
    await user.save();
  }
  return finishLogin(response, user);
}

async function logout(request, response) {
  await deleteSession(getBearerToken(request));
  return response.status(200).json(new ApiResponse({ message: "Signed out" }, "Signed out"));
}

function me(request, response) {
  return response.json(new ApiResponse({ user: publicUser(request.user) }));
}

export { register, login, googleLogin, logout, me };
