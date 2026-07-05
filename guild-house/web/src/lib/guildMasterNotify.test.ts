import { describe, expect, test } from "bun:test";
import {
  formatGuildMasterNotifyDetail,
  guildMasterWakeEnabled,
} from "./guildMasterNotify";

describe("guildMasterWakeEnabled", () => {
  test("poke or channel enables wake", () => {
    expect(guildMasterWakeEnabled({ sessionPokeEnabled: true })).toBe(true);
    expect(guildMasterWakeEnabled({ channelPushEnabled: true })).toBe(true);
    expect(guildMasterWakeEnabled({})).toBe(false);
  });
});

describe("formatGuildMasterNotifyDetail", () => {
  test("poke delivered", () => {
    expect(formatGuildMasterNotifyDetail({ poke: { delivered: true } })).toContain("PO poked");
  });

  test("session not live", () => {
    expect(
      formatGuildMasterNotifyDetail({ poke: { delivered: false, reason: "session not live" } }),
    ).toContain("restore session");
  });

  test("inbox only fallback", () => {
    expect(formatGuildMasterNotifyDetail({ poke: { delivered: false } })).toContain("Inbox only");
  });
});
