/**
 * Read/write mission board note meta.yaml — orchestrator-only.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { YAML } from "bun";
import type { Config } from "../../config";
import { boardNoteMetaPath, missionBoardEntryPath, type BoardStage } from "../../paths";
import type { BoardNoteMeta, CreateBoardNoteMetaInput } from "../../types/board-note";

function slugFromNoteId(noteId: string): string {
  const match = noteId.match(/^(.+)-(\d{8})-([a-f0-9]{6})$/i);
  return match?.[1] ?? noteId;
}

/** Parse meta.yaml from disk. */
export function parseBoardNoteMeta(raw: string, fallbackId: string): BoardNoteMeta {
  const doc = YAML.parse(raw) as Partial<BoardNoteMeta>;

  if (!doc.type || !doc.origin || !doc.created_at) {
    throw new Error(`Invalid meta.yaml for ${fallbackId}`);
  }

  return {
    note_id: doc.note_id ?? fallbackId,
    type: doc.type,
    slug: doc.slug ?? slugFromNoteId(fallbackId),
    origin: doc.origin,
    parent_id: doc.parent_id ?? null,
    spawned_from_draft: doc.spawned_from_draft ?? null,
    created_at: doc.created_at,
    completed_at: doc.completed_at ?? null,
  };
}

export function serializeBoardNoteMeta(meta: BoardNoteMeta): string {
  const lines = [
    `note_id: "${meta.note_id}"`,
    `type: ${meta.type}`,
    `slug: "${meta.slug}"`,
    `origin: ${meta.origin}`,
    `parent_id: ${meta.parent_id ? `"${meta.parent_id}"` : "null"}`,
    `spawned_from_draft: ${meta.spawned_from_draft ? `"${meta.spawned_from_draft}"` : "null"}`,
    `created_at: "${meta.created_at}"`,
    `completed_at: ${meta.completed_at ? `"${meta.completed_at}"` : "null"}`,
  ];
  return `${lines.join("\n")}\n`;
}

export function buildBoardNoteMeta(input: CreateBoardNoteMetaInput): BoardNoteMeta {
  return {
    note_id: input.noteId,
    type: input.type,
    slug: input.slug,
    origin: input.origin,
    parent_id: input.parentId ?? null,
    spawned_from_draft: input.spawnedFromDraft ?? null,
    created_at: new Date().toISOString(),
    completed_at: null,
  };
}

export async function readBoardNoteMeta(
  config: Config,
  stage: BoardStage,
  noteId: string,
): Promise<BoardNoteMeta | null> {
  const path = boardNoteMetaPath(config, stage, noteId);
  try {
    return parseBoardNoteMeta(await readFile(path, "utf8"), noteId);
  } catch {
    return null;
  }
}

export async function writeBoardNoteMeta(
  config: Config,
  stage: BoardStage,
  meta: BoardNoteMeta,
): Promise<void> {
  const path = boardNoteMetaPath(config, stage, meta.note_id);
  await writeFile(path, serializeBoardNoteMeta(meta), "utf8");
}

/** Mark note completed when moving to done/ or aborted/. */
export async function markBoardNoteCompleted(
  config: Config,
  stage: BoardStage,
  noteId: string,
): Promise<BoardNoteMeta> {
  const meta = await readBoardNoteMeta(config, stage, noteId);
  if (!meta) throw new Error(`Missing meta.yaml for ${noteId}`);
  const updated: BoardNoteMeta = { ...meta, completed_at: new Date().toISOString() };
  await writeBoardNoteMeta(config, stage, updated);
  return updated;
}

/** Read brief from board note — mission.md preferred, scratch.md legacy fallback. */
export async function readBoardNoteBrief(
  config: Config,
  stage: BoardStage,
  noteId: string,
): Promise<string> {
  const entry = missionBoardEntryPath(config, stage, noteId);
  for (const name of ["mission.md", "scratch.md"]) {
    try {
      return (await readFile(join(entry, name), "utf8")).trim();
    } catch {
      // try next
    }
  }
  return "";
}
