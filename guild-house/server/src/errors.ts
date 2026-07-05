/** Map orchestrator thrown errors to HTTP responses. */
type ErrorMapper = (message: string) => Response | null;

export function mapOrchestratorError(err: unknown, mappers: ErrorMapper[]): Response {
  const message = err instanceof Error ? err.message : String(err);
  for (const map of mappers) {
    const result = map(message);
    if (result) return result;
  }
  return Response.json({ error: message }, { status: 400 });
}

export const mapNotFound: ErrorMapper = (message) =>
  message.includes("not found") ||
  message.includes("missing") ||
  message.includes("not on the discovering") ||
  message.includes("Missing discovery") ||
  message.includes("Missing mission") ||
  message.includes("not active") ||
  message.includes("working board") ||
  message.includes("not on the working board") ||
  message.includes("Missing checkpoint") ||
  message.includes("not on the done board") ||
  message.includes("not on the done or aborted board")
    ? Response.json({ error: message }, { status: 404 })
    : null;

export const mapConflict: ErrorMapper = (message) =>
  message.includes("already exists") ||
  message.includes("already closed") ||
  message.includes("already complete") ||
  message.includes("already done") ||
  message.includes("already terminal") ||
  message.includes("No mission packages") ||
  message.includes("must be awaiting_artifact_review") ||
  message.includes("must be phase done") ||
  message.includes("mission_plan_complete") ||
  message.includes("must be phase aborted") ||
  message.includes("Parking entry already exists")
    ? Response.json({ error: message }, { status: 409 })
    : null;

export const mapPromote: ErrorMapper[] = [mapNotFound, mapConflict];

export const mapMissionActive: ErrorMapper[] = [
  (m) =>
    m.includes("not active") || m.includes("working board") || m.includes("Missing checkpoint")
      ? Response.json({ error: m }, { status: 404 })
      : null,
  (m) => (m.includes("already done") ? Response.json({ error: m }, { status: 409 }) : null),
];

export const mapDiscovering: ErrorMapper[] = [
  (m) =>
    m.includes("not on the discovering board") ||
    m.includes("not on the discovering") ||
    m.includes("Missing discovery") ||
    m.includes("Missing mission")
      ? Response.json({ error: m }, { status: 404 })
      : null,
  (m) =>
    m.includes("already closed") || m.includes("already complete") || m.includes("No mission packages")
      ? Response.json({ error: m }, { status: 409 })
      : null,
  mapConflict,
];

/** Empty body → `{}` for optional POST payloads. */
export async function readJsonBody<T>(req: Request): Promise<T> {
  const text = await req.text();
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}
