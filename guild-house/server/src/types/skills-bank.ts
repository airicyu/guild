export interface SkillListItem {
  name: string;
  description: string | null;
  source?: "built-in" | "custom";
}

export interface SkillsBankSummary {
  catalog: string;
  skills: SkillListItem[];
  count: number;
}

export interface SkillFileEntry {
  path: string;
  content: string;
}

export interface SkillDetail {
  name: string;
  description: string | null;
  skillMd: string;
  files: SkillFileEntry[];
}
