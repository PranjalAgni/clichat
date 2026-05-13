import React from "react";
import { Box, Text } from "ink";
import type { Room } from "@clichat/types";

interface StatusBarProps {
  connected: boolean;
  currentRoom: Room | null;
  userCount: number;
  currentUsername: string;
}

export function StatusBar({ connected, currentRoom, userCount, currentUsername }: StatusBarProps): React.ReactElement {
  return (
    <Box flexDirection="row" justifyContent="space-between" paddingX={2}>
      <Box flexDirection="row" gap={2}>
        <Text color={connected ? "green" : "red"}>
          {connected ? "● connected" : "● disconnected"}
        </Text>
        {currentRoom && (
          <Text color="cyan" bold>{currentRoom.name}</Text>
        )}
      </Box>
      <Box flexDirection="row" gap={2}>
        <Text color="gray" dimColor>{userCount} online</Text>
        <Text color="cyan">@{currentUsername}</Text>
      </Box>
    </Box>
  );
}
