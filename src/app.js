import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import usersRoutes from "./routes/usersRoutes.js";
import conversationsRoutes from "./routes/conversationsRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { ApiError } from "./utils/apiError.js";
import { ApiResponse } from "./utils/apiResponse.js";

const app = express();
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
const frontendOrigin = new URL(frontendUrl).origin;

app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use((request, response, next) => {
  const changesState = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  const requestOrigin = request.get("origin");

  if (changesState && requestOrigin && requestOrigin !== frontendOrigin) {
    return next(new ApiError(403, "Request origin is not allowed"));
  }

  return next();
});
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.get("/api/health", (request, response) =>
  response.json(new ApiResponse({ status: "ok" }))
);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/conversations", conversationsRoutes);
app.use((request, response, next) => next(new ApiError(404, "Not found")));
app.use(errorHandler);

export default app;
