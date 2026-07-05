/**
 * Combined inbox write + channel push + session poke for guild-master orchestrator actions.
 */
import type { Config } from "../../config";
import type { MissionMode, MissionPhase } from "../../types/mission";
import { notifyGuildChannel } from "./channel-notify";
import { writeMissionInbox } from "./inbox";
import { pokeMissionSession, type SessionPokeEvent } from "./session-poke";

export interface GuildMasterNotifyResult {
  channel: { delivered: boolean; reason?: string };
  poke: { delivered: boolean; reason?: string; durationMs?: number };
}

export interface GuildMasterDirectiveInput {
  event: string;
  directive: string;
  appendInbox?: boolean;
  /** Post-transition phase for poke doorbell message. */
  pokePhase?: MissionPhase;
  pokeMode?: MissionMode;
}

/** Persist directive to inbox.md; optional channel push; optional session poke. */
export async function deliverGuildMasterDirective(
  config: Config,
  missionId: string,
  input: GuildMasterDirectiveInput,
): Promise<GuildMasterNotifyResult> {
  await writeMissionInbox(config, missionId, input.directive, {
    append: input.appendInbox ?? false,
  });

  const channel = await notifyGuildChannel(config, missionId, input.event, input.directive);

  let poke: GuildMasterNotifyResult["poke"] = {
    delivered: false,
    reason: "poke skipped",
  };

  if (input.pokePhase !== undefined) {
    poke = await pokeMissionSession(config, missionId, {
      event: input.event as SessionPokeEvent,
      phase: input.pokePhase,
      mode: input.pokeMode,
    });
  }

  console.log(
    `[guild-master-notify] mission=${missionId} event=${input.event} channel.delivered=${channel.delivered}${channel.reason ? ` reason=${channel.reason}` : ""} poke.delivered=${poke.delivered}${poke.reason ? ` poke.reason=${poke.reason}` : ""}`,
  );

  return { channel, poke };
}
