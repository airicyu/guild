/**
 * CORS for the web UI — allowlist from config.uiOrigins only (no wildcard *).
 * Applied via withCors on REST responses; OPTIONS preflight handled separately.
 */
import type { Config } from "../config";

const DEFAULT_ORIGINS = ["http://127.0.0.1:3848", "http://localhost:3848"];

/** Parse GUILD_UI_ORIGIN comma list; defaults to local dev UI ports. */
export function parseUiOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return DEFAULT_ORIGINS;
  return raw.split(",").map((o) => o.trim()).filter(Boolean);
}

/** Build Access-Control-* headers when Origin matches allowlist. */
export function corsHeaders(config: Config, req: Request): HeadersInit {
  const origin = req.headers.get("Origin");
  if (!origin || !config.uiOrigins.includes(origin)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    Vary: "Origin",
  };
}

/** Merge CORS headers onto a REST response. */
export function withCors(config: Config, req: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(config, req))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
