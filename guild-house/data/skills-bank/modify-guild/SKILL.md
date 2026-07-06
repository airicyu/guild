---
name: modify-guild
description: >-
  Execution missions that change Guild product code in guild-house/ or guild-desk/
  (features, fixes, enhancements). Use when the brief targets server, web, orchestrator,
  or guild-master skill — not ideas/ design-only. Depends on modify-git-project for
  worktree workflow; adds Guild scope and live-orchestrator rules. Wire at PO Round 0.
depends-on:
  - modify-git-project
---

# Modify Guild

在 **execution mission** 裡改 **Guild 產品 code**（`guild-house/`、`guild-desk/`），同時 **live orchestrator 繼續跑主工作區**，不被改到一半搞掛。

---

## Dependency

**Depends on:** `modify-git-project`

本 skill 不重複通用 git mission 流程。執行前須已 wire `.claude/skills/modify-git-project/` 並依其 playbook 操作；若尚未 wire，Round 0 先 wire 依賴，再 wire 本 skill。

以下僅定義 Guild 產品的 **bindings** 與 **額外約束**。

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

外部 project（非 Guild monorepo）→ 只 wire `modify-git-project`，不要 wire 本 skill。

---

## Bindings（套用 modify-git-project）

從 **mission room cwd**（`guild-house/data/mission-rooms/{missionId}/`）：

| Binding | Guild 值 |
|---------|----------|
| `target_repo` | `../../../../`（guild monorepo git root） |
| Worktree | `{target_repo}/.worktrees/guild/{missionId}/` |
| Manifest | `artifacts/guild-patch/manifest.md` |
| `feature_branch` | brief 指定，或 `mission/{missionId}` |
| `base_ref` | brief 指定，或依 `modify-git-project` 預設 resolve `origin/HEAD` |
| Scope | `guild-house/**`、`guild-desk/**` |

Round 2 charter 時將上表寫入 `memories/common/memory.md`；`artifact-release.md` 的 `source_paths` 用 `artifacts/guild-patch/`（取代通用 `project-patch/`）。

---

## Guild-only 範圍

| 路徑 | 允許 |
|------|------|
| worktree 內 `guild-house/**` | ✅ |
| worktree 內 `guild-desk/**` | ✅ |
| `ideas/**` | ❌（除非 brief 明確要求且 evaluator 確認） |
| 主工作區 `guild-house/data/**` | ❌ **禁止** — live board / mission rooms |
| 主工作區 `guild-house/server/`、`web/` | ❌ **禁止** — 只在 worktree 裡改 |

---

## Guild-only 規則

在遵守 `modify-git-project` 的前提下，額外遵守：

1. **Live orchestrator 隔離**
   - 禁止在主工作區跑 `bun run dev` 覆蓋 live `:3847`
   - worktree 內臨時 dev server 用 **不同 port**（例如 `3849`），獨立 `.env`
   - 可依賴 live API 做唯讀呼叫；不要假設 worktree code 已在 live 運行

2. **測試**
   - 首選：worktree 內 `guild-house/server/` 跑 `bun test` 等
   - worktree 的 `guild-house/data/` 與 live **分離**（gitignored）；不要 symlink live `data/` 進 worktree

3. **禁止**
   - ❌ 在 worktree 與 live 同時佔用 `:3847`
   - ❌ 未 approve 就 merge 到 main

---

## Implementer cwd 範例

worktree 內（`…/.worktrees/guild/{missionId}/`）：

- `guild-house/server/` — API / orchestrator
- `guild-house/web/` — Web UI
- `guild-desk/` — guild-master skill

---

## Manifest delta

使用 `artifacts/guild-patch/manifest.md`（結構同 `modify-git-project` manifest），Review 段 scope diff：

```bash
git -C "{worktree_path}" diff {base_sha}..HEAD -- guild-house/ guild-desk/
```

Merge 段範例：

```bash
cd {guild_root}    # target_repo
git merge mission/{missionId}
git worktree remove .worktrees/guild/{missionId}
git branch -d mission/{missionId}
# restart bun dev if needed
```

`head_commit`、`tests_run` 在 **Round 4 QA 通過後**填入（見 `modify-git-project`）。

---

## Guild master checklist

完成 `modify-git-project` checklist 後，額外：

- [ ] Restart `bun run dev` on main checkout if server code changed
- [ ] Smoke test API `:3847` / Web UI `:3848` if applicable
