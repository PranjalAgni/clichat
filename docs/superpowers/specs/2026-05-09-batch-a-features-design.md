# Batch A Features Design — Typing Indicators, @Mentions, Input History, Tab Completion

**Date:** 2026-05-09  
**Status:** Draft

---

## Overview

Four features that make clichat feel like a real, polished chat product rather than a demo:

1. **Typing indicators** — show when another user is composing a message
2. **@mention highlighting** — highlight your username in messages, badge the room
3. **Input history** — navigate previously sent messages with Up/Down arrow
4. **Tab completion** — autocomplete @username and /commands with Tab

These are all client-focused except typing indicators, which requires a new server event round-trip.

---

## 1. Typing Indicators

### What it does
When a user is typing (input non-empty), their username appears in a "… is typing" bar above the input box. Multiple typers: "alice and bob are typing". After 2s of inactivity or on send, the indicator clears.

### Server changes
Two new socket events added to the shared types:

```typescript
// ClientToServerEvents
"typing:start": (roomId: string) => void;
"typing:stop": (roomId: string) => void;

// ServerToClientEvents
"typing:update": (roomId: string, usernames: string[]) => void;
```

Server keeps a `Map<roomId, Set<socketId>>` of active typers per room. On `typing:start`, adds the user and broadcasts the updated list to the room (excluding sender). On `typing:stop` or disconnect, removes and re-broadcasts. Server also auto-clears a user after 3s with a per-user debounce timer.

### Client changes
- `useSocket` hook: expose `startTyping(roomId)` and `stopTyping(roomId)` callbacks, and `typingUsers: string[]` state (usernames currently typing in the current room).
- `InputBox`: on `onChange` when value becomes non-empty → call `startTyping`. On submit or value becomes empty → call `stopTyping`. Debounce: don't re-emit `typing:start` more than once per 1s.
- New `TypingIndicator` component rendered between the message list and input box:
  ```
  ● alice is typing...
  ● alice and bob are typing...
  ```
  Shown only when `typingUsers.length > 0` and height is exactly 1 row.

### Data flow
```
InputBox onChange (non-empty) → startTyping() → socket.emit("typing:start", roomId)
  → server adds to typers → broadcasts typing:update to room
  → useSocket updates typingUsers state → TypingIndicator renders
InputBox onSubmit / value empty → stopTyping() → clears indicator
```

---

## 2. @Mention Highlighting

### What it does
When a message contains `@<your-username>` (case-insensitive):
- The `@username` token in the message text is rendered in bold yellow instead of default white
- The room in the sidebar sets `hasNewMention: true` → red dot badge
- The room header flashes briefly (1 render cycle bold) to draw attention

### Implementation

**Message rendering** — `MessageRow` in `MessageList.tsx` receives `currentUsername: string` prop. When rendering a chat message, split `msg.content` on `/@(\w+)/g`. For each token: if it matches `currentUsername` (case-insensitive), render as `chalk.hex("#FFD700").bold("@username")`; otherwise render as plain text. This is pure client-side, no server changes needed.

**Mention badge** — The server already has `hasNewMention: boolean` on `Room`. Currently it's always `false`. The server now checks on `message:send`: if `content` contains `@<username>` for any member of the room, sets `hasNewMention: true` on that member's room view. This is tracked per-user so only the mentioned user sees the badge.

Implementation: server maintains a `Map<socketId, Set<roomId>>` for pending mentions. When `room:joined` or `room:list` is emitted, `hasNewMention` reflects that map. When the user joins the room, the mention is cleared.

**Props threading** — `currentUsername` is already available in `ChatApp` from the `username` prop. Thread it down: `ChatLayout` → `MessageList` → `MessageRow`.

---

## 3. Input History

### What it does
After sending a message, pressing Up arrow cycles back through previously sent messages (most recent first). Down arrow moves forward. Pressing Up when at the top stays at the oldest. Pressing Down when at the most recent restores the live draft.

### Implementation
Lives entirely in `InputBox`. No server changes.

```typescript
const [history, setHistory] = useState<string[]>([]);
const [historyIndex, setHistoryIndex] = useState<number>(-1);
const [draft, setDraft] = useState<string>(""); // saved live input before navigating
```

