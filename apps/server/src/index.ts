import { createServer } from "http";
import { Server } from "socket.io";
import { randomUUID } from "crypto";
import { USERNAME_MAX_LENGTH } from "@clichat/types";
import type { ChatMessage, Room, User, ServerToClientEvents, ClientToServerEvents } from "@clichat/types";

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);
const TYPING_AUTO_CLEAR_MS = 4000;

const USER_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
  "#BB8FCE", "#85C1E9",
];

interface InternalRoom {
  id: string;
  name: string;
  messages: ChatMessage[];
  memberIds: Set<string>;
}

const rooms = new Map<string, InternalRoom>();
const users = new Map<string, User>();
let colorCounter = 0;

const roomTypers = new Map<string, Set<string>>();
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingMentions = new Map<string, Set<string>>();

function createDefaultRooms(): void {
  for (const name of ["general", "random", "tech"]) {
    rooms.set(name, { id: name, name: `#${name}`, messages: [], memberIds: new Set() });
    roomTypers.set(name, new Set());
  }
}

function getColorForIndex(index: number): string {
  return USER_COLORS[index % USER_COLORS.length] as string;
}

function makeSystemMessage(roomId: string, content: string): ChatMessage {
  return {
    id: randomUUID(),
    roomId,
    userId: "system",
    username: "system",
    content,
    timestamp: Date.now(),
    type: "system",
  };
}

function toPublicRoom(room: InternalRoom, socketId?: string): Room {
  const mentions = socketId ? (pendingMentions.get(socketId) ?? new Set()) : new Set<string>();
  return {
    id: room.id,
    name: room.name,
    unreadCount: 0,
    hasNewMention: mentions.has(room.id),
  };
}

function getRoomList(socketId?: string): Room[] {
  return Array.from(rooms.values()).map((r) => toPublicRoom(r, socketId));
}

function getUserList(): User[] {
  return Array.from(users.values());
}

function broadcastTypers(roomId: string, excludeSocketId: string): void {
  const typers = roomTypers.get(roomId) ?? new Set();
  const usernames = Array.from(typers)
    .filter((sid) => sid !== excludeSocketId)
    .map((sid) => users.get(sid)?.username)
    .filter((u): u is string => !!u);
  io.to(roomId).emit("typing:update", roomId, usernames);
}

function clearTyper(socketId: string, roomId: string): void {
  const typers = roomTypers.get(roomId);
  if (typers) typers.delete(socketId);
  const timer = typingTimers.get(socketId);
  if (timer) {
    clearTimeout(timer);
    typingTimers.delete(socketId);
  }
}

createDefaultRooms();

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  let currentUser: User | null = null;

  socket.on("authenticate", (username) => {
    if (!username || typeof username !== "string") {
      socket.emit("error", "Invalid username");
      return;
    }

    const trimmed = username.trim().slice(0, USERNAME_MAX_LENGTH);
    if (!trimmed) {
      socket.emit("error", "Username cannot be empty");
      return;
    }

    currentUser = {
      id: socket.id,
      username: trimmed,
      color: getColorForIndex(colorCounter++),
      isOnline: true,
    };

    users.set(socket.id, currentUser);
    pendingMentions.set(socket.id, new Set());

    socket.emit("room:list", getRoomList(socket.id));
    socket.emit("user:list", getUserList());
    io.emit("user:joined", currentUser);

    const general = rooms.get("general");
    if (general) {
      general.memberIds.add(socket.id);
      socket.join("general");
      const sysMsg = makeSystemMessage("general", `${trimmed} joined the chat`);
      general.messages.push(sysMsg);
      socket.emit("room:joined", toPublicRoom(general, socket.id), general.messages.slice(-50));
      socket.to("general").emit("message:new", sysMsg);
    }

    console.log(`[+] ${trimmed} connected (${socket.id})`);
  });

  socket.on("message:send", (roomId, content) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || !content || typeof content !== "string") return;

    const msg: ChatMessage = {
      id: randomUUID(),
      roomId,
      userId: currentUser.id,
      username: currentUser.username,
      content: content.trim(),
      timestamp: Date.now(),
      type: "message",
    };

    room.messages.push(msg);
    if (room.messages.length > 50) room.messages.shift();

    const mentionPattern = /@(\w+)/gi;
    let match: RegExpExecArray | null;
    while ((match = mentionPattern.exec(msg.content)) !== null) {
      const mentionedUsername = match[1]?.toLowerCase();
      for (const [sid, user] of users) {
        if (sid !== socket.id && user.username.toLowerCase() === mentionedUsername) {
          const userMentions = pendingMentions.get(sid) ?? new Set<string>();
          userMentions.add(roomId);
          pendingMentions.set(sid, userMentions);
        }
      }
    }

    clearTyper(socket.id, roomId);
    broadcastTypers(roomId, socket.id);

    io.to(roomId).emit("message:new", msg);
  });

  socket.on("room:join", (roomId) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit("error", `Room ${roomId} not found`);
      return;
    }

    pendingMentions.get(socket.id)?.delete(roomId);
    room.memberIds.add(socket.id);
    socket.join(roomId);
    socket.emit("room:joined", toPublicRoom(room, socket.id), room.messages.slice(-50));
  });

  socket.on("room:leave", (roomId) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room) return;
    clearTyper(socket.id, roomId);
    room.memberIds.delete(socket.id);
    socket.leave(roomId);
  });

  socket.on("typing:start", (roomId) => {
    if (!currentUser) return;
    if (!rooms.has(roomId)) return;

    const typers = roomTypers.get(roomId) ?? new Set<string>();
    typers.add(socket.id);
    roomTypers.set(roomId, typers);

    const existing = typingTimers.get(socket.id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      clearTyper(socket.id, roomId);
      broadcastTypers(roomId, socket.id);
    }, TYPING_AUTO_CLEAR_MS);
    typingTimers.set(socket.id, timer);

    broadcastTypers(roomId, socket.id);
  });

  socket.on("typing:stop", (roomId) => {
    if (!currentUser) return;
    clearTyper(socket.id, roomId);
    broadcastTypers(roomId, socket.id);
  });

  socket.on("disconnect", () => {
    if (!currentUser) return;
    users.delete(socket.id);
    pendingMentions.delete(socket.id);
    io.emit("user:left", socket.id);

    for (const room of rooms.values()) {
      if (room.memberIds.has(socket.id)) {
        room.memberIds.delete(socket.id);
        clearTyper(socket.id, room.id);
        broadcastTypers(room.id, socket.id);
        const sysMsg = makeSystemMessage(room.id, `${currentUser.username} left the chat`);
        room.messages.push(sysMsg);
        io.to(room.id).emit("message:new", sysMsg);
      }
    }

    console.log(`[-] ${currentUser.username} disconnected`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[clichat server] listening on port ${PORT}`);
});
