import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
      validate: {
        validator(value) {
          return value.length === 2 && String(value[0]) !== String(value[1]);
        },
        message: "A conversation must have two distinct participants"
      }
    },
    participantKey: { type: String, required: true, unique: true },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null
    },
    unreadByUser: {
      type: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
          count: { type: Number, default: 0, min: 0 }
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

export default mongoose.model("Conversation", conversationSchema);
