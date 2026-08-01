import redis, { userChatChannel, groupChatChannel } from "../config/redis.js";

// Shared publish helper — wraps redis.publish with error handling.
// Controllers calling these methods are never affected by a Redis publish failure.
const publish = async (channel, event, data) => {
  try {
    await redis.publish(channel, JSON.stringify({ event, data }));
  } catch (err) {
    console.warn(`[RealTimeChat] publish failed on ${channel}:`, err.message);
  }
};

class RealTimeChat {
  // ── FRIEND CHAT ─────────────────────────────────────────────────────────────

  SendChatToFriend = async (receiverId, senderId, data) => {
    if (!receiverId || !senderId) {
      console.warn("[RealTimeChat] SendChatToFriend: missing receiverId or senderId");
      return;
    }
    // Publish to both recipient and sender so every open tab of the sender also receives the echo.
    await publish(userChatChannel(receiverId), "receiveMessage", data);
    await publish(userChatChannel(senderId),   "receiveMessage", data);
  };

  LikeFriendMessage = async (receiverId, data) => {
    if (!receiverId) {
      console.warn("[RealTimeChat] LikeFriendMessage: missing receiverId");
      return;
    }
    await publish(userChatChannel(receiverId), "likeMessage", data);
  };

  RecallMessage = async (receiverId, data) => {
    if (!receiverId) {
      console.warn("[RealTimeChat] RecallMessage: missing receiverId");
      return;
    }
    await publish(userChatChannel(receiverId), "recallMessage", data);
  };

  // ── GROUP CHAT ───────────────────────────────────────────────────────────────

  SendChatToGroup = async (groupId, data) => {
    if (!groupId) {
      console.warn("[RealTimeChat] SendChatToGroup: missing groupId");
      return;
    }
    await publish(groupChatChannel(groupId), "receiveGroupMessage", data);
  };

  LikeGroupMessage = async (groupId, data) => {
    if (!groupId) {
      console.warn("[RealTimeChat] LikeGroupMessage: missing groupId");
      return;
    }
    await publish(groupChatChannel(groupId), "likeGroupMessage", data);
  };

  RecallGroupMessage = async (groupId, data) => {
    if (!groupId) {
      console.warn("[RealTimeChat] RecallGroupMessage: missing groupId");
      return;
    }
    await publish(groupChatChannel(groupId), "recallGroupMessage", data);
  };
}

export default new RealTimeChat();
