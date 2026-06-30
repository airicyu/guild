/**
 * Discovery browser terminal attach — reuses shared attach PTY stack.
 *
 * WS: /ws/discoveries/:id/attach · ensureDiscoverySessionLive on connect.
 */
export {
  extractAttachRoute,
  handleAttachClose,
  handleAttachMessage,
  handleAttachOpen,
  validateWsAuth,
  validateWsOrigin,
  type AttachMessage,
  type AttachPipeline,
  type AttachRoute,
  type AttachWsData,
} from "./attach-pty";

/** @deprecated Use extractAttachRoute — discovery id only. */
export function extractAttachDiscoveryId(pathname: string): string | null {
  const match = pathname.match(/^\/ws\/discoveries\/([^/]+)\/attach$/);
  return match ? decodeURIComponent(match[1]) : null;
}
