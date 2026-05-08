import { createServer } from "http";
import { Server } from "socket.io";
import { randomUUID } from "crypto";
import type { ChatMessage, Room, User, ServerToClientEvents, ClientToServerEvents } from "@clichat/types";

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);

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

function createDefaultRooms(): void {
  for (const name of ["general", "random", "tech"]) {
    const id = name;
    rooms.set(id, { id, name: `#${name}`, messages: [], memberIds: new Set() });
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

function getRoomList(): Room[] {
  return Array.from(rooms.values()).map((r) => ({
    id: r.id,
    name: r.name,
    unreadCount: 0,
    hasNewMention: false,
  }));
}

function getUserList(): User[] {
  return Array.from(users.values());
}

createDefaultRooms();

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  let currentUser: User | null = null;

  socket.on("authenticate" as any, (username: string) => {
    if (!username || typeof username !== "string") {
      socket.emit("error", "Invalid username");
      return;
    }

    const trimmed = username.trim().slice(0, 20);
    if (!trimmed) {
      socket.emit("error", "Username cannot be empty");
      return;
    }

    const colorIndex = users.size;
    currentUser = {
      id: socket.id,
      username: trimmed,
      color: getColorForIndex(colorIndex),
      isOnline: true,
    };

    users.set(socket.id, currentUser);

    socket.emit("room:list" as any, getRoomList());
    socket.emit("user:list" as any, getUserList());
    io.emit("user:joined" as any, currentUser);

    // Auto-join general
    const general = rooms.get("general");
    if (general) {
      general.memberIds.add(socket.id);
      socket.join("general");
      const sysMsg = makeSystemMessage("general", `${trimmed} joined the chat`);
      general.messages.push(sysMsg);
      socket.emit("room:joined" as any, { id: general.id, name: general.name, unreadCount: 0, hasNewMention: false }, general.messages.slice(-50));
      socket.to("general").emit("message:new" as any, sysMsg);
    }

    console.log(`[+] ${trimmed} connected (${socket.id})`);
  });

  socket.on("message:send" as any, (roomId: string, content: string) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room) return;
    if (!content || typeof content !== "string") return;

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

    io.to(roomId).emit("message:new" as any, msg);
  });

  socket.on("room:join" as any, (roomId: string) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit("error", `Room ${roomId} not found`);
      return;
    }

    room.memberIds.add(socket.id);
    socket.join(roomId);
    socket.emit("room:joined" as any, { id: room.id, name: room.name, unreadCount: 0, hasNewMention: false }, room.messages.slice(-50));
  });

  socket.on("room:leave" as any, (roomId: string) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.memberIds.delete(socket.id);
    socket.leave(roomId);
  });

  socket.on("disconnect", () => {
    if (!currentUser) return;
    users.delete(socket.id);
    io.emit("user:left" as any, socket.id);

    for (const [roomId, room] of rooms) {
      if (room.memberIds.has(socket.id)) {
        room.memberIds.delete(socket.id);
        const sysMsg = makeSystemMessage(roomId, `${currentUser.username} left the chat`);
        room.messages.push(sysMsg);
        io.to(roomId).emit("message:new" as any, sysMsg);
      }
    }

    console.log(`[-] ${currentUser.username} disconnected`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[clichat server] listening on port ${PORT}`);
});
