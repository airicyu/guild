---
name: modify-git-project
description: >-
  Execution missions that change code in a git-backed project via worktree isolation
  or in-place editing on a feature branch. Use when the brief targets a repo with its
  own git root (external project or any specified target_repo). Artifacts are
  manifest-only; guild master merges manually. Wire at PO Round 0 before evaluator.
---

# Modify Git Project

在 **execution mission** 裡改 **指定 git repo** 的 code，用 **worktree 隔離**或 **in-place**（原地 feature branch）實作；mission room 的 `artifacts/` 只放 manifest（指標 + review 步驟）；merge 由 guild master 人工完成。

> **設計原則：** code 改在 worktree（或 in-place feature branch）；QA 通過後才 commit 到 feature branch；release 不做 git 操作。

---

## 何時 wire 這個 skill

Wire 當 mission brief 的 deliverables 包含：

- 改 **外部 project**（有自己的 git repo）
- 或 brief 明確指定 `target_repo` 的 code enhancement

**不要** wire 當：

- 只在 `artifacts/` 做 demo / 文件類任務（用預設 playbook）
- Discovery intake（discovery 產 mission package，不跑這套）

改 **Guild 產品 code** 時 wire **`modify-guild`**（depends on 本 skill），不要只 wire 本 skill 而漏掉 Guild scope。

---

## Brief / charter 欄位

Round 2 寫入 `memories/common/memory.md`（並在 manifest 重複）：

| 欄位 | 必填 | 預設 |
|------|------|------|
| `target_repo` | ✅ | — absolute path to git root |
| `base_ref` | — | resolve `origin/HEAD` after `git fetch`；fallback `main`，再 `master` |
| `feature_branch` | — | `mission/{missionId}` |
| `edit_mode` | — | `worktree` — `worktree` 或 `in-place`，由 guild master 在 charter 階段決定 |

Round 0 驗證 `target_repo`：目錄存在、是 git repo、可 `git fetch`（有 `origin` 更佳）。

---

## edit_mode 概念

`edit_mode` 決定 implementer 如何修改 target repo 的 code，由 guild master 在 charter 階段確認。

### `worktree`（預設）

現有行為。建立隔離的 git worktree 來實作：

- 完整隔離：不影響主 checkout 的 working tree、index、或 live 服務
- 適合大型改動、需獨立 dev server 的情境
- 多 mission 可同時進行而不衝突
- 實作流程：建立 worktree → 在 worktree 內修改 → 在 worktree 內測試 → commit 到 feature branch → guild master merge 回主 checkout

### `in-place`

直接在 target_repo 主 checkout 建立 feature branch 後原地修改：

- 無 worktree overhead：不需要建立/移除 worktree，減少跨 filesystem 操作
- 適合小型、快速修改（改 config、修小 bug）
- **仍需 feature branch**：禁止直接改 `main`/`master`
- 實作流程：在主 checkout 建立 feature branch → 原地修改 → 測試 → commit → guild master merge
- 注意：與主 checkout 的 live 服務共用 filesystem，須注意隔離規則

> **選擇建議：** 不確定時用 `worktree`（預設）。`in-place` 適合 PO 或 guild master 確認「改動範圍小、不影響主 checkout 其他工作」的情境。

---

## 路徑約定

從 **mission room cwd**（`guild-house/data/mission-rooms/{missionId}/`）：

| 概念 | 路徑 |
|------|------|
| Target repo | `{target_repo}`（brief / memory 給的 absolute path） |
| Worktree checkout（worktree 模式） | `{target_repo}/.worktrees/guild/{missionId}/` |
| Manifest | `artifacts/project-patch/manifest.md` |

Worktree **不要**放在 `artifacts/` 或 mission room `.agents/` 底下。in-place 模式無 worktree checkout 路徑。

---

## PO Round 0 — 權限

Mission room 預設 `.agents/settings.json` **不含** `git`。Wire 本 skill 後，建立或合併 `.agents/settings.local.json`：

**worktree 模式：**
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

**in-place 模式：**（無需 `git worktree *`）
```json
{
  "permissions": {
    "allow": [
      "Bash(git *)"
    ]
  }
}
```

Implementer 的 **Edit** 應在 worktree（worktree 模式）或 feature branch（in-place 模式）內進行。**禁止**用 Edit 直接改 `target_repo` 主 checkout 的 `main`/`master`（除非 brief 明確允許且與策略一致）。

---

## PO Round 2 — charter 必寫

1. **`artifact-release.md`**
   - `mode: custom`
   - `source_paths`: `artifacts/project-patch/`
   - Notes：guild master approve 後於 **主 checkout** merge feature branch；PO 不 push、不 merge

2. **`squad.md` `artifact_roots`**
   - `artifacts/project-patch/`（manifest，不是整份 codebase）

3. **`memories/common/memory.md` constraints**（至少）：
   - `target_repo`、`base_ref`、`feature_branch`、`edit_mode`（resolved 值）
   - 所有 code 變更僅在 worktree（worktree 模式）或 feature branch（in-place 模式）
   - 禁止改 `main`/`master`（除非 brief 例外）
   - 測試在 worktree 或 feature branch 內執行

