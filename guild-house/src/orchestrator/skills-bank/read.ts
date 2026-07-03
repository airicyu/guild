/**
 * Read-only skills bank — list catalog and fetch skill folders under data/skills-bank/.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Config } from "../../config";
import { skillsBankPath } from "../../paths";
import type { SkillDetail, SkillListItem, SkillsBankSummary } from "../../types/skills-bank";

const SKIP = new Set([".gitkeep", ".DS_Store", "README.md"]);
const SKILL_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export function assertSkillName(name: string): void {
  if (!SKILL_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid skill name: ${name}`);
  }
}

async function readCatalog(config: Config): Promise<string> {
  try {
    return (await readFile(join(skillsBankPath(config), "catalog.md"), "utf8")).trim();
  } catch {
    return "";
  }
}

async function listSkillNames(config: Config): Promise<string[]> {
  const bank = skillsBankPath(config);
  let entries: string[];
  try {
    entries = await readdir(bank);
  } catch {
    return [];
  }

  const names: string[] = [];
  for (const entry of entries) {
    if (SKIP.has(entry) || entry.startsWith(".")) continue;
    const full = join(bank, entry);
    if (!(await stat(full)).isDirectory()) continue;
    try {
      await stat(join(full, "SKILL.md"));
      names.push(entry);
    } catch {
      // not a skill folder
    }
  }

  return names.sort();
}

function parseSkillDescription(content: string): string | null {
  const match = content.match(/^description:\s*(.+)$/m);
  if (!match) return null;
  const raw = match[1].trim();
  if (raw.startsWith(">-") || raw.startsWith("|")) return null;
  return raw.replace(/^['"]|['"]$/g, "");
}

async function buildSkillListItem(config: Config, name: string): Promise<SkillListItem> {
  let description: string | null = null;
  try {
    const skillMd = await readFile(join(skillsBankPath(config), name, "SKILL.md"), "utf8");
    description = parseSkillDescription(skillMd);
  } catch {
    // optional
  }
  return { name, description };
}

/** GET /skills-bank — catalog text + skill folder listing. */
export async function getSkillsBankSummary(config: Config): Promise<SkillsBankSummary> {
  const names = await listSkillNames(config);
  const skills = await Promise.all(names.map((name) => buildSkillListItem(config, name)));
  return {
    catalog: await readCatalog(config),
    skills,
    count: skills.length,
  };
}

async function collectSkillFiles(dir: string, root: string): Promise<Array<{ path: string; content: string }>> {
  const files: Array<{ path: string; content: string }> = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP.has(entry.name) || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSkillFiles(full, root)));
      continue;
    }
    const rel = relative(root, full).replace(/\\/g, "/");
    files.push({ path: rel, content: await readFile(full, "utf8") });
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/** GET /skills-bank/:name — skill folder contents; null if missing. */
export async function getSkillDetail(config: Config, name: string): Promise<SkillDetail | null> {
  assertSkillName(name);
  const root = join(skillsBankPath(config), name);
  try {
    if (!(await stat(root)).isDirectory()) return null;
    await stat(join(root, "SKILL.md"));
  } catch {
    return null;
  }

  const files = await collectSkillFiles(root, root);
  let skillMd = "";
  try {
    skillMd = await readFile(join(root, "SKILL.md"), "utf8");
  } catch {
    return null;
  }

  return {
    name,
    description: parseSkillDescription(skillMd),
    skillMd,
    files,
  };
}
