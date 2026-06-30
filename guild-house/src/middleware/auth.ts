/**
 * REST Bearer-token gate. Returns middleware that yields 401 Response or null (ok).
 * /health is exempt. WebSocket attach uses separate auth in attach-pty.ts.
 */
import type { Config } from "../config";

/** Return middleware that rejects requests without valid Bearer token (except /health). */
export function requireApiKey(config: Config) {
  return (req: Request): Response | null => {
    const url = new URL(req.url);
    if (url.pathname === "/health") return null;

    const header = req.headers.get("authorization");
    const expected = `Bearer ${config.apiKey}`;

    if (header !== expected) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    return null;
  };
}
