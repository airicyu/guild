import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";

/**
 * Shared Guild attach terminal — tab-lazy mount, WebGL xterm, alt-screen CSS.
 * Mission and discovery wrappers differ only in WS URL and copy.
 *
 * Locked semantics (specs/product.md):
 * - WS attaches to server PTY running `claude attach` — not a fresh Claude spawn.
 * - Effect cleanup closes WS + disposes xterm only; the PO/discovery --bg job keeps running.
 * - Fit xterm and pass ?cols=&rows= before opening WS so the PTY starts at the right size.
 */
type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

export interface AttachTerminalPaneProps {
  connectKey: string;
  buildWsUrl: (cols: number, rows: number) => string;
  title: string;
  restoreRequired: boolean;
  sessionLive: boolean;
  sessionLoading?: boolean;
  onRestore?: () => void;
  restorePending?: boolean;
  restorePrompt: string;
  noSessionPrompt: string;
  ensuringLabel: string;
}

const TERMINAL_BG = "#1e1e1e";

const DARK_THEME = {
  background: TERMINAL_BG,
  foreground: "#d4d4d4",
  cursor: "#b8832e",
  selectionBackground: "rgba(74, 158, 255, 0.35)",
  black: "#000000",
  red: "#f14c4c",
  green: "#23d18b",
  yellow: "#f5f543",
  blue: "#3b8eea",
  magenta: "#d670d6",
  cyan: "#29b8db",
  white: "#e5e5e5",
  brightBlack: "#666666",
  brightRed: "#f14c4c",
  brightGreen: "#23d18b",
  brightYellow: "#f5f543",
  brightBlue: "#3b8eea",
  brightMagenta: "#d670d6",
  brightCyan: "#29b8db",
  brightWhite: "#ffffff",
  scrollbarSliderBackground: "rgba(170, 170, 170, 0.55)",
  scrollbarSliderHoverBackground: "rgba(210, 210, 210, 0.75)",
  scrollbarSliderActiveBackground: "rgba(240, 240, 240, 0.9)",
  overviewRulerBorder: "#3a3a3a",
};

function trackAltScreen(term: Terminal, host: HTMLElement): () => void {
  const apply = () => {
    host.classList.toggle("mission-terminal--alt-screen", term.buffer.active.type === "alternate");
  };

  apply();
  const sub = term.buffer.onBufferChange(() => apply());
  return () => {
    sub.dispose();
    host.classList.remove("mission-terminal--alt-screen");
  };
}

function preferDragSelection(term: Terminal): () => void {
  type XtermCore = {
    _selectionService?: { disable: () => void; enable: () => void };
  };

  const core = (term as unknown as { _core?: XtermCore })._core;
  const selection = core?._selectionService;
  if (!selection) return () => {};

  const originalDisable = selection.disable.bind(selection);
  selection.disable = () => {};
  selection.enable();

  return () => {
    selection.disable = originalDisable;
  };
}

