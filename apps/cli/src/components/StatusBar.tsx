import React from "react";
import { Box, Text } from "ink";
import type { Room } from "@clichat/types";

interface StatusBarProps {
  connected: boolean;
  currentRoom: Room | null;
  userCount: number;
}

export function StatusBar({ connected, currentRoom, userCount }: StatusBarProps): React.ReactElement {
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
      <Box flexDirection="row" gap={1}>
        <Text color="gray" dimColor>{userCount} online · clichat v0.0.1</Text>
      </Box>
    </Box>
  );
}
