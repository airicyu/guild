/**
 * Push orchestrator events into a live PO session via guild-channel HTTP endpoint.
 *
 * Degraded mode: no endpoint / dead port → caller still updates checkpoint + inbox.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import { missionRoomPath } from "../../paths";
import { assertMissionId } from "../core/board";

export interface ChannelNotifyResult {
  delivered: boolean;
  reason?: string;
  httpStatus?: number;
}

function channelNotifyLog(message: string, extra?: Record<string, unknown>): void {
  const suffix = extra ? ` ${JSON.stringify(extra)}` : "";
  console.log(`[channel-notify] ${message}${suffix}`);
}

async function readChannelEndpoint(
  config: Config,
  missionId: string,
): Promise<{ host: string; port: number } | null> {
  const endpointPath = join(missionRoomPath(config, missionId), ".guild", "channel-endpoint.json");
  try {
    const raw = await readFile(endpointPath, "utf8");
    const parsed = JSON.parse(raw) as { host?: string; port?: number };
    if (parsed.port) {
      return { host: parsed.host ?? "127.0.0.1", port: parsed.port };
    }
  } catch {
    // endpoint missing or unreadable
  }
  return null;
}

async function channelPortLive(
  apiKey: string,
  endpoint: { host: string; port: number },
): Promise<boolean> {
  const url = `http://${endpoint.host}:${endpoint.port}/`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: "",
    });
    return res.status === 403 || res.status === 400 || res.ok;
  } catch {
    return false;
  }
}

/** POST channel event to mission room guild-channel; best-effort, never throws. */
export async function notifyGuildChannel(
  config: Config,
  missionId: string,
  event: string,
  content: string,
): Promise<ChannelNotifyResult> {
  assertMissionId(missionId);

  if (!config.channelPushEnabled) {
    channelNotifyLog("skip", { missionId, event, reason: "GUILD_CHANNEL_PUSH disabled" });
    return { delivered: false, reason: "GUILD_CHANNEL_PUSH disabled" };
  }

  const endpoint = await readChannelEndpoint(config, missionId);
  if (!endpoint) {
    channelNotifyLog("skip", { missionId, event, reason: "no channel endpoint" });
    return { delivered: false, reason: "no channel endpoint" };
  }

  channelNotifyLog("endpoint", { missionId, event, host: endpoint.host, port: endpoint.port });

  if (!(await channelPortLive(config.apiKey, endpoint))) {
    channelNotifyLog("skip", { missionId, event, reason: "channel port not live", port: endpoint.port });
    return { delivered: false, reason: "channel port not live" };
  }

  const url = `http://${endpoint.host}:${endpoint.port}/`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event, content }),
    });
    const bodyText = await res.text();
    if (!res.ok) {
      channelNotifyLog("POST failed", {
        missionId,
        event,
        url,
        status: res.status,
        body: bodyText.slice(0, 200),
      });
      return {
        delivered: false,
        reason: `POST failed: ${res.status}${bodyText ? ` ${bodyText.slice(0, 120)}` : ""}`,
        httpStatus: res.status,
      };
    }
    channelNotifyLog("POST ok", { missionId, event, url, status: res.status, body: bodyText });
    return { delivered: true, httpStatus: res.status };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    channelNotifyLog("POST error", { missionId, event, url, reason });
    return { delivered: false, reason };
  }
}
