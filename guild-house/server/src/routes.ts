import type { BunRequest } from "bun";
import type { Config } from "./config";
import { withCors } from "./middleware/cors";
import { boardRoutes } from "./handlers/board";
import { boardNoteRoutes } from "./handlers/board-notes";
import { missionRoutes } from "./handlers/missions";
import { skillsBankRoutes } from "./handlers/skills-bank";
import { systemRoutes } from "./handlers/system";

type Handler = (req: BunRequest) => Promise<Response> | Response;
export type RoutesSlice = Record<string, Partial<Record<"GET" | "POST", Handler>>>;

function requireAuth(config: Config, req: Request): Response | null {
  const header = req.headers.get("authorization");
  if (header === `Bearer ${config.apiKey}`) return null;
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

/** Bun.serve routes — https://bun.com/docs/runtime/http/routing */
export function buildRoutes(config: Config): RoutesSlice {
  const wrap =
    (handler: Handler): Handler =>
    async (req) => {
      const denied = requireAuth(config, req);
      if (denied) return withCors(config, req, denied);
      return withCors(config, req, await handler(req));
    };

  const routes: RoutesSlice = {
    "/health": {
      GET: (req) =>
        withCors(
          config,
          req,
          Response.json({
            ok: true,
            service: "guild-house",
            version: "0.34.0",
            guildHome: config.guildHome,
            guildMasterName: config.guildMasterName,
            tickIntervalMinutes: config.tickIntervalMinutes,
            channelPushEnabled: config.channelPushEnabled,
            sessionPokeEnabled: config.sessionPokeEnabled,
          }),
        ),
    },
  };

  for (const [path, methods] of Object.entries({
    ...boardRoutes(config),
    ...boardNoteRoutes(config),
    ...skillsBankRoutes(config),
    ...systemRoutes(config),
    ...missionRoutes(config),
  })) {
    routes[path] = {};
    for (const [method, handler] of Object.entries(methods)) {
      routes[path]![method as "GET" | "POST"] = wrap(handler!);
    }
  }

  return routes;
}
