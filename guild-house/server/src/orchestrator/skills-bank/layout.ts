/**
 * Ensure data/skills-bank/ exists — dual-layer skills catalog (built-in + custom).
 */
import { mkdir } from "node:fs/promises";
import type { Config } from "../../config";
import { skillsBankPath, builtInSkillsPath, customSkillsPath } from "../../paths";

/** Create data/skills-bank/ with built-in/ and custom/ skeleton if missing. */
export async function ensureSkillsBankLayout(config: Config): Promise<void> {
  await mkdir(skillsBankPath(config), { recursive: true });
  await mkdir(builtInSkillsPath(config), { recursive: true });
  await mkdir(customSkillsPath(config), { recursive: true });
}