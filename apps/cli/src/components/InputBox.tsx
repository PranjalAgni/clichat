import React, { useState } from "react";
import { Box, Text, useApp } from "ink";
import TextInput from "ink-text-input";

interface InputBoxProps {
  onSend: (content: string) => void;
  onJoinRoom: (roomId: string) => void;
  currentRoomName: string;
}

export function InputBox({ onSend, onJoinRoom, currentRoomName }: InputBoxProps): React.ReactElement {
  const [input, setInput] = useState("");
  const { exit } = useApp();

  function handleSubmit(value: string): void {
    const trimmed = value.trim();
    if (!trimmed) {
      setInput("");
      return;
    }

    if (trimmed.startsWith("/")) {
      const parts = trimmed.slice(1).split(/\s+/);
      const cmd = parts[0]?.toLowerCase();

      if (cmd === "quit" || cmd === "exit") {
        exit();
        return;
      }

      if (cmd === "join" && parts[1]) {
        const roomId = parts[1].replace(/^#/, "");
        onJoinRoom(roomId);
        setInput("");
        return;
      }

      // Unknown command — clear silently
      setInput("");
      return;
    }

    onSend(trimmed);
    setInput("");
  }

  return (
    <Box
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      flexDirection="row"
      alignItems="center"
    >
      <Text color="cyan" bold>
        {currentRoomName}{" > "}
      </Text>
      <Box flexGrow={1}>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Type a message... (/join <room> · /quit)"
        />
      </Box>
    </Box>
  );
}
