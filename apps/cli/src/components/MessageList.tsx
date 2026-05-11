import React, { useMemo } from "react";
import { Box, Text, useStdout } from "ink";
import chalk from "chalk";
import type { ChatMessage, User } from "@clichat/types";
import { USERNAME_DISPLAY_WIDTH } from "@clichat/types";

interface MessageListProps {
  messages: ChatMessage[];
  users: User[];
  currentUsername: string;
}

const CHROME_ROWS = 11;

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

interface MessageContentProps {
  content: string;
  currentUsername: string;
}

function MessageContent({ content, currentUsername }: MessageContentProps): React.ReactElement {
  const parts = content.split(/(@\w+)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (
          part.startsWith("@") &&
          part.slice(1).toLowerCase() === currentUsername.toLowerCase()
        ) {
          return <Text key={i}>{chalk.hex("#FFD700").bold(part)}</Text>;
        }
        return <Text key={i}>{part}</Text>;
      })}
    </>
  );
}

interface MessageRowProps {
  msg: ChatMessage;
  colorMap: Map<string, string>;
  currentUsername: string;
}

function MessageRow({ msg, colorMap, currentUsername }: MessageRowProps): React.ReactElement {
  const timeStr = formatTime(msg.timestamp);

  if (msg.type === "system") {
    return (
      <Box paddingX={2}>
        <Text color="gray" dimColor>── {msg.content} ──</Text>
      </Box>
    );
  }

  const color = colorMap.get(msg.username) ?? "#FFFFFF";
  const coloredUsername = chalk.hex(color).bold(padRight(msg.username, USERNAME_DISPLAY_WIDTH));

  return (
    <Box flexDirection="row" paddingX={1}>
      <Text color="gray" dimColor>[{timeStr}] </Text>
      <Text>{coloredUsername}</Text>
      <Text color="gray"> : </Text>
      <Box flexGrow={1}>
        <Text wrap="wrap">
          <MessageContent content={msg.content} currentUsername={currentUsername} />
        </Text>
      </Box>
    </Box>
  );
}

export function MessageList({ messages, users, currentUsername }: MessageListProps): React.ReactElement {
  const { stdout } = useStdout();
  const visibleRows = Math.max(1, (stdout?.rows ?? 24) - CHROME_ROWS);
  const visible = messages.slice(-visibleRows);

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users) {
      map.set(user.username, user.color);
    }
    return map;
  }, [users]);

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
        <MessageRow key={msg.id} msg={msg} colorMap={colorMap} currentUsername={currentUsername} />
      ))}
    </Box>
  );
}
