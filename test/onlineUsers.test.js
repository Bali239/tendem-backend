import test from "node:test";
import assert from "node:assert/strict";
import { addSocket, removeSocket, isOnline, getOnlineUserIds } from "../src/utils/onlineUsers.js";

test("online state remains active until the last socket disconnects", () => {
  const userId = "test-user-online";
  assert.equal(addSocket(userId, "socket-a"), true);
  assert.equal(addSocket(userId, "socket-b"), false);
  assert.equal(isOnline(userId), true);
  assert.equal(removeSocket(userId, "socket-a"), false);
  assert.equal(isOnline(userId), true);
  assert.equal(removeSocket(userId, "socket-b"), true);
  assert.equal(isOnline(userId), false);
  assert.equal(getOnlineUserIds().includes(userId), false);
});
