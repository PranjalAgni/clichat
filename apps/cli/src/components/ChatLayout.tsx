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
      <StatusBar connected={connected} currentRoom={currentRoom} userCount={users.length} />

      <Box flexDirection="row" flexGrow={1}>
        <Box
          flexDirection="column"
          width={SIDEBAR_WIDTH}
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
          flexShrink={0}
        >
          <RoomList rooms={rooms} currentRoomId={currentRoom?.id ?? null} onSelect={onJoinRoom} />
          <Box height={1} />
          <Box borderStyle="single" borderColor="gray" />
          <Box height={1} />
          <UserList users={users} currentUserId={currentUserId} />
        </Box>

        <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="cyan">
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
              <MessageList messages={messages} users={users} currentUsername={currentUsername} />
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
