---
name: modify-guild
description: >-
  Execution missions that change Guild product code in guild-house/ or guild-desk/
  (features, fixes, enhancements). Use when the brief targets server, web, orchestrator,
  or guild-master skill — not ideas/ design-only. Isolates edits in a git worktree;
  live orchestrator stays on the main checkout. Wire at PO Round 0 before evaluator.
---

# Modify Guild

在 **execution mission** 裡改 **Guild 產品 code**（`guild-house/`、`guild-desk/`），同時 **live orchestrator 繼續跑主工作區**，不被改到一半搞掛。

> **設計原則：** code 改在 git worktree；mission room 的 `artifacts/` 只放 manifest（指標 + review 步驟）；merge 由 guild master 人工完成。

---

## 何時 wire 這個 skill

Wire 當 mission brief 的 deliverables 包含以下任一：

- 改 `guild-house/server/`、`guild-house/web/`、`guild-house/templates/`
- 改 `guild-desk/.claude/skills/guild-master/` 或其他 desk runtime
- 「改 Guild API / Web UI / orchestrator / guild-master skill」

**不要** wire 當：

- 只改 `ideas/` 設計文件（無 product code）
- 只在 `artifacts/` 做 hello-world demo 類任務（用預設 playbook 即可）
- Discovery intake（discovery 產 mission package，不跑這套）

---

## 範圍

| 路徑 | 允許 |
|------|------|
| `guild-house/**` | ✅ |
| `guild-desk/**` | ✅ |
| `ideas/**` | ❌（除非 brief 明確要求且 evaluator 確認） |
| 主工作區 `guild-house/data/**` | ❌ **禁止直接改** — live board / mission rooms |
| 主工作區 `guild-house/server/`、`web/` | ❌ **禁止直接改** — 只在 worktree 裡改 |

---

## 路徑約定

從 **mission room cwd**（`guild-house/data/mission-rooms/{missionId}/`）：

| 概念 | 路徑 |
|------|------|
| Guild git root（monorepo） | `../../../../` |
| Worktree checkout | `../../../../.worktrees/missions/{missionId}/` |
| Manifest（mission 產出） | `artifacts/guild-patch/manifest.md` |
| Feature branch | `mission/{missionId}` |

Worktree **不要**放在 `artifacts/` 或 `.claude/` 底下。

---

## PO Round 0 — 權限

Mission room 預設 `.claude/settings.json` **不含** `git`。在 wire 本 skill 後，建立或合併 `.claude/settings.local.json`：

```json
{
  "permissions": {
    "allow": [
      "Bash(git *)",
      "Bash(git worktree *)"
    ]
  }
}
```

Implementer 的 **Edit** 應在 worktree 內進行（用 Bash `git` + 編輯器，或 PO 在 charter 時擴展 allow 路徑）。**禁止**用 Edit 工具直接改主工作區的 `guild-house/server/`。

---

## PO Round 2 — charter 必寫

1. **`artifact-release.md`**
   - `mode: custom`
   - `source_paths`: `artifacts/guild-patch/`
   - Notes：guild master 在 approve 後於 **主工作區** merge feature branch；PO 不 push

2. **`squad.md` `artifact_roots`**
   - `artifacts/guild-patch/`（manifest，不是整份 codebase）

3. **`memories/common/memory.md` constraints**（至少）：
   - 所有 product code 變更僅在 worktree
   - 禁止改主工作區 source / live `data/`
   - 禁止在主工作區跑 `bun run dev` 覆蓋 `:3847`
   - 測試在 worktree 內執行（unit test 或換 port）

4. 向 guild master 確認 **`base_ref`**（branch 或 commit；預設 `main` HEAD）

---

## Round 3 — 建立 worktree（PO 或 senior-dev）

在 **guild git root** 執行（不是 mission room cwd）：

