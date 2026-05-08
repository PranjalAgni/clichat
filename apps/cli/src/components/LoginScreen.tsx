import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import chalk from "chalk";

interface LoginScreenProps {
  onLogin: (username: string) => void;
}

const ASCII_TITLE = [
  "  ██████╗██╗     ██╗ ██████╗██╗  ██╗ █████╗ ████████╗",
  " ██╔════╝██║     ██║██╔════╝██║  ██║██╔══██╗╚══██╔══╝",
  " ██║     ██║     ██║██║     ███████║███████║   ██║   ",
  " ██║     ██║     ██║██║     ██╔══██║██╔══██║   ██║   ",
  " ╚██████╗███████╗██║╚██████╗██║  ██║██║  ██║   ██║   ",
  "  ╚═════╝╚══════╝╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝  ",
];

const GRADIENT_COLORS = [
  "#FF6B6B",
  "#FF8E53",
  "#FF6B9D",
  "#C44DFF",
  "#4ECDC4",
  "#45B7D1",
];

export function LoginScreen({ onLogin }: LoginScreenProps): React.ReactElement {
  const [value, setValue] = useState("");

  function handleSubmit(submitted: string): void {
    const trimmed = submitted.trim();
    if (!trimmed) return;
    onLogin(trimmed);
  }

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" padding={2}>
      <Box flexDirection="column" alignItems="center" marginBottom={2}>
        {ASCII_TITLE.map((line, i) => (
          <Text key={i}>
            {chalk.hex(GRADIENT_COLORS[i % GRADIENT_COLORS.length] as string)(line)}
          </Text>
        ))}
      </Box>

      <Box marginBottom={1}>
        <Text color="gray" dimColor>
          {chalk.italic("Real-time terminal chat — powered by Socket.io & Ink")}
        </Text>
      </Box>

      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={4}
        paddingY={1}
        flexDirection="column"
        alignItems="center"
        width={50}
      >
        <Box marginBottom={1}>
          <Text bold color="cyan">
            Welcome! Enter your username to join
          </Text>
        </Box>

        <Box>
          <Text color="cyan" bold>{"> "}</Text>
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            placeholder="your username..."
          />
        </Box>

        <Box marginTop={1}>
          <Text color="gray" dimColor>press Enter to connect</Text>
        </Box>
      </Box>

      <Box marginTop={2} flexDirection="column" alignItems="center">
        <Text color="gray" dimColor>Commands: /join &lt;room&gt; · /quit</Text>
        <Text color="gray" dimColor>Rooms: #general · #random · #tech</Text>
      </Box>
    </Box>
  );
}
