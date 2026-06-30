/**
 * REST route table — maps HTTP paths to orchestrator functions.
 *
 * Returns null for unknown routes (server → 404). Most GETs are read-only;
 * session restore only on POST /restore, POST /resume, GET .../session?ensureLive=true.
 * Discovery + mission error mapping uses message string matching (keep in sync with throws).
 */
import type { Config } from "../config";
import { listBoard } from "../orchestrator/core/board";
import {
  escalateToGuildMaster,
  getMissionOutboxSummary,
  listUnreadOutbox,
  markOutboxRead,
} from "../orchestrator/mission/outbox";
import { appendEventEntry, getEventsSummary } from "../orchestrator/mission/events";
import {
  archiveMission,
  handleSignal,
  pauseMission,
  recoverActiveMissions,
  resumeMission,
} from "../orchestrator/mission/lifecycle";
import {
  getMission,
  getMissionSession,
  getQueue,
  listMissions,
} from "../orchestrator/mission/pickup";
import { orchestratorTick } from "../orchestrator/tick";
import { promoteParkingToQueued } from "../orchestrator/mission/promote";
import { createIdea, getIdea, listIdeas } from "../orchestrator/discovery/ideas";
import { approveDiscovery } from "../orchestrator/discovery/approve";
import { getIdeaDrafts } from "../orchestrator/discovery/drafts";
import { appendDiscoveryEventEntry, getDiscoveryEventsSummary } from "../orchestrator/discovery/events";
import {
  buildDiscoverySessionInfo,
  getDiscoverySession,
  restoreDiscoverySession,
  syncActiveDiscovery,
} from "../orchestrator/discovery/session-lifecycle";
import { handleDiscoverySignal } from "../orchestrator/discovery/lifecycle";
import {
  escalateDiscoveryToGuildMaster,
  getDiscoveryOutboxSummary,
  markDiscoveryOutboxRead,
} from "../orchestrator/discovery/outbox";
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
import type { CreateIdeaRequest, DiscoveryEventLogRequest, DiscoverySignalRequest } from "../types/discovery";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function notFound(message = "Not found"): Response {
  return json({ error: message }, 404);
}

function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

function conflict(message: string): Response {
  return json({ error: message }, 409);
}

async function readJsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

