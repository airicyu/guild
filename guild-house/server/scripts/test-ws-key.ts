#!/usr/bin/env bun
/** Send a single key over attach WS and report whether attach survives */
import { config } from "../src/config";

const missionId = process.argv[2];
const keyArg = process.argv[3] ?? "left";

if (!missionId) {
  console.error("Usage: bun scripts/test-ws-key.ts <missionId> [left|right|a]");
  process.exit(1);
}

const keys: Record<string, string> = {
  left: "\x1b[D",
  right: "\x1b[C",
  up: "\x1b[A",
  down: "\x1b[B",
  a: "a",
};

const data = keys[keyArg] ?? keyArg;
const url = `ws://127.0.0.1:${config.port}/ws/missions/${encodeURIComponent(missionId)}/attach?token=${encodeURIComponent(config.apiKey)}`;

const ws = new WebSocket(url);
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data as string);
  if (msg.type === "connected") {
    console.log("connected, sending key:", keyArg, JSON.stringify(data));
    ws.send(JSON.stringify({ type: "chat_input", data }));
  }
  if (msg.type === "error") console.log("error:", msg.message);
};
ws.onclose = (e) => {
  console.log(`close code=${e.code} reason=${e.reason}`);
  process.exit(0);
};
setTimeout(() => {
  console.log("timeout (attach survived)");
  ws.close();
  process.exit(0);
}, 4000);
