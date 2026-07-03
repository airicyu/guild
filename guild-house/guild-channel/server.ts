#!/usr/bin/env bun
/**
 * Per-mission-room guild-channel MCP server (Claude Code Channels).
 *
 * Claude Code spawns this via templates/mission-room/.mcp.json. Listens on
 * localhost HTTP; orchestrator POSTs authenticated events → PO session.
 * Writes .guild/channel-endpoint.json with bound port on startup.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const CHANNEL_INSTRUCTIONS = [
  'Events from <channel source="guild-house" ...> are orchestrator directives from Guild House — not user chat.',
  "When you receive a guild-house channel event:",
  "1. Read inbox.md for the full directive text.",
  "2. Read checkpoint.yaml for current phase (do not edit checkpoint.yaml).",
  "3. Follow your playbook for the event type (event attribute on the channel tag).",
  "Act on orchestrator directives promptly; these reflect guild-master or orchestrator actions.",
].join(" ");

/** MCP subprocess often lacks orchestrator env — fall back to guild-house/.env (../../../.env from room cwd). */
async function resolveChannelSecret(): Promise<string> {
  if (process.env.GUILD_CHANNEL_SECRET) return process.env.GUILD_CHANNEL_SECRET;
  if (process.env.GUILD_API_KEY) return process.env.GUILD_API_KEY;

  const envPath = join(process.cwd(), "../../../.env");
  try {
    const text = await readFile(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      if (trimmed.startsWith("GUILD_CHANNEL_SECRET=")) {
        return trimmed.slice("GUILD_CHANNEL_SECRET=".length).trim();
      }
      if (trimmed.startsWith("GUILD_API_KEY=")) {
        return trimmed.slice("GUILD_API_KEY=".length).trim();
      }
    }
  } catch {
    // room cwd may differ during local tests
  }
  return "";
}

const CHANNEL_SECRET = await resolveChannelSecret();

function channelLog(message: string, extra?: Record<string, unknown>): void {
  const suffix = extra ? ` ${JSON.stringify(extra)}` : "";
  console.error(`[guild-channel] ${message}${suffix}`);
}

function authorize(req: Request): boolean {
  if (!CHANNEL_SECRET) {
    console.error("[guild-channel] No GUILD_API_KEY or GUILD_CHANNEL_SECRET — rejecting all POSTs");
    return false;
  }
  const auth = req.headers.get("Authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] === CHANNEL_SECRET;
}

const mcp = new Server(
  { name: "guild-house", version: "0.1.0" },
  {
    capabilities: { experimental: { "claude/channel": {} } },
    instructions: CHANNEL_INSTRUCTIONS,
  },
);

await mcp.connect(new StdioServerTransport());

const guildDir = join(process.cwd(), ".guild");
await mkdir(guildDir, { recursive: true });

const server = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  async fetch(req) {
    if (req.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }
    if (!authorize(req)) {
      return new Response("forbidden", { status: 403 });
    }

    const contentType = req.headers.get("Content-Type") ?? "";
    let content: string;
    let event = req.headers.get("X-Guild-Event") ?? "orchestrator_directive";

    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { content?: string; event?: string };
      content = body.content ?? "";
      if (body.event) event = body.event;
    } else {
      content = await req.text();
    }

    if (!content.trim()) {
      channelLog("reject empty body", { port: server.port });
      return new Response("empty body", { status: 400 });
    }

    channelLog("POST received", {
      port: server.port,
      event,
      contentBytes: content.length,
      cwd: process.cwd(),
    });

    try {
      await mcp.notification({
        method: "notifications/claude/channel",
        params: {
          content,
          meta: { event },
        },
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      channelLog("notification failed", { port: server.port, event, reason });
      return new Response(`notification failed: ${reason}`, { status: 502 });
    }

    channelLog("notification sent", { port: server.port, event });
    return new Response("ok");
  },
});

const endpoint = {
  host: "127.0.0.1",
  port: server.port,
  path: "/",
};
await writeFile(join(guildDir, "channel-endpoint.json"), `${JSON.stringify(endpoint, null, 2)}\n`, "utf8");
channelLog("listening", endpoint);
