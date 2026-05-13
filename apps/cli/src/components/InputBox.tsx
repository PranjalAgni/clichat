import React, { useState, useRef } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import type { User } from "@clichat/types";

const SLASH_COMMANDS = ["/join", "/quit", "/exit"];
const HISTORY_MAX = 50;

interface InputBoxProps {
  onSend: (content: string) => void;
  onJoinRoom: (roomId: string) => void;
  onStartTyping: () => void;
  onStopTyping: () => void;
  currentRoomName: string;
  users: User[];
}

export function InputBox({
  onSend,
  onJoinRoom,
  onStartTyping,
  onStopTyping,
  currentRoomName,
  users,
}: InputBoxProps): React.ReactElement {
  const [input, setInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const { exit } = useApp();

  const historyRef = useRef<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const draftRef = useRef("");

  const completionCandidatesRef = useRef<string[]>([]);
  const completionIndexRef = useRef(0);

  function resetCompletion(): void {
    completionCandidatesRef.current = [];
    completionIndexRef.current = 0;
  }

  function showError(msg: string): void {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(""), 2000);
  }

  function handleChange(value: string): void {
    setInput(value);
    resetCompletion();
    if (value.length > 0) {
      onStartTyping();
    } else {
      onStopTyping();
    }
  }

  function handleSubmit(value: string): void {
    const trimmed = value.trim();
    onStopTyping();
    resetCompletion();
    setHistoryIndex(-1);
    draftRef.current = "";

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

      if (cmd === "join" && !parts[1]) {
        showError("Usage: /join <room>");
        setInput("");
        return;
      }

      showError(`Unknown command: /${cmd}`);
      setInput("");
      return;
    }

    if (historyRef.current[0] !== trimmed) {
      historyRef.current = [trimmed, ...historyRef.current].slice(0, HISTORY_MAX);
    }

    onSend(trimmed);
    setInput("");
  }

  useInput((_inputChar, key) => {
    if (key.upArrow) {
      const history = historyRef.current;
      if (history.length === 0) return;
      if (historyIndex === -1) draftRef.current = input;
      const nextIndex = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex] ?? "");
      resetCompletion();
      return;
    }

    if (key.downArrow) {
      if (historyIndex === -1) return;
      const nextIndex = historyIndex - 1;
      if (nextIndex < 0) {
        setHistoryIndex(-1);
        setInput(draftRef.current);
      } else {
        setHistoryIndex(nextIndex);
        setInput(historyRef.current[nextIndex] ?? "");
      }
      resetCompletion();
      return;
    }

    if (key.tab) {
      const wordMatch = input.match(/\S+$/);
      const currentWord = wordMatch ? wordMatch[0] : "";

      let candidates: string[] = [];

      if (currentWord.startsWith("@")) {
        const prefix = currentWord.slice(1).toLowerCase();
        candidates = users
          .map((u) => `@${u.username}`)
          .filter((u) => u.slice(1).toLowerCase().startsWith(prefix));
      } else if (currentWord.startsWith("/")) {
        candidates = SLASH_COMMANDS.filter((c) => c.startsWith(currentWord.toLowerCase()));
      }

      if (candidates.length === 0) return;

      const prevCandidates = completionCandidatesRef.current;
      if (
        prevCandidates.length !== candidates.length ||
        prevCandidates.some((c, i) => c !== candidates[i])
      ) {
        completionCandidatesRef.current = candidates;
        completionIndexRef.current = 0;
      } else {
        completionIndexRef.current = (completionIndexRef.current + 1) % candidates.length;
      }

      const chosen = candidates[completionIndexRef.current] ?? "";
      const prefix = input.slice(0, input.length - currentWord.length);
      setInput(prefix + chosen + " ");
    }
  });

  const historyTotal = historyRef.current.length;
  const showHistoryHint = historyIndex !== -1 && historyTotal > 0;

  return (
    <Box flexDirection="column">
      {errorMsg ? (
        <Box paddingX={2}>
          <Text color="red">✗ {errorMsg}</Text>
        </Box>
      ) : null}
      <Box
        borderStyle="round"
        borderColor={errorMsg ? "red" : "cyan"}
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
            onChange={handleChange}
            onSubmit={handleSubmit}
            placeholder="Type a message... (@user Tab · /join · /quit)"
          />
        </Box>
        {showHistoryHint && (
          <Text color="gray" dimColor> ↕ {historyIndex + 1}/{historyTotal}</Text>
        )}
      </Box>
    </Box>
  );
}
