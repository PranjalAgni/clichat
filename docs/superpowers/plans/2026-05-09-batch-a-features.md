# Batch A Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add typing indicators, @mention highlighting, input history (Up/Down), and tab completion to clichat.

**Architecture:** Typing indicators require new server-side events and per-room typer state; the other three features are pure client-side additions to `InputBox` and `MessageList`. All changes flow through the existing `useSocket` hook and prop-drilled into the relevant components.

**Tech Stack:** TypeScript, Ink v5, Socket.io v4, chalk v5, React hooks (`useState`, `useCallback`, `useRef`, `useInput` from Ink)

---

## File Map

| File | Change |
|---|---|
| `packages/types/src/index.ts` | Add `typing:start`, `typing:stop`, `typing:update` events |
| `apps/server/src/index.ts` | Add typing state + auto-clear timers + mention tracking |
| `apps/cli/src/hooks/useSocket.ts` | Add `typingUsers`, `startTyping`, `stopTyping` |
| `apps/cli/src/components/InputBox.tsx` | Add history, tab completion, typing emit |
| `apps/cli/src/components/TypingIndicator.tsx` | New component |
| `apps/cli/src/components/MessageList.tsx` | Accept + use `currentUsername` for mention rendering |
| `apps/cli/src/components/ChatLayout.tsx` | Wire new props through layout |

---

## Task 1: Add typing events to shared types and rebuild

**Files:**
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Add the three new events**

Open `packages/types/src/index.ts`. The full updated file:

```typescript
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_DISPLAY_WIDTH = 12;

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
  type: "message" | "system";
}

export interface Room {
  id: string;
  name: string;
  unreadCount: number;
  hasNewMention: boolean;
}

export interface User {
  id: string;
  username: string;
  color: string;
  isOnline: boolean;
}

export interface ServerToClientEvents {
  "message:new": (message: ChatMessage) => void;
  "room:list": (rooms: Room[]) => void;
  "user:list": (users: User[]) => void;
  "user:joined": (user: User) => void;
  "user:left": (userId: string) => void;
  "room:joined": (room: Room, history: ChatMessage[]) => void;
  "typing:update": (roomId: string, usernames: string[]) => void;
  "error": (message: string) => void;
}

export interface ClientToServerEvents {
  "authenticate": (username: string) => void;
  "message:send": (roomId: string, content: string) => void;
  "room:join": (roomId: string) => void;
  "room:leave": (roomId: string) => void;
  "typing:start": (roomId: string) => void;
  "typing:stop": (roomId: string) => void;
}
```

- [ ] **Step 2: Rebuild the types package**

```bash
cd /path/to/clichat
pnpm --filter @clichat/types build
```

Expected output: no errors, `packages/types/dist/index.js` updated.

- [ ] **Step 3: Typecheck**

```bash
pnpm turbo typecheck
```

Expected: 2 tasks successful.

- [ ] **Step 4: Commit**

```bash
git add packages/types/
git commit -m "feat(types): add typing:start, typing:stop, typing:update events"
```

---

## Task 2: Add typing indicator and mention tracking to server

**Files:**
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Write the full updated server**

Replace `apps/server/src/index.ts` with:

```typescript
import { createServer } from "http";
import { Server } from "socket.io";
import { randomUUID } from "crypto";
import { USERNAME_MAX_LENGTH } from "@clichat/types";
import type { ChatMessage, Room, User, ServerToClientEvents, ClientToServerEvents } from "@clichat/types";

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);
const TYPING_AUTO_CLEAR_MS = 3000;

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

// roomId → set of socketIds currently typing
const roomTypers = new Map<string, Set<string>>();
// socketId → auto-clear timer
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
// socketId → set of roomIds with pending mentions for that user
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
  if (typers) {
    typers.delete(socketId);
  }
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

    // Check for @mentions and notify each mentioned member
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

    // Stop typing indicator on send
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

    // Clear mention badge when joining the room
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

    // Reset auto-clear timer
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
```

- [ ] **Step 2: Typecheck server**

```bash
pnpm --filter @clichat/server typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/
git commit -m "feat(server): add typing indicators and @mention tracking"
```

