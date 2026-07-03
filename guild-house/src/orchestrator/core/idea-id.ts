/**
 * Idea id validation and minting for discovery intake (POST /ideas).
 *
 * Format: idea-{date}-{hex} or {slug}-{date}-{hex}. isIdeaIdInUse checks ideas,
 * discovering board entries, and discovery-rooms/ dir.
 */
import { stat } from "node:fs/promises";
import type { Config } from "../../config";
import { discoveryRoomPath } from "../../paths";
import { listBoard } from "./board";

/** Minted on submission: `idea-{YYYYMMDD}-{6hex}` or `{slug}-{YYYYMMDD}-{6hex}`. */
export const MINTED_IDEA_ID_PATTERN = /^(?:idea|(.+))-(\d{8})-([a-f0-9]{6})$/i;

const LEGACY_IDEA_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
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

/** Throw if ideaId is not a valid legacy or minted id. */
export function assertIdeaId(ideaId: string): void {
  if (LEGACY_IDEA_ID_PATTERN.test(ideaId) || MINTED_IDEA_ID_PATTERN.test(ideaId)) {
    return;
  }
  throw new Error(`Invalid idea id: ${ideaId}`);
}

function sanitizeSlug(slug: string): string {
  const trimmed = slug.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!trimmed) {
    throw new Error("Invalid slug: empty after sanitization");
  }
  return trimmed;
}

/** Mint `idea-{date}-{hex}` or `{slug}-{date}-{hex}`. */
export function mintIdeaId(slug?: string, date = todayYmd()): string {
  const prefix = slug ? sanitizeSlug(slug) : "idea";
  const id = `${prefix}-${date}-${randomHex6()}`;
  assertIdeaId(id);
  return id;
}

/** True when id is on ideas-backlog/ideas/discovering board or discovery-rooms/ exists. */
export async function isIdeaIdInUse(config: Config, ideaId: string): Promise<boolean> {
  const board = await listBoard(config);
  if (
    board["ideas-backlog"].includes(ideaId) ||
    board.ideas.includes(ideaId) ||
    board.discovering.includes(ideaId)
  ) {
    return true;
  }

  try {
    await stat(discoveryRoomPath(config, ideaId));
    return true;
  } catch {
    return false;
  }
}

/** Mint a collision-free idea id, retrying up to MAX_MINT_ATTEMPTS. */
export async function mintUniqueIdeaId(config: Config, slug?: string): Promise<string> {
  const date = todayYmd();
  for (let i = 0; i < MAX_MINT_ATTEMPTS; i++) {
    const id = mintIdeaId(slug, date);
    if (!(await isIdeaIdInUse(config, id))) return id;
  }
  throw new Error(`Failed to mint unique idea id${slug ? ` for slug: ${slug}` : ""}`);
}
