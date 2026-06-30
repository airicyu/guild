/**
 * Mission id validation, minting, and kickstart rename at bell pickup.
 *
 * Format: {slug}-{YYYYMMDD}-{6hex}. resolveMissionIdAtKickstart may rename queued folder
 * before pickup when slug-only or colliding id. isMissionIdInUse checks board + room dir.
 */
import { stat } from "node:fs/promises";
import type { Config } from "../../config";
import { missionRoomPath } from "../../paths";
import { listBoard, resolveQueuedEntryPath } from "./board";

/** Minted at bell: `{slug}-{YYYYMMDD}-{6hex}` */
export const MINTED_MISSION_ID_PATTERN = /^(.+)-(\d{8})-([a-f0-9]{6})$/i;

const LEGACY_MISSION_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

const MAX_MINT_ATTEMPTS = 20;

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function randomHex6(): string {
  return crypto.getRandomValues(new Uint8Array(3)).reduce(
    (s, b) => s + b.toString(16).padStart(2, "0"),
    "",
  );
}

/** Parse slug, date, and hex from a minted mission id; null if not minted format. */
export function parseMintedMissionId(missionId: string): { slug: string; date: string; hex: string } | null {
  const match = missionId.match(MINTED_MISSION_ID_PATTERN);
  if (!match) return null;
  return { slug: match[1], date: match[2], hex: match[3].toLowerCase() };
}

/** True when missionId matches `{slug}-{YYYYMMDD}-{6hex}` format. */
export function isMintedMissionId(missionId: string): boolean {
  return MINTED_MISSION_ID_PATTERN.test(missionId);
}

/** Throw if missionId is not a valid legacy or minted id. */
export function assertMissionId(missionId: string): void {
  if (LEGACY_MISSION_ID_PATTERN.test(missionId) || isMintedMissionId(missionId)) {
    return;
  }
  throw new Error(`Invalid mission id: ${missionId}`);
}

/** Extract slug portion from a minted id, or return folder name as-is. */
export function slugFromFolderName(folderName: string): string {
  const parsed = parseMintedMissionId(folderName);
  return parsed?.slug ?? folderName;
}

/** Mint `{slug}-{date}-{6hex}`; throws on empty slug. */
export function mintMissionId(slug: string, date = todayYmd()): string {
  const safeSlug = slugFromFolderName(slug).trim();
  if (!safeSlug) {
    throw new Error("Cannot mint mission id: empty slug");
  }
  const id = `${safeSlug}-${date}-${randomHex6()}`;
  assertMissionId(id);
  return id;
}

/** True when id is on any board stage or mission-rooms/ exists. */
export async function isMissionIdInUse(
  config: Config,
  missionId: string,
  options?: { exceptQueuedFolder?: string },
): Promise<boolean> {
  const board = await listBoard(config);

  for (const stage of ["parking", "working", "done", "archive"] as const) {
    if (board[stage].includes(missionId)) return true;
  }

  for (const queuedId of board.queued) {
    if (queuedId === missionId && queuedId === options?.exceptQueuedFolder) continue;
    if (queuedId === missionId) return true;
  }

  try {
    await stat(missionRoomPath(config, missionId));
    return true;
  } catch {
    return false;
  }
}

/** Mint a collision-free mission id, retrying up to MAX_MINT_ATTEMPTS. */
export async function mintUniqueMissionId(config: Config, slug: string): Promise<string> {
  const date = todayYmd();
  for (let i = 0; i < MAX_MINT_ATTEMPTS; i++) {
    const id = mintMissionId(slug, date);
    if (!(await isMissionIdInUse(config, id))) return id;
  }
  throw new Error(`Failed to mint unique mission id for slug: ${slug}`);
}

/** Resolve (and optionally rename queued folder) before bell pickup. */
export async function resolveMissionIdAtKickstart(
  config: Config,
  queuedFolderName: string,
): Promise<string> {
  assertMissionId(queuedFolderName);

  if (
    isMintedMissionId(queuedFolderName) &&
    !(await isMissionIdInUse(config, queuedFolderName, { exceptQueuedFolder: queuedFolderName }))
  ) {
    return queuedFolderName;
  }

  const slug = slugFromFolderName(queuedFolderName);
  return mintUniqueMissionId(config, slug);
}

/** True when folder exists on queued/ or legacy ready/. */
export async function queuedEntryExists(config: Config, folderName: string): Promise<boolean> {
  return (await resolveQueuedEntryPath(config, folderName)) !== null;
}

/** @deprecated Use queuedEntryExists */
export const readyEntryExists = queuedEntryExists;
