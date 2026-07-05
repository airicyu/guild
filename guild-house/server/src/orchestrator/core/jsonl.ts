/**
 * Generic JSONL helpers — outbox, events, and similar append-only logs.
 */
import { JSONL } from "bun";
import { appendFile, readFile, writeFile } from "node:fs/promises";

/** Read all JSON lines; returns [] on missing or invalid file. */
export async function readJsonl<T>(path: string): Promise<T[]> {
  try {
    const raw = await readFile(path, "utf8");
    if (!raw.trim()) return [];
    return JSONL.parse(raw) as T[];
  } catch {
    return [];
  }
}

/** Append one JSON object as a new line (append-only log). */
export async function appendJsonl<T>(path: string, entry: T): Promise<void> {
  await appendFile(path, `${JSON.stringify(entry)}\n`, "utf8");
}

/** Replace entire JSONL file with given entries. */
export async function writeJsonl<T>(path: string, entries: T[]): Promise<void> {
  const body = entries.length > 0 ? `${entries.map((e) => JSON.stringify(e)).join("\n")}\n` : "";
  await writeFile(path, body, "utf8");
}
