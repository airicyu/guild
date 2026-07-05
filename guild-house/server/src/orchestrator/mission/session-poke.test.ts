import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import type { Config } from "../../config";
import {
  __clearPokeMutexForTests,
  __setAttachActiveCheckForTests,
  __setPokeRunnerForTests,
  __setProbeSessionForTests,
  buildPokeMessage,
  pokeMissionSession,
} from "./session-poke";

const baseConfig = {
  sessionPokeEnabled: true,
  sessionPokeTimeoutMs: 8000,
  sessionPokeMessageTemplate: undefined,
  claudeCommand: "claude",
  guildHome: join(import.meta.dir, "../../../../data"),
} as Config;

const liveProbe = async () => ({ processLive: true, jobState: "running" as const });

describe("buildPokeMessage", () => {
  test("artifacts_approved execution wording", () => {
    const msg = buildPokeMessage("artifacts_approved", "releasing");
    expect(msg).toContain("[guild-house]");
    expect(msg).toContain("artifacts_approved");
    expect(msg).toContain("phase: releasing");
    expect(msg).toContain("project owner");
    expect(msg).toContain("checkpoint.yaml");
    expect(msg).toContain("comm/inbox.md");
  });

  test("awaiting_input intake lead wording", () => {
    const msg = buildPokeMessage("awaiting_input", "mission_planning", "intake");
    expect(msg).toContain("phase unchanged");
    expect(msg).toContain("intake lead");
  });

  test("template override placeholders", () => {
    const msg = buildPokeMessage("mission_aborted", "aborted", "execution", "{{event}} {{phase}} {{role}}");
    expect(msg).toBe("mission_aborted aborted project owner");
  });
});

describe("pokeMissionSession", () => {
  beforeEach(() => {
    __clearPokeMutexForTests();
    __setPokeRunnerForTests(null);
    __setProbeSessionForTests(null);
    __setAttachActiveCheckForTests(null);
  });

  afterEach(() => {
    __setPokeRunnerForTests(null);
    __setProbeSessionForTests(null);
    __setAttachActiveCheckForTests(null);
    __clearPokeMutexForTests();
  });

  test("disabled flag returns reason", async () => {
    const result = await pokeMissionSession(
      { ...baseConfig, sessionPokeEnabled: false },
      "demo-001",
      { event: "artifacts_approved", phase: "releasing" },
    );
    expect(result).toEqual({ delivered: false, reason: "GUILD_SESSION_POKE disabled" });
  });

  test("missing checkpoint returns reason", async () => {
    const result = await pokeMissionSession(baseConfig, "nonexistent-mission-id-xyz", {
      event: "artifacts_approved",
      phase: "releasing",
    });
    expect(result.delivered).toBe(false);
    expect(result.reason).toBe("missing checkpoint session");
  });

  test("dead session returns session not live", async () => {
    const result = await pokeMissionSession(baseConfig, "longbridge-validation-20260704-bc317a", {
      event: "artifacts_approved",
      phase: "releasing",
    });
    expect(result).toEqual({ delivered: false, reason: "session not live" });
  });

  test("mock runner success when session live", async () => {
    __setProbeSessionForTests(liveProbe);
    __setPokeRunnerForTests(async () => ({ delivered: true, durationMs: 99 }));

    const result = await pokeMissionSession(baseConfig, "longbridge-validation-20260704-bc317a", {
      event: "artifacts_rejected",
      phase: "blocked",
    });
    expect(result).toEqual({ delivered: true, durationMs: 99 });
  });

  test("mock runner timeout surfaces reason", async () => {
    __setProbeSessionForTests(liveProbe);
    __setPokeRunnerForTests(async () => ({
      delivered: false,
      reason: "attach inject timeout",
      durationMs: 8000,
    }));

    const result = await pokeMissionSession(baseConfig, "longbridge-validation-20260704-bc317a", {
      event: "artifacts_approved",
      phase: "releasing",
    });
    expect(result.delivered).toBe(false);
    expect(result.reason).toBe("attach inject timeout");
  });

  test("attach_in_use skips poke", async () => {
    __setProbeSessionForTests(liveProbe);
    __setAttachActiveCheckForTests(() => true);

    const result = await pokeMissionSession(baseConfig, "longbridge-validation-20260704-bc317a", {
      event: "artifacts_approved",
      phase: "releasing",
    });
    expect(result).toEqual({ delivered: false, reason: "attach_in_use" });
  });

  test("concurrent poke skips with poke in flight", async () => {
    __setProbeSessionForTests(liveProbe);
    __setPokeRunnerForTests(
      () => new Promise((resolve) => setTimeout(() => resolve({ delivered: true, durationMs: 50 }), 40)),
    );

    const missionId = "longbridge-validation-20260704-bc317a";
    const [r1, r2] = await Promise.all([
      pokeMissionSession(baseConfig, missionId, { event: "artifacts_approved", phase: "releasing" }),
      pokeMissionSession(baseConfig, missionId, { event: "artifacts_approved", phase: "releasing" }),
    ]);

    const reasons = [r1.reason, r2.reason];
    expect(r1.delivered === true || r2.delivered === true).toBe(true);
    expect(reasons).toContain("poke in flight");
  });
});
