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

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSocketReturn {
  messages: ChatMessage[];
  rooms: Room[];
  users: User[];
  currentRoom: Room | null;
  connected: boolean;
  socketId: string;
  sendMessage: (content: string) => void;
  joinRoom: (roomId: string) => void;
}

export function useSocket(username: string): UseSocketReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState("");
  const socketRef = useRef<AppSocket | null>(null);
  const currentRoomRef = useRef<Room | null>(null);

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

    return () => {
      socket.disconnect();
    };
  }, [username]);

  const sendMessage = useCallback((content: string) => {
    const socket = socketRef.current;
    if (!socket || !currentRoomRef.current) return;
    socket.emit("message:send", currentRoomRef.current.id, content);
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("room:join", roomId);
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, unreadCount: 0 } : r))
    );
  }, []);

  return {
    messages,
    rooms,
    users,
    currentRoom,
    connected,
    socketId,
    sendMessage,
    joinRoom,
  };
}
