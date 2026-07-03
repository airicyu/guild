import type { IdeaBoard } from "../../types/discovery";

export type IdeaTabId = "scratch" | "drafts" | "outbox" | "terminal";

export const IDEA_TABS: { id: IdeaTabId; label: string }[] = [
  { id: "scratch", label: "Scratch" },
  { id: "drafts", label: "Draft missions" },
  { id: "outbox", label: "Outbox" },
  { id: "terminal", label: "Terminal" },
];

/** Backlog and ideas columns show scratch only; discovering gets full room tabs. */
export function ideaTabsForBoard(board: IdeaBoard | undefined): { id: IdeaTabId; label: string }[] {
  if (board === "discovering") return IDEA_TABS;
  return IDEA_TABS.filter((t) => t.id === "scratch");
}