4. 向 guild master 確認 **`base_ref`** 與 **`feature_branch`**（若 brief 未指明，用預設並寫入 memory）

5. **向 guild master 確認 `edit_mode`**（`worktree` 或 `in-place`，預設 `worktree`）：
   - 透過 outbox 或 attach 詢問 guild master 偏好
   - 若 guild master 未指定，預設為 `worktree`
   - 將 resolved `edit_mode` 寫入 `memories/common/memory.md` constraints
   - 此決定影響後續 Round 3 的實作流程選擇

---

## Round 3（worktree 模式）

當 `edit_mode: worktree` 時，按以下步驟建立 worktree。若 `edit_mode: in-place`，跳至下方 [In-place 模式流程](#in-place-模式流程)。

在 **`target_repo`** 執行（不是 mission room cwd）：

```bash
REPO="{target_repo}"              # absolute path
MISSION_ID="{missionId}"
BRANCH="{feature_branch}"         # brief 或 mission/{missionId}
WORKTREE="${REPO}/.worktrees/guild/${MISSION_ID}"

# Resolve base_ref if not specified in brief
git -C "${REPO}" fetch origin 2>/dev/null || true
if [[ -z "${BASE_REF:-}" ]]; then
  BASE_REF="$(git -C "${REPO}" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null || true)"
  [[ -z "${BASE_REF}" ]] && BASE_REF="main"
  git -C "${REPO}" rev-parse --verify "${BASE_REF}" >/dev/null 2>&1 || BASE_REF="master"
fi

mkdir -p "${REPO}/.worktrees/guild"
git -C "${REPO}" worktree add -b "${BRANCH}" "${WORKTREE}" "${BASE_REF}"
```

若 branch 已存在（restore 後重跑），改用 `git worktree add "${WORKTREE}" "${BRANCH}"` 而非 `-b`。

PO 在首次建立 worktree 後寫 `artifacts/project-patch/manifest.md`（見下方模板），填入 resolved `base_ref` SHA。

**Implementer cwd：** worktree 內對應 brief scope 的子目錄。

---

## Round 3–4 — 實作與測試（worktree 模式）

### 實作

- 只 edit **worktree** 內檔案
- **最終 commit 留到 QA 通過後**（Round 4）；實作期間 WIP commit 可選
- 禁止 `cp -r` 整個 repo 到 `artifacts/`

### 測試

- 在 worktree 內跑 project 慣用的 test / lint / build
- 若需 dev server，用 **不同 port** 或獨立 env，避免與主 checkout 的 live 服務衝突

---

## Round 4 — QA 通過後 commit（worktree 模式）

1. **QA** 在 worktree 驗收（committed 或 uncommitted 皆可）
2. QA pass 後 → 在 worktree **commit 所有變更**到 `feature_branch`：

```bash
git -C "${WORKTREE}" add -A
git -C "${WORKTREE}" commit -m "…"   # 清楚描述；可多個 commit 後 squash 亦可
```

3. 更新 manifest：`head_commit`、`tests_run`、Scope 路徑列表
4. PO finalize `artifact-release.md`（`confirmed` 若 guild master 在 chat  refine 過）
5. Signal **`artifacts_ready_for_review`** — **不要**在此階段 `mission_complete`

---

## Round 5 — Release（worktree 模式）

Release **不做 git 操作**（不 commit、merge、push、worktree remove）。

1. 確認 manifest 完整（`head_commit`、`tests_run` 已在 Round 4 填好）
2. Guild master **approve artifacts** 後：
   - PO 確認 manifest 完整
   - 設 `artifact-release.md` → `status: released`
   - Signal `artifact_release_complete`
3. **PO 不 merge、不 push、不 remove worktree** — guild master 依 manifest 操作

---

## In-place 模式流程

當 `edit_mode: in-place` 時，以下流程取代上述 worktree 模式（Round 3 到 Round 5）。

### Round 3 — 建立 feature branch

在 **`target_repo`** 主 checkout 執行（不是 mission room cwd）：

```bash
REPO="{target_repo}"              # absolute path
BRANCH="{feature_branch}"         # brief 或 mission/{missionId}

# Resolve base_ref if not specified in brief
git -C "${REPO}" fetch origin 2>/dev/null || true
if [[ -z "${BASE_REF:-}" ]]; then
  BASE_REF="$(git -C "${REPO}" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null || true)"
  [[ -z "${BASE_REF}" ]] && BASE_REF="main"
  git -C "${REPO}" rev-parse --verify "${BASE_REF}" >/dev/null 2>&1 || BASE_REF="master"
fi

git -C "${REPO}" checkout -b "${BRANCH}" "${BASE_REF}"
```

若 branch 已存在（restore 後重跑），改用 `git checkout "${BRANCH}"` 而非 `-b`；若 branch 已與 `base_ref` 不同步，用 `git rebase "${BASE_REF}"`。

PO 在建立 feature branch 後寫 `artifacts/project-patch/manifest.md`（見下方 in-place 模板），填入 resolved `base_ref` SHA。

**Implementer cwd：** `target_repo` 根目錄（或對應 brief scope 的子目錄）。

### Round 3–4 — 實作與測試

#### 實作

- 只 edit **feature branch** 內的檔案（在主 checkout 的 feature branch 上）
- **最終 commit 留到 QA 通過後**（Round 4）；實作期間 WIP commit 可選
- 禁止 `cp -r` 整個 repo 到 `artifacts/`

#### 測試

- 在 `target_repo` 主 checkout 的 feature branch 上跑 project 慣用的 test / lint / build
- 若需 dev server，用 **不同 port** 或獨立 env，避免與主 checkout 的 live 服務衝突
- 注意：in-place 模式下，主 checkout 的 working tree 與 index 會因 feature branch 而變更；測試前確認不受影響

### Round 4 — QA 通過後 commit

1. **QA** 在 feature branch 驗收（committed 或 uncommitted 皆可）
2. QA pass 後 → **commit 所有變更**到 `feature_branch`：

```bash
git -C "${REPO}" add -A
git -C "${REPO}" commit -m "…"   # 清楚描述；可多個 commit 後 squash 亦可
```

3. 更新 manifest：`head_commit`、`tests_run`、Scope 路徑列表
4. PO finalize `artifact-release.md`（`confirmed` 若 guild master 在 chat  refine 過）
5. Signal **`artifacts_ready_for_review`** — **不要**在此階段 `mission_complete`

### Round 5 — Release

Release **不做 git 操作**（不 commit、merge、push）。

1. 確認 manifest 完整（`head_commit`、`tests_run` 已在 Round 4 填好）
2. Guild master **approve artifacts** 後：
   - PO 確認 manifest 完整
   - 設 `artifact-release.md` → `status: released`
   - Signal `artifact_release_complete`
3. **PO 不 merge、不 push** — guild master 依 manifest 操作

---

## Manifest 模板

### worktree 模式模板

當 `edit_mode: worktree`（預設）時使用：

```markdown
# Project patch manifest

## Repo
- **target_repo:** /absolute/path/to/repo
- **base_ref:** origin/main @ abc1234
- **edit_mode:** worktree
- **branch:** mission/{missionId}
- **worktree_path:** /absolute/path/to/repo/.worktrees/guild/{missionId}

## Scope
- path/to/changed/files…
- (list paths touched, relative to repo root)

## Review (guild master)
\`\`\`bash
git -C "{worktree_path}" log {base_sha}..HEAD --oneline
git -C "{worktree_path}" diff {base_sha}..HEAD
\`\`\`

## Merge (guild master, after approve)
\`\`\`bash
cd {target_repo}
git merge {branch}
git worktree remove .worktrees/guild/{missionId}
git branch -d {branch}
\`\`\`

## Status
- **head_commit:** (fill after QA pass, before artifacts_ready_for_review)
- **tests_run:** (commands + result)
```

### in-place 模式模板

當 `edit_mode: in-place` 時使用：

```markdown
# Project patch manifest

## Repo
- **target_repo:** /absolute/path/to/repo
- **base_ref:** origin/main @ abc1234
- **edit_mode:** in-place
- **feature_branch:** mission/{missionId}

## Scope
- path/to/changed/files…
- (list paths touched, relative to repo root)

## Review (guild master)
\`\`\`bash
git -C "{target_repo}" log {base_sha}..HEAD --oneline
git -C "{target_repo}" diff {base_sha}..HEAD
\`\`\`

## Merge (guild master, after approve)
\`\`\`bash
cd {target_repo}
git merge {feature_branch}
git branch -d {feature_branch}
\`\`\`

## Status
- **head_commit:** (fill after QA pass, before artifacts_ready_for_review)
- **tests_run:** (commands + result)
```

---

## 禁止事項

- ❌ `cp -r` 整個 repo 到 `artifacts/`
- ❌ 直接改主 checkout source（應在 worktree 或 feature branch）
- ❌ 未 approve 就 merge
- ❌ 在 release phase commit / merge / push
- ❌ 多個 mission 改同一 branch 而不協調（conflict 由 guild master 處理）
- ❌ in-place 模式直接改 `main`/`master`（必須用 feature branch）

---

## 與其他 playbook 的關係

- 一般 `artifacts/{subproject}/` 規則仍適用；本 skill **取代**「在 artifacts 裡從零建整個 product tree」
- `artifact-release.md` 預設 hierarchy 仍有效；Round 2 明確寫 `mode: custom`
- Evaluator 應確認：`target_repo` 是否清楚、是否 git repo、`base_ref` / `feature_branch` / `edit_mode` 是否需要 guild master 決定

---

## Guild master checklist

- [ ] Review manifest + `git diff`（in worktree 或 target_repo，依 edit_mode）
- [ ] Approve artifacts in Web UI / API
- [ ] Merge `feature_branch` on main checkout
- [ ] **worktree 模式：** `git worktree remove` + `git branch -d`
- [ ] **in-place 模式：** `git branch -d`（無需 worktree remove）
- [ ] Project-specific smoke test（若適用）
- [ ] Archive mission when done