/** Dispatch REST request to orchestrator handler; null → 404. */
export async function routeRequest(config: Config, req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const { pathname } = url;

  if (req.method === "GET" && pathname === "/board") {
    return json(await listBoard(config));
  }

  const parkingPromoteMatch = pathname.match(/^\/board\/parking\/([^/]+)\/promote$/);
  if (req.method === "POST" && parkingPromoteMatch) {
    try {
      const folder = decodeURIComponent(parkingPromoteMatch[1]);
      const result = await promoteParkingToQueued(config, folder);
      return json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("not found") || message.includes("missing")) {
        return notFound(message);
      }
      if (message.includes("already exists")) return conflict(message);
      return badRequest(message);
    }
  }

  if (req.method === "POST" && pathname === "/bell") {
    return json(await orchestratorTick(config));
  }

  if (req.method === "GET" && pathname === "/queue") {
    return json(await getQueue(config));
  }

  if (req.method === "POST" && pathname === "/ideas") {
    try {
      const body = await readJsonBody<CreateIdeaRequest>(req);
      return json(await createIdea(config, body), 201);
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : String(err));
    }
  }

  if (req.method === "GET" && pathname === "/ideas") {
    return json(await listIdeas(config));
  }

  const ideaDraftsMatch = pathname.match(/^\/ideas\/([^/]+)\/drafts$/);
  if (req.method === "GET" && ideaDraftsMatch) {
    try {
      const drafts = await getIdeaDrafts(config, decodeURIComponent(ideaDraftsMatch[1]));
      if (!drafts) return notFound("Idea not found");
      return json(drafts);
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : String(err));
    }
  }

  const ideaMatch = pathname.match(/^\/ideas\/([^/]+)$/);
  if (req.method === "GET" && ideaMatch) {
    try {
      const idea = await getIdea(config, decodeURIComponent(ideaMatch[1]));
      if (!idea) return notFound("Idea not found");
      return json(idea);
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : String(err));
    }
  }

  const discoveryApproveMatch = pathname.match(/^\/discoveries\/([^/]+)\/approve$/);
  if (req.method === "POST" && discoveryApproveMatch) {
    try {
      const ideaId = decodeURIComponent(discoveryApproveMatch[1]);
      const result = await approveDiscovery(config, ideaId);
      return json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("not on the discovering board") || message.includes("Missing discovery")) {
        return notFound(message);
      }
      if (message.includes("already closed") || message.includes("No mission packages")) {
        return conflict(message);
      }
      if (message.includes("Parking entry already exists")) return conflict(message);
      return badRequest(message);
    }
  }

  const discoverySessionMatch = pathname.match(/^\/discoveries\/([^/]+)\/session$/);
  if (req.method === "GET" && discoverySessionMatch) {
    try {
      const ideaId = decodeURIComponent(discoverySessionMatch[1]);
      const ensureLive = url.searchParams.get("ensureLive") === "true";
      const session = await getDiscoverySession(config, ideaId, { ensureLive });
      if (!session) return notFound("Discovery session not found");
      return json(session);
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : String(err));
    }
  }

  const discoveryRestoreMatch = pathname.match(/^\/discoveries\/([^/]+)\/restore$/);
  if (req.method === "POST" && discoveryRestoreMatch) {
    try {
      const ideaId = decodeURIComponent(discoveryRestoreMatch[1]);
      const result = await restoreDiscoverySession(config, ideaId);
      const synced = await syncActiveDiscovery(config, ideaId);
      const session =
        synced &&
        buildDiscoverySessionInfo(config, ideaId, synced.checkpoint, {
          processLive: synced.live,
          jobState: synced.jobState,
        });
      return json({ ok: true, ideaId, ...result, session });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("not on the discovering board") || message.includes("Missing discovery")) {
        return notFound(message);
      }
      if (message.includes("already closed")) return conflict(message);
      return badRequest(message);
    }
  }

  const discoverySignalsMatch = pathname.match(/^\/discoveries\/([^/]+)\/signals$/);
  if (req.method === "POST" && discoverySignalsMatch) {
    try {
      const ideaId = decodeURIComponent(discoverySignalsMatch[1]);
      const body = await readJsonBody<DiscoverySignalRequest>(req);
      if (!body.type) return badRequest("Missing signal type");
      const checkpoint = await handleDiscoverySignal(config, ideaId, body);
      return json({ ok: true, ideaId, checkpoint });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("not on the discovering board") || message.includes("Missing discovery")) {
        return notFound(message);
      }
      if (message.includes("already closed")) return conflict(message);
      return badRequest(message);
    }
  }

  const discoveryEscalateMatch = pathname.match(/^\/discoveries\/([^/]+)\/escalate$/);
  if (req.method === "POST" && discoveryEscalateMatch) {
    try {
      const ideaId = decodeURIComponent(discoveryEscalateMatch[1]);
      const body = await readJsonBody<EscalateRequest>(req);
      if (!body.question) return badRequest("Missing question");
      const result = await escalateDiscoveryToGuildMaster(config, ideaId, body);
      return json({ ok: true, ideaId, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("not on the discovering board") || message.includes("Missing discovery")) {
        return notFound(message);
      }
      if (message.includes("already closed")) return conflict(message);
      return badRequest(message);
    }
  }

  const discoveryOutboxReadMatch = pathname.match(/^\/discoveries\/([^/]+)\/outbox\/read$/);
  if (req.method === "POST" && discoveryOutboxReadMatch) {
    try {
      const ideaId = decodeURIComponent(discoveryOutboxReadMatch[1]);
      let ids: string[] | undefined;
      const contentType = req.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        try {
          ids = (await readJsonBody<{ ids?: string[] }>(req)).ids;
        } catch {
          return badRequest("Invalid JSON body");
        }
      }
      const result = await markDiscoveryOutboxRead(config, ideaId, ids);
      return json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("not found")) return notFound(message);
      return badRequest(message);
    }
  }

  const discoveryOutboxMatch = pathname.match(/^\/discoveries\/([^/]+)\/outbox$/);
  if (req.method === "GET" && discoveryOutboxMatch) {
    try {
      const ideaId = decodeURIComponent(discoveryOutboxMatch[1]);
      const outbox = await getDiscoveryOutboxSummary(config, ideaId);
      if (!outbox) return notFound("Idea not found");
      return json(outbox);
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : String(err));
    }
  }

  const discoveryEventsPostMatch = pathname.match(/^\/discoveries\/([^/]+)\/events$/);
  if (req.method === "POST" && discoveryEventsPostMatch) {
    try {
      const ideaId = decodeURIComponent(discoveryEventsPostMatch[1]);
      const body = await readJsonBody<DiscoveryEventLogRequest>(req);
      if (!body.from) return badRequest("Missing from");
      if (!body.body) return badRequest("Missing body");
      if (!body.type) return badRequest("Missing type");
      const entry = await appendDiscoveryEventEntry(config, ideaId, body);
      return json({ ok: true, ideaId, entry });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("not on the discovering board") || message.includes("not found")) {
        return notFound(message);
      }
      return badRequest(message);
    }
  }

  const discoveryEventsMatch = pathname.match(/^\/discoveries\/([^/]+)\/events$/);
  if (req.method === "GET" && discoveryEventsMatch) {
    try {
      const ideaId = decodeURIComponent(discoveryEventsMatch[1]);
      const events = await getDiscoveryEventsSummary(config, ideaId);
      if (!events) return notFound("Idea not found");
      return json(events);
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : String(err));
    }
  }

  if (req.method === "GET" && pathname === "/missions") {
    return json(await listMissions(config));
  }

  if (req.method === "GET" && pathname === "/outbox") {
    const items = await listUnreadOutbox(config);
    return json({ items, count: items.length });
  }

  if (req.method === "POST" && pathname === "/recover") {
    return json({ ok: true, recovered: await recoverActiveMissions(config) });
  }

  const briefMatch = pathname.match(/^\/missions\/([^/]+)\/brief$/);
  if (req.method === "GET" && briefMatch) {
    try {
      const missionId = decodeURIComponent(briefMatch[1]);
      const brief = await getMissionBrief(config, missionId);
      if (!brief) return notFound("Brief not found");
      return json(brief);
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : String(err));
    }
  }

  const summaryMatch = pathname.match(/^\/missions\/([^/]+)\/summary$/);
  if (req.method === "GET" && summaryMatch) {
    try {
      const missionId = decodeURIComponent(summaryMatch[1]);
      const summary = await getMissionSummary(config, missionId);
      if (!summary) return notFound("Mission not found");
      return json(summary);
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : String(err));
    }
  }

  const roomMatch = pathname.match(/^\/missions\/([^/]+)\/room\/(.+)$/);
  if (req.method === "GET" && roomMatch) {
    try {
      const missionId = decodeURIComponent(roomMatch[1]);
      const file = await readMissionRoomFile(config, missionId, roomMatch[2]);
      if (!file) return notFound("File not found");
      return json(file);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === "Path not allowed") return badRequest(message);
      return badRequest(message);
    }
  }

  const missionMatch = pathname.match(/^\/missions\/([^/]+)$/);
  if (req.method === "GET" && missionMatch) {
    try {
      const mission = await getMission(config, decodeURIComponent(missionMatch[1]));
      if (!mission) return notFound("Mission not found");
      return json(mission);
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : String(err));
    }
  }

  const sessionMatch = pathname.match(/^\/missions\/([^/]+)\/session$/);
  if (req.method === "GET" && sessionMatch) {
    try {
      const missionId = decodeURIComponent(sessionMatch[1]);
      const ensureLive = url.searchParams.get("ensureLive") === "true";
      const session = await getMissionSession(config, missionId, { ensureLive });
      if (!session) return notFound("Mission session not found");
      return json(session);
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : String(err));
    }
  }

  const restoreMatch = pathname.match(/^\/missions\/([^/]+)\/restore$/);
  if (req.method === "POST" && restoreMatch) {
    try {
      const missionId = decodeURIComponent(restoreMatch[1]);
      const result = await restoreMissionSession(config, missionId);
      const synced = await syncActiveMission(config, missionId);
      const session =
        synced &&
        buildMissionSessionInfo(config, missionId, synced.checkpoint, {
          processLive: synced.live,
          jobState: synced.jobState,
        });
      return json({ ok: true, missionId, ...result, session });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("not active") ||
        message.includes("working board") ||
        message.includes("Missing checkpoint")
      )
        return notFound(message);
      if (message.includes("already done")) return conflict(message);
      return badRequest(message);
    }
  }

  const signalsMatch = pathname.match(/^\/missions\/([^/]+)\/signals$/);
  if (req.method === "POST" && signalsMatch) {
    try {
      const missionId = decodeURIComponent(signalsMatch[1]);
      const body = await readJsonBody<SignalRequest>(req);
      if (!body.type) return badRequest("Missing signal type");
      const checkpoint = await handleSignal(config, missionId, body);
      return json({ ok: true, missionId, checkpoint });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("not active") ||
        message.includes("working board") ||
        message.includes("Missing checkpoint")
      )
        return notFound(message);
      return badRequest(message);
    }
  }

  const pauseMatch = pathname.match(/^\/missions\/([^/]+)\/pause$/);
  if (req.method === "POST" && pauseMatch) {
    try {
      const missionId = decodeURIComponent(pauseMatch[1]);
      const checkpoint = await pauseMission(config, missionId);
      return json({ ok: true, missionId, checkpoint });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("not active") ||
        message.includes("working board") ||
        message.includes("Missing checkpoint")
      )
        return notFound(message);
      if (message.includes("already done")) return conflict(message);
      return badRequest(message);
    }
  }

  const resumeMatch = pathname.match(/^\/missions\/([^/]+)\/resume$/);
  if (req.method === "POST" && resumeMatch) {
    try {
      const missionId = decodeURIComponent(resumeMatch[1]);
      const result = await resumeMission(config, missionId);
      const synced = await syncActiveMission(config, missionId);
      const session =
        synced &&
        buildMissionSessionInfo(config, missionId, synced.checkpoint, {
          processLive: synced.live,
          jobState: synced.jobState,
        });
      return json({ ok: true, missionId, ...result, session });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("not active") ||
        message.includes("working board") ||
        message.includes("Missing checkpoint")
      )
        return notFound(message);
      if (message.includes("already done")) return conflict(message);
      return badRequest(message);
    }
  }

  const archiveMatch = pathname.match(/^\/missions\/([^/]+)\/archive$/);
  if (req.method === "POST" && archiveMatch) {
    try {
      const missionId = decodeURIComponent(archiveMatch[1]);
      const checkpoint = await archiveMission(config, missionId);
      return json({ ok: true, missionId, checkpoint });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("not on the done board") ||
        message.includes("not on the active board") ||
        message.includes("working board") ||
        message.includes("Missing checkpoint")
      ) {
        return notFound(message);
      }
      if (message.includes("must be phase done")) return conflict(message);
      return badRequest(message);
    }
  }

  const outboxMatch = pathname.match(/^\/missions\/([^/]+)\/outbox$/);
  if (req.method === "GET" && outboxMatch) {
    try {
      const missionId = decodeURIComponent(outboxMatch[1]);
      await syncActiveMission(config, missionId);
      const outbox = await getMissionOutboxSummary(config, missionId);
      if (!outbox) return notFound("Mission not found");
      return json(outbox);
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : String(err));
    }
  }

  const outboxReadMatch = pathname.match(/^\/missions\/([^/]+)\/outbox\/read$/);
  if (req.method === "POST" && outboxReadMatch) {
    try {
      const missionId = decodeURIComponent(outboxReadMatch[1]);
      let ids: string[] | undefined;
      const contentType = req.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        try {
          ids = (await readJsonBody<{ ids?: string[] }>(req)).ids;
        } catch {
          return badRequest("Invalid JSON body");
        }
      }
      const result = await markOutboxRead(config, missionId, ids);
      return json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("not found")) return notFound(message);
      return badRequest(message);
    }
  }

  const escalateMatch = pathname.match(/^\/missions\/([^/]+)\/escalate$/);
  if (req.method === "POST" && escalateMatch) {
    try {
      const missionId = decodeURIComponent(escalateMatch[1]);
      const body = await readJsonBody<EscalateRequest>(req);
      if (!body.question) return badRequest("Missing question");
      const result = await escalateToGuildMaster(config, missionId, body);
      return json({ ok: true, missionId, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("not active") ||
        message.includes("working board") ||
        message.includes("Missing checkpoint")
      )
        return notFound(message);
      return badRequest(message);
    }
  }

  const eventsPostMatch = pathname.match(/^\/missions\/([^/]+)\/events$/);
  if (req.method === "POST" && eventsPostMatch) {
    try {
      const missionId = decodeURIComponent(eventsPostMatch[1]);
      const body = await readJsonBody<EventLogRequest>(req);
      if (!body.from) return badRequest("Missing from");
      if (!body.body) return badRequest("Missing body");
      if (!body.type) return badRequest("Missing type");
      const entry = await appendEventEntry(config, missionId, body);
      return json({ ok: true, missionId, entry });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("not active") ||
        message.includes("working board") ||
        message.includes("Missing checkpoint")
      )
        return notFound(message);
      return badRequest(message);
    }
  }

  const eventsMatch = pathname.match(/^\/missions\/([^/]+)\/events$/);
  if (req.method === "GET" && eventsMatch) {
    try {
      const missionId = decodeURIComponent(eventsMatch[1]);
      await syncActiveMission(config, missionId);
      const events = await getEventsSummary(config, missionId);
      if (!events) return notFound("Mission not found");
      return json(events);
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : String(err));
    }
  }

  return null;
}