---

## Task 3: Update useSocket hook with typing state

**Files:**
- Modify: `apps/cli/src/hooks/useSocket.ts`

- [ ] **Step 1: Write the updated hook**

Replace `apps/cli/src/hooks/useSocket.ts` with:

```typescript
import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ChatMessage,
  Room,
  User,
  ServerToClientEvents,
  ClientToServerEvents,
} from "@clichat/types";

const SERVER_URL = process.env["SERVER_URL"] ?? "http://localhost:3001";
const TYPING_DEBOUNCE_MS = 1000;

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSocketReturn {
  messages: ChatMessage[];
  rooms: Room[];
  users: User[];
  currentRoom: Room | null;
  connected: boolean;
  socketId: string;
  typingUsers: string[];
  sendMessage: (content: string) => void;
  joinRoom: (roomId: string) => void;
  startTyping: () => void;
  stopTyping: () => void;
}

export function useSocket(username: string): UseSocketReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const socketRef = useRef<AppSocket | null>(null);
  const currentRoomRef = useRef<Room | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    const socket: AppSocket = io(SERVER_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    }) as AppSocket;

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setSocketId(socket.id ?? "");
      socket.emit("authenticate", username);
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setTypingUsers([]);
    });

    socket.on("room:list", (roomList) => {
      setRooms(roomList);
    });

    socket.on("user:list", (userList) => {
      setUsers(userList);
    });

    socket.on("user:joined", (user) => {
      setUsers((prev) => {
        if (prev.some((u) => u.id === user.id)) return prev;
        return [...prev, user];
      });
    });

    socket.on("user:left", (userId) => {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    });

    socket.on("room:joined", (room, history) => {
      setCurrentRoom(room);
      currentRoomRef.current = room;
      setMessages(history);
      setTypingUsers([]);
    });

    socket.on("message:new", (msg) => {
      if (currentRoomRef.current && msg.roomId === currentRoomRef.current.id) {
        setMessages((prev) => [...prev, msg]);
      } else {
        setRooms((prev) =>
          prev.map((r) =>
            r.id === msg.roomId ? { ...r, unreadCount: r.unreadCount + 1 } : r
          )
        );
      }
    });

    socket.on("typing:update", (roomId, usernames) => {
      if (currentRoomRef.current?.id === roomId) {
        setTypingUsers(usernames);
      }
    });

    return () => {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      socket.disconnect();
    };
  }, [username]);

  const sendMessage = useCallback((content: string) => {
    const socket = socketRef.current;
    if (!socket || !currentRoomRef.current) return;
    isTypingRef.current = false;
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = null;
    }
    socket.emit("message:send", currentRoomRef.current.id, content);
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("room:join", roomId);
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, unreadCount: 0, hasNewMention: false } : r))
    );
  }, []);

  const startTyping = useCallback(() => {
    const socket = socketRef.current;
    const room = currentRoomRef.current;
    if (!socket || !room) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit("typing:start", room.id);
    }

    // Reset debounce — if no further startTyping call within 1s, stop
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit("typing:stop", room.id);
    }, TYPING_DEBOUNCE_MS);
  }, []);

  const stopTyping = useCallback(() => {
    const socket = socketRef.current;
    const room = currentRoomRef.current;
    if (!socket || !room) return;
    if (!isTypingRef.current) return;
    isTypingRef.current = false;
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = null;
    }
    socket.emit("typing:stop", room.id);
  }, []);

  return {
    messages,
    rooms,
    users,
    currentRoom,
    connected,
    socketId,
    typingUsers,
    sendMessage,
    joinRoom,
    startTyping,
    stopTyping,
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @clichat/cli typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/cli/src/hooks/useSocket.ts
git commit -m "feat(useSocket): add typingUsers state and startTyping/stopTyping callbacks"
```

---

## Task 4: Create TypingIndicator component

**Files:**
- Create: `apps/cli/src/components/TypingIndicator.tsx`

- [ ] **Step 1: Create the component**

Create `apps/cli/src/components/TypingIndicator.tsx`:

