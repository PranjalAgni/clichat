# clichat

```
  ██████╗██╗     ██╗ ██████╗██╗  ██╗ █████╗ ████████╗
 ██╔════╝██║     ██║██╔════╝██║  ██║██╔══██╗╚══██╔══╝
 ██║     ██║     ██║██║     ███████║███████║   ██║
 ██║     ██║     ██║██║     ██╔══██║██╔══██║   ██║
 ╚██████╗███████╗██║╚██████╗██║  ██║██║  ██║   ██║
  ╚═════╝╚══════╝╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═╝
```

> Real-time terminal chat — built with Ink, Socket.io, and TypeScript.

A beautiful multi-room chat app that lives entirely in your terminal. Powered by a Socket.io server and an [Ink](https://github.com/vadimdemedes/ink) (React for CLIs) frontend, organized as a [Turborepo](https://turbo.build/) monorepo.

---

## Features

- **Three default rooms** — `#general`, `#random`, `#tech` — switch with `/join`
- **Per-user colors** — each user gets a unique hex color, consistently shown everywhere
- **Aligned message layout** — `[HH:MM]  username      : message`
- **System messages** — join and leave events styled distinctly from chat
- **Unread badges** — yellow dot on rooms with unread messages, red dot for mentions
- **Online user list** — live sidebar showing everyone currently connected
- **Keyboard commands** — `/join <room>` to switch rooms, `/quit` to exit
- **Rounded Unicode borders** throughout — looks great on any modern terminal

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | [Turborepo](https://turbo.build/) + [pnpm workspaces](https://pnpm.io/workspaces) |
| Terminal UI | [Ink v5](https://github.com/vadimdemedes/ink) (React for CLIs) |
| Layout engine | [Yoga](https://yogalayout.dev/) (flexbox in the terminal) |
| Real-time messaging | [Socket.io v4](https://socket.io/) |
| Language | TypeScript 5 (strict mode, ESM) |
| Colors | [chalk v5](https://github.com/chalk/chalk) |
| Runtime | Node.js ≥ 18 |

---

## Project Structure

```
clichat/
├── apps/
│   ├── cli/                    # Ink terminal UI (the chat client)
│   │   └── src/
│   │       ├── index.tsx       # Entry point, login → chat state machine
│   │       ├── hooks/
│   │       │   └── useSocket.ts
│   │       └── components/
│   │           ├── ChatLayout.tsx
│   │           ├── LoginScreen.tsx
│   │           ├── MessageList.tsx
│   │           ├── InputBox.tsx
│   │           ├── RoomList.tsx
│   │           ├── UserList.tsx
│   │           └── StatusBar.tsx
│   └── server/                 # Socket.io chat server
│       └── src/
│           └── index.ts
├── packages/
│   ├── tsconfig/               # Shared TypeScript config presets
│   └── types/                  # Shared interfaces (ChatMessage, Room, User)
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- pnpm ≥ 9 — `npm install -g pnpm`

### Install

```bash
git clone https://github.com/PranjalAgni/clichat.git
cd clichat
pnpm install
```

### Run

The CLI requires a real TTY so it must run in its own terminal tab — it cannot share a multiplexed output stream with the server.

**Terminal 1 — start the server**
```bash
pnpm dev:server
# [clichat server] listening on port 3001
```

**Terminal 2 — start the client**
```bash
pnpm dev:cli
```

> By default the client connects to `http://localhost:3001`. Override with:
> ```bash
> SERVER_URL=http://your-server:3001 pnpm dev:cli
> ```

---

## Usage

When the client starts you'll see the login screen. Type your username and press **Enter** to connect.

Once in the chat:

| Input | Action |
|---|---|
| Type and press **Enter** | Send a message to the current room |
| `/join general` | Switch to `#general` |
| `/join random` | Switch to `#random` |
| `/join tech` | Switch to `#tech` |
| `/quit` | Exit the app |
| **Ctrl+C** | Force exit |

---

## Available Scripts

From the repo root:

```bash
pnpm dev:server      # Start the Socket.io server (watches for changes)
pnpm dev:cli         # Start the terminal UI client
pnpm build           # Build all packages
pnpm typecheck       # TypeScript check across all packages
pnpm clean           # Remove all dist/ and node_modules/
```

---

## Design Patterns

See [`docs/design-patterns.md`](docs/design-patterns.md) for a full breakdown of the patterns used and why:

- **Observer** — Socket.io event system decouples producers from consumers
- **Custom Hook** — `useSocket` encapsulates all socket state and lifecycle
- **Component Composition** — Ink layout assembled from focused single-purpose components
- **Repository** — Server-side room and user stores behind helper functions
- **Strategy** — Message type rendering (system vs chat) and command dispatch

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port the server listens on |
| `SERVER_URL` | `http://localhost:3001
` | Server URL the client connects to |


200% vibe coded using claude code 

Went to 90s cafe and roast ccx for icecream
