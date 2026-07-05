/**
 * List and preview mission draft packages under discovery room artifacts/missions/.
 *
 * Used by GET /ideas/:id/drafts and approve validation (hasMissionMd gate).
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import { frontmatterScalar, stripFrontmatterBody } from "../../frontmatter";
import { intakeArtifactsMissionsPath, missionRoomPath } from "../../paths";
import type { IdeaDraftsSummary, MissionDraftSummary } from "../../types/discovery";
import { assertNoteId } from "../core/note-id";
import { getBoardNote } from "../board-notes";

const PREVIEW_LEN = 240;
const SKIP = new Set([".gitkeep", ".DS_Store"]);

function previewBody(content: string): string {
  const trimmed = stripFrontmatterBody(content);
  if (trimmed.length <= PREVIEW_LEN) return trimmed;
  return `${trimmed.slice(0, PREVIEW_LEN)}…`;
}

async function listMissionDraftFolders(config: Config, ideaId: string): Promise<string[]> {
  const dir = intakeArtifactsMissionsPath(config, ideaId);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const folders: string[] = [];
  for (const entry of entries) {
    if (SKIP.has(entry) || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if ((await stat(full)).isDirectory()) folders.push(entry);
  }

  return folders.sort();
}

/** Parse mission.md frontmatter from a draft folder for approval UI. */
export async function summarizeMissionDraft(
  config: Config,
  ideaId: string,
  folder: string,
): Promise<MissionDraftSummary> {
  const missionPath = join(intakeArtifactsMissionsPath(config, ideaId), folder, "mission.md");
  try {
    const content = await readFile(missionPath, "utf8");
    return {
      folder,
      title: frontmatterScalar(content, "title"),
      preview: previewBody(content),
      hasMissionMd: true,
    };
  } catch {
    return {
      folder,
      title: null,
      preview: "",
      hasMissionMd: false,
    };
  }
}

/** List draft mission packages under discovery room artifacts (valid = has mission.md). */
export async function listValidMissionDraftFolders(config: Config, ideaId: string): Promise<string[]> {
  const folders = await listMissionDraftFolders(config, ideaId);
  const valid: string[] = [];

  for (const folder of folders) {
    const summary = await summarizeMissionDraft(config, ideaId, folder);
    if (summary.hasMissionMd) valid.push(folder);
  }

  return valid;
}

/** List draft folders with valid mission.md under artifacts/missions/. */
export async function getIdeaDrafts(config: Config, ideaId: string): Promise<IdeaDraftsSummary | null> {
  assertNoteId(ideaId);

  try {
    await stat(missionRoomPath(config, ideaId));
  } catch {
    const note = await getBoardNote(config, ideaId);
    if (!note) return null;
    return { ideaId, drafts: [], count: 0 };
  }

  const folders = await listMissionDraftFolders(config, ideaId);
  const drafts = await Promise.all(
    folders.map((folder) => summarizeMissionDraft(config, ideaId, folder)),
  );

  return { ideaId, drafts, count: drafts.length };
}
