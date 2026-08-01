import { redisSubscriber, userChatChannel, groupChatChannel } from "../config/redis.js";
import { getReceiverSocketId } from "./socketReceiverConfig.js";

// ── Channel registry ──────────────────────────────────────────────────────────
// channelRegistry: Map<channelName, Set<socketId>>
//   A Redis subscribe is only issued when the set goes from empty → non-empty.
//   A Redis unsubscribe is only issued when the set goes from non-empty → empty.
const channelRegistry = new Map();

// socketChannels: Map<socketId, Set<channelName>>
//   Reverse index — enables O(k) cleanup on disconnect without scanning channelRegistry.
const socketChannels = new Map();

let ioInstance = null; // set once by initChatSubscriber


// ── Internal registry helpers ─────────────────────────────────────────────────

const trackSocket = (channel, socketId) => {
  if (!channelRegistry.has(channel)) channelRegistry.set(channel, new Set());
  channelRegistry.get(channel).add(socketId);

  if (!socketChannels.has(socketId)) socketChannels.set(socketId, new Set());
  socketChannels.get(socketId).add(channel);
};

const untrackSocket = (channel, socketId) => {
  const sockets = channelRegistry.get(channel);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) channelRegistry.delete(channel);
  }
  const channels = socketChannels.get(socketId);
  if (channels) {
    channels.delete(channel);
    if (channels.size === 0) socketChannels.delete(socketId);
  }
};

const isChannelActive = (channel) =>
  channelRegistry.has(channel) && channelRegistry.get(channel).size > 0;


// ── Message handler ───────────────────────────────────────────────────────────

const handleMessage = async (message, channel) => {
  let parsed;
  try {
    parsed = JSON.parse(message);
  } catch (err) {
    console.warn(`[chatPubSub] Failed to parse message on ${channel}:`, err.message, "raw:", message);
    return;
  }

  const { event, data } = parsed;

  try {
    if (channel.startsWith("chat:user:")) {
      const userId = channel.replace("chat:user:", "");
      const socketId = await getReceiverSocketId(userId);
      if (socketId && ioInstance) {
        ioInstance.to(socketId).emit(event, data);
      }
    } else if (channel.startsWith("chat:group:")) {
      const groupId = channel.replace("chat:group:", "");
      if (ioInstance) {
        ioInstance.to(groupId).emit(event, data);
      }
    }
  } catch (err) {
    console.warn(`[chatPubSub] emit failed on channel ${channel}:`, err.message);
  }
};


// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call once at startup, before any sockets connect.
 * Registers the Redis message listener and stores the io instance.
 * Also registers a reconnect handler that re-subscribes all active channels.
 * @param {import("socket.io").Server} io
 */
export const initChatSubscriber = (io) => {
  ioInstance = io;

  // Re-subscribe to all active channels after a Redis reconnect
  redisSubscriber.on("reconnect", async () => {
    console.log("[chatPubSub] Reconnected — re-subscribing to active channels...");
    for (const channel of getActiveChannels()) {
      try {
        await redisSubscriber.subscribe(channel, handleMessage);
      } catch (err) {
        console.warn(`[chatPubSub] re-subscribe failed for ${channel}:`, err.message);
      }
    }
  });
};

/**
 * Called when a socket connects.
 * Subscribes to the per-user channel if this is the first socket for that user.
 */
export const subscribeUserChannel = async (userId, socketId) => {
  if (!userId || !socketId) return;
  const channel = userChatChannel(userId);
  const wasActive = isChannelActive(channel);
  trackSocket(channel, socketId);
  if (!wasActive) {
    try {
      await redisSubscriber.subscribe(channel, handleMessage);
    } catch (err) {
      console.warn(`[chatPubSub] subscribe failed for ${channel}:`, err.message);
    }
  }
};

/**
 * Called when a socket disconnects.
 * Unsubscribes from the per-user channel only when the last socket for that user leaves.
 */
export const unsubscribeUserChannel = async (userId, socketId) => {
  if (!userId || !socketId) return;
  const channel = userChatChannel(userId);
  untrackSocket(channel, socketId);
  if (!isChannelActive(channel)) {
    try {
      await redisSubscriber.unsubscribe(channel);
    } catch (err) {
      console.warn(`[chatPubSub] unsubscribe failed for ${channel}:`, err.message);
    }
  }
};

/**
 * Called when a socket joins a group room.
 * Subscribes to the per-group channel if this is the first socket for that group.
 */
export const subscribeGroupChannel = async (groupId, socketId) => {
  if (!groupId || !socketId) return;
  const channel = groupChatChannel(groupId);
  const wasActive = isChannelActive(channel);
  trackSocket(channel, socketId);
  if (!wasActive) {
    try {
      await redisSubscriber.subscribe(channel, handleMessage);
    } catch (err) {
      console.warn(`[chatPubSub] subscribe failed for ${channel}:`, err.message);
    }
  }
};

/**
 * Called when a socket disconnects.
 * Removes that socket from every group channel it was tracking
 * and unsubscribes from any that become empty.
 */
export const unsubscribeGroupChannelsForSocket = async (socketId) => {
  if (!socketId) return;
  const channels = socketChannels.get(socketId);
  if (!channels) return;
  for (const channel of [...channels]) {
    if (!channel.startsWith("chat:group:")) continue;
    untrackSocket(channel, socketId);
    if (!isChannelActive(channel)) {
      try {
        await redisSubscriber.unsubscribe(channel);
      } catch (err) {
        console.warn(`[chatPubSub] unsubscribe failed for ${channel}:`, err.message);
      }
    }
  }
};

/**
 * Returns all currently active channel names.
 * Used by the reconnect handler to re-subscribe after a Redis drop.
 */
export const getActiveChannels = () => [...channelRegistry.keys()];
