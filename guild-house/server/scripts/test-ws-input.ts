#!/usr/bin/env bun
/** Send chat_input over attach WS and watch for pty_output */
import { config } from "../src/config";

const missionId = process.argv[2] ?? "terminal-smoke-20260627-0efa16";
const url = `ws://127.0.0.1:${config.port}/ws/missions/${encodeURIComponent(missionId)}/attach?token=${encodeURIComponent(config.apiKey)}`;

console.log("connecting", missionId);

const ws = new WebSocket(url);
let connected = false;
let outputsAfterInput = 0;

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data as string);
  if (msg.type === "connected") {
    connected = true;
    console.log("connected");
    setTimeout(() => {
      console.log("sending chat_input");
      ws.send(JSON.stringify({ type: "chat_input", data: "hello\r" }));
      setTimeout(() => {
        console.log("outputs after input:", outputsAfterInput);
        ws.close();
      }, 3000);
    }, 2000);
  } else if (msg.type === "pty_output") {
    if (connected) outputsAfterInput++;
    if (msg.data?.includes?.("hello")) console.log("saw hello in output");
  } else if (msg.type === "error") {
    console.log("error", msg.message);
  }
};

ws.onclose = (e) => {
  console.log("close", e.code, e.reason);
  process.exit(0);
};

setTimeout(() => {
  console.log("timeout");
  ws.close();
  process.exit(1);
}, 15000);