```typescript
import React from "react";
import { Box, Text } from "ink";

interface TypingIndicatorProps {
  typingUsers: string[];
}

function formatTypingText(usernames: string[]): string {
  if (usernames.length === 0) return "";
  if (usernames.length === 1) return `${usernames[0]} is typing...`;
  if (usernames.length === 2) return `${usernames[0]} and ${usernames[1]} are typing...`;
  return `${usernames[0]}, ${usernames[1]} and ${usernames.length - 2} others are typing...`;
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps): React.ReactElement {
  if (typingUsers.length === 0) {
    return <Box height={1} />;
  }

  return (
    <Box height={1} paddingX={2}>
      <Text color="gray" dimColor>
        ● {formatTypingText(typingUsers)}
      </Text>
    </Box>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @clichat/cli typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/cli/src/components/TypingIndicator.tsx
git commit -m "feat(cli): add TypingIndicator component"
```

---

## Task 5: Add @mention highlighting to MessageList

**Files:**
- Modify: `apps/cli/src/components/MessageList.tsx`

- [ ] **Step 1: Write the updated MessageList**

Replace `apps/cli/src/components/MessageList.tsx` with:

```typescript
import React, { useMemo } from "react";
import { Box, Text, useStdout } from "ink";
import chalk from "chalk";
import type { ChatMessage, User } from "@clichat/types";
import { USERNAME_DISPLAY_WIDTH } from "@clichat/types";

interface MessageListProps {
  messages: ChatMessage[];
  users: User[];
  currentUsername: string;
}

const CHROME_ROWS = 11; // status bar + room header + typing indicator + input box + borders

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function padRight(str: string, len: number): string {
  if (str.length >= len) return str.slice(0, len);
  return str + " ".repeat(len - str.length);
}

interface MessageContentProps {
  content: string;
  currentUsername: string;
}

function MessageContent({ content, currentUsername }: MessageContentProps): React.ReactElement {
  const parts = content.split(/(@\w+)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("@") && part.slice(1).toLowerCase() === currentUsername.toLowerCase()) {
          return (
            <Text key={i}>{chalk.hex("#FFD700").bold(part)}</Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </>
  );
}

interface MessageRowProps {
  msg: ChatMessage;
  colorMap: Map<string, string>;
  currentUsername: string;
}

function MessageRow({ msg, colorMap, currentUsername }: MessageRowProps): React.ReactElement {
  const timeStr = formatTime(msg.timestamp);

  if (msg.type === "system") {
    return (
      <Box paddingX={2}>
        <Text color="gray" dimColor>── {msg.content} ──</Text>
      </Box>
    );
  }

  const color = colorMap.get(msg.username) ?? "#FFFFFF";
  const coloredUsername = chalk.hex(color).bold(padRight(msg.username, USERNAME_DISPLAY_WIDTH));

  return (
    <Box flexDirection="row" paddingX={1}>
      <Text color="gray" dimColor>[{timeStr}] </Text>
      <Text>{coloredUsername}</Text>
      <Text color="gray"> : </Text>
      <Box flexGrow={1}>
        <Text wrap="wrap">
          <MessageContent content={msg.content} currentUsername={currentUsername} />
        </Text>
      </Box>
    </Box>
  );
}

export function MessageList({ messages, users, currentUsername }: MessageListProps): React.ReactElement {
  const { stdout } = useStdout();
  const visibleRows = Math.max(1, (stdout?.rows ?? 24) - CHROME_ROWS);
  const visible = messages.slice(-visibleRows);

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users) {
      map.set(user.username, user.color);
    }
    return map;
  }, [users]);

  if (messages.length === 0) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text color="gray" dimColor>No messages yet. Say hello!</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visible.map((msg) => (
        <MessageRow key={msg.id} msg={msg} colorMap={colorMap} currentUsername={currentUsername} />
      ))}
    </Box>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @clichat/cli typecheck
```

Expected: errors on `ChatLayout` because it hasn't been updated yet to pass `currentUsername`. That's fine — fix in Task 7.

- [ ] **Step 3: Commit**

