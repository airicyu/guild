/**
 * Preprocess mission brief markdown for display (Web layer only — disk file unchanged).
 * Strips YAML frontmatter, surfaces metadata separately, cleans body headings/spacing.
 */

const KNOWN_META_KEYS = ["title", "intent", "autonomy", "priority", "constraints"] as const;

export type BriefMetadataKey = (typeof KNOWN_META_KEYS)[number];

export interface BriefMetadata {
  title?: string;
  intent?: string;
  autonomy?: string;
  priority?: string;
  constraints?: string[];
  /** Any other frontmatter keys (scalar or list). */
  extra: Record<string, string | string[]>;
}

export interface NormalizedBrief {
  metadata: BriefMetadata;
  /** Markdown body after frontmatter strip + cleanup. */
  body: string;
  /** Title for page heading — frontmatter title or first H1. */
  displayTitle: string | null;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function splitFrontmatter(raw: string): { yaml: string; body: string } | null {
  const trimmed = raw.replace(/^\uFEFF/, "").trimStart();
  if (!trimmed.startsWith("---")) return null;
  const end = trimmed.indexOf("\n---", 3);
  if (end === -1) return null;
  return {
    yaml: trimmed.slice(3, end).trim(),
    body: trimmed.slice(end + 4).replace(/^\r?\n/, ""),
  };
}

/** Minimal YAML parser for mission.md frontmatter (scalars + one-level lists). */
export function parseBriefFrontmatter(yaml: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  let listKey: string | null = null;

  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem && listKey) {
      const items = (result[listKey] as string[]) ?? [];
      items.push(unquote(listItem[1].trim()));
      result[listKey] = items;
      continue;
    }

    const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;

    const [, key, rest] = kv;
    if (rest === "" || rest === "|" || rest === ">") {
      listKey = key;
      result[key] = [];
      continue;
    }

    listKey = null;
    result[key] = unquote(rest.trim());
  }

  return result;
}

function toMetadata(parsed: Record<string, string | string[]>): BriefMetadata {
  const extra: Record<string, string | string[]> = {};
  const metadata: BriefMetadata = { extra };

  for (const [key, value] of Object.entries(parsed)) {
    if ((KNOWN_META_KEYS as readonly string[]).includes(key)) {
      if (key === "constraints" && Array.isArray(value)) {
        metadata.constraints = value;
      } else if (key === "title" && typeof value === "string") {
        metadata.title = value;
      } else if (key === "intent" && typeof value === "string") {
        metadata.intent = value;
      } else if (key === "autonomy" && typeof value === "string") {
        metadata.autonomy = value;
      } else if (key === "priority" && typeof value === "string") {
        metadata.priority = value;
      }
    } else {
      extra[key] = value;
    }
  }

  return metadata;
}

function collapseBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeTitleToken(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titlesMatch(a: string, b: string): boolean {
  const na = normalizeTitleToken(a);
  const nb = normalizeTitleToken(b);
  if (!na || !nb) return false;
  return na === nb || na.startsWith(nb) || nb.startsWith(na);
}

/** Remove leading H1 when it duplicates frontmatter title. */
function stripDuplicateTitleHeading(body: string, title: string | undefined): string {
  if (!title) return body;

  const lines = body.split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i += 1;
  if (i >= lines.length) return body;

  const h1 = lines[i].match(/^#\s+(.+)$/);
  if (!h1 || !titlesMatch(h1[1], title)) return body;

  lines.splice(i, 1);
  while (i < lines.length && !lines[i].trim()) lines.splice(i, 1);
  return lines.join("\n");
}

/** Demote lone H1 sections to H2 when title is shown separately. */
function demoteTopLevelHeadings(body: string, hasDisplayTitle: boolean): string {
  if (!hasDisplayTitle) return body;
  return body.replace(/^#\s+(.+)$/gm, "## $1");
}

function firstHeadingTitle(body: string): string | null {
  const match = body.match(/^#{1,6}\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

export function normalizeBriefContent(raw: string): NormalizedBrief {
  const split = splitFrontmatter(raw);
  const empty: NormalizedBrief = {
    metadata: { extra: {} },
    body: collapseBlankLines(raw.trim()),
    displayTitle: firstHeadingTitle(raw) ?? null,
  };

  if (!split) return empty;

  const parsed = parseBriefFrontmatter(split.yaml);
  const metadata = toMetadata(parsed);

  let body = collapseBlankLines(split.body);
  body = stripDuplicateTitleHeading(body, metadata.title);

  const displayTitle = metadata.title ?? firstHeadingTitle(body) ?? null;
  body = demoteTopLevelHeadings(body, Boolean(displayTitle));

  return { metadata, body, displayTitle };
}

export function hasBriefMetadata(metadata: BriefMetadata): boolean {
  return Boolean(
    metadata.intent ||
      metadata.autonomy ||
      metadata.priority ||
      (metadata.constraints && metadata.constraints.length > 0) ||
      Object.keys(metadata.extra).length > 0,
  );
}
