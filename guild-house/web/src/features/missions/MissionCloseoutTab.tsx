import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MarkdownView } from "../../components/MarkdownView";
import { ApiError, fetchMissionRoomFile } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";
import type { MissionSummaryResponse } from "../../types/mission";

interface CloseoutFile {
  path: string;
  label: string;
  group: "release" | "retro";
}

function buildCloseoutFiles(summary: MissionSummaryResponse): CloseoutFile[] {
  const files: CloseoutFile[] = [
    { path: "artifact-release.md", label: "artifact-release.md", group: "release" },
    { path: "retrospective/workflow-report.md", label: "workflow-report.md", group: "retro" },
  ];

  if (summary.board === "aborted" || summary.checkpoint?.phase === "aborted") {
    files.push({
      path: "retrospective/abort-note.md",
      label: "abort-note.md",
      group: "retro",
    });
  }

  for (const member of summary.squadMembers) {
    const slug = member.toLowerCase().replace(/\s+/g, "-");
    files.push({
      path: `retrospective/members/${slug}/feedback.md`,
      label: `${slug}/feedback.md`,
      group: "retro",
    });
  }

  return files;
}

function defaultSelectedPath(files: CloseoutFile[], phase?: string): string {
  if (phase === "retrospective" || phase === "done") {
    const workflow = files.find((f) => f.path === "retrospective/workflow-report.md");
    if (workflow) return workflow.path;
  }
  return files[0]?.path ?? "artifact-release.md";
}

interface MissionCloseoutTabProps {
  missionId: string;
  summary: MissionSummaryResponse;
}

export function MissionCloseoutTab({ missionId, summary }: MissionCloseoutTabProps) {
  const files = useMemo(() => buildCloseoutFiles(summary), [summary]);
  const phase = summary.checkpoint?.phase;
  const [selectedPath, setSelectedPath] = useState(() => defaultSelectedPath(files, phase));

  const fileQuery = useQuery({
    queryKey: queryKeys.missionRoomFile(missionId, selectedPath),
    queryFn: () => fetchMissionRoomFile(missionId, selectedPath),
    enabled: Boolean(missionId && selectedPath),
    retry: false,
  });

  const apiError = fileQuery.error instanceof ApiError ? fileQuery.error : null;
  const releaseFiles = files.filter((f) => f.group === "release");
  const retroFiles = files.filter((f) => f.group === "retro");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(12rem,16rem)_1fr]">
      {phase === "awaiting_artifact_review" && (
        <p className="lg:col-span-2 text-sm text-[var(--color-text-muted)]">
          Guild master can approve or reject from the header when session poke is enabled (default).
          If poke fails, restore the PO session and attach — inbox and checkpoint are always updated.
        </p>
      )}
      <aside className="guild-glass rounded-lg p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
          Release
        </p>
        <ul className="mb-4 space-y-1">
          {releaseFiles.map((file) => (
            <li key={file.path}>
              <button
                type="button"
                onClick={() => setSelectedPath(file.path)}
                className={[
                  "w-full rounded-md px-2 py-1.5 text-left font-mono text-xs transition",
                  selectedPath === file.path
                    ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]",
                ].join(" ")}
              >
                {file.label}
              </button>
            </li>
          ))}
        </ul>

        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
          Retrospective
        </p>
        <ul className="space-y-1">
          {retroFiles.map((file) => (
            <li key={file.path}>
              <button
                type="button"
                onClick={() => setSelectedPath(file.path)}
                className={[
                  "w-full rounded-md px-2 py-1.5 text-left font-mono text-xs transition",
                  selectedPath === file.path
                    ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]",
                ].join(" ")}
              >
                {file.label}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] leading-relaxed text-[var(--color-text-muted)]">
          Skills reports live under <code className="text-[var(--color-accent-dim)]">retrospective/skills-reports/</code>
        </p>
      </aside>

      <section className="guild-glass min-h-[16rem] rounded-lg p-5 md:p-6">
        <p className="mb-3 font-mono text-xs text-[var(--color-text-muted)]">{selectedPath}</p>
        {fileQuery.isLoading && (
          <p className="text-sm text-[var(--color-text-muted)]">Loading file…</p>
        )}
        {fileQuery.isError && (
          <p className="text-sm text-[var(--phase-blocked)]">
            {apiError?.status === 404
              ? "File not found in mission room yet."
              : (fileQuery.error as Error).message}
          </p>
        )}
        {fileQuery.data && (
          <article className="mx-auto max-w-3xl">
            <MarkdownView content={fileQuery.data.content} />
          </article>
        )}
      </section>
    </div>
  );
}
