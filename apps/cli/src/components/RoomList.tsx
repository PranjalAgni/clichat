import React from "react";
import { Box, Text, useInput } from "ink";
import type { Room } from "@clichat/types";

interface RoomListProps {
  rooms: Room[];
  currentRoomId: string | null;
  onSelect: (roomId: string) => void;
}

export function RoomList({ rooms, currentRoomId, onSelect }: RoomListProps): React.ReactElement {
  useInput((input) => {
    const index = parseInt(input, 10);
    if (!isNaN(index) && index >= 1 && index <= rooms.length) {
      const room = rooms[index - 1];
      if (room && room.id !== currentRoomId) {
        onSelect(room.id);
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">ROOMS</Text>
      </Box>
      {rooms.length === 0 && (
        <Text color="gray" dimColor>No rooms</Text>
      )}
      {rooms.map((room, index) => {
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
            <Text color="gray" dimColor>{index + 1} </Text>
            <Text
              bold={isActive}
              color={isActive ? "cyan" : hasUnread ? "yellow" : "white"}
              dimColor={!isActive && !hasUnread && !hasMention}
            >
              {room.name}
            </Text>
            {hasUnread && !hasMention && (
              <Text color="yellow"> ({room.unreadCount})</Text>
            )}
            {hasMention && <Text color="red"> @</Text>}
          </Box>
        );
      })}
      <Box marginTop={1}>
        <Text color="gray" dimColor>press 1-{rooms.length} to switch</Text>
      </Box>
    </Box>
  );
}
