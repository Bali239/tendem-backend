import { ZodError } from "zod";
import mongoose from "mongoose";
import { ApiError } from "../utils/apiError.js";

function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  let statusCode = 500;
  let message = "An unexpected server error occurred";
  let errors;

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    message = "Invalid request";
    errors = error.issues.map(({ path, message: issueMessage }) => ({
      path,
      message: issueMessage
    }));
  } else if (error instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = error.message;
  }else if (error.code === 11000) {
  console.error("Duplicate key error:", error.keyPattern, error.keyValue);
  statusCode = 409;
  message = "An account with this email already exists";
  } else if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
    statusCode = error.status;
    message = error.message || "Request failed";
  }

  if (statusCode >= 500) {
    console.error(error);
  }

  return response.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {})
  });
}

export { errorHandler };
