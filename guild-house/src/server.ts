/**
 * Guild House HTTP + WebSocket entrypoint (Bun.serve).
 *
 * Boot: ensures data layout, recovers working-board PO sessions, then listens.
 * - REST: authenticated except GET /health (version string lives here).
 * - WS: /ws/missions/:id/attach and /ws/discoveries/:id/attach — PTY attach; auth via ?token= or Bearer.
 *   Upgrade bypasses handleRequest; cols/rows query params seed initial PTY size.
 */
import { config } from "./config";
import { requireApiKey } from "./middleware/auth";
import { corsPreflight, withCors } from "./middleware/cors";
import { recoverActiveMissions } from "./orchestrator/mission/lifecycle";
import { startPeriodicTick } from "./orchestrator/tick-scheduler";
import { ensureDataLayout } from "./paths";
import { routeRequest } from "./routes/api";
import {
  extractAttachRoute,
  handleAttachClose,
  handleAttachMessage,
  handleAttachOpen,
  validateWsAuth,
  validateWsOrigin,
  type AttachWsData,
} from "./websocket/attach-pty";

await ensureDataLayout(config);

const bootRecovery = await recoverActiveMissions(config);
if (bootRecovery.length > 0) {
  console.log("Boot recovery:", bootRecovery);
}

const auth = requireApiKey(config);

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

async function handleRequest(req: Request): Promise<Response> {
  const preflight = corsPreflight(config, req);
  if (preflight) return preflight;

  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/health") {
    return withCors(
      config,
      req,
      json({
        ok: true,
        service: "guild-house",
        version: "0.20.0",
        guildHome: config.guildHome,
        guildMasterName: config.guildMasterName,
        tickIntervalMinutes: config.tickIntervalMinutes,
      }),
    );
  }

  const denied = auth(req);
  if (denied) return withCors(config, req, denied);

  const routed = await routeRequest(config, req);
  if (routed) return withCors(config, req, routed);

  return withCors(config, req, json({ error: "Not found" }, 404));
}

console.log(`guild-house listening on http://127.0.0.1:${config.port}`);
console.log(`GUILD_HOME=${config.guildHome}`);
console.log(`WebSocket attach: ws://127.0.0.1:${config.port}/ws/missions/:id/attach?token=<API_KEY>`);
console.log(`WebSocket attach: ws://127.0.0.1:${config.port}/ws/discoveries/:id/attach?token=<API_KEY>`);

startPeriodicTick(config);

const server = Bun.serve<AttachWsData>({
  hostname: "127.0.0.1",
  port: config.port,
  fetch(req, bunServer) {
    const url = new URL(req.url);
    const attachRoute = extractAttachRoute(url.pathname);

    if (attachRoute && req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      if (!validateWsAuth(config, req)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!validateWsOrigin(config, req)) {
        return new Response(JSON.stringify({ error: "Origin not allowed" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const parseDim = (value: string | null, fallback: number): number => {
        const n = value ? Number.parseInt(value, 10) : Number.NaN;
        return Number.isFinite(n) && n > 0 ? n : fallback;
      };
      const initialCols = parseDim(url.searchParams.get("cols"), 80);
      const initialRows = parseDim(url.searchParams.get("rows"), 24);

      const upgraded = bunServer.upgrade(req, {
        data: {
          pipeline: attachRoute.pipeline,
          resourceId: attachRoute.resourceId,
          pty: null,
          lastCols: initialCols,
          lastRows: initialRows,
          attachGen: 0,
        } satisfies AttachWsData,
      });

      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      return undefined as unknown as Response;
    }

    return handleRequest(req);
  },
  websocket: {
    async open(ws) {
      await handleAttachOpen(config, ws);
    },
    message(ws, message) {
      try {
        handleAttachMessage(ws, message);
      } catch (err) {
        console.warn("[attach-pty] Unhandled message error:", err);
      }
    },
    close(ws) {
      handleAttachClose(ws);
    },
  },
});

export { server };
