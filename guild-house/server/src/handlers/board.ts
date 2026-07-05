import { listBoard } from "../orchestrator/core/board";
import { promoteIdeasBacklogToIdeas } from "../orchestrator/discovery/promote-backlog";
import { promoteParkingToQueued } from "../orchestrator/mission/promote";
import { getQueue } from "../orchestrator/mission/pickup";
import { orchestratorTick } from "../orchestrator/tick";
import type { Config } from "../config";
import { mapOrchestratorError, mapPromote } from "../errors";
import type { RoutesSlice } from "../routes";

export function boardRoutes(config: Config): RoutesSlice {
  return {
    "/board": { GET: async () => Response.json(await listBoard(config)) },
    "/queue": { GET: async () => Response.json(await getQueue(config)) },
    "/bell": { POST: async () => Response.json(await orchestratorTick(config)) },
    "/board/ideas-backlog/:id/promote": {
      POST: async (req) => {
        try {
          const result = await promoteIdeasBacklogToIdeas(config, req.params.id);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return mapOrchestratorError(err, mapPromote);
        }
      },
    },
    "/board/parking/:folder/promote": {
      POST: async (req) => {
        try {
          const result = await promoteParkingToQueued(config, req.params.folder);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return mapOrchestratorError(err, mapPromote);
        }
      },
    },
  };
}
