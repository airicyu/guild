/**
 * Combined inbox write + channel push for guild-master orchestrator actions.
 */
import type { Config } from "../../config";
import { notifyGuildChannel } from "./channel-notify";
import { writeMissionInbox } from "./inbox";

export interface GuildMasterNotifyResult {
  channel: { delivered: boolean; reason?: string };
}

/** Persist directive to inbox.md and push to live PO channel when available. */
export async function deliverGuildMasterDirective(
  config: Config,
  missionId: string,
  input: { event: string; directive: string; appendInbox?: boolean },
): Promise<GuildMasterNotifyResult> {
  await writeMissionInbox(config, missionId, input.directive, {
    append: input.appendInbox ?? false,
  });
  const channel = await notifyGuildChannel(config, missionId, input.event, input.directive);
  console.log(
    `[guild-master-notify] mission=${missionId} event=${input.event} channel.delivered=${channel.delivered}${channel.reason ? ` reason=${channel.reason}` : ""}`,
  );
  return { channel };
}