export function AttachTerminalPane({
  connectKey,
  buildWsUrl,
  title,
  restoreRequired,
  sessionLive,
  sessionLoading = false,
  onRestore,
  restorePending = false,
  restorePrompt,
  noSessionPrompt,
  ensuringLabel,
}: AttachTerminalPaneProps) {
  const paneRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [connectNonce, setConnectNonce] = useState(0);
  const [isPaneReady, setIsPaneReady] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canMountPane = !restoreRequired && (sessionLoading || sessionLive);
  const terminalReady = !sessionLoading && !restoreRequired && sessionLive;

  // Wait for tab pane dimensions before mounting xterm (terminal tab is lazy-rendered).
  useEffect(() => {
    if (!canMountPane) {
      setIsPaneReady(false);
      return;
    }

    const el = paneRef.current;
    if (!el) return;

    const hasSize = () => {
      const { width, height } = el.getBoundingClientRect();
      return width > 0 && height > 0;
    };

    if (hasSize()) {
      setIsPaneReady(true);
    } else {
      setIsPaneReady(false);
    }

    const observer = new ResizeObserver(() => {
      setIsPaneReady(hasSize());
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [canMountPane, connectNonce]);

  useEffect(() => {
    if (!terminalReady || !isPaneReady || !terminalRef.current) return;

    setStatus("connecting");
    setErrorMessage(null);

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: DARK_THEME,
      scrollback: 10000,
      overviewRuler: { width: 14, showBottomBorder: false },
      rightClickSelectsWord: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    let webglAddon: WebglAddon | null = null;

    let canSend = false;
    let displayReady = false;
    let lastCols = 0;
    let lastRows = 0;
    const outputBuffer: string[] = [];
    let ws: WebSocket | null = null;

    term.open(terminalRef.current);

    try {
      webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon?.dispose();
        webglAddon = null;
        // Force a full redraw so the DOM renderer (fallback) picks up cleanly
        term.refresh(0, term.rows - 1);
      });
      term.loadAddon(webglAddon);
    } catch {
      webglAddon = null;
    }

    const restoreSelection = preferDragSelection(term);
    const restoreAltClass = trackAltScreen(term, paneRef.current!);
    term.focus();

    const syncTerminalSize = () => {
      const host = terminalRef.current;
      if (!host) return;
      const { width, height } = host.getBoundingClientRect();
      if (width < 2 || height < 2) return;

      fitAddon.fit();
      const { cols, rows } = term;
      if (cols === lastCols && rows === lastRows) return;
      lastCols = cols;
      lastRows = rows;
      if (canSend && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "pty_resize", cols, rows }));
      }
    };

    const syncAfterAttach = (flushBufferedOutput: boolean) => {
      syncTerminalSize();
      if (flushBufferedOutput) {
        for (const chunk of outputBuffer) {
          term.write(chunk);
        }
        outputBuffer.length = 0;
        term.scrollToBottom();
        displayReady = true;
      }
      window.setTimeout(() => {
        syncTerminalSize();
        term.scrollToBottom();
      }, 100);
    };

    const connectWebSocket = () => {
      // cols/rows in WS URL + initial pty_resize — server spawns attach PTY at this geometry.
      fitAddon.fit();
      const { cols, rows } = term;
      lastCols = cols;
      lastRows = rows;

      ws = new WebSocket(buildWsUrl(cols, rows));

      ws.onopen = () => {
        canSend = true;
        ws!.send(JSON.stringify({ type: "pty_resize", cols: lastCols, rows: lastRows }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as {
            type: string;
            data?: string;
            message?: string;
          };

          switch (message.type) {
            case "pty_output":
              if (message.data) {
                if (displayReady) term.write(message.data);
                else outputBuffer.push(message.data);
              }
              break;
            case "connected":
              setStatus("connected");
              syncAfterAttach(true);
              term.focus();
              break;
            case "error":
              canSend = false;
              setStatus("error");
              setErrorMessage(message.message ?? "Attach failed");
              break;
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = (event) => {
        canSend = false;
        if (event.code === 1006) {
          setStatus("error");
          setErrorMessage(
            "Cannot reach Guild House API — ensure `bun run dev` is running on port 3847",
          );
        } else {
          setStatus((prev) => (prev === "error" ? "error" : "disconnected"));
        }
      };

      ws.onerror = () => {
        canSend = false;
        setStatus("error");
        setErrorMessage(
          "WebSocket connection failed — is the API server running on port 3847?",
        );
      };
    };

    void document.fonts.ready.then(connectWebSocket);

    term.onData((data) => {
      if (!canSend || !ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "chat_input", data }));
    });

    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") return true;
      const key = event.key.toLowerCase();

      const copySelection = () => {
        const text = term.getSelection();
        if (!text) return false;
        void navigator.clipboard.writeText(text);
        return true;
      };

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "c") {
        return copySelection() ? false : true;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === "c" && term.hasSelection()) {
        return copySelection() ? false : true;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === "c") return true;
      if ((event.ctrlKey || event.metaKey) && key === "v") return false;
      return true;
    });

    const handlePaste = (event: ClipboardEvent) => {
      event.preventDefault();
      const text = event.clipboardData?.getData("text");
      if (text && canSend && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "chat_input", data: text }));
      }
    };

    const terminalHost = terminalRef.current;
    terminalHost?.addEventListener("paste", handlePaste);

    const resizeObserver = new ResizeObserver(() => {
      syncTerminalSize();
    });
    const pane = paneRef.current;
    if (pane) {
      resizeObserver.observe(pane);
    }

    // Scroll-triggered refresh — fixes WebGL rendering artifacts when scrolling
    // through the scrollback buffer. The WebGL texture atlas can get out of sync
    // with the scroll position, causing garbled/incomplete rendering.
    let scrollRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scrollableEl = term.element?.querySelector(".xterm-scrollable-element") as HTMLElement | null;
    const handleScroll = () => {
      if (scrollRefreshTimer) return; // debounce — refresh at most once per animation frame
      scrollRefreshTimer = setTimeout(() => {
        scrollRefreshTimer = null;
        if (webglAddon) {
          term.refresh(0, term.rows - 1);
        }
      }, 50);
    };
    scrollableEl?.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      canSend = false;
      if (scrollRefreshTimer) clearTimeout(scrollRefreshTimer);
      scrollableEl?.removeEventListener("scroll", handleScroll);
      restoreSelection();
      restoreAltClass();
      resizeObserver.disconnect();
      terminalHost?.removeEventListener("paste", handlePaste);
      // Detach UI only — does not stop the background PO/discovery job on the server.
      ws?.close();
      webglAddon?.dispose();
      term.dispose();
    };
  }, [terminalReady, isPaneReady, connectKey, connectNonce, buildWsUrl]);

  const statusLabel = () => {
    switch (status) {
      case "idle":
        return "Idle";
      case "connecting":
        return "Connecting…";
      case "connected":
        return "Attached";
      case "disconnected":
        return "Detached";
      case "error":
        return "Error";
    }
  };

  const statusDotClass = () => {
    switch (status) {
      case "connected":
        return "bg-[var(--phase-running)] shadow-[0_0_6px_rgba(5,150,105,0.45)]";
      case "connecting":
        return "bg-[var(--color-accent)] animate-pulse";
      case "error":
        return "bg-[var(--phase-blocked)]";
      default:
        return "bg-[var(--color-text-muted)]";
    }
  };

  if (restoreRequired) {
    return (
      <div className="guild-glass rounded-lg p-8 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">{restorePrompt}</p>
        {onRestore && (
          <button
            type="button"
            disabled={restorePending}
            onClick={onRestore}
            className="guild-btn-primary mt-4 rounded-lg px-4 py-2 text-sm"
          >
            {restorePending ? "Restoring…" : "Restore session"}
          </button>
        )}
      </div>
    );
  }

  if (!canMountPane) {
    return (
      <div className="guild-glass rounded-lg p-8 text-center text-sm text-[var(--color-text-muted)]">
        {noSessionPrompt}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {title}
        </span>
        <div className="flex items-center gap-3">
          {errorMessage && (
            <span className="max-w-xs truncate text-xs text-[var(--phase-blocked)]">{errorMessage}</span>
          )}
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${statusDotClass()}`} />
            <span className="text-xs text-[var(--color-text-muted)]">
              {sessionLoading ? "Ensuring session…" : statusLabel()}
            </span>
          </div>
          {(status === "disconnected" || status === "error") && (
            <button
              type="button"
              onClick={() => setConnectNonce((n) => n + 1)}
              className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-accent)] hover:border-[var(--color-border-strong)]"
            >
              Reconnect
            </button>
          )}
        </div>
      </div>
      <div
        ref={paneRef}
        className="mission-terminal-host relative flex h-[min(70vh,520px)] flex-col px-2 pt-2 pb-0"
        style={{ backgroundColor: TERMINAL_BG }}
      >
        {sessionLoading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center text-sm text-[#a0a0a0]"
            style={{ backgroundColor: "rgba(30, 30, 30, 0.85)" }}
          >
            {ensuringLabel}
          </div>
        )}
        <div ref={terminalRef} className="mission-terminal-surface min-h-0 flex-1" />
      </div>
      <p className="border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-2 text-[10px] text-[var(--color-text-muted)]">
        Bash scrollback: scrollbar on the right + wheel. Attach fullscreen: wheel only, no scrollbar.
      </p>
    </div>
  );
}
