import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { conversationSchema, messageSchema, objectId } from "../schemas/chatSchemas.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { isOnline } from "../utils/onlineUsers.js";

const id = (value) => String(value);
const pairKey = (left, right) => [id(left), id(right)].sort().join(":");

async function listConversations(request, response) {
  const conversations = await Conversation.find({ participants: request.user._id })
    .populate("participants", "name email avatar")
    .populate({
      path: "lastMessage",
      populate: { path: "sender", select: "name" }
    })
    .sort({ updatedAt: -1 })
    .lean();

  return response.json(new ApiResponse({
    conversations: conversations.map((conversation) => {
      const other = conversation.participants.find(
        (participant) => id(participant._id) !== id(request.user._id)
      );
      const unread = conversation.unreadByUser.find(
        (entry) => id(entry.userId) === id(request.user._id)
      );
      return {
        id: id(conversation._id),
        participant: other
          ? {
              id: id(other._id),
              name: other.name,
              email: other.email,
              avatar: other.avatar || "",
              isOnline: isOnline(other._id)
            }
          : null,
        lastMessage: conversation.lastMessage
          ? {
              id: id(conversation.lastMessage._id),
              text: conversation.lastMessage.text,
              senderId: id(conversation.lastMessage.sender._id),
              createdAt: conversation.lastMessage.createdAt
            }
          : null,
        unreadCount: unread ? unread.count : 0,
        updatedAt: conversation.updatedAt
      };
    })
  }));
}

async function createConversation(request, response) {
  const { userId } = conversationSchema.parse(request.body);
  if (userId === id(request.user._id)) {
    throw new ApiError(400, "You cannot start a conversation with yourself");
  }
  const participant = await User.findById(userId).select("_id");
  if (!participant) {
    throw new ApiError(404, "User not found");
  }
  const participantKey = pairKey(request.user._id, userId);
  let conversation = await Conversation.findOne({ participantKey });
  if (!conversation) {
    try {
      conversation = await Conversation.create({
        participants: [request.user._id, userId],
        participantKey,
        unreadByUser: [
          { userId: request.user._id, count: 0 },
          { userId, count: 0 }
        ]
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      conversation = await Conversation.findOne({ participantKey });
      if (!conversation) throw error;
    }
  }
  return response.status(200).json(
    new ApiResponse({ conversationId: id(conversation._id) })
  );
}

async function getConversationOrFail(conversationId, userId) {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId
  });
  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }
  return conversation;
}

async function getMessages(request, response) {
  const conversationId = objectId.parse(request.params.conversationId);
  await getConversationOrFail(conversationId, request.user._id);
  const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 100);
  const before = request.query.before ? new Date(request.query.before) : null;
  if (before && Number.isNaN(before.getTime())) {
    throw new ApiError(400, "Invalid message cursor");
  }
  const filter = { conversation: conversationId };
  if (before) filter.createdAt = { $lt: before };
  const messages = await Message.find(filter)
    .populate("sender", "name avatar")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return response.json(new ApiResponse({
    messages: messages.reverse().map((message) => ({
      id: id(message._id),
      conversationId: id(message.conversation),
      sender: {
        id: id(message.sender._id),
        name: message.sender.name,
        avatar: message.sender.avatar || ""
      },
      text: message.text,
      createdAt: message.createdAt
    })),
    hasMore: messages.length === limit
  }));
}

async function sendMessage({ conversationId, senderId, text, io, activeUserIds = [] }) {
  const parsedConversationId = objectId.parse(conversationId);
  const parsed = messageSchema.parse({ text });
  const conversation = await getConversationOrFail(parsedConversationId, senderId);
  const message = await Message.create({
    conversation: conversation._id,
    sender: senderId,
    text: parsed.text
  });
  conversation.lastMessage = message._id;
  for (const entry of conversation.unreadByUser) {
    if (id(entry.userId) === id(senderId)) {
      entry.count = 0;
    } else if (activeUserIds.includes(id(entry.userId))) {
      entry.count = 0;
    } else {
      entry.count += 1;
    }
  }
  await conversation.save();
  await message.populate("sender", "name avatar");
  const serialized = {
    id: id(message._id),
    conversationId: id(message.conversation),
    sender: {
      id: id(message.sender._id),
      name: message.sender.name,
      avatar: message.sender.avatar || ""
    },
    text: message.text,
    createdAt: message.createdAt
  };
  io.to(`conversation:${id(conversation._id)}`).emit("message:new", serialized); //Socket.IO delivers the new message
  io.to(`user:${id(senderId)}`).emit("conversation:updated", {
    conversationId: id(conversation._id),
    lastMessage: serialized,
    unreadCount: 0
  });
  for (const recipient of conversation.participants) {
    if (id(recipient) !== id(senderId)) {
      io.to(`user:${id(recipient)}`).emit("conversation:updated", {
        conversationId: id(conversation._id),
        lastMessage: serialized,
        unreadCount: conversation.unreadByUser.find(
          (entry) => id(entry.userId) === id(recipient)
        )?.count || 0
      });
    }
  }
  return serialized;
}

async function markRead(request, response) {
  const conversationId = objectId.parse(request.params.conversationId);
  const conversation = await getConversationOrFail(conversationId, request.user._id);
  const entry = conversation.unreadByUser.find(
    (item) => id(item.userId) === id(request.user._id)
  );
  if (entry) entry.count = 0;
  await conversation.save();
  return response.json(new ApiResponse({ unreadCount: 0 }));
}

export {
  listConversations,
  createConversation,
  getMessages,
  markRead,
  sendMessage
};
