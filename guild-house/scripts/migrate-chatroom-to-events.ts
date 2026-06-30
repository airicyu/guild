/**
 * One-off: migrate chatroom.jsonl → events.jsonl in mission rooms.
 * Run: bun run scripts/migrate-chatroom-to-events.ts
 */
import { readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const GUILD_HOME = join(import.meta.dir, "..", "data");
const ROOMS = join(GUILD_HOME, "mission-rooms");

function mapType(type: string): string {
  if (type === "message") return "status";
  return type;
}

async function migrateRoom(roomId: string) {
  const chatPath = join(ROOMS, roomId, "memories", "common", "chatroom.jsonl");
  const eventsPath = join(ROOMS, roomId, "memories", "common", "events.jsonl");

  let raw: string;
  try {
    raw = await readFile(chatPath, "utf8");
  } catch {
    return;
  }

  const lines = raw.split("\n").filter((l) => l.trim());
  const migrated = lines.map((line) => {
    const entry = JSON.parse(line) as { type?: string };
    if (entry.type) entry.type = mapType(entry.type);
    return JSON.stringify(entry);
  });

  const existing = await readFile(eventsPath, "utf8").catch(() => "");
  const merged = [...existing.split("\n").filter((l) => l.trim()), ...migrated].join("\n");
  const output = merged ? `${merged}\n` : "";

  await writeFile(eventsPath, output, "utf8");
  await unlink(chatPath);
  console.log(`Migrated ${roomId}: ${migrated.length} entries`);
}

const { readdir } = await import("node:fs/promises");
const rooms = await readdir(ROOMS);
for (const roomId of rooms) {
  await migrateRoom(roomId);
}
