import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

interface TypingIndicatorProps {
  typingUsers: string[];
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function formatTypingText(usernames: string[]): string {
  if (usernames.length === 1) return `${usernames[0]} is typing`;
  if (usernames.length === 2) return `${usernames[0]} and ${usernames[1]} are typing`;
  return `${usernames[0]}, ${usernames[1]} and ${usernames.length - 2} more are typing`;
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps): React.ReactElement {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (typingUsers.length === 0) return;
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, [typingUsers.length]);

  if (typingUsers.length === 0) {
    return <Box height={1} />;
  }

  return (
    <Box height={1} paddingX={2}>
      <Text color="cyan">{SPINNER_FRAMES[frame]} </Text>
      <Text color="gray" dimColor>{formatTypingText(typingUsers)}...</Text>
    </Box>
  );
}
