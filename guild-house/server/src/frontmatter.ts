/**
 * Markdown frontmatter helpers — body is markdown; header is YAML.
 * Use Bun.YAML.parse (https://bun.com/docs/runtime/yaml), not Bun.markdown (render-only).
 */
import { YAML } from "bun";

export function splitFrontmatter(content: string): { yaml: string | null; body: string } {
  if (!content.startsWith("---")) return { yaml: null, body: content };
  const end = content.indexOf("\n---", 3);
  if (end === -1) return { yaml: null, body: content };
  return {
    yaml: content.slice(3, end).trim(),
    body: content.slice(end + 4),
  };
}

export function parseFrontmatter<T extends Record<string, unknown> = Record<string, unknown>>(
  content: string,
): T {
  const { yaml } = splitFrontmatter(content);
  if (!yaml) return {} as T;
  return YAML.parse(yaml) as T;
}

export function frontmatterScalar(content: string, key: string): string | null {
  const value = parseFrontmatter(content)[key];
  if (value === undefined || value === null) return null;
  return String(value);
}

export function stripFrontmatterBody(content: string): string {
  return splitFrontmatter(content).body.trim();
}
