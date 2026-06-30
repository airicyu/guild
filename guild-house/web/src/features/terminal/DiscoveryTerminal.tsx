import { useCallback } from "react";
import { discoveryAttachWebSocketUrl } from "../../lib/api";
import { AttachTerminalPane } from "./AttachTerminalPane";

/** Discovery intake attach — WS path /ws/discoveries/:id/attach. */
interface DiscoveryTerminalProps {
  ideaId: string;
  restoreRequired: boolean;
  sessionLive: boolean;
  sessionLoading?: boolean;
  onRestore?: () => void;
  restorePending?: boolean;
}

export function DiscoveryTerminal(props: DiscoveryTerminalProps) {
  const { ideaId, ...rest } = props;
  const buildWsUrl = useCallback(
    (cols: number, rows: number) => discoveryAttachWebSocketUrl(ideaId, cols, rows),
    [ideaId],
  );

  return (
    <AttachTerminalPane
      connectKey={ideaId}
      buildWsUrl={buildWsUrl}
      title="Discovery terminal"
      restorePrompt="Discovery session is not live. Restore the session before attaching the terminal."
      noSessionPrompt="No live discovery session for this idea."
      ensuringLabel="Ensuring discovery session is live…"
      {...rest}
    />
  );
}
