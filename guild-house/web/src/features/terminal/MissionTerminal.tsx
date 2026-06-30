import { useCallback } from "react";
import { attachWebSocketUrl } from "../../lib/api";
import { AttachTerminalPane } from "./AttachTerminalPane";

/** Mission PO attach — WS path /ws/missions/:id/attach. See AttachTerminalPane for PTY semantics. */
interface MissionTerminalProps {
  missionId: string;
  restoreRequired: boolean;
  sessionLive: boolean;
  sessionLoading?: boolean;
  onRestore?: () => void;
  restorePending?: boolean;
}

export function MissionTerminal(props: MissionTerminalProps) {
  const { missionId, ...rest } = props;
  const buildWsUrl = useCallback(
    (cols: number, rows: number) => attachWebSocketUrl(missionId, cols, rows),
    [missionId],
  );

  return (
    <AttachTerminalPane
      connectKey={missionId}
      buildWsUrl={buildWsUrl}
      title="PO terminal"
      restorePrompt="PO session is not live. Restore the session before attaching the terminal."
      noSessionPrompt="No live PO session for this mission."
      ensuringLabel="Ensuring PO session is live…"
      {...rest}
    />
  );
}
