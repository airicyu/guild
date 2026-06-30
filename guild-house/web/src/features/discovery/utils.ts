export type IdeaTabId = "scratch" | "drafts" | "outbox" | "terminal";

export const IDEA_TABS: { id: IdeaTabId; label: string }[] = [
  { id: "scratch", label: "Scratch" },
  { id: "drafts", label: "Draft missions" },
  { id: "outbox", label: "Outbox" },
  { id: "terminal", label: "Terminal" },
];
