# Design Patterns in clichat

This document describes the key design patterns used across the clichat codebase, where they appear, and why each was the right choice.

---

## 1. Observer Pattern

**What it is:**
The Observer pattern defines a one-to-many dependency between objects so that when one object (the subject) changes state, all its dependents (observers) are notified and updated automatically. Subscribers register interest in events and respond when they fire — without the subject knowing who is listening.

**Where it is used:**
- **File:** `apps/server/src/index.ts`
  - `io.on("connection", ...)` — the Socket.io server observes new client connections.
  - Inside the connection handler: `socket.on("authenticate", ...)`, `socket.on("message:send", ...)`, `socket.on("room:join", ...)`, `socket.on("room:leave", ...)`, `socket.on("disconnect", ...)` — each is an observer registered on the socket's event emitter.
  - `io.emit(...)` and `io.to(roomId).emit(...)` — the server notifies all relevant observers (connected clients) when state changes.
- **File:** `apps/cli/src/hooks/useSocket.ts` — `useSocket` hook
  - `socket.on("message:new", ...)`, `socket.on("room:joined", ...)`, `socket.on("user:joined", ...)`, etc. — the React state layer observes server-sent events and updates local state accordingly.

**Why it was the right choice:**
Real-time chat is inherently event-driven. The Observer pattern decouples event producers (server or socket) from consumers (UI state, peer clients). Neither side needs a direct reference to the other; both sides evolve independently. Socket.io's EventEmitter API is a first-class implementation of this pattern, making it the natural fit for bidirectional, low-latency messaging.

---

## 2. Custom Hook Pattern

**What it is:**
A Custom Hook is a React convention that extracts stateful logic into a reusable function whose name starts with `use`. It encapsulates `useState`, `useEffect`, `useCallback`, and any other hooks into a single composable unit with a clean API surface.

**Where it is used:**
- **File:** `apps/cli/src/hooks/useSocket.ts` — `useSocket()` function
  - Manages socket lifecycle (`useEffect` creates the socket on mount, tears it down on unmount).
  - Maintains all application-level state: `messages`, `rooms`, `users`, `currentRoom`, `connected`, `authenticated`, `errorMsg`.
  - Exposes stable callbacks (`sendMessage`, `joinRoom`, `authenticate`) via `useCallback`.
  - Returns a clean, typed `UseSocketReturn` object consumed by `App` in `apps/cli/src/index.tsx`.

**Why it was the right choice:**
Socket management and server-state synchronisation are cross-cutting concerns shared across multiple components. Pulling them into a custom hook keeps every component pure and focused on rendering, not networking. The hook is also trivially testable and mockable in isolation.

---

## 3. Component Composition

**What it is:**
Component Composition is a React structural pattern where complex UIs are assembled from small, focused, single-responsibility components rather than monolithic ones. Parent components orchestrate layout; leaf components render data.

**Where it is used:**
- **File:** `apps/cli/src/components/ChatLayout.tsx` — `ChatLayout` composes:
  - `StatusBar` — top bar with connection info.
  - `RoomList` — left sidebar rooms.
  - `UserList` — left sidebar users, below a divider.
  - `MessageList` — scrolling message area.
  - `InputBox` — bottom input row with command parsing.
- **File:** `apps/cli/src/index.tsx` — `App` composes either `LoginScreen` or `ChatLayout` based on auth state.

**Why it was the right choice:**
Ink (React for terminals) renders a virtual DOM to the terminal using Yoga layout, the same flexbox engine used in React Native. The component model maps directly to terminal layout boxes, making composition the idiomatic approach. Keeping each component small means layout changes (resizing panes, adding a panel) require only local edits.

---

## 4. Repository Pattern

**What it is:**
The Repository pattern abstracts the storage and retrieval of domain objects behind a consistent interface. Consumers work with domain concepts (rooms, users, messages) rather than raw storage details (maps, arrays, indices).

**Where it is used:**
- **File:** `apps/server/src/index.ts`
  - `const rooms = new Map<string, InternalRoom>()` — the rooms repository. All room mutations (add member, append message, truncate history) go through helper functions: `createDefaultRooms()`, `getRoomList()`, and inline mutations inside event handlers — never through direct external mutation.
  - `const users = new Map<string, User>()` — the users repository. Reads via `getUserList()`, writes via `users.set(...)` and `users.delete(...)` gated in the authenticate/disconnect handlers.
  - `makeSystemMessage(roomId, content)` — a factory function that encapsulates `ChatMessage` construction, analogous to a repository factory method.

**Why it was the right choice:**
The server needs to store and query two domain aggregates (rooms, users) independently of transport concerns. By centralising access through Map-backed stores and helper functions, the business logic (join a room, broadcast to members, cap history at 50) is separated from I/O. If the storage layer needed to be swapped for Redis or a database, only these helper functions would change.

---

## 5. Strategy Pattern

**What it is:**
The Strategy pattern defines a family of algorithms (or rendering behaviours), encapsulates each one, and makes them interchangeable. A context object delegates to a strategy at runtime based on some discriminant value.

**Where it is used:**
- **File:** `apps/cli/src/components/MessageList.tsx` — `MessageRow` component
  - The discriminant is `msg.type`: `"system"` vs `"message"`.
  - **System strategy:** renders a centered, italic, dimmed gray divider — `── <content> ──`.
  - **Chat strategy:** renders `[HH:MM] <right-padded username in hex color>: <content>`.
  - Both strategies share the same interface — they receive a `MessageRowProps` and return a `React.ReactElement` — so `Static` can render them uniformly.
- **File:** `apps/cli/src/components/InputBox.tsx` — `handleSubmit` function
  - The discriminant is whether the input starts with `/`.
  - **Command strategy:** parses and dispatches `/join` or `/quit`.
  - **Message strategy:** calls `onSend`.

**Why it was the right choice:**
Chat applications need to render heterogeneous message types that look and behave differently but flow through the same data pipeline. Rather than a growing `if/else` chain scattered across the component tree, each rendering strategy is a self-contained block. Adding a new message type (e.g., `"file"`, `"reaction"`) requires only adding a new branch in `MessageRow` without touching the broader rendering infrastructure.
