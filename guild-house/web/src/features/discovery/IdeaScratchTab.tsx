import { MarkdownView } from "../../components/MarkdownView";
import type { IdeaDetail } from "../../types/discovery";

type IdeaScratchTabProps = {
  idea: IdeaDetail;
};

export function IdeaScratchTab({ idea }: IdeaScratchTabProps) {
  return (
    <div className="guild-glass rounded-lg p-5">
      {idea.scratch ? (
        <MarkdownView content={idea.scratch} />
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">No scratch content.</p>
      )}
    </div>
  );
}
