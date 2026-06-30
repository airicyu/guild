import { useState } from "react";
import { Lightbulb } from "lucide-react";

interface SubmitIdeaModalProps {
  open: boolean;
  pending?: boolean;
  onClose: () => void;
  onSubmit: (text: string, slug?: string) => void;
}

export function SubmitIdeaModal({ open, pending, onClose, onSubmit }: SubmitIdeaModalProps) {
  const [text, setText] = useState("");
  const [slug, setSlug] = useState("");

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed, slug.trim() || undefined);
  };

  const handleClose = () => {
    if (pending) return;
    setText("");
    setSlug("");
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
          Rough idea text goes to the <strong>Ideas</strong> column. Ring the bell to start discovery.
        </p>
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
