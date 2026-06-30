/**
 * List and preview mission draft packages under discovery room artifacts/missions/.
 *
 * Used by GET /ideas/:id/drafts and approve validation (hasMissionMd gate).
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import { discoveryArtifactsMissionsPath, discoveryRoomPath } from "../../paths";
import type { IdeaDraftsSummary, MissionDraftSummary } from "../../types/discovery";
import { assertIdeaId } from "../core/idea-id";
import { getIdea } from "./ideas";

const PREVIEW_LEN = 240;
const SKIP = new Set([".gitkeep", ".DS_Store"]);

function parseFrontmatterTitle(content: string): string | null {
  if (!content.startsWith("---")) return null;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return null;
  const block = content.slice(3, end);
  for (const line of block.split("\n")) {
    const match = line.match(/^title:\s*(?:"([^"]*)"|'([^']*)'|(.+))\s*$/);
    if (match) return (match[1] ?? match[2] ?? match[3]).trim();
  }
  return null;
}

function previewBody(content: string): string {
  let body = content;
  if (content.startsWith("---")) {
    const end = content.indexOf("\n---", 3);
    if (end !== -1) body = content.slice(end + 4);
  }
  const trimmed = body.trim();
  if (trimmed.length <= PREVIEW_LEN) return trimmed;
  return `${trimmed.slice(0, PREVIEW_LEN)}…`;
}

async function listMissionDraftFolders(config: Config, ideaId: string): Promise<string[]> {
  const dir = discoveryArtifactsMissionsPath(config, ideaId);
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
  const missionPath = join(discoveryArtifactsMissionsPath(config, ideaId), folder, "mission.md");
  try {
    const content = await readFile(missionPath, "utf8");
    return {
      folder,
      title: parseFrontmatterTitle(content),
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
  assertIdeaId(ideaId);

  try {
    await stat(discoveryRoomPath(config, ideaId));
  } catch {
    const idea = await getIdea(config, ideaId);
    if (!idea) return null;
    return { ideaId, drafts: [], count: 0 };
  }

  const folders = await listMissionDraftFolders(config, ideaId);
  const drafts = await Promise.all(
    folders.map((folder) => summarizeMissionDraft(config, ideaId, folder)),
  );

  return { ideaId, drafts, count: drafts.length };
}
