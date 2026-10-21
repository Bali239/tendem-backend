const socketsByUser = new Map();
// This map will store the online users and their corresponding socket IDs. The keys of the map are user IDs (as strings), and the values are sets of socket IDs (as strings) that represent the active connections for each user.
function addSocket(userId, socketId) {  // The addSocket function is responsible for adding a new socket ID to the list of active sockets for a given user. It takes two parameters: userId (the ID of the user) and socketId (the ID of the socket connection). The function first converts the userId to a string and retrieves the set of active sockets for that user from the socketsByUser map. If there are no active sockets for the user, it creates a new set. The function then adds the new socketId to the set and updates the map with the new set of active sockets. Finally, it returns a boolean value indicating whether the user was previously offline (i.e., had no active sockets) before this new socket was added.
  const key = String(userId);
  const sockets = socketsByUser.get(key) || new Set();
  const wasOffline = sockets.size === 0;
  sockets.add(socketId);
  socketsByUser.set(key, sockets);
  return wasOffline;
}
// The removeSocket function is responsible for removing a socket ID from the list of active sockets for a given user. It takes two parameters: userId (the ID of the user) and socketId (the ID of the socket connection). The function first converts the userId to a string and retrieves the set of active sockets for that user from the socketsByUser map. If there are no active sockets for the user, it returns false, indicating that the user was not online. The function then removes the specified socketId from the set of active sockets. If there are still active sockets remaining for the user after this removal, it returns false, indicating that the user is still online. If there are no more active sockets for the user, it deletes the entry for that user from the map and returns true, indicating that the user has gone offline.
function removeSocket(userId, socketId) {
  const key = String(userId);
  const sockets = socketsByUser.get(key);
  if (!sockets) {
    return false;
  }
  sockets.delete(socketId);
  if (sockets.size > 0) {
    return false;
  }
  socketsByUser.delete(key);
  return true;
}

function isOnline(userId) {
  return socketsByUser.has(String(userId));
}

function getOnlineUserIds() {
  return [...socketsByUser.keys()];
}

export { addSocket, removeSocket, isOnline, getOnlineUserIds };
