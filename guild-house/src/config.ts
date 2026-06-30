/**
 * Environment → frozen runtime config. Loaded once at import.
 *
 * GUILD_HOME is relative to project root. Slot limits: MAX_ACTIVE_MISSIONS (working),
 * MAX_DISCOVERY_SESSIONS (live discovery leads). UI CORS origins from GUILD_UI_ORIGIN.
 */
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..");

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error(`Invalid integer env ${name}: ${raw}`);
  return n;
}

const PERMISSION_MODES = new Set([
  "default",
  "acceptEdits",
  "plan",
  "auto",
  "dontAsk",
  "bypassPermissions",
]);

const guildHomeRel = process.env.GUILD_HOME ?? "data";
const claudePermissionMode = process.env.CLAUDE_PERMISSION_MODE ?? "acceptEdits";
if (!PERMISSION_MODES.has(claudePermissionMode)) {
  throw new Error(
    `Invalid CLAUDE_PERMISSION_MODE: ${claudePermissionMode} (use ${[...PERMISSION_MODES].join(", ")})`,
  );
}

const guildMasterName =
  (process.env.GUILD_MASTER_NAME ?? "Guild Master").trim() || "Guild Master";

function parseUiOrigins(raw: string | undefined): string[] {
  const defaults = ["http://127.0.0.1:3848", "http://localhost:3848"];
  if (!raw?.trim()) return defaults;
  return raw.split(",").map((o) => o.trim()).filter(Boolean);
}

export const config = {
  projectRoot,
  guildHome: join(projectRoot, guildHomeRel),
  port: envInt("PORT", 3847),
  apiKey: env("GUILD_API_KEY", "dev-key-change-me"),
  claudeCommand: process.env.CLAUDE_COMMAND ?? "claude",
  claudePermissionMode,
  guildMasterName,
  maxActiveMissions: envInt("MAX_ACTIVE_MISSIONS", 4),
  maxDiscoverySessions: envInt("MAX_DISCOVERY_SESSIONS", 2),
  /** 0 = disabled; periodic orchestratorTick (same as POST /bell) */
  tickIntervalMinutes: envInt("GUILD_TICK_INTERVAL_MINUTES", 0),
  uiOrigins: parseUiOrigins(process.env.GUILD_UI_ORIGIN),
} as const;

export type Config = typeof config;
