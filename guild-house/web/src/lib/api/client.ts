import { getApiKeyOrDefault } from "../auth";

const BASE = import.meta.env.VITE_GUILD_API_URL ?? "/api";

/** WebSocket attach URL (dev: Vite proxies /ws → :3847). Auth via ?token= query param. */
function buildAttachWebSocketUrl(path: string, cols?: number, rows?: number): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const token = encodeURIComponent(getApiKeyOrDefault());
  const params = new URLSearchParams({ token });
  if (cols !== undefined && cols > 0) params.set("cols", String(cols));
  if (rows !== undefined && rows > 0) params.set("rows", String(rows));
  return `${protocol}//${window.location.host}${path}?${params}`;
}

export function attachWebSocketUrl(missionId: string, cols?: number, rows?: number): string {
  return buildAttachWebSocketUrl(
    `/ws/missions/${encodeURIComponent(missionId)}/attach`,
    cols,
    rows,
  );
}

export function discoveryAttachWebSocketUrl(ideaId: string, cols?: number, rows?: number): string {
  return attachWebSocketUrl(ideaId, cols, rows);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  // /health is unauthenticated; all other routes require Bearer token.
  const { auth = path !== "/health", ...init } = options;
  const headers = new Headers(init.headers);

  if (auth) {
    headers.set("Authorization", `Bearer ${getApiKeyOrDefault()}`);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const body = await parseJson(res);

  if (!res.ok) {
    const msg =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: string }).error)
        : res.statusText;
    throw new ApiError(msg || `HTTP ${res.status}`, res.status, body);
  }

  return body as T;
}

export interface HealthResponse {
  ok: boolean;
  service: string;
  version: string;
  guildHome: string;
  guildMasterName: string;
  tickIntervalMinutes?: number;
  /** Orchestrator HTTP push to live PO via guild-channel (GUILD_CHANNEL_PUSH=1). */
  channelPushEnabled?: boolean;
  /** Ephemeral attach poke on guild-master directives (GUILD_SESSION_POKE, default on). */
  sessionPokeEnabled?: boolean;
}

export function fetchHealth() {
  return apiFetch<HealthResponse>("/health", { auth: false });
}
