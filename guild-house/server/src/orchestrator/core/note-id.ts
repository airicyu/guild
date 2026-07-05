/**
 * Unified board note / mission id minting — {slug}-{YYYYMMDD}-{6hex}.
 * Legacy ids (idea-…, slug-only) accepted when reading.
 */
import { stat } from "node:fs/promises";
import type { Config } from "../../config";
import {
  missionBoardEntryPath,
  missionRoomAchivePath,
  missionRoomArchivePath,
  missionRoomPath,
  type BoardStage,
} from "../../paths";
import { listBoard } from "./board";

export const MINTED_NOTE_ID_PATTERN = /^(.+)-(\d{8})-([a-f0-9]{6})$/i;
const LEGACY_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
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

function sanitizeSlug(slug: string): string {
  const trimmed = slug.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!trimmed) throw new Error("Invalid slug: empty after sanitization");
  return trimmed;
}

/** Throw if id is not valid legacy or minted format. */
export function assertNoteId(noteId: string): void {
  if (LEGACY_ID_PATTERN.test(noteId) || MINTED_NOTE_ID_PATTERN.test(noteId)) return;
  throw new Error(`Invalid note id: ${noteId}`);
}

export function parseMintedNoteId(noteId: string): { slug: string; date: string; hex: string } | null {
  const match = noteId.match(MINTED_NOTE_ID_PATTERN);
  if (!match) return null;
  return { slug: match[1], date: match[2], hex: match[3].toLowerCase() };
}

export function isMintedNoteId(noteId: string): boolean {
  return MINTED_NOTE_ID_PATTERN.test(noteId);
}

export function slugFromFolderName(folderName: string): string {
  return parseMintedNoteId(folderName)?.slug ?? folderName;
}

/** Mint `{slug}-{date}-{hex}`; default slug `idea` for rough submit. */
export function mintNoteId(slug?: string, date = todayYmd()): string {
  const prefix = slug ? sanitizeSlug(slug) : "idea";
  const id = `${prefix}-${date}-${randomHex6()}`;
  assertNoteId(id);
  return id;
}

const ALL_BOARD_STAGES: BoardStage[] = [
  "ideas-backlog",
  "ideas",
  "discovering",
  "parking",
  "queued",
  "working",
  "done",
  "aborted",
  "archive",
];

async function roomExists(config: Config, noteId: string): Promise<boolean> {
  for (const p of [missionRoomPath(config, noteId), missionRoomArchivePath(config, noteId), missionRoomAchivePath(config, noteId)]) {
    try {
      await stat(p);
      return true;
    } catch {
      // continue
    }
  }
  // Legacy discovery-rooms read compat
  try {
    await stat(`${config.guildHome}/discovery-rooms/${noteId}`);
    return true;
  } catch {
    // continue
  }
  try {
    await stat(`${config.guildHome}/discovery-rooms/achive/${noteId}`);
    return true;
  } catch {
    return false;
  }
}

/** True when id exists on any board stage or mission room. */
export async function isNoteIdInUse(
  config: Config,
  noteId: string,
  options?: { exceptQueuedFolder?: string },
): Promise<boolean> {
  const board = await listBoard(config);
  for (const stage of ALL_BOARD_STAGES) {
    if (stage === "queued" && options?.exceptQueuedFolder === noteId) continue;
    if (board[stage].includes(noteId)) return true;
  }
  return roomExists(config, noteId);
}

export async function mintUniqueNoteId(config: Config, slug?: string): Promise<string> {
  const date = todayYmd();
  for (let i = 0; i < MAX_MINT_ATTEMPTS; i++) {
    const id = mintNoteId(slug, date);
    if (!(await isNoteIdInUse(config, id))) return id;
  }
  throw new Error(`Failed to mint unique note id${slug ? ` for slug: ${slug}` : ""}`);
}

export async function resolveMissionIdAtKickstart(
  config: Config,
  queuedFolderName: string,
): Promise<string> {
  assertNoteId(queuedFolderName);
  if (
    isMintedNoteId(queuedFolderName) &&
    !(await isNoteIdInUse(config, queuedFolderName, { exceptQueuedFolder: queuedFolderName }))
  ) {
    return queuedFolderName;
  }
  return mintUniqueNoteId(config, slugFromFolderName(queuedFolderName));
}

export async function queuedEntryExists(config: Config, folderName: string): Promise<boolean> {
  const { resolveQueuedEntryPath } = await import("./board");
  return (await resolveQueuedEntryPath(config, folderName)) !== null;
}
