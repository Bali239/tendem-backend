import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import { ApiError } from "../utils/apiError.js";

const maxAvatarSize = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const multerAvatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxAvatarSize, files: 1, fields: 0 },
  fileFilter(request, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new ApiError(415, "Avatar must be a JPEG, PNG, or WebP image"));
    }
    return callback(null, true);
  }
}).single("avatar");

function uploadAvatar(request, response, next) {
  multerAvatarUpload(request, response, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return next(new ApiError(413, "Avatar image must be 5 MB or smaller"));
      }
      if (error.code === "LIMIT_UNEXPECTED_FILE" || error.code === "LIMIT_FILE_COUNT") {
        return next(new ApiError(400, "Upload one avatar image at a time"));
      }
      return next(new ApiError(400, "Avatar upload could not be processed"));
    }
    if (error) return next(error);
    if (!request.file) return next();

    fileTypeFromBuffer(request.file.buffer)
      .then((detectedType) => {
        if (!detectedType || !allowedMimeTypes.has(detectedType.mime) || detectedType.mime !== request.file.mimetype) {
          return next(new ApiError(415, "Avatar must contain a valid JPEG, PNG, or WebP image"));
        }
        return next();
      })
      .catch(next);
  });
}

export { uploadAvatar };
