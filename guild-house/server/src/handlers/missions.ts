import { approveDiscovery } from "../orchestrator/discovery/approve";
import { getIdeaDrafts } from "../orchestrator/discovery/drafts";
import { approveMissionArtifacts } from "../orchestrator/mission/approve-artifacts";
import { rejectMissionArtifacts } from "../orchestrator/mission/reject-artifacts";
import { abortMission } from "../orchestrator/mission/abort-mission";
import { appendEventEntry, getEventsSummary } from "../orchestrator/mission/events";
import {
  archiveMission,
  handleSignal,
  pauseMission,
  resumeMission,
} from "../orchestrator/mission/lifecycle";
import {
  escalateToGuildMaster,
  getMissionOutboxSummary,
  markOutboxRead,
} from "../orchestrator/mission/outbox";
import { getMission, getMissionSession, listMissions } from "../orchestrator/mission/pickup";
import {
  getMissionBrief,
  getMissionSummary,
  readMissionRoomFile,
} from "../orchestrator/mission/room-read";
import {
  buildMissionSessionInfo,
  restoreMissionSession,
  syncActiveMission,
} from "../orchestrator/mission/session-lifecycle";
import type { EscalateRequest, EventLogRequest, SignalRequest } from "../types/mission";
import type { Config } from "../config";
import {
  mapDiscovering,
  mapMissionActive,
  mapNotFound,
  mapOrchestratorError,
  readJsonBody,
} from "../errors";
import type { RoutesSlice } from "../routes";

async function readOptionalOutboxIds(req: Request): Promise<string[] | undefined> {
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return undefined;
  return (await readJsonBody<{ ids?: string[] }>(req)).ids;
}

