# Skills bank catalog

Short index of skills in `data/skills-bank/`. PO / intake lead: pick from here, then follow `mission-management/skills-bank.md` to wire into this room.

**Summary 寫法：** 說明 purpose、作用、何時 wire — 不要寫實作方法（worktree、API、檔案格式等細節在 `SKILL.md`）。

Detail per skill: `../../skills-bank/{name}/SKILL.md` or `GET /skills-bank/{name}`.

| Skill | Summary |
|-------|---------|
| `generate-report` | 從 mission 執行期間的調研或分析成果產出結構化靜態報告（四段式：executive summary → findings → data → recommendations）；當 mission 需要交付一份可分享的書面報告、或需要將多個來源的發現組合成正式文件時 wire |
| `ad-hoc-create` | 執行或 discovery 期間，從 room 內快速在 board 新增 idea 或 mission；當 scope 需拆成獨立追蹤的任務時 wire |
| `modify-git-project` | 在指定 git repo 上做 enhancement mission（worktree + manifest；guild master 人工 merge） |
| `modify-guild` | 改 Guild 產品 code；depends on `modify-git-project` |
| `web-research` | 結構化網路研究流程（plan → search → fetch → synthesize → cite）；discovery 或 execution 需要外部資訊時 wire |

_Guild master: add a row when you add a folder under `data/skills-bank/`._
