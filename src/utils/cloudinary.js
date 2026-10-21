import { v2 as cloudinary } from "cloudinary";
import { ApiError } from "./apiError.js";

function configuredCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new ApiError(503, "Avatar uploads are not configured");
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
  });
  return cloudinary;
}

function uploadAvatarImage(buffer) {
  const client = configuredCloudinary();
  return new Promise((resolve, reject) => {
    const uploadStream = client.uploader.upload_stream(
      { folder: "tandem/avatars", resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url || !result.public_id) {
          return reject(new Error("Cloudinary did not return an avatar URL and public ID"));
        }
        return resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    uploadStream.end(buffer);
  });
}

async function deleteAvatarImage(publicId) {
  if (!publicId) return;
  const client = configuredCloudinary();
  await client.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
}

export { uploadAvatarImage, deleteAvatarImage };
