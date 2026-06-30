#!/usr/bin/env bun
/** Quick WS attach smoke test — uses config.apiKey from .env */
import { config } from "../src/config";

const missionId = process.argv[2];
if (!missionId) {
  console.error("Usage: bun scripts/test-ws-attach.ts <missionId>");
  process.exit(1);
}

const board = await fetch(`http://127.0.0.1:${config.port}/board`, {
  headers: { Authorization: `Bearer ${config.apiKey}` },
}).then((r) => r.json());

console.log("Working missions:", (board as { working: string[] }).working);

const url = `ws://127.0.0.1:${config.port}/ws/missions/${encodeURIComponent(missionId)}/attach?token=${encodeURIComponent(config.apiKey)}`;
console.log("Connecting:", url.replace(config.apiKey, "***"));

const ws = new WebSocket(url);

const timeout = setTimeout(() => {
  console.log("Timeout — closing");
  ws.close();
  process.exit(0);
}, 8000);

ws.onopen = () => console.log("WS open");
ws.onmessage = (e) => console.log("MSG:", e.data);
ws.onerror = () => console.log("WS error");
ws.onclose = (e) => {
  clearTimeout(timeout);
  console.log(`WS close code=${e.code} reason=${e.reason}`);
  process.exit(0);
};
