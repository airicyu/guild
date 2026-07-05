---
name: ad-hoc-create
description: 從任何 discovery 或 mission room 內建立 ad-hoc idea（backlog/ideas）或 mission（parking/queued）— 純檔案系統，無 API 相依
---

# Ad-hoc Create

在 discovery 或 mission 執行期間，從 room cwd 快速建立新的 idea 或 mission — 不需要 API、不需要切換目錄、不需要手動 scaffold 資料夾。

> **設計原則**: 純檔案系統操作；orchestrator bell 會在下次 tick 時自動拾取 queued mission

---

## 何時使用

- 在 discovery 期間發現一個值得獨立追蹤的 subtask → `create-idea.sh`
- 在 mission 執行期間需要 spin off 一個相關的新 mission → `create-mission.sh`
- 任何需要在 board 上快速留下紀錄的靈感或任務

---

## create-idea.sh

在 mission board 上建立一個新的 idea（產生 `scratch.md`）。

```bash
# 最簡用法（預設：backlog board，slug 自動為 "idea"）
bash .claude/skills/ad-hoc-create/create-idea.sh "你的 idea 內容"

# 指定 slug
bash .claude/skills/ad-hoc-create/create-idea.sh "你的 idea 內容" my-feature

# 指定 board（backlog | ideas）
bash .claude/skills/ad-hoc-create/create-idea.sh "你的 idea 內容" my-feature ideas
```

### 參數

| 順序 | 參數 | 必要 | 預設值 | 說明 |
|------|------|------|--------|------|
| 1 | `content` | ✅ | — | `scratch.md` 的純文字內容 |
| 2 | `slug` | ❌ | `idea` | 用於產生資料夾 id 的 slug |
| 3 | `board` | ❌ | `backlog` | 目標 board：`backlog`（→ ideas-backlog）或 `ideas` |

### 產出

```
../../mission-board/ideas-backlog/{slug}-YYYYMMDD-6hex/
  scratch.md
```

或（board=ideas）：

```
../../mission-board/ideas/{slug}-YYYYMMDD-6hex/
  scratch.md
```

### 範例

```bash
bash .claude/skills/ad-hoc-create/create-idea.sh "研究 OKX DEX API 整合可行性" dex-research
# → Created: ../../mission-board/ideas-backlog/dex-research-20260704-a1b2c3/
```

---

## create-mission.sh

在 mission board 上建立一個新的 mission（產生 `mission.md`）。

```bash
# 最簡用法（預設：parking board）
bash .claude/skills/ad-hoc-create/create-mission.sh "我的任務標題" "任務目標描述"

# 指定 board（parking | queued）
bash .claude/skills/ad-hoc-create/create-mission.sh "我的任務標題" "任務目標描述" queued
```

### 參數

| 順序 | 參數 | 必要 | 預設值 | 說明 |
|------|------|------|--------|------|
| 1 | `title` | ✅ | — | 人類可讀的 mission 標題 |
| 2 | `intent` | ✅ | — | 一句話描述目標 |
| 3 | `board` | ❌ | `parking` | 目標 board：`parking` 或 `queued` |

### 產出

```
../../mission-board/parking/{slug}-YYYYMMDD-6hex/
  mission.md
```

或（board=queued）：

```
../../mission-board/queued/{slug}-YYYYMMDD-6hex/
  mission.md
```

`mission.md` 包含合法 YAML frontmatter（`title`, `intent`）+ body skeleton：
- Background
- Deliverables
- Acceptance criteria
- Out of scope
- Notes

### 範例

```bash
bash .claude/skills/ad-hoc-create/create-mission.sh "Add CI pipeline" "Set up GitHub Actions for automated testing"
# → Created: ../../mission-board/parking/add-ci-pipeline-20260704-d4e5f6/
```

---

## 共同行為

- **Idempotent-safe** — 若目標資料夾已存在，script 會報錯並拒絕覆蓋
- **無外部相依** — 僅使用 bash + coreutils（date、openssl 或 xxd）
- **無環境變數** — 不需要 API key 或設定檔
- **從 room cwd 執行** — 路徑以 room cwd 為基準（`mission-rooms/{id}/` 或 `discovery-rooms/{id}/`）

## Board 路徑對照

| Board 參數 | 實際路徑 |
|-----------|---------|
| `backlog` | `../../mission-board/ideas-backlog/` |
| `ideas` | `../../mission-board/ideas/` |
| `parking` | `../../mission-board/parking/` |
| `queued` | `../../mission-board/queued/` |

## Guild master 後續操作

- Backlog → ideas：`POST /board/ideas-backlog/:id/promote`
- Parking → queued：`POST /board/parking/:folder/promote`
- Bell 自動從 queued 拾取 mission

## 相依

無。純 bash + coreutils。