On submit: prepend to `history` (cap at 50 entries), reset `historyIndex` to `-1`, clear `draft`.

`useInput` in `InputBox` (in addition to `TextInput`'s own handler):
- `key.upArrow`: if `historyIndex === -1`, save current input to `draft`; increment index; set input to `history[newIndex]`.
- `key.downArrow`: if `historyIndex > 0`, decrement; set input to `history[newIndex]`. If `historyIndex === 0`, set to `-1` and restore `draft`.

`TextInput` already has `useInput` internally, so we need to use Ink's `useInput` with `{ isActive: true }` and handle Up/Down ourselves before the text input sees them — Ink's `TextInput` ignores `upArrow`/`downArrow` (verified in source).

---

## 4. Tab Completion

### What it does
Press Tab while typing to autocomplete:
- `@` prefix → complete to `@username` from the online user list
- `/` prefix → complete to a slash command (`/join`, `/quit`, `/exit`)
- Cycles through candidates on repeated Tab presses

### Implementation
Lives entirely in `InputBox`. No server changes. Receives `users: User[]` as a new prop (passed from `ChatLayout`).

```typescript
const [completionCandidates, setCompletionCandidates] = useState<string[]>([]);
const [completionIndex, setCompletionIndex] = useState<number>(0);
```

`useInput` in `InputBox`, intercept `key.tab`:
1. Get the current word being typed (everything after the last space).
2. If word starts with `@`: filter `users` whose username starts with `word.slice(1)` (case-insensitive). Candidates = `["@alice", "@bob", ...]`.
3. If word starts with `/`: filter `["/join", "/quit", "/exit"]` by prefix.
4. If no match: do nothing (don't insert a tab character).
5. If one candidate: replace the current word with the candidate + space.
6. If multiple: cycle through on repeated Tab (increment `completionIndex % candidates.length`), replace word in-place each time.

Reset `completionCandidates` whenever the user types any non-Tab key.

---

## Architecture Changes Summary

### `packages/types/src/index.ts`
- Add `"typing:start"` and `"typing:stop"` to `ClientToServerEvents`
- Add `"typing:update"` to `ServerToClientEvents`

### `apps/server/src/index.ts`
- Add `typingTimers: Map<socketId, NodeJS.Timeout>` for auto-clear
- Add `roomTypers: Map<roomId, Set<socketId>>` for per-room state
- Handle `typing:start`, `typing:stop` events
- Check for `@mention` on `message:send`, update per-user mention state
- Include per-user `hasNewMention` in `room:list` and `room:joined` responses

### `apps/cli/src/hooks/useSocket.ts`
- Add `typingUsers: string[]` state
- Add `startTyping` / `stopTyping` callbacks
- Handle `typing:update` event

### `apps/cli/src/components/InputBox.tsx`
- Add input history (Up/Down)
- Add tab completion (Tab)
- Add typing emit on onChange/onSubmit
- Accept `users: User[]` and `currentUsername: string` as new props

### `apps/cli/src/components/TypingIndicator.tsx` (new)
- Renders "X is typing…" or "X and Y are typing…" in 1 row

### `apps/cli/src/components/MessageList.tsx`
- Accept `currentUsername: string` prop
- Pass to `MessageRow` for mention highlighting

### `apps/cli/src/components/ChatLayout.tsx`
- Pass `users`, `currentUsername` to `InputBox`
- Pass `currentUsername` to `MessageList`
- Render `TypingIndicator` between message list and input

---

## Constraints & Edge Cases

- **Typing indicator self-exclusion**: a user must never see their own "is typing" indicator.
- **Tab completion doesn't insert literal tab**: if no candidates match, Tab is swallowed silently.
- **History cap**: 50 entries max to avoid unbounded memory growth.
- **Mention detection**: case-insensitive, word-boundary match (`@pranjal` matches username `Pranjal`).
- **Typing debounce**: `typing:start` re-emitted at most once per 1s to avoid flooding the server.
- **Server auto-clear**: if a client goes silent for 3s (no `typing:stop`), server removes them from typers and re-broadcasts — handles cases where the client crashes mid-type.