export function missionRoutes(config: Config): RoutesSlice {
  return {
    "/missions": { GET: async () => Response.json(await listMissions(config)) },
    "/missions/:id/drafts": {
      GET: async (req) => {
        try {
          const drafts = await getIdeaDrafts(config, req.params.id);
          if (!drafts) return Response.json({ error: "Mission not found" }, { status: 404 });
          return Response.json(drafts);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
    "/missions/:id/approve-discovery": {
      POST: async (req) => {
        try {
          const result = await approveDiscovery(config, req.params.id);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return mapOrchestratorError(err, mapDiscovering);
        }
      },
    },
    "/missions/:id/brief": {
      GET: async (req) => {
        try {
          const brief = await getMissionBrief(config, req.params.id);
          if (!brief) return Response.json({ error: "Brief not found" }, { status: 404 });
          return Response.json(brief);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
    "/missions/:id/summary": {
      GET: async (req) => {
        try {
          const summary = await getMissionSummary(config, req.params.id);
          if (!summary) return Response.json({ error: "Mission not found" }, { status: 404 });
          return Response.json(summary);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
    "/missions/:id/room/*": {
      GET: async (req) => {
        try {
          const filePath = new URL(req.url).pathname.slice(`/missions/${req.params.id}/room/`.length);
          const file = await readMissionRoomFile(config, req.params.id, filePath);
          if (!file) return Response.json({ error: "File not found" }, { status: 404 });
          return Response.json(file);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
    "/missions/:id/session": {
      GET: async (req) => {
        try {
          const ensureLive = new URL(req.url).searchParams.get("ensureLive") === "true";
          const session = await getMissionSession(config, req.params.id, { ensureLive });
          if (!session) return Response.json({ error: "Mission session not found" }, { status: 404 });
          return Response.json(session);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
    "/missions/:id/restore": {
      POST: async (req) => {
        try {
          const result = await restoreMissionSession(config, req.params.id);
          const synced = await syncActiveMission(config, req.params.id);
          const session =
            synced &&
            buildMissionSessionInfo(config, req.params.id, synced.checkpoint, {
              processLive: synced.live,
              jobState: synced.jobState,
            });
          return Response.json({ ok: true, missionId: req.params.id, ...result, session });
        } catch (err) {
          return mapOrchestratorError(err, mapMissionActive);
        }
      },
    },
    "/missions/:id/signals": {
      POST: async (req) => {
        try {
          const body = await readJsonBody<SignalRequest>(req);
          if (!body.type) return Response.json({ error: "Missing signal type" }, { status: 400 });
          const checkpoint = await handleSignal(config, req.params.id, body);
          return Response.json({ ok: true, missionId: req.params.id, checkpoint });
        } catch (err) {
          return mapOrchestratorError(err, mapMissionActive);
        }
      },
    },
    "/missions/:id/pause": {
      POST: async (req) => {
        try {
          const checkpoint = await pauseMission(config, req.params.id);
          return Response.json({ ok: true, missionId: req.params.id, checkpoint });
        } catch (err) {
          return mapOrchestratorError(err, mapMissionActive);
        }
      },
    },
    "/missions/:id/resume": {
      POST: async (req) => {
        try {
          const result = await resumeMission(config, req.params.id);
          const synced = await syncActiveMission(config, req.params.id);
          const session =
            synced &&
            buildMissionSessionInfo(config, req.params.id, synced.checkpoint, {
              processLive: synced.live,
              jobState: synced.jobState,
            });
          return Response.json({ ok: true, missionId: req.params.id, ...result, session });
        } catch (err) {
          return mapOrchestratorError(err, mapMissionActive);
        }
      },
    },
    "/missions/:id/archive": {
      POST: async (req) => {
        try {
          const checkpoint = await archiveMission(config, req.params.id);
          return Response.json({ ok: true, missionId: req.params.id, checkpoint });
        } catch (err) {
          return mapOrchestratorError(err, [
            mapNotFound,
            (m) =>
              m.includes("must be phase done") ||
              m.includes("mission_plan_complete") ||
              m.includes("must be phase aborted")
                ? Response.json({ error: m }, { status: 409 })
                : null,
          ]);
        }
      },
    },
    "/missions/:id/approve-artifacts": {
      POST: async (req) => {
        try {
          const result = await approveMissionArtifacts(config, req.params.id);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return mapOrchestratorError(err, [
            mapNotFound,
            (m) =>
              m.includes("must be awaiting_artifact_review")
                ? Response.json({ error: m }, { status: 409 })
                : null,
          ]);
        }
      },
    },
    "/missions/:id/reject-artifacts": {
      POST: async (req) => {
        try {
          const body = await readJsonBody<{ reason?: string; notes?: string }>(req);
          const result = await rejectMissionArtifacts(config, req.params.id, body);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return mapOrchestratorError(err, [
            mapNotFound,
            (m) =>
              m.includes("must be awaiting_artifact_review")
                ? Response.json({ error: m }, { status: 409 })
                : null,
          ]);
        }
      },
    },
    "/missions/:id/abort": {
      POST: async (req) => {
        try {
          const body = await readJsonBody<{ reason?: string }>(req);
          const result = await abortMission(config, req.params.id, body);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return mapOrchestratorError(err, [
            mapNotFound,
            (m) =>
              m.includes("already terminal") ? Response.json({ error: m }, { status: 409 }) : null,
          ]);
        }
      },
    },
    "/missions/:id/outbox": {
      GET: async (req) => {
        try {
          await syncActiveMission(config, req.params.id);
          const outbox = await getMissionOutboxSummary(config, req.params.id);
          if (!outbox) return Response.json({ error: "Mission not found" }, { status: 404 });
          return Response.json(outbox);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
    "/missions/:id/outbox/read": {
      POST: async (req) => {
        try {
          const ids = await readOptionalOutboxIds(req);
          const result = await markOutboxRead(config, req.params.id, ids);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return mapOrchestratorError(err, [mapNotFound]);
        }
      },
    },
    "/missions/:id/escalate": {
      POST: async (req) => {
        try {
          const body = await readJsonBody<EscalateRequest>(req);
          if (!body.question) return Response.json({ error: "Missing question" }, { status: 400 });
          const result = await escalateToGuildMaster(config, req.params.id, body);
          return Response.json({ ok: true, missionId: req.params.id, ...result });
        } catch (err) {
          return mapOrchestratorError(err, mapMissionActive);
        }
      },
    },
    "/missions/:id/events": {
      GET: async (req) => {
        try {
          await syncActiveMission(config, req.params.id);
          const events = await getEventsSummary(config, req.params.id);
          if (!events) return Response.json({ error: "Mission not found" }, { status: 404 });
          return Response.json(events);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 400 });
        }
      },
      POST: async (req) => {
        try {
          const body = await readJsonBody<EventLogRequest>(req);
          if (!body.from) return Response.json({ error: "Missing from" }, { status: 400 });
          if (!body.body) return Response.json({ error: "Missing body" }, { status: 400 });
          if (!body.type) return Response.json({ error: "Missing type" }, { status: 400 });
          const entry = await appendEventEntry(config, req.params.id, body);
          return Response.json({ ok: true, missionId: req.params.id, entry });
        } catch (err) {
          return mapOrchestratorError(err, mapMissionActive);
        }
      },
    },
    "/missions/:id": {
      GET: async (req) => {
        try {
          const mission = await getMission(config, req.params.id);
          if (!mission) return Response.json({ error: "Mission not found" }, { status: 404 });
          return Response.json(mission);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  };
}
