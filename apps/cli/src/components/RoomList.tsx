import React from "react";
import { Box, Text } from "ink";
import type { Room } from "@clichat/types";

interface RoomListProps {
  rooms: Room[];
  currentRoomId: string | null;
  onSelect: (roomId: string) => void;
}

export function RoomList({ rooms, currentRoomId }: RoomListProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">ROOMS</Text>
      </Box>
      {rooms.length === 0 && (
        <Text color="gray" dimColor>No rooms</Text>
      )}
      {rooms.map((room) => {
        const isActive = room.id === currentRoomId;
        const hasMention = room.hasNewMention;
        const hasUnread = room.unreadCount > 0;

        let dotColor: string;
        if (hasMention) dotColor = "red";
        else if (hasUnread) dotColor = "yellow";
        else dotColor = "gray";

        return (
          <Box key={room.id} flexDirection="row" alignItems="center">
            <Text color={dotColor}>{hasMention || hasUnread ? "● " : "  "}</Text>
            <Text color="cyan">{isActive ? "▶ " : "  "}</Text>
            <Text
              bold={isActive}
              color={isActive ? "cyan" : hasUnread ? "yellow" : "white"}
              dimColor={!isActive && !hasUnread && !hasMention}
            >
              {room.name}
            </Text>
            {hasUnread && !hasMention && (
              <Text color="yellow"> {room.unreadCount}</Text>
            )}
            {hasMention && <Text color="red"> @</Text>}
          </Box>
        );
      })}
      <Box marginTop={1}>
        <Text color="gray" dimColor>/join &lt;room&gt;</Text>
      </Box>
    </Box>
  );
}
