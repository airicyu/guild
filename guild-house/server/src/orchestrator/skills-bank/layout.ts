/**
 * Ensure data/skills-bank/ exists — singleton skills catalog (committed under data/skills-bank/).
 */
import { mkdir } from "node:fs/promises";
import type { Config } from "../../config";
import { skillsBankPath } from "../../paths";

/** Create data/skills-bank/ if missing; does not seed from templates. */
export async function ensureSkillsBankLayout(config: Config): Promise<void> {
  await mkdir(skillsBankPath(config), { recursive: true });
}
