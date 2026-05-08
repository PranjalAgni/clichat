import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";
import type { User } from "@clichat/types";

interface UserListProps {
  users: User[];
  currentUserId?: string;
}

export function UserList({ users, currentUserId }: UserListProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ONLINE ({users.length})
        </Text>
      </Box>
      {users.length === 0 && (
        <Text color="gray" dimColor>
          No users
        </Text>
      )}
      {users.map((user) => {
        const isCurrentUser = user.id === currentUserId;
        const coloredName = chalk.hex(user.color)(
          user.username.slice(0, 13) + (isCurrentUser ? " (you)" : "")
        );
        return (
          <Box key={user.id} flexDirection="row" alignItems="center">
            <Text color="green">● </Text>
            <Text>{coloredName}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
