#!/usr/bin/env node
import React, { useState } from "react";
import { render } from "ink";
import { LoginScreen } from "./components/LoginScreen.js";
import { ChatLayout } from "./components/ChatLayout.js";
import { useSocket } from "./hooks/useSocket.js";

function ChatApp({ username }: { username: string }): React.ReactElement {
  const {
    messages,
    rooms,
    users,
    currentRoom,
    connected,
    sendMessage,
    joinRoom,
    socketId,
  } = useSocket(username);

  return (
    <ChatLayout
      messages={messages}
      rooms={rooms}
      users={users}
      currentRoom={currentRoom}
      connected={connected}
      currentUserId={socketId}
      onSendMessage={sendMessage}
      onJoinRoom={joinRoom}
    />
  );
}

function App(): React.ReactElement {
  const [username, setUsername] = useState<string | null>(null);

  if (!username) {
    return <LoginScreen onLogin={setUsername} />;
  }

  return <ChatApp username={username} />;
}

const { waitUntilExit } = render(<App />, { exitOnCtrlC: true });
waitUntilExit().then(() => process.exit(0));
