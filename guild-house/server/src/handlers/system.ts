import { listUnreadOutbox } from "../orchestrator/mission/outbox";
import { recoverActiveMissions } from "../orchestrator/mission/lifecycle";
import type { Config } from "../config";
import type { RoutesSlice } from "../routes";

export function systemRoutes(config: Config): RoutesSlice {
  return {
    "/outbox": {
      GET: async () => {
        const items = await listUnreadOutbox(config);
        return Response.json({ items, count: items.length });
      },
    },
    "/recover": {
      POST: async () => Response.json({ ok: true, recovered: await recoverActiveMissions(config) }),
    },
  };
}
