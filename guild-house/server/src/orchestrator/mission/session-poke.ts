/**
 * Session poke — orchestrator ephemeral attach to wake idle --bg PO sessions.
 *
 * Policy: Option A — probeSession only; no ensureLive on notify path.
 */
import type { Config } from "../../config";
import { missionRoomPath } from "../../paths";
import type { MissionMode, MissionPhase } from "../../types/mission";
import { runEphemeralAttachPoke } from "../core/attach-pty-core";
import { injectMissionAttachChatInput, isMissionAttachWsActive } from "../../websocket/attach-pty";
import { readCheckpoint } from "./checkpoint";
import { probeSession as defaultProbeSession } from "./session-lifecycle";

export type SessionPokeEvent =
  | "artifacts_approved"
  | "artifacts_rejected"
  | "mission_aborted"
  | "awaiting_input";

export type SessionPokeDelivery = {
  delivered: boolean;
  reason?: string;
  durationMs?: number;
};

const pokeInFlight = new Set<string>();

type PokeRunner = typeof runEphemeralAttachPoke;
let pokeRunner: PokeRunner = runEphemeralAttachPoke;
type ProbeSessionFn = typeof defaultProbeSession;
let probeSessionFn: ProbeSessionFn = defaultProbeSession;
type AttachInjectFn = typeof injectMissionAttachChatInput;
let attachInjectFn: AttachInjectFn = injectMissionAttachChatInput;

/** Test hook — inject mock PTY runner without live Claude. */
export function __setPokeRunnerForTests(runner: PokeRunner | null): void {
  pokeRunner = runner ?? runEphemeralAttachPoke;
}

/** Test hook — stub session probe. */
export function __setProbeSessionForTests(fn: ProbeSessionFn | null): void {
  probeSessionFn = fn ?? defaultProbeSession;
}

type AttachActiveFn = typeof isMissionAttachWsActive;
let attachActiveCheck: AttachActiveFn = isMissionAttachWsActive;

/** Test hook — stub WS attach inject. */
export function __setAttachInjectFnForTests(fn: AttachInjectFn | null): void {
  attachInjectFn = fn ?? injectMissionAttachChatInput;
}

/** Test hook — stub WS attach-active check. */
export function __setAttachActiveCheckForTests(fn: AttachActiveFn | null): void {
  attachActiveCheck = fn ?? isMissionAttachWsActive;
}

/** Test hook — clear in-flight mutex between tests. */
export function __clearPokeMutexForTests(): void {
  pokeInFlight.clear();
}

/** Canonical poke doorbell — design §2.3 */
export function buildPokeMessage(
  event: SessionPokeEvent,
  phase: MissionPhase,
  mode?: MissionMode,
  templateOverride?: string,
): string {
  const role =
    mode === "intake" && event === "awaiting_input" ? "intake lead" : "project owner";
  const phasePart = event === "awaiting_input" ? "phase unchanged" : `phase: ${phase}`;

  if (templateOverride?.trim()) {
    return templateOverride
      .replaceAll("{{event}}", event)
      .replaceAll("{{phase}}", phase)
      .replaceAll("{{role}}", role)
      .replaceAll("{{phasePart}}", phasePart);
  }

  return `[guild-house] Guild master updated mission state (event: ${event}, ${phasePart}). Read checkpoint.yaml and comm/inbox.md for the latest directive, then continue per your playbook as ${role}.`;
}

/** Best-effort poke; never throws — failures do not roll back inbox/checkpoint. */
export async function pokeMissionSession(
  config: Config,
  missionId: string,
  input: { event: SessionPokeEvent; phase: MissionPhase; mode?: MissionMode },
): Promise<SessionPokeDelivery> {
  if (!config.sessionPokeEnabled) {
    return { delivered: false, reason: "GUILD_SESSION_POKE disabled" };
  }

  if (pokeInFlight.has(missionId)) {
    return { delivered: false, reason: "poke in flight" };
  }

  pokeInFlight.add(missionId);
  const started = Date.now();

  try {
    const checkpoint = await readCheckpoint(config, missionId);
    if (!checkpoint?.claude_session?.id) {
      return { delivered: false, reason: "missing checkpoint session" };
    }

    const sessionId = checkpoint.claude_session.id;
    const probe = await probeSessionFn(config, sessionId);
    if (!probe.processLive) {
      return { delivered: false, reason: "session not live" };
    }

    const message = buildPokeMessage(
      input.event,
      input.phase,
      input.mode ?? checkpoint.mode,
      config.sessionPokeMessageTemplate,
    );

    if (attachActiveCheck(missionId)) {
      const viaAttach = await attachInjectFn(missionId, message);
      const durationMs = Date.now() - started;
      if (!viaAttach.delivered) {
        console.log(
          `[session-poke] mission=${missionId} event=${input.event} via=ws-attach delivered=false reason=${viaAttach.reason ?? "unknown"} durationMs=${durationMs}`,
        );
        return { delivered: false, reason: viaAttach.reason, durationMs };
      }

      const afterAttachProbe = await probeSessionFn(config, sessionId);
      if (!afterAttachProbe.processLive) {
        console.log(
          `[session-poke] mission=${missionId} event=${input.event} via=ws-attach delivered=false reason=bg job not live after inject durationMs=${durationMs}`,
        );
        return {
          delivered: false,
          reason: "bg job not live after poke teardown",
          durationMs,
        };
      }

      console.log(
        `[session-poke] mission=${missionId} event=${input.event} via=ws-attach delivered=true durationMs=${durationMs}`,
      );
      return { delivered: true, durationMs };
    }

    const cwd = checkpoint.claude_session.cwd || missionRoomPath(config, missionId);

    const result = await pokeRunner({
      claudeCommand: config.claudeCommand,
      sessionId,
      cwd,
      message,
      timeoutMs: config.sessionPokeTimeoutMs,
    });

    if (!result.delivered) {
      console.log(
        `[session-poke] mission=${missionId} event=${input.event} delivered=false reason=${result.reason ?? "unknown"} durationMs=${result.durationMs ?? Date.now() - started}`,
      );
      return {
        delivered: false,
        reason: result.reason,
        durationMs: result.durationMs,
      };
    }

    const afterProbe = await probeSessionFn(config, sessionId);
    if (!afterProbe.processLive) {
      console.log(
        `[session-poke] mission=${missionId} event=${input.event} delivered=false reason=bg job not live after poke teardown`,
      );
      return {
        delivered: false,
        reason: "bg job not live after poke teardown",
        durationMs: result.durationMs,
      };
    }

    console.log(
      `[session-poke] mission=${missionId} event=${input.event} via=ephemeral delivered=true durationMs=${result.durationMs ?? Date.now() - started}`,
    );
    return { delivered: true, durationMs: result.durationMs };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.log(
      `[session-poke] mission=${missionId} event=${input.event} delivered=false reason=${reason}`,
    );
    return { delivered: false, reason };
  } finally {
    pokeInFlight.delete(missionId);
  }
}
