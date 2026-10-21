import User from "../models/User.js";
import { userSearchSchema } from "../schemas/chatSchemas.js";
import { updateNameSchema } from "../schemas/userSchemas.js";
import { isOnline } from "../utils/onlineUsers.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { deleteAvatarImage, uploadAvatarImage } from "../utils/cloudinary.js";

async function searchUsers(request, response) {
  const { q, limit } = userSearchSchema.parse(request.query);
  const expression = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const users = await User.find({
    _id: { $ne: request.user._id },
    $or: [
      { name: { $regex: expression, $options: "i" } },
      { email: { $regex: expression, $options: "i" } }
    ]
  })
    .select("name email avatar")
    .sort({ name: 1 })
    .limit(limit)
    .lean();
  return response.json(new ApiResponse({
    users: users.map((user) => ({
      id: String(user._id),
      name: user.name,
      email: user.email,
      avatar: user.avatar || "",
      isOnline: isOnline(user._id)
    }))
  }));
}

async function updateName(request, response) {
  const { name } = updateNameSchema.parse(request.body);
  const user = await User.findById(request.user._id);
  if (!user) throw new ApiError(404, "User not found");

  user.name = name;
  await user.save();

  return response.json(new ApiResponse({
    user: { id: String(user._id), name: user.name }
  }));
}

async function updateAvatar(request, response) {
  if (!request.file) {
    throw new ApiError(400, "Choose an avatar image to upload");
  }

  const user = await User.findById(request.user._id).select("+avatarPublicId +googleAvatar");
  if (!user) throw new ApiError(404, "User not found");

  const oldPublicId = user.avatarPublicId;
  const uploadedAvatar = await uploadAvatarImage(request.file.buffer);
  user.avatar = uploadedAvatar.url;
  user.avatarPublicId = uploadedAvatar.publicId;

  try {
    await user.save();
  } catch (error) {
    try {
      await deleteAvatarImage(uploadedAvatar.publicId);
    } catch {
      console.error("Unable to clean up a new avatar after its database save failed");
    }
    throw error;
  }

  if (oldPublicId) {
    try {
      await deleteAvatarImage(oldPublicId);
    } catch {
      console.error("Unable to delete the replaced avatar from Cloudinary");
    }
  }

  return response.json(new ApiResponse({ avatar: user.avatar }));
}

async function removeAvatar(request, response) {
  const user = await User.findById(request.user._id).select("+avatarPublicId +googleAvatar");
  if (!user) throw new ApiError(404, "User not found");

  const oldPublicId = user.avatarPublicId;
  user.avatar = user.googleAvatar || "";
  user.avatarPublicId = "";
  await user.save();

  if (oldPublicId) {
    try {
      await deleteAvatarImage(oldPublicId);
    } catch {
      console.error("Unable to delete the removed avatar from Cloudinary");
    }
  }

  return response.json(new ApiResponse({ avatar: user.avatar }));
}

export { removeAvatar, searchUsers, updateAvatar, updateName };
