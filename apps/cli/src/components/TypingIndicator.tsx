import React from "react";
import { Box, Text } from "ink";

interface TypingIndicatorProps {
  typingUsers: string[];
}

function formatTypingText(usernames: string[]): string {
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
      <Text color="gray" dimColor>● {formatTypingText(typingUsers)}</Text>
    </Box>
  );
}
