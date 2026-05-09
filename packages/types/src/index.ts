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
  "error": (message: string) => void;
}

export interface ClientToServerEvents {
  "authenticate": (username: string) => void;
  "message:send": (roomId: string, content: string) => void;
  "room:join": (roomId: string) => void;
  "room:leave": (roomId: string) => void;
}
