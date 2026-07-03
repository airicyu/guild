/**
 * Seed skills-bank from templates/skills-bank when data/skills-bank/catalog.md is missing.
 */
import { cp, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import { skillsBankPath, skillsBankTemplatePath } from "../../paths";

/** Ensure data/skills-bank/ exists; seed from template on first boot. */
export async function ensureSkillsBankLayout(config: Config): Promise<void> {
  const bankPath = skillsBankPath(config);
  await mkdir(bankPath, { recursive: true });

  const catalogPath = join(bankPath, "catalog.md");
  try {
    await stat(catalogPath);
    return;
  } catch {
    // seed from template
  }

  const templatePath = skillsBankTemplatePath(config);
  await cp(templatePath, bankPath, {
    recursive: true,
    force: true,
    filter: (src) => !src.endsWith("README.md"),
  });
}
