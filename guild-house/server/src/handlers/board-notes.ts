import type { BoardStage } from "../paths";
import { abortBoardNote, getBoardNote, listBoardNotes, submitBoardNote } from "../orchestrator/board-notes";
import type { SubmitBoardNoteRequest } from "../types/board-note";
import type { Config } from "../config";
import { mapNotFound, mapOrchestratorError, readJsonBody } from "../errors";
import type { RoutesSlice } from "../routes";

export function boardNoteRoutes(config: Config): RoutesSlice {
  return {
    "/mission-board-notes": {
      GET: async (req) => {
        const stage = new URL(req.url).searchParams.get("stage") ?? undefined;
        return Response.json(await listBoardNotes(config, stage as BoardStage | undefined));
      },
    },
    "/mission-board-notes/:id": {
      GET: async (req) => {
        try {
          const note = await getBoardNote(config, req.params.id);
          if (!note) return Response.json({ error: "Board note not found" }, { status: 404 });
          return Response.json(note);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
    "/mission-board-notes/:id/abort": {
      POST: async (req) => {
        try {
          const body = await readJsonBody<{ reason?: string }>(req);
          const result = await abortBoardNote(config, req.params.id, body.reason);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return mapOrchestratorError(err, [mapNotFound]);
        }
      },
    },
    "/ideas": {
      POST: async (req) => {
        try {
          const body = await readJsonBody<SubmitBoardNoteRequest>(req);
          return Response.json(await submitBoardNote(config, body), { status: 201 });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  };
}
