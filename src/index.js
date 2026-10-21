import dotenv from "dotenv";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import app from "./app.js";
import { connectDatabase } from "./db/connect.js";
import User from "./models/User.js";
import Conversation from "./models/Conversation.js";
import { COOKIE_NAME, verifyToken } from "./utils/auth.js";
import { addSocket, removeSocket, getOnlineUserIds } from "./utils/onlineUsers.js";
import { sendMessage } from "./controllers/conversationsController.js";
import { ApiError } from "./utils/apiError.js";
import mongoose from "mongoose";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(currentDirectory, "../.env") });
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
const frontendOrigin = new URL(frontendUrl).origin;


const server = createServer(app);
const io = new Server(server, {   //attaches Socket.IO to that same HTTP server so it can manage real-time connections too.
  cors: { origin: frontendOrigin, credentials: true }
});

io.engine.use(cookieParser());
// to authenticate the user when they connect to the WebSocket server, we can use a middleware function that checks for a valid JWT token in the cookies of the incoming socket request. If the token is valid, we can retrieve the user from the database and attach it to the socket object for later use. If the token is invalid or missing, we can reject the connection with an error message.
io.use(async (socket, next) => {
 const origin = socket.handshake.headers.origin;

if (origin !== frontendOrigin) {
  return next(new Error("Socket origin is not allowed"));
}

  try {
    const token = socket.request.cookies[COOKIE_NAME];
    if (!token) return next(new Error("Authentication required"));
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub).select("_id name");
    if (!user) return next(new Error("Authentication required"));
    socket.user = user;
    socket.data.userId = String(user._id);
    return next();
  } catch (error) {
    return next(new Error("Authentication required"));
  }
});
// The io.on("connection") event listener is called whenever a new client connects to the WebSocket server. Inside this listener, we can handle various events that the client may emit, such as joining a conversation, sending a message, or updating their typing status. We can also manage the user's online presence by adding or removing their socket ID from a list of online users and broadcasting presence changes to other connected clients.
io.on("connection", async (socket) => {
  const userId = String(socket.user._id);
  socket.join(`user:${userId}`);
  const becameOnline = addSocket(userId, socket.id);
  socket.emit("presence:snapshot", { userIds: getOnlineUserIds() }); // send the current online users to the newly connected user
  if (becameOnline) io.emit("presence:changed", { userId, isOnline: true });
// The socket.on("conversation:join") event listener is called whenever a client wants to join a conversation. Inside this listener, we can check if the user is a participant in the conversation and add them to the corresponding room for that conversation. If the user is not a participant, we can return an error message to the client.
  socket.on("conversation:join", async (conversationId, acknowledge = () => {}) => {
    try {
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: socket.user._id
      }).select("_id");
      if (!conversation) {
        if (process.env.NODE_ENV === "development") {
          console.info("[socket] conversation:join rejected", {
            acknowledgement: { error: "Conversation not found" },
          });
        }
        return acknowledge({ error: "Conversation not found" });
      }
      const room = `conversation:${conversationId}`;
      socket.join(room);
      if (process.env.NODE_ENV === "development") {
        console.info("[socket] conversation:join accepted", {
          acknowledgement: { ok: true },
          inRoom: socket.rooms.has(room),
        });
      }
      return acknowledge({ ok: true });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.info("[socket] conversation:join rejected", {
          acknowledgement: { error: "Unable to join conversation" },
        });
      }
      return acknowledge({ error: "Unable to join conversation" });
    }
  });
// The socket.on("message:send") event listener is called whenever a client wants to send a message in a conversation. Inside this listener, we can call the sendMessage function to create a new message in the database and broadcast it to all participants in the conversation. We can also acknowledge the message sending to the client with a success or error response.
  socket.on("message:send", async (payload = {}, acknowledge = () => {}) => {
    try {
      const message = await sendMessage({
        conversationId: payload.conversationId,
        senderId: socket.user._id,
        text: payload.text,
        io,
        activeUserIds: (await io.in(`conversation:${payload.conversationId}`).fetchSockets())
          .map((conversationSocket) => conversationSocket.data.userId)
      });
      return acknowledge({ ok: true, message });
    } catch (error) {
      return acknowledge({
        error: error instanceof ApiError && error.statusCode < 500
          ? error.message
          : "Unable to send message"
      });
    }
  });

  socket.on("typing:update", async ({ conversationId, isTyping } = {}) => {
    if (!conversationId || typeof isTyping !== "boolean") return;
    const room = `conversation:${conversationId}`;
    try {
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: socket.user._id
      }).select("_id");
      if (!conversation) return;
      socket.to(room).emit("typing:changed", {
        conversationId,
        userId,
        isTyping
      });
    } catch (error) {
      console.error("Failed to verify typing conversation", error);
    }
  });

  socket.on("conversation:leave", (conversationId) => {
    if (conversationId) socket.leave(`conversation:${conversationId}`);
  });
// The socket.on("disconnect") event listener is called whenever a client disconnects from the WebSocket server. Inside this listener, we can remove the user's socket ID from the list of online users and broadcast a presence change to other connected clients if the user has no more active sockets. This allows us to keep track of which users are currently online and notify other users when someone goes offline.
  socket.on("disconnect", () => {
    if (removeSocket(userId, socket.id)) {
      io.emit("presence:changed", { userId, isOnline: false });
    }
  });
});

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("Set JWT_SECRET to a random value of at least 32 characters in backend/.env");
  }
  await connectDatabase();
  console.log("Connected database:", mongoose.connection.name);
console.log("MongoDB host:", mongoose.connection.host);
console.log(await User.collection.indexes());
  const port = Number(process.env.PORT) || 4000;
  server.listen(port, () => console.log(`Tandem API listening on http://localhost:${port}`));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  start().catch((error) => {
    console.error("Failed to start chat server", error);
    process.exitCode = 1;
  });
}

export { server, io, start };
