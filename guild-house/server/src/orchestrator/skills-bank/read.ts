/**
 * Read-only skills bank — list catalog and fetch skill folders under data/skills-bank/.
 * Built-in skills take priority over custom skills with the same name.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Config } from "../../config";
import { builtInCatalogPath, builtInSkillsPath, customCatalogPath, customSkillsPath, skillsBankPath } from "../../paths";
import type { SkillDetail, SkillListItem, SkillsBankSummary } from "../../types/skills-bank";

const SKIP = new Set([".gitkeep", ".DS_Store", "README.md"]);
const SKILL_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export function assertSkillName(name: string): void {
  if (!SKILL_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid skill name: ${name}`);
  }
}

async function readSingleCatalog(path: string): Promise<string> {
  try {
    return (await readFile(path, "utf8")).trim();
  } catch {
    return "";
  }
}

/** Merge built-in and custom catalog text. */
async function readMergedCatalog(config: Config): Promise<string> {
  const builtIn = await readSingleCatalog(builtInCatalogPath(config));
  const custom = await readSingleCatalog(customCatalogPath(config));
  const parts: string[] = [];
  if (builtIn) parts.push(builtIn);
  if (custom) parts.push(custom);
  return parts.join("\n\n");
}

/** Scan a single skills directory for skill names (folders with SKILL.md). */
async function scanSkillsDir(skillsDir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(skillsDir);
  } catch {
    return [];
  }

  const names: string[] = [];
  for (const entry of entries) {
    if (SKIP.has(entry) || entry.startsWith(".")) continue;
    const full = join(skillsDir, entry);
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

/** List unique skill names: built-in first (wins dedup), then custom. */
async function listSkillNames(config: Config): Promise<string[]> {
  const builtInNames = await scanSkillsDir(builtInSkillsPath(config));
  const customNames = await scanSkillsDir(customSkillsPath(config));

  const seen = new Set(builtInNames);
  const result = [...builtInNames];
  for (const name of customNames) {
    if (!seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }

  return result;
}

function parseSkillDescription(content: string): string | null {
  const match = content.match(/^description:\s*(.+)$/m);
  if (!match) return null;
  const raw = match[1].trim();
  if (raw.startsWith(">-") || raw.startsWith("|")) return null;
  return raw.replace(/^['"]|['"]$/g, "");
}

/** Find which source directory a skill lives in. */
async function resolveSkillSource(config: Config, name: string): Promise<"built-in" | "custom" | null> {
  const builtIn = join(builtInSkillsPath(config), name);
  try {
    if ((await stat(builtIn)).isDirectory()) return "built-in";
  } catch {
    // not in built-in
  }
  const custom = join(customSkillsPath(config), name);
  try {
    if ((await stat(custom)).isDirectory()) return "custom";
  } catch {
    // not in custom
  }
  return null;
}

async function buildSkillListItem(config: Config, name: string, source: "built-in" | "custom"): Promise<SkillListItem> {
  let description: string | null = null;
  const skillsDir = source === "built-in" ? builtInSkillsPath(config) : customSkillsPath(config);
  try {
    const skillMd = await readFile(join(skillsDir, name, "SKILL.md"), "utf8");
    description = parseSkillDescription(skillMd);
  } catch {
    // optional
  }
  return { name, description, source };
}

/** GET /skills-bank — catalog text + skill folder listing. */
export async function getSkillsBankSummary(config: Config): Promise<SkillsBankSummary> {
  const names = await listSkillNames(config);
  const skills: SkillListItem[] = [];
  for (const name of names) {
    const source = await resolveSkillSource(config, name);
    if (source) {
      skills.push(await buildSkillListItem(config, name, source));
    }
  }
  return {
    catalog: await readMergedCatalog(config),
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

  // Look in built-in first, then custom
  const builtInRoot = join(builtInSkillsPath(config), name);
  let root = builtInRoot;
  let found = false;
  try {
    if ((await stat(builtInRoot)).isDirectory()) {
      await stat(join(builtInRoot, "SKILL.md"));
      found = true;
    }
  } catch {
    // not in built-in
  }

  if (!found) {
    const customRoot = join(customSkillsPath(config), name);
    try {
      if ((await stat(customRoot)).isDirectory()) {
        await stat(join(customRoot, "SKILL.md"));
        root = customRoot;
        found = true;
      }
    } catch {
      // not in custom either
    }
  }

  if (!found) return null;

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