```bash
git add apps/cli/src/components/MessageList.tsx
git commit -m "feat(cli): add @mention highlighting in message rendering"
```

---

## Task 6: Rewrite InputBox with history, tab completion, and typing emit

**Files:**
- Modify: `apps/cli/src/components/InputBox.tsx`

- [ ] **Step 1: Write the updated InputBox**

Replace `apps/cli/src/components/InputBox.tsx` with:

```typescript
import React, { useState, useRef } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import type { User } from "@clichat/types";

const SLASH_COMMANDS = ["/join", "/quit", "/exit"];
const HISTORY_MAX = 50;

interface InputBoxProps {
  onSend: (content: string) => void;
  onJoinRoom: (roomId: string) => void;
  onStartTyping: () => void;
  onStopTyping: () => void;
  currentRoomName: string;
  users: User[];
}

export function InputBox({
  onSend,
  onJoinRoom,
  onStartTyping,
  onStopTyping,
  currentRoomName,
  users,
}: InputBoxProps): React.ReactElement {
  const [input, setInput] = useState("");
  const { exit } = useApp();

  // History
  const historyRef = useRef<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const draftRef = useRef("");

  // Tab completion
  const completionCandidatesRef = useRef<string[]>([]);
  const completionIndexRef = useRef(0);

  function resetCompletion(): void {
    completionCandidatesRef.current = [];
    completionIndexRef.current = 0;
  }

  function handleChange(value: string): void {
    setInput(value);
    resetCompletion();
    if (value.length > 0) {
      onStartTyping();
    } else {
      onStopTyping();
    }
  }

  function handleSubmit(value: string): void {
    const trimmed = value.trim();
    onStopTyping();
    resetCompletion();
    setHistoryIndex(-1);
    draftRef.current = "";

    if (!trimmed) {
      setInput("");
      return;
    }

    if (trimmed.startsWith("/")) {
      const parts = trimmed.slice(1).split(/\s+/);
      const cmd = parts[0]?.toLowerCase();

      if (cmd === "quit" || cmd === "exit") {
        exit();
        return;
      }

      if (cmd === "join" && parts[1]) {
        const roomId = parts[1].replace(/^#/, "");
        onJoinRoom(roomId);
        setInput("");
        return;
      }

      setInput("");
      return;
    }

    // Add to history (most recent first, deduplicate consecutive)
    if (historyRef.current[0] !== trimmed) {
      historyRef.current = [trimmed, ...historyRef.current].slice(0, HISTORY_MAX);
    }

    onSend(trimmed);
    setInput("");
  }

  useInput((inputChar, key) => {
    // History navigation
    if (key.upArrow) {
      const history = historyRef.current;
      if (history.length === 0) return;
      if (historyIndex === -1) {
        draftRef.current = input;
      }
      const nextIndex = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex] ?? "");
      resetCompletion();
      return;
    }

    if (key.downArrow) {
      if (historyIndex === -1) return;
      const nextIndex = historyIndex - 1;
      if (nextIndex < 0) {
        setHistoryIndex(-1);
        setInput(draftRef.current);
      } else {
        setHistoryIndex(nextIndex);
        setInput(historyRef.current[nextIndex] ?? "");
      }
      resetCompletion();
      return;
    }

    // Tab completion
    if (key.tab) {
      const wordMatch = input.match(/\S+$/);
      const currentWord = wordMatch ? wordMatch[0] : "";

      let candidates: string[] = [];

      if (currentWord.startsWith("@")) {
        const prefix = currentWord.slice(1).toLowerCase();
        candidates = users
          .map((u) => `@${u.username}`)
          .filter((u) => u.slice(1).toLowerCase().startsWith(prefix));
      } else if (currentWord.startsWith("/")) {
        candidates = SLASH_COMMANDS.filter((c) => c.startsWith(currentWord.toLowerCase()));
      }

      if (candidates.length === 0) return;

      // If candidates changed (new Tab session), reset index
      const prevCandidates = completionCandidatesRef.current;
      if (
        prevCandidates.length !== candidates.length ||
        prevCandidates.some((c, i) => c !== candidates[i])
      ) {
        completionCandidatesRef.current = candidates;
        completionIndexRef.current = 0;
      } else {
        completionIndexRef.current = (completionIndexRef.current + 1) % candidates.length;
      }

      const chosen = candidates[completionIndexRef.current] ?? "";
      const prefix = input.slice(0, input.length - currentWord.length);
      setInput(prefix + chosen + " ");
    }
  });

  return (
    <Box
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      flexDirection="row"
      alignItems="center"
    >
      <Text color="cyan" bold>
        {currentRoomName}{" > "}
      </Text>
      <Box flexGrow={1}>
        <TextInput
          value={input}
          onChange={handleChange}
          onSubmit={handleSubmit}
          placeholder="Type a message... (@user Tab · /join · /quit)"
        />
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @clichat/cli typecheck
```

