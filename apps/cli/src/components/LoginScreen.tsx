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
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(val: string): void {
    const trimmed = val.trim();
    if (!trimmed) {
      setError("Username cannot be empty");
      return;
    }
    if (trimmed.length < 2) {
      setError("Username must be at least 2 characters");
      return;
    }
    if (!/^[\w-]+$/.test(trimmed)) {
      setError("Only letters, numbers, _ and - allowed");
      return;
    }
    setError("");
    setSubmitted(true);
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
        borderColor={error ? "red" : submitted ? "green" : "cyan"}
        paddingX={4}
        paddingY={1}
        flexDirection="column"
        alignItems="center"
        width={52}
      >
        <Box marginBottom={1}>
          <Text bold color={submitted ? "green" : "cyan"}>
            {submitted ? "Connecting..." : "Choose your username"}
          </Text>
        </Box>

        {!submitted && (
          <Box>
            <Text color="cyan" bold>{"> "}</Text>
            <TextInput
              value={value}
              onChange={(v) => { setValue(v); setError(""); }}
              onSubmit={handleSubmit}
              placeholder="your username..."
            />
          </Box>
        )}

        {submitted && (
          <Box>
            <Text color="green">⠋ </Text>
            <Text color="gray">Joining as </Text>
            <Text color="cyan" bold>{value.trim()}</Text>
            <Text color="gray">...</Text>
          </Box>
        )}

        <Box marginTop={1}>
          {error ? (
            <Text color="red">✗ {error}</Text>
          ) : (
            <Text color="gray" dimColor>
              {submitted ? "Waiting for server..." : "press Enter to connect"}
            </Text>
          )}
        </Box>
      </Box>

      <Box marginTop={2} flexDirection="column" alignItems="center">
        <Text color="gray" dimColor>Commands: /join &lt;room&gt; · /quit</Text>
        <Text color="gray" dimColor>Rooms: #general · #random · #tech</Text>
      </Box>
    </Box>
  );
}
