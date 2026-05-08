import React from "react";
import { Box, Text, useStdout } from "ink";
import chalk from "chalk";
import type { ChatMessage, User } from "@clichat/types";

interface MessageListProps {
  messages: ChatMessage[];
  users: User[];
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function padRight(str: string, len: number): string {
  if (str.length >= len) return str.slice(0, len);
  return str + " ".repeat(len - str.length);
}

function getUserColor(username: string, users: User[]): string {
  const user = users.find((u) => u.username === username);
  return user?.color ?? "#FFFFFF";
}

interface MessageRowProps {
  msg: ChatMessage;
  users: User[];
}

function MessageRow({ msg, users }: MessageRowProps): React.ReactElement {
  const timeStr = formatTime(msg.timestamp);

  if (msg.type === "system") {
    return (
      <Box paddingX={2}>
        <Text color="gray" dimColor>
          {"── "}
          {msg.content}
          {" ──"}
        </Text>
      </Box>
    );
  }

  const color = getUserColor(msg.username, users);
  const paddedUsername = padRight(msg.username, 12);
  const coloredUsername = chalk.hex(color).bold(paddedUsername);

  return (
    <Box flexDirection="row" paddingX={1}>
      <Text color="gray" dimColor>[{timeStr}] </Text>
      <Text>{coloredUsername}</Text>
      <Text color="gray"> : </Text>
      <Text wrap="wrap">{msg.content}</Text>
    </Box>
  );
}

export function MessageList({ messages, users }: MessageListProps): React.ReactElement {
  const { stdout } = useStdout();
  // Reserve rows for: status bar, room header, input box, borders
  const reserved = 10;
  const visibleRows = Math.max(1, (stdout?.rows ?? 24) - reserved);
  const visible = messages.slice(-visibleRows);

  if (messages.length === 0) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text color="gray" dimColor>No messages yet. Say hello!</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visible.map((msg) => (
        <MessageRow key={msg.id} msg={msg} users={users} />
      ))}
    </Box>
  );
}
