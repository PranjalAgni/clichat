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
    <Box
      flexDirection="row"
      justifyContent="space-between"
      paddingX={2}
      paddingY={0}
    >
      <Box flexDirection="row" gap={2}>
        <Text>
          {connected ? (
            <Text color="green">● connected</Text>
          ) : (
            <Text color="red">● disconnected</Text>
          )}
        </Text>
        {currentRoom && (
          <Text color="cyan" bold>
            {currentRoom.name}
          </Text>
        )}
      </Box>
      <Box flexDirection="row" gap={1}>
        <Text color="gray" dimColor>
          {userCount} online
        </Text>
        <Text color="gray" dimColor>
          · clichat v0.0.1
        </Text>
      </Box>
    </Box>
  );
}
