import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254
    },
    passwordHash: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true, select: false },
    avatar: { type: String, default: "" },
    avatarPublicId: { type: String, default: "", select: false },
    googleAvatar: { type: String, default: "", select: false }
  },
  { timestamps: true }
);

userSchema.index({ name: "text", email: "text" });

export default mongoose.model("User", userSchema);
