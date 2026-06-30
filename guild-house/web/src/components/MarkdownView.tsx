import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewProps {
  content: string;
  className?: string;
}

const proseClasses = [
  "guild-markdown prose prose-sm max-w-none",
  "prose-headings:font-[var(--font-display)] prose-headings:text-[var(--color-text)]",
  "prose-p:text-[var(--color-text-muted)] prose-li:text-[var(--color-text-muted)]",
  "prose-a:text-[var(--color-accent)] prose-strong:text-[var(--color-text)]",
  "prose-code:text-[var(--color-accent-dim)] prose-code:before:content-none prose-code:after:content-none",
].join(" ");

export function MarkdownView({ content, className }: MarkdownViewProps) {
  return (
    <div className={[proseClasses, className].filter(Boolean).join(" ")}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
