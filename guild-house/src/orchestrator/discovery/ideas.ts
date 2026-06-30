/**
 * Idea submission and GET helpers — ideas + discovering board stages.
 *
 * createIdea writes scratch.md under mission-board/ideas/{id}/.
 * getIdea probes session liveness when on discovering board.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import { discoveryRoomPath, ideaBoardEntryPath } from "../../paths";
import type { CreateIdeaRequest, IdeaDetail, IdeaListItem } from "../../types/discovery";
import { assertIdeaId, mintUniqueIdeaId } from "../core/idea-id";
import { listBoard } from "../core/board";
import { readDiscoveryCheckpoint } from "./checkpoint";
import { syncActiveDiscovery } from "./session-lifecycle";

const SCRATCH_PREVIEW_LEN = 200;

async function readScratch(config: Config, ideaId: string, stage: "ideas" | "discovering"): Promise<string> {
  const path = join(ideaBoardEntryPath(config, stage, ideaId), "scratch.md");
  try {
    return (await readFile(path, "utf8")).trim();
  } catch {
    return "";
  }
}

function scratchPreview(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= SCRATCH_PREVIEW_LEN) return trimmed;
  return `${trimmed.slice(0, SCRATCH_PREVIEW_LEN)}…`;
}

/** POST /ideas — mint id, write idea.md on ideas board, optional slug. */
export async function createIdea(config: Config, body: CreateIdeaRequest) {
  const text = body.text?.trim();
  if (!text) {
    throw new Error("Missing text");
  }

  const ideaId = await mintUniqueIdeaId(config, body.slug?.trim() || undefined);
  const entryPath = ideaBoardEntryPath(config, "ideas", ideaId);
  await mkdir(entryPath, { recursive: true });
  await writeFile(join(entryPath, "scratch.md"), text, "utf8");

  return {
    ok: true as const,
    ideaId,
    board: "ideas" as const,
    scratchPreview: scratchPreview(text),
  };
}

async function buildListItem(
  config: Config,
  ideaId: string,
  stage: "ideas" | "discovering",
): Promise<IdeaListItem> {
  const scratch = await readScratch(config, ideaId, stage);
  const item: IdeaListItem = {
    id: ideaId,
    board: stage,
    scratchPreview: scratchPreview(scratch),
  };

  if (stage === "discovering") {
    const synced = await syncActiveDiscovery(config, ideaId);
    const checkpoint = synced?.checkpoint ?? (await readDiscoveryCheckpoint(config, ideaId));
    item.phase = checkpoint?.phase;
    item.sessionLive = synced?.live ?? false;
  }

  return item;
}

/** List ideas board entries with checkpoint phase when on discovering. */
export async function listIdeas(config: Config) {
  const board = await listBoard(config);
  const items = await Promise.all([
    ...board.ideas.map((id) => buildListItem(config, id, "ideas")),
    ...board.discovering.map((id) => buildListItem(config, id, "discovering")),
  ]);

  return { ideas: items, count: items.length };
}

/** Idea detail for ideas or discovering board; null if not found. */
export async function getIdea(config: Config, ideaId: string): Promise<IdeaDetail | null> {
  assertIdeaId(ideaId);
  const board = await listBoard(config);

  let stage: "ideas" | "discovering" | null = null;
  if (board.ideas.includes(ideaId)) stage = "ideas";
  else if (board.discovering.includes(ideaId)) stage = "discovering";
  else return null;

  const scratch = await readScratch(config, ideaId, stage);
  const detail: IdeaDetail = {
    id: ideaId,
    board: stage,
    scratch,
    scratchPreview: scratchPreview(scratch),
  };

  if (stage === "discovering") {
    const synced = await syncActiveDiscovery(config, ideaId);
    const checkpoint = synced?.checkpoint ?? (await readDiscoveryCheckpoint(config, ideaId));

    detail.checkpoint = checkpoint;
    detail.sessionLive = synced?.live ?? false;
    detail.jobState = synced?.jobState ?? checkpoint?.claude_session.job_state ?? "missing";
    detail.restoreRequired = synced?.restoreRequired ?? false;
    detail.roomPath = discoveryRoomPath(config, ideaId);
    detail.phase = checkpoint?.phase;
  }

  return detail;
}
