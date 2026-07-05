/**
 * {{key}} substitution for mission/discovery room templates (playbooks, handoff).
 *
 * Substitute only stable ids/paths (ideaId, missionId, briefPath) — not display names.
 * Playbooks use the role term **guild master**; see specs/product.md § Guild master.
 */
/** Replace `{{key}}` placeholders in template file content. */
export function applyTemplateVars(content: string, vars: Record<string, string>): string {
  let out = content;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out;
}
