import type { Serve } from "bun";
import { config } from "./config";
import { corsHeaders, withCors } from "./middleware/cors";
import { recoverActiveMissions } from "./orchestrator/mission/lifecycle";
import { startPeriodicTick } from "./orchestrator/tick-scheduler";
import { ensureDataLayout } from "./paths";
import { ensureSkillsBankLayout } from "./orchestrator/skills-bank/layout";
import { buildRoutes } from "./routes";
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
await ensureSkillsBankLayout(config);

const bootRecovery = await recoverActiveMissions(config);
if (bootRecovery.length > 0) console.log("Boot recovery:", bootRecovery);

startPeriodicTick(config);

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: config.port,
  routes: buildRoutes(config),
  fetch(req, server) {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(config, req) });
    }

    const url = new URL(req.url);
    const attach = extractAttachRoute(url.pathname);
    if (attach && req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      if (!validateWsAuth(config, req)) {
        return withCors(config, req, Response.json({ error: "Unauthorized" }, { status: 401 }));
      }
      if (!validateWsOrigin(config, req)) {
        return withCors(config, req, Response.json({ error: "Origin not allowed" }, { status: 403 }));
      }
      const cols = Number(url.searchParams.get("cols")) || 80;
      const rows = Number(url.searchParams.get("rows")) || 24;
      if (
        server.upgrade(req, {
          data: {
            pipeline: attach.pipeline,
            resourceId: attach.resourceId,
            pty: null,
            lastCols: cols > 0 ? cols : 80,
            lastRows: rows > 0 ? rows : 24,
            attachGen: 0,
          } satisfies AttachWsData,
        })
      ) {
        return;
      }
      return withCors(config, req, new Response("WebSocket upgrade failed", { status: 400 }));
    }

    return withCors(config, req, Response.json({ error: "Not found" }, { status: 404 }));
  },
  websocket: {
    data: {} as AttachWsData,
    async open(ws) {
      await handleAttachOpen(config, ws);
    },
    message(ws, message) {
      try {
        handleAttachMessage(ws, message);
      } catch (err) {
        console.warn("[attach-pty]", err);
      }
    },
    close(ws) {
      handleAttachClose(ws);
    },
  },
  error(err) {
    console.error(err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  },
} satisfies Serve.Options<AttachWsData>);

console.log(`guild-house ${server.url}`);
console.log(`GUILD_HOME=${config.guildHome}`);
console.log(`WebSocket attach: ws://127.0.0.1:${config.port}/ws/missions/:id/attach?token=<API_KEY>`);

export { server };
