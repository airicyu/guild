import { useState } from "react";
import { Lightbulb } from "lucide-react";

type SubmitDestination = "backlog" | "ideas";

interface SubmitIdeaModalProps {
  open: boolean;
  pending?: boolean;
  onClose: () => void;
  onSubmit: (text: string, options?: { slug?: string; board?: SubmitDestination }) => void;
}

export function SubmitIdeaModal({ open, pending, onClose, onSubmit }: SubmitIdeaModalProps) {
  const [text, setText] = useState("");
  const [slug, setSlug] = useState("");
  const [destination, setDestination] = useState<SubmitDestination>("backlog");

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed, {
      slug: slug.trim() || undefined,
      board: destination,
    });
  };

  const handleClose = () => {
    if (pending) return;
    setText("");
    setSlug("");
    setDestination("backlog");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        className="guild-glass w-full max-w-lg rounded-lg p-5 shadow-xl"
      >
        <div className="flex items-center gap-2">
          <Lightbulb size={20} className="text-[var(--color-accent)]" />
          <h3 className="guild-display text-lg font-bold text-[var(--color-text)]">Submit idea</h3>
        </div>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Choose where the idea lands. Backlog incubates until you promote; Ideas enters the bell
          queue for discovery.
        </p>
        <fieldset className="mt-4">
          <legend className="text-xs font-medium text-[var(--color-text-muted)]">Destination</legend>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <label className="flex flex-1 cursor-pointer items-start gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 has-[:checked]:border-[var(--color-accent)]">
              <input
                type="radio"
                name="destination"
                value="backlog"
                checked={destination === "backlog"}
                onChange={() => setDestination("backlog")}
                className="mt-0.5 accent-[var(--color-accent)]"
              />
              <span>
                <span className="block text-sm font-medium text-[var(--color-text)]">
                  Add to backlog
                </span>
                <span className="block text-xs text-[var(--color-text-muted)]">
                  Incubate — promote when ready for discovery
                </span>
              </span>
            </label>
            <label className="flex flex-1 cursor-pointer items-start gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 has-[:checked]:border-[var(--color-accent)]">
              <input
                type="radio"
                name="destination"
                value="ideas"
                checked={destination === "ideas"}
                onChange={() => setDestination("ideas")}
                className="mt-0.5 accent-[var(--color-accent)]"
              />
              <span>
                <span className="block text-sm font-medium text-[var(--color-text)]">
                  Add to ideas
                </span>
                <span className="block text-xs text-[var(--color-text-muted)]">
                  Ring the bell to start discovery
                </span>
              </span>
            </label>
          </div>
        </fieldset>
        <label className="mt-4 block">
          <span className="text-xs font-medium text-[var(--color-text-muted)]">Idea text</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            required
            placeholder="Describe the problem or opportunity…"
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-xs font-medium text-[var(--color-text-muted)]">
            Slug prefix <span className="font-normal">(optional)</span>
          </span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="my-feature"
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 font-mono text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={handleClose}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || !text.trim()}
            className="guild-btn-primary rounded-lg px-3 py-1.5 text-sm"
          >
            {pending ? "Submitting…" : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}
