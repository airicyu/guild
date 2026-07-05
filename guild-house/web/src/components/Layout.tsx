import { useQuery } from "@tanstack/react-query";
import { Activity, KeyRound, LayoutGrid, Lightbulb, ScrollText, type LucideIcon } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ApiKeyBanner } from "./ApiKeyBanner";
import { ApiError, fetchBoard, fetchOutbox } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { useHealth } from "../providers/AppProviders";

interface LayoutProps {
  onOpenSettings: () => void;
}

const nav: Array<{
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badgeKey?: "outbox" | "discovering";
  isActiveMatch?: (pathname: string) => boolean;
}> = [
  { to: "/", label: "Board", icon: LayoutGrid, end: true },
  {
    to: "/discovering",
    label: "Discovering",
    icon: Lightbulb,
    badgeKey: "discovering",
    isActiveMatch: (pathname) =>
      pathname === "/discovering" || pathname.startsWith("/ideas/"),
  },
  {
    to: "/hall",
    label: "Missions",
    icon: Activity,
    isActiveMatch: (pathname) => pathname === "/hall" || pathname.startsWith("/missions/"),
  },
  { to: "/outbox", label: "Outbox", icon: ScrollText, badgeKey: "outbox" },
];

function isNavItemActive(
  pathname: string,
  to: string,
  end: boolean | undefined,
  isActiveMatch: ((pathname: string) => boolean) | undefined,
): boolean {
  if (isActiveMatch) return isActiveMatch(pathname);
  return end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}

export function Layout({ onOpenSettings }: LayoutProps) {
  const location = useLocation();
  const { data: health, isLoading, isError } = useHealth();
  const boardProbe = useQuery({
    // Lightweight auth + discovering badge count (shares cache with BoardPage).
    queryKey: queryKeys.board,
    queryFn: fetchBoard,
    retry: false,
  });
  const outboxProbe = useQuery({
    queryKey: queryKeys.outbox,
    queryFn: fetchOutbox,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const authFailed =
    boardProbe.error instanceof ApiError && boardProbe.error.status === 401;
  const outboxCount = outboxProbe.data?.count ?? 0;
  const discoveringCount = boardProbe.data?.discovering.length ?? 0;

  return (
    <div className="guild-grid-bg flex h-full min-h-screen">
      <aside className="guild-glass flex w-56 shrink-0 flex-col border-r border-[var(--color-border)]">
        <div className="border-b border-[var(--color-border)] px-5 py-5">
          <h1 className="guild-display text-lg font-bold tracking-wide text-[var(--color-accent)]">
            Guild House
          </h1>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Command center</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {nav.map(({ to, label, icon: Icon, end, badgeKey, isActiveMatch }) => {
            const active = isNavItemActive(location.pathname, to, end, isActiveMatch);
            return (
            <NavLink
              key={to}
              to={to}
              end={end}
              aria-current={active ? "page" : undefined}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--color-accent-glow)] text-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]",
              ].join(" ")}
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {badgeKey === "outbox" && outboxCount > 0 && (
                <span
                  className="min-w-[1.25rem] rounded-full bg-[var(--phase-blocked)] px-1.5 py-0.5 text-center text-[10px] font-bold text-white"
                  aria-label={`${outboxCount} unread`}
                >
                  {outboxCount}
                </span>
              )}
              {badgeKey === "discovering" && discoveringCount > 0 && (
                <span
                  className="min-w-[1.25rem] rounded-full bg-[var(--board-discovering-accent)] px-1.5 py-0.5 text-center text-[10px] font-bold text-white"
                  aria-label={`${discoveringCount} discovering`}
                >
                  {discoveringCount}
                </span>
              )}
            </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-[var(--color-border)] p-4 text-xs text-[var(--color-text-muted)]">
          API v{health?.version ?? "—"}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="guild-glass flex items-center justify-between border-b border-[var(--color-border)] px-6 py-3">
          <div className="flex items-center gap-3">
            <span
              className={`h-2 w-2 rounded-full ${
                isLoading ? "bg-[var(--color-text-muted)]" : isError ? "bg-[var(--phase-blocked)]" : "bg-[var(--phase-running)]"
              }`}
            />
            <span className="text-sm text-[var(--color-text-muted)]">
              {isError
                ? "API offline — start guild-house on :3847"
                : health
                  ? `${health.guildMasterName} · ${health.service}`
                  : "Connecting…"}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
          >
            <KeyRound size={16} />
            API key
          </button>
        </header>

        {authFailed && <ApiKeyBanner onOpenSettings={onOpenSettings} />}

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
