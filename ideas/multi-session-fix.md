# Multi-Session Attach Fix

**狀態**: backlog  
**日期**: 2026-07-09

## 問題

目前 `attach-pty.ts` 只支援**一個 browser tab 對一個 mission terminal**。當兩個 browser tab 同時打開同一個 mission 的 terminal 時，新 tab 會踢掉舊 tab 的 WebSocket 連線。

### 現行行為

| 場景 | 行為 |
|------|------|
| 兩個 tab，不同 mission | ✅ 正常，各有各的 PTY |
| 兩個 tab，同一個 mission | ❌ 新 tab 踢掉舊的（code 4000 "superseded"），舊 tab 畫面凍結 |

### 根因

`attach-pty.ts` 中的 `activeAttachByKey` 是 `Map<string, ServerWebSocket>`，每個 resource key 只存一個 WS client：

```typescript
// attach-pty.ts:62-63
const activeAttachByKey = new Map<string, ServerWebSocket<AttachWsData>>();

// attach-pty.ts:153-166
function supersedeAttach(ws) {
  const existing = activeAttachByKey.get(key);
  if (existing && existing !== ws) {
    existing.data.superseded = true;
    existing.close(4000, "superseded");  // 踢掉舊的
  }
  activeAttachByKey.set(key, ws);  // 新的取代
}

// attach-pty.ts:75-78
function broadcastToClient(key, message) {
  const ws = activeAttachByKey.get(key);  // 只取一個
  if (ws) send(ws, message);              // 只發給一個
}
```

原始動機是防止 React StrictMode 雙重 mount 造成重複建立 PTY，但副作用是禁止了多 tab 同時觀看。

## 目標

支援多個 browser tab 同時 attach 到同一個 mission 的 terminal。底層 PTY 只有一個，Bun server 做 multiplexing。

```
Browser-1 ──WS──┐
Browser-2 ──WS──┼── Bun Server ──PTY── claude (只有一個)
Browser-3 ──WS──┘
```

## 需要改動的地方

### 1. `activeAttachByKey` 改為支援多 client

```typescript
// 從 Map<key, WS> 改成 Map<key, Set<WS>>
const activeAttachByKey = new Map<string, Set<ServerWebSocket<AttachWsData>>>();
```

### 2. `broadcastToClient` 改為 broadcast

```typescript
function broadcastToClient(key: string, message: AttachMessage): void {
  const clients = activeAttachByKey.get(key);
  if (!clients) return;
  for (const ws of clients) {
    send(ws, message);
  }
}
```

### 3. `supersedeAttach` → `addAttachClient`

不再踢人，改成加入 set：

```typescript
function addAttachClient(ws: ServerWebSocket<AttachWsData>): void {
  const key = terminalKey(ws.data.pipeline, ws.data.resourceId);
  let clients = activeAttachByKey.get(key);
  if (!clients) {
    clients = new Set();
    activeAttachByKey.set(key, clients);
  }
  clients.add(ws);
}
```

### 4. `handleAttachClose` → remove from set

只有當**最後一個 client** 離開時才 kill server PTY：

```typescript
function handleAttachClose(ws: ServerWebSocket<AttachWsData>): void {
  const key = terminalKey(ws.data.pipeline, ws.data.resourceId);
  const clients = activeAttachByKey.get(key);
  if (clients) {
    clients.delete(ws);
    if (clients.size === 0) {
      activeAttachByKey.delete(key);
      killServerTerminal(key);  // 最後一個離開才 kill
    }
  }
}
```

### 5. Input 處理

多個 client 同時打字 → PTY 本身就是 sequential 的，先到先寫，不需要 lock。`handleAttachMessage` 中的 `safeAttachWrite` 邏輯不變。

### 6. Resize 衝突

多個 client 視窗大小不同，PTY 用誰的 cols/rows？

- **最後一個 resize 的為準**（建議，最簡單）
- 取 max(cols), max(rows)（給最大空間，但小視窗可能顯示不完整）

### 7. 新 client 加入時的狀態同步

新連上的 client 需要看到當前畫面。PTY 沒有 scrollback buffer 快照機制。

- 選項 A：不做快照，新 client 從加入那一刻開始看（最簡單）
- 選項 B：server 端 buffer 最近 N 行輸出，新 client 加入時 replay

## 相關檔案

- `guild-house/server/src/websocket/attach-pty.ts` — 主要改動
- `guild-house/web/src/features/terminal/AttachTerminalPane.tsx` — WS onclose 處理（目前 code 4000 時顯示 disconnected，可能需調整）