```bash
GUILD_ROOT="$(cd ../../../../ && pwd)"
MISSION_ID="{missionId}"          # 從 room 路徑或 checkpoint 取得
BASE_REF="main"                   # 或 brief 指定的 commit / branch
BRANCH="mission/${MISSION_ID}"
WORKTREE="${GUILD_ROOT}/.worktrees/missions/${MISSION_ID}"

mkdir -p "${GUILD_ROOT}/.worktrees/missions"
git -C "${GUILD_ROOT}" fetch origin 2>/dev/null || true
git -C "${GUILD_ROOT}" worktree add -b "${BRANCH}" "${WORKTREE}" "${BASE_REF}"
```

若 branch 已存在（restore 後重跑），改用 `git worktree add "${WORKTREE}" "${BRANCH}"` 而非 `-b`。

**Implementer cwd：** worktree 內的 product 路徑，例如：

- `…/guild-house/server/` — API / orchestrator
- `…/guild-house/web/` — Web UI
- `…/guild-desk/` — guild-master skill

---

## 實作與測試

### 實作

- 只 edit **worktree** 內檔案
- Commit 在 worktree 所在 repo（`git -C "${WORKTREE}" …`）
- Commit message 清楚、小步提交

### 測試

| 做法 | 說明 |
|------|------|
| Unit / script tests | 在 worktree 的 `guild-house/server/` 跑 `bun test` 等 — **首選** |
| 臨時 dev server | worktree 內、**不同 port**（例如 `3849`），獨立 `.env`；**不要**停 live `:3847` |
| 依賴 live API | 僅唯讀呼叫 live；不要假設 worktree code 已在 live 運行 |

Worktree 的 `guild-house/data/` 與 live **分離**（gitignored）。不要 symlink live `data/` 进 worktree。

---

## Manifest 模板

PO 在首次建立 worktree 後寫 `artifacts/guild-patch/manifest.md`，release 前更新 `head_commit`：

```markdown
# Guild patch manifest

## Base
- **base_ref:** main @ abc1234
- **branch:** mission/{missionId}
- **worktree_path:** /absolute/path/to/guild/.worktrees/missions/{missionId}

## Scope
- guild-house/server/src/…
- (list paths touched)

## Review (guild master)
```bash
git -C "{worktree_path}" log {base_ref}..HEAD --oneline
git -C "{worktree_path}" diff {base_ref}..HEAD -- guild-house/ guild-desk/
```

## Merge (guild master, after approve)
```bash
cd {guild_root}
git merge mission/{missionId}
git worktree remove .worktrees/missions/{missionId}
git branch -d mission/{missionId}
# restart bun dev if needed
```

## Status
- **head_commit:** (fill before artifacts_ready_for_review)
- **tests_run:** (commands + result)
```

---

## Round 5 — Release

1. 在 worktree 確保所有變更已 **commit** 到 `mission/{missionId}`
2. 更新 manifest 的 `head_commit`、`tests_run`
3. Guild master **approve artifacts** 後：
   - PO 確認 manifest 完整
   - 設 `artifact-release.md` → `status: released`
   - Signal `artifact_release_complete`
4. **PO 不 merge、不 push** — guild master 依 manifest **Merge** 段操作

---

## 禁止事項

- ❌ `cp -r` 整個 guild repo 到 `artifacts/`（recursive / 肥大）
- ❌ 直接改主工作區 `guild-house/server/`、`web/`、`data/`
- ❌ 在 worktree 與 live 同時佔用 `:3847`
- ❌ 未 approve 就 merge 到 main
- ❌ 多個 mission 改同一檔案而不協調（merge conflict 由 guild master 處理）

---

## 與其他 playbook 的關係

- 一般 `artifacts/{subproject}/` 規則仍適用；本 skill **取代**「在 artifacts 裡從零建整個 product tree」的做法
- `artifact-release.md` 預設 hierarchy 仍有效；本 mission 應在 Round 2 明確寫 `mode: custom`
- Evaluator 應在 assessment 確認：brief 是否 product code mission、base_ref 是否清楚、是否需 senior-dev

---

## Guild master checklist

- [ ] Review manifest + `git diff` in worktree
- [ ] Approve artifacts in Web UI / API
- [ ] Merge `mission/{missionId}` on main checkout
- [ ] `git worktree remove` + optional branch delete
- [ ] Restart dev / smoke test
- [ ] Archive mission when done
