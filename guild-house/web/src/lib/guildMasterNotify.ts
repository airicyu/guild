/** Guild-master directive notify block — re-export from mission types. */
import type { GuildMasterNotify } from "../types/mission";

export type { GuildMasterNotify };

export type GuildWakeHealth = {
  sessionPokeEnabled?: boolean;
  channelPushEnabled?: boolean;
};

/** True when API can attempt to wake idle PO (session poke or channel). */
export function guildMasterWakeEnabled(health: GuildWakeHealth): boolean {
  return health.sessionPokeEnabled === true || health.channelPushEnabled === true;
}

/** Toast detail after approve / reject / abort based on notify.poke (0.5.0 primary). */
export function formatGuildMasterNotifyDetail(notify?: GuildMasterNotify): string {
  if (notify?.poke?.delivered) return "PO poked — release can continue without attach";
  if (notify?.channel?.delivered) return "PO notified via channel";
  if (notify?.poke?.reason === "session not live") {
    return "Inbox updated — restore session, then attach or retry";
  }
  if (notify?.poke?.reason === "attach_in_use") {
    return "Inbox updated — close browser terminal attach, then retry";
  }
  return "Inbox only — restore session and attach if PO is idle";
}