Expected: errors on `ChatLayout` (hasn't been updated yet to pass new props). That's fine — fix in Task 7.

- [ ] **Step 3: Commit**

```bash
git add apps/cli/src/components/InputBox.tsx
git commit -m "feat(cli): add input history, tab completion, and typing emit to InputBox"
```

---

## Task 7: Update ChatLayout and ChatApp to wire all new props

**Files:**
- Modify: `apps/cli/src/components/ChatLayout.tsx`
- Modify: `apps/cli/src/index.tsx`

- [ ] **Step 1: Update ChatLayout**

Replace `apps/cli/src/components/ChatLayout.tsx` with:

```typescript
import React from "react";
import { Box, Text, useStdout } from "ink";
import type { ChatMessage, Room, User } from "@clichat/types";
import { RoomList } from "./RoomList.js";
import { UserList } from "./UserList.js";
import { MessageList } from "./MessageList.js";
import { InputBox } from "./InputBox.js";
import { StatusBar } from "./StatusBar.js";
import { TypingIndicator } from "./TypingIndicator.js";

interface ChatLayoutProps {
  messages: ChatMessage[];
  rooms: Room[];
  users: User[];
  currentRoom: Room | null;
  connected: boolean;
  currentUserId: string;
  currentUsername: string;
  typingUsers: string[];
  onSendMessage: (content: string) => void;
  onJoinRoom: (roomId: string) => void;
  onStartTyping: () => void;
  onStopTyping: () => void;
}

const MIN_WIDTH = 80;
const MIN_HEIGHT = 20;
const SIDEBAR_WIDTH = 20;

export function ChatLayout({
  messages,
  rooms,
  users,
  currentRoom,
  connected,
  currentUserId,
  currentUsername,
  typingUsers,
  onSendMessage,
  onJoinRoom,
  onStartTyping,
  onStopTyping,
}: ChatLayoutProps): React.ReactElement {
  const { stdout } = useStdout();
  const termWidth = stdout?.columns ?? 80;
  const termHeight = stdout?.rows ?? 24;

  if (termWidth < MIN_WIDTH || termHeight < MIN_HEIGHT) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center">
        <Text color="yellow" bold>Terminal too small!</Text>
        <Text color="gray">
          Minimum size: {MIN_WIDTH}×{MIN_HEIGHT} (current: {termWidth}×{termHeight})
        </Text>
        <Text color="gray">Please resize your terminal and restart.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight - 1}>
      <StatusBar
        connected={connected}
        currentRoom={currentRoom}
        userCount={users.length}
      />

      <Box flexDirection="row" flexGrow={1}>
        <Box
          flexDirection="column"
          width={SIDEBAR_WIDTH}
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
          flexShrink={0}
        >
          <RoomList
            rooms={rooms}
            currentRoomId={currentRoom?.id ?? null}
            onSelect={onJoinRoom}
          />
          <Box height={1} />
          <Box borderStyle="single" borderColor="gray" />
          <Box height={1} />
          <UserList users={users} currentUserId={currentUserId} />
        </Box>

        <Box
          flexDirection="column"
          flexGrow={1}
          borderStyle="round"
          borderColor="cyan"
        >
          <Box paddingX={2} borderStyle="single" borderColor="gray">
            <Text bold color="cyan">
              {currentRoom ? currentRoom.name : "No room selected"}
            </Text>
            {currentRoom && (
              <Text color="gray" dimColor> · {messages.length} messages</Text>
            )}
          </Box>

          <Box flexGrow={1} flexDirection="column" overflow="hidden">
            {currentRoom ? (
              <MessageList
                messages={messages}
                users={users}
                currentUsername={currentUsername}
              />
            ) : (
              <Box flexGrow={1} alignItems="center" justifyContent="center">
                <Text color="gray" dimColor>
                  Join a room to start chatting. Type /join general
                </Text>
              </Box>
            )}
          </Box>

          <TypingIndicator typingUsers={typingUsers} />

          <InputBox
            onSend={onSendMessage}
            onJoinRoom={onJoinRoom}
            onStartTyping={onStartTyping}
            onStopTyping={onStopTyping}
            currentRoomName={currentRoom?.name ?? "#"}
            users={users}
          />
        </Box>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Update ChatApp in index.tsx**

Replace `apps/cli/src/index.tsx` with:

```typescript
#!/usr/bin/env node
import React, { useState } from "react";
import { render } from "ink";
import { LoginScreen } from "./components/LoginScreen.js";
import { ChatLayout } from "./components/ChatLayout.js";
import { useSocket } from "./hooks/useSocket.js";

function ChatApp({ username }: { username: string }): React.ReactElement {
  const {
    messages,
    rooms,
    users,
    currentRoom,
    connected,
    socketId,
    typingUsers,
    sendMessage,
    joinRoom,
    startTyping,
    stopTyping,
  } = useSocket(username);

  return (
    <ChatLayout
      messages={messages}
      rooms={rooms}
      users={users}
      currentRoom={currentRoom}
      connected={connected}
      currentUserId={socketId}
      currentUsername={username}
      typingUsers={typingUsers}
      onSendMessage={sendMessage}
      onJoinRoom={joinRoom}
      onStartTyping={startTyping}
      onStopTyping={stopTyping}
    />
  );
}

function App(): React.ReactElement {
  const [username, setUsername] = useState<string | null>(null);

  if (!username) {
    return <LoginScreen onLogin={setUsername} />;
  }

  return <ChatApp username={username} />;
}

const { waitUntilExit } = render(<App />, { exitOnCtrlC: true });
waitUntilExit().then(() => process.exit(0));
```

- [ ] **Step 3: Full typecheck — must be clean**

```bash
pnpm turbo typecheck
```

Expected: 2 tasks successful, 0 errors.

- [ ] **Step 4: Rebuild types and verify CLI starts**

```bash
pnpm --filter @clichat/types build
```

Then in a real terminal:
```bash
pnpm dev:server   # terminal 1
pnpm dev:cli      # terminal 2
```

Verify: login screen renders, chat layout loads, no runtime errors.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/components/ChatLayout.tsx apps/cli/src/index.tsx
git commit -m "feat(cli): wire typing indicators, @mentions, history, and tab completion through ChatLayout"
```

---

## Task 8: Manual smoke test and final commit

- [ ] **Step 1: Start server and two CLI clients**

Terminal 1: `pnpm dev:server`
Terminal 2: `pnpm dev:cli` — log in as `alice`
Terminal 3: `pnpm dev:cli` — log in as `bob`

- [ ] **Step 2: Verify typing indicators**

In alice's terminal, start typing. Bob's terminal should show `● alice is typing...`. Send the message — indicator disappears.

- [ ] **Step 3: Verify @mention highlighting**

Alice sends `hello @bob how are you`. In bob's terminal, `@bob` should appear in bold yellow. Bob's `#general` room badge should show a red dot if he's in a different room.

- [ ] **Step 4: Verify input history**

Alice sends three messages. Press Up arrow — should cycle back through them. Press Down — should restore draft.

- [ ] **Step 5: Verify tab completion**

Alice types `@b` then presses Tab — should complete to `@bob `. Alice types `/j` then Tab — should complete to `/join `.

- [ ] **Step 6: Final push**

```bash
git push origin main
```
