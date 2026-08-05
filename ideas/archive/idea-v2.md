# Guild House — Design v2 (archive)

> **Historical only** — early vision and brainstorm (mixed 中文/English).  
> **Do not extend.** Current product: [guild-house/specs/product.md](../../guild-house/specs/product.md) · API: [guild-house/docs/api.md](../../guild-house/docs/api.md)

> 整合自 idea.md 與 brainstorm 討論。v1[[idea]] 保留作歷史；v2 為早期共識草稿。

## Prototype as-built（v0.10 — 2026-06-28）

以下為 **已實作** 的 prototype 行為；正文其餘章節仍含 **長遠願景**（Eric 作固定稱呼等），以本節 + [implementation-plan.md](./implementation-plan.md) + [web-ui-implementation-plan.md](./web-ui-implementation-plan.md) 為準。

| 主題 | As-built |
|------|----------|
| **Control-plane 角色** | **Guild master**（env `GUILD_MASTER_NAME`，預設 `Guild Master`；例 `.env` 設 `Eric`）— 非 hardcode 在 API/checkpoint 欄位 |
| **Mission id** | Intake 用 **slug** 資料夾（如 `hello-world`）；**bell** 時 mint `{slug}-{YYYYMMDD}-{6hex}` 並 rename ready folder（若已 mint 且未 collision 則沿用） |
| **`mission_complete`** | stop PO → `phase: done` → **留 `active/` board**；**不** auto archive |
| **Archive** | Guild master **`POST /missions/:id/archive`**（需 `phase: done`）→ board `active/` → `archive/`；**mission room 留** `mission-rooms/{id}/` |
| **Concurrent slots** | Max 4 PO sessions；**`phase: done` 不佔 slot**（可 bell 下一個 ready） |
| **`awaiting_guild_master`** | 原 `awaiting_eric`；escalate/blocked 時設；MVP idle 仍佔 slot（timeout 仍屬長遠） |
| **Session lifecycle (v0.6)** | **GET** 只 sync（`claude agents --json` + job `state.json`），不 spawn；**restore** 僅 boot / `POST /restore` / `POST /resume` / `?ensureLive=true`；ladder: respawn → new `--bg` |
| **API 版本** | `GET /health` → **0.10.0**（Phase 5 WS attach）；詳 [guild-house/docs/api.md](../../guild-house/docs/api.md) |
| **Mission brief** | Orchestrator 於 bell **複製** board `mission.md` → `memories/common/mission-brief.md`（frozen）；PO **只讀**；`ensureMissionBriefInRoom` 修復 legacy room |
| **Team memory** | `memories/common/memory.md` — PO 維護的 living truth |
| **Member memory** | `memories/members/{role}/memory.md` — 各 member scratch；scaffold 於 pickup |
| **Event log（取代 chatroom）** | `memories/common/events.jsonl` + `tools/log` → `POST /missions/:id/events`；**審計 / milestone**，非 agent 溝通 channel |
| **Agent 協作** | CC **agent team / Task**（live）；evaluator 以 **Task 返回** 給 PO，非寫 chatroom |
| **Web UI (Plan 2)** | `guild-house/web/` — board, hall, outbox, mission room（brief/checkpoint/events/outbox/**terminal**）, archive/pause/resume/restore；**Phase 5 PTY done**（WSL/Linux） |
| **Terminal attach (UI)** | Tab-lazy xterm（`@xterm/xterm` 6, dark theme）→ `WS /ws/missions/:id/attach` → Bun PTY → `claude attach {shortId}`；關 tab = detach only |
| **Board archive UX** | Archive 僅 mission 詳情頁 `MissionActions` 按鈕（`archiveReady`）；board card **無** Archive 徽章 |

---

## 願景

自動工作流系統：預先定義不同角色的 agents，guild master drop 任務進任務欄，team 自主評估、組隊、執行、匯報。

- 任務可 **暫存**（先放下不做）或 **ready**（打算做）
- Ready 任務 pickup 後：evaluator 評估 → **Project Owner (PO / team lead)** 組 AI 小隊 → 執行 → 匯報
- **任務大廳**：看進行中任務；進入 **任務房間** 看 detail 進度與組員
- 可 **暫停**（關電腦）後 **resume**；狀態持久化在 filesystem
- 多任務 **平行獨立**，各 mission workspace isolation
- 預設 **guild master 不在**，PO 自主打理；需 guild master 時 **主動 escalate**，不 silent 等待

---

## 設計原則

### Filesystem-first

- **Filesystem = source of truth**（agent 讀寫 markdown / yaml / jsonl / code）
- **Orchestrator = watcher + process manager**（搬 folder、spawn Claude session、nudge、notify）
- **UI = derived view**（讀 mission-reports、folder 結構；可選輕量 index）
- DB 若用，只做 UI 快取，不是 agent 主介面

Option A 純 event-driven + DB 太 rigid；workflow 智慧留給 PO + files，orchestrator 管 infra。

### Multi-session，不以單一 context 撐到底

- 工作 **多輪多步**；每步 bounded session，以 **artifacts + memory files** 接棒
- Context 不無限膨脹；pause = 等 checkpoint 寫完再關 process

### Conway's Law

組織溝通結構會反映系統結構。Guild House 採 **hub-and-spoke**：

- PO 為中心（guardian memory、組隊、escalation）
- Specialist 並行但 **write partition** 清楚
- `squad.md` body 記錄 communication charter，不只 roster

### 與 OpenClaw 的差異（簡述）

OpenClaw：always-on gateway + chat channels + standing orders。  
Guild House：**mission-centric**、filesystem-first、IDE 寫 mission.md intake、一 mission 一 workspace 一 bg Claude session。可借鑑 subagent spawn、workspace bootstrap，但不需複製 gateway 模型。

---

## Repo 分工

| Repo | 路徑 | 職責 |
|------|------|------|
| **Guild House** | `airwave/guild-house/` | **系統**：Bun daemon、REST API、API doc、`data/`（mission-board、mission-rooms）、orchestrator、PO/member 模板、mission tools |
| **Guild Desk** | `airwave/guild-desk/` | **Guild master 操作空間**：`guild-master` skill、`CLAUDE.md`、control-plane CC session cwd |
| **Notes** | `guild/ideas/` | 設計 doc only（`archive/`、`backlog.md` 等），**不寫 code** |

```
airwave/
  guild-house/          ← daemon + API + mission data + mission runtime
  guild-desk/           ← guild master 開 CC，用 guild-master skill 指揮 guild-house API

Guild master workflow:
  cd guild-desk → claude              # control plane（guild-master skill）
  skill: bell / list missions / show attach cmd
  cd <mission cwd> → claude attach    # 介入 PO session（terminal）
```

- **Mission PO sessions** cwd = `guild-house/data/mission-rooms/{id}/`
- **Guild desk 不跑 mission**；只裝 **guild-master** skill + 與 guild master 對話操作 API
- API doc 放在 **guild-house**（e.g. `docs/api.md`）；**guild-master** skill **引用**該 doc（path 或 env）

**命名三件套**：`guild-house`（系統）· `guild-desk`（你的 desk）· `guild-master`（skill，会长号令 house）

---

## 架構總覽

```
Eric (IDE / UI)
    │
    ├── mission-board/          ← drop mission.md（intake）
    ├── inbox.md                ← Eric → Team
    └── UI: 任務板 / 大廳 / attach terminal

Orchestrator (Bun)
    ├── Bell: scan ready → pickup
    ├── claude --bg / attach / nudge / respawn
    ├── folder watch → UI refresh
    └── mailbox 聚合 outbox → notify Eric

Mission room (filesystem)
    ├── PO: claude --bg session (main agent)
    ├── members/ agent.md + subagents / 額外 session
    ├── memories/ + artifacts/ + mission-reports/
    └── checkpoint.yaml

Claude Code
    ├── --bg: background team runtime
    ├── attach: Eric CHAT 介入
    └── -r: inbox nudge
```

---

## UI

### Intake（不用任務生成 UI）

在 **`guild-house/data/mission-board/`** 下，Eric 在 Cursor/VS Code 寫 `mission.md` 即可（也可從 **guild-desk** 透過 guild-master skill / API 觸發，但 intake 檔案歸 guild-house data）。

### 任務板

- 顯示 parking / ready / active / archive
- **Bell button**：手動 trigger orchestrator scan mission folders

### 任務大廳

- Card = 各 mission 的 `mission-reports/visualization/overview.html`（或 overview.md）
- Card 有 **進入** → 任務房間 detail + 組員資訊
- Squad / memory markdown 在 UI → 見 [backlog.md](./backlog.md)（Files tab）

### 任務房間（Web UI — Plan 2 as-built）

- Tabs：**Brief** · **Checkpoint** · **Events** · **Outbox** · **Terminal**
- `GET /missions/:id/brief` — brief markdown（不暴露 raw 磁碟路徑）
- **Events** = `events.jsonl` 審計軌跡（milestone / qa_pass 等），**不是** team chat
- Guild master actions：archive（confirm）、pause/resume、restore session、mark outbox read
- **Terminal tab**：browser xterm + WebSocket → Bun PTY → `claude attach`（WSL/Linux dev）；dark theme；tab 開才 mount（非 Freeflow always-on）
- Sidebar：**Missions** 在 `/hall` 與 `/missions/:id` 皆高亮

### 原則

- Program artifact 與 mission meta **分離**（artifacts/ vs room root meta）

---

## Folder 結構

```
mission-board/
  parking/
  ready/
    hello-world/                ← intake slug（bell 可 mint 成 hello-world-20260627-a3f9c2）
      mission.md
  active/                       ← 含 phase: done 待 archive 的 mission
  archive/                      ← guild master POST /archive 後 board entry

mission-rooms/
  hello-world-20260627-a3f9c2/  ← id = minted mission id；archive 後仍留此路徑（prototype 不搬 room）
    squad.md                  ← YAML frontmatter + MD reasoning
    checkpoint.yaml           ← runtime 狀態（orchestrator）
    inbox.md                  ← guild master → Team
    outbox.jsonl              ← Team → guild master（escalations）
    members/
      project-owner/
        agent.md
      evaluator/
        agent.md
      specialist-*/
        agent.md
      reporter/
        agent.md
      ...（自由擴展）
    memories/
      common/
        mission-brief.md        ← orchestrator 於 bell 複製 board mission.md（frozen）
        events.jsonl          ← append-only 審計 / milestone（非 chat channel）
        memory.md             ← team 共識（PO guardian 寫入）
      members/
        project-owner/
          memory.md           ← PO 個人觀察 scratch
        {member}/
          ...                 ← 各 member 自由 memory
    artifacts/                ← 產出 code/project，與 meta 分離
      project-xxx/
      ...
    mission-reports/
      overview.md
      daily/
        YYYY-MM-DD.md
      visualization/
        overview.html         ← 大廳 card
        detail.html           ← 房間 detail
    tools/
      log.cmd / log.sh        ← POST /events（審計）
      escalate.* / signal.*   ← outbox / lifecycle signals

# 長遠：mission-rooms-archive/ 可選；prototype 不搬 room，只 archive board folder
```

---

## Mission 生命週期

### Folder location（coarse）vs 內部 state（fine）

| Folder | 意味 |
|--------|------|
| parking | 暫存，不 pickup |
| ready | 等待 pickup |
| active | evaluating / running / blocked / paused / **done**（done 仍在此直到 archive） |
| archive | guild master 驗收後 board entry 歸檔 |

細 state 在 `checkpoint.yaml`（runtime）；任務邏輯 state 在 memory / squad（PO 管理）。

### Handoff（ready → active，一次性）

```
ready/hello-world/mission.md
    ↓  [Bell → mint id if needed → rename ready folder]
ready/hello-world-20260627-a3f9c2/
    ↓  [pickup]
active/hello-world-20260627-a3f9c2/
mission-rooms/hello-world-20260627-a3f9c2/ 建立
    ↓
claude --bg -n "mission-apple-abcde-po"  (cwd = mission room)
session id → checkpoint.yaml
    ↓  PO 第一輪必讀 orchestrator 複製的 brief，產出：
       - squad.md
       - memories/common/memory.md 初稿
       - memories/common/mission-brief.md（orchestrator 於 bell 複製，frozen）
```

### mission-board vs mission room

- **mission-board**：initial note / 參考；Eric 可事後修改，叫 team 參看
- **開工後 source of truth → mission room**（memory、squad、artifacts、reports）
- Eric 改 board 時，PO 應檢查是否 sync 到 common/memory.md

---

## squad.md

**格式：MD + YAML frontmatter**

- **Frontmatter**：機器可 parse — members、spawn 設定、skills、autonomy
- **Body**：組隊 reasoning、architecture intent、communication rules、risks

Resume 時 orchestrator 讀 frontmatter 重建；PO / member 讀 body 理解 team charter。

建議 body sections：

```markdown
## Why this squad
## Architecture intent
## Communication rules
## Risks & open questions
```

---

## checkpoint.yaml

**用途**：mission 的 **runtime 快照**（CC session、phase、slot、resume 用）— **不是**任務正文（那是 memory / squad / artifacts）。

**誰寫**：**僅 Orchestrator**（Bun server 確定性 logic，不是 agent）。PO / members **read-only**；要改 runtime state 必須 **發 signal**（見下）。

**PO 如何影響 checkpoint**：不直接編輯檔案 → `POST /missions/:id/signals` 或 mission room 內 `tools/signal.sh`（curl API）→ Orchestrator 驗證後 **寫入 checkpoint** 並執行 process 操作（stop / respawn；**archive 僅經 `POST /archive`**）。

```yaml
claude_session:
  id: "7c5dcf5d"              # short bg job id（attach / respawn）
  session_id: "uuid-..."      # v0.6+ conversation id（state.json）
  name: "mission-hello-world-20260627-a3f9c2-po"
  cwd: ".../mission-rooms/hello-world-20260627-a3f9c2"
  status: running
  job_state: running          # running | done | missing（sync 自 job state.json）
  synced_at: "2026-06-27T..."

phase: running              # evaluating | running | blocked | paused | done
awaiting_guild_master: false
inbox_pending: false        # 長遠：inbox nudge API
```

**不追蹤 guild master 是否在線**。Guild master attach/detach 由 Claude session 自然處理。

關機 resume：**explicit restore**（boot / `POST /restore` / `?ensureLive=true`）— respawn ladder，見 [session-lifecycle.md](../../guild-house/specs/session-lifecycle.md)（現行 spec）。

---

## Memory 模型

### 原則

- **所有 memory 自由 read**
- **Write 有邊界**（tool + path guard + PO 規則）

### events.jsonl（取代 chatroom）

- Append-only JSONL；**不是** team 溝通 channel（CC agent team / Task 負責 live 協作）
- Tool：`tools/log.cmd` / `log.sh` → `POST /missions/:id/events`
- PO 記 milestone/directive；member 記 status/evidence/qa_pass/qa_fail
- Guild master + Web UI 讀取審計軌跡

範例：

```jsonl
{"ts":"2026-06-25T14:02:00+08:00","from":"project-owner","type":"milestone","body":"Squad chartered — developer + qa"}
{"ts":"2026-06-25T14:05:00+08:00","from":"qa","type":"qa_pass","body":"hello.cmd prints Guild House OK"}
```

### common/memory.md

- Project / team 維度 **approved truth**
- **只有 team lead 可寫**；member 透過 CC team 與 PO 溝通，PO 更新 memory

### memories/members/{role}/memory.md

- 各 member 私人 scratch（scaffold 於 pickup）
- PO 個人：`memories/members/project-owner/memory.md`

### mission-brief.md

- Orchestrator 於 bell pickup **複製** board `mission.md`；PO **只讀**

### Write matrix（摘要）

| Path | Read | Write |
|------|------|-------|
| events.jsonl | all | PO + members via `log` tool（type 白名單） |
| common/memory.md | all | team lead only |
| memories/members/{self}/memory.md | all | that member |
| squad.md | all | team lead |
| checkpoint.yaml | all | orchestrator only |
| inbox.md | all | Eric |
| outbox.jsonl | all | team lead via escalate tool |
| mission-reports/ | all | reporter（或 PO 代寫） |
| artifacts/{subproject}/ | all | assigned owner |

Parallel write：partition by member folder + append-only logs；common 避免多人 edit 同一 md。

---

## Runtime：Claude Code `--bg`

### Mission 開工

```bash
claudew --bg -n "mission-{id}-po"   # cwd = mission room
# orchestrator 写入 initial prompt（读 mission.md → squad / memory handoff）
# → session id 寫入 checkpoint.yaml
```

Main agent = PO（team lead）。Subagent / 額外 session 由 PO 按需 spawn。

### 預設：Guild-master-absent autonomy

PO `agent.md` 核心規則：

1. Guild master 不在是預設；能決定自己決定。
2. Guild master 訊息（attach / inbox）= **directive**；回覆後 **繼續工作**，不 idle 等 follow-up。
3. 需 guild master 決策 → `POST /escalate`（outbox + blocked signal）→ Orchestrator 設 `awaiting_guild_master`；停派新工，不 busy-wait。

### Guild master 介入 — 方式 A：CHAT（prototype 主要方式）

- 進 mission room UI → PTY 跑 `claude attach <session-id>`
- 或 CLI：`claude attach` / `claude -r <name>`
- 跟 **main agent (PO)** 講；不能 town hall → 找 member 透過 PO 或讀 filesystem
- 關 UI = detach（等同 `/exit`），bg session 繼續
- ESC → 打斷當前 turn

### Guild master 介入 — 方式 B：Drop-in（inbox，prototype 無 auto nudge）

1. Guild master 寫 `inbox.md`
2. 手動 nudge（UI button 或 CLI）
3. Orchestrator：
   ```bash
   claude -r "<session-id>" "[System] Eric updated inbox.md — read and act"
   ```
4. Guild master 不進 terminal（prototype 無 auto nudge）

### Team → Guild master：outbox + notify

- Tool：`POST /missions/:id/escalate` — append `outbox.jsonl` + blocked signal；Orchestrator 設 `awaiting_guild_master`
- Desktop notification + UI badge
- 將來：**guild mailbox** 聚合各 mission outbox unread；team 只 call tool

Eric 回覆：inbox + nudge，或 attach CHAT。

---

## Mission 多輪循環與 Session 生命週期

### 是不是 main system 背後 manage 很多 AI CLI process？

**是，但分兩層，不要混為一談：**

| 層 | 誰管 | 管什麼 |
|----|------|--------|
| **Orchestrator** | Guild House daemon | 每個 active mission 的 **PO bg session**（spawn / 記 session id / nudge / respawn / 歸檔時 stop） |
| **Claude Code supervisor** | Claude 內建 | 同一 PO session 內的 **subagent / Task**、bg session 進程細節 |
| **PO（邏輯）** | Team lead agent | Mission **多輪工作循環**的決策：派工、收工、下一輪、完成、blocked |

Orchestrator **不需要** micro-manage 每一個 subagent turn。它管的是 **mission ↔ PO session** 這條主線。

多 mission 平行時 ≈ **N 個 active mission → N 個 PO `claude --bg` session**（+ 你 attach 時的 PTY 是 UI 層，不是第三個 PO）。

```
Orchestrator
  ├── mission-A → claude --bg (PO session A)
  ├── mission-B → claude --bg (PO session B)
  └── mission-C → claude --bg (PO session C)
        └──（session C 內）PO spawn subagents → Claude supervisor 管
```

### 三個時間尺度（不要搞混）

| 尺度 | 是什麼 | Process 要不要重生？ |
|------|--------|---------------------|
| **Turn** | PO 或 subagent 一次推理 + tool use | 否 |
| **Round** | PO 完成一個 plan 步驟（派工 → 收結果 → 更新 memory / report） | **通常否** — 同一 PO session 繼續下一 round |
| **Session** | 一個 PO `claude --bg` 進程 / session id | **例外才重生**（見下） |
| **Mission** | 從 pickup 到 archive | 期間可含很多 round；可跨多次 session（respawn） |

Mission 的「多輪循環直到完成」主要是 **PO 在同一 session 內 loop**：

```
loop until mission_complete:
  read checkpoint + memory + recent events tail
  decide next action
  spawn subagents / do work / call reporter
  distill → common/memory.md, events.jsonl, mission-reports/
  signal round_complete / mission_complete → via API（Orchestrator 寫 checkpoint）
  if blocked awaiting guild master → exit loop iteration, wait (outbox / inbox)
  if mission done → signal mission_complete → break
  # guild master 驗收後 POST /archive
```

**Filesystem + checkpoint 是接棒點**；session 進程是可替換的 runtime，不是 state 本身。

### 誰判斷 session 完結？誰觸發重生？

原則：**PO 發 signal（API / lifecycle script）→ Orchestrator 寫 checkpoint 並執行 process 操作。**  
Orchestrator 不替 PO 決定「這一輪活動做完沒有」，只認 **明確 signal**。

#### Session 繼續（預設，大多數 round 結束）

- PO 呼叫 `POST /signals { type: round_complete }`；Orchestrator 更新 checkpoint、`events.jsonl`；PO 自行更新 memory
- **PO bg session 不關**
- 下一 round 同一 process 繼續

#### Session 正常結束（mission 層）

| Signal | 誰發 | Orchestrator 做什麼 |
|--------|------|---------------------|
| `mission_complete` | PO via `POST /signals` | 寫 checkpoint `phase: done` → **stop PO session** → **留 active board** |
| Archive | Guild master `POST /missions/:id/archive` | board `active/` → `archive/`（需 `phase: done`）；room 不搬 |
| `mission_cancelled` | Guild master API 或 PO signal | 長遠；prototype 可等同 complete + archive |

#### Session 中止後重生（例外，但設計要支援）

| 原因 | 誰發 signal | Orchestrator 做什麼 |
|------|-------------|---------------------|
| 關機 / crash | Orchestrator 開機 | 讀 checkpoint → `claude respawn <id>` 或 `--resume` |
| Eric / 系統 pause | Eric 或 UI | `phase: paused` → stop bg session（可選） |
| Resume | Eric Bell / UI | respawn 或 `--resume`，PO 讀 files 接棒 |
| Context 過長 | PO `request_session_restart` | stop → 新 session `--resume` 同 id（或 fork）；**state 在 files** |
| PO 卡死 | Orchestrator watchdog | 超時 → stop → respawn + 寫 event |

**Round 完成 ≠ Session 重生。** 只有上表情況才換 PO process。

#### Blocked（不是 session 完結）

- PO escalate（outbox）+ `POST /signals { type: blocked }` → Orchestrator 設 `awaiting_guild_master`
- **MVP（prototype v0.7）**：PO session **掛著 idle**；停派新工；**佔 slot**（timeout 釋 slot 仍屬長遠）
- **長遠**：`awaiting_guild_master` 帶 **wait timeout**（例如 30 分鐘）→ 逾時 **graceful shutdown** PO session → **釋出 concurrent slot（4 之一）** → orchestrator 從 **ready queue** spin up 下一個 mission；原 mission 維持 `phase: blocked`，Eric 回覆後以 `--resume` / respawn 接棒（state 在 files）

```
awaiting_guild_master + outbox
    ↓ MVP: idle 佔 slot
    ↓ 長遠: timer（e.g. 30min）
graceful stop session → slot free
    ↓
orchestrator pickup next ready mission（若 queue 有）
    ↓
Eric 後來回 inbox → nudge / resume blocked mission（若仍有 slot 或等下一個 release）
```

### checkpoint.yaml（擴充 lifecycle 欄位）

```yaml
claude_session:
  id: "7c5dcf5d"
  name: "mission-apple-abcde-po"
  status: running          # running | stopping | stopped | respawning

phase: running             # evaluating | running | blocked | paused | done
round: 3                   # 邏輯 round 計數
round_status: in_progress  # in_progress | complete

awaiting_guild_master: false
awaiting_guild_master_since: null      # 長遠：ISO timestamp，供 timeout 計算
inbox_pending: false

last_signal:
  at: "2026-06-25T15:00:00+08:00"
  by: project-owner
  type: round_complete     # round_complete | mission_complete | request_restart | blocked
```

`events.jsonl` 由 Orchestrator 在處理 signal 時 append（audit trail）。

### PO lifecycle scripts（呼叫 API；Orchestrator 寫 checkpoint）

Mission room 內 `tools/signal.sh` 或等同 script → `curl POST /missions/:id/signals`：

| Signal `type` | Orchestrator 做什麼 |
|---------------|---------------------|
| `round_complete` | 寫 checkpoint（`round++` 等）→ session **繼續** |
| `mission_complete` | `phase: done` → stop session；**不** auto archive board |
| `blocked` | `phase: blocked`，`awaiting_guild_master: true`（常與 outbox 一起） |
| `request_session_restart` | stop → `--resume` / respawn |

PO `agent.md` 必須寫：何時呼叫哪個 signal（例如：每完成 plan 一步 `round_complete`；全部 acceptance 過 `mission_complete`）。

### Orchestrator session manager（prototype v0.6+ sketch）

```typescript
// Sync（GET /missions/:id/session）：agents --json + job state.json → patch checkpoint；不 spawn

// Restore（boot / POST /restore / ensureLive）：respawn short id → fail → new --bg + resume prompt

// mission_complete signal：stopSession；phase done；不搬 board

// POST /archive（guild master）：require phase done → move active board folder → archive

// Boot recovery：skip paused + done；restore 其餘 active
```

開機時：對 active missions（非 paused/done）執行 **restore ladder**（非 blind respawn all）。

### 中斷與 Resume 流程

**中斷（Eric 關電腦 / 按 pause）**

1. Orchestrator 設 `phase: paused`
2. 可選：graceful stop PO bg session
3. checkpoint + 所有 memory / artifacts 已落在 disk → safe

**Resume**

1. Orchestrator 啟動 → 掃 active missions
2. `claude respawn <id>` 或 `--resume`
3. PO 第一輪：讀 checkpoint + common/memory.md + recent events + squad.md
4. 從 `round` / plan 繼續，不需靠舊 process memory

**Eric ESC（attach 時）**

- 只打斷 **當前 turn**，不是 mission pause
- PO bg session 繼續；Eric detach UI 不影響

### MVP 建議（由簡到繁）

1. **一 mission 一 PO bg session**，round loop 全在 session 內，不 auto respawn
2. checkpoint 追 `phase` + session id + `awaiting_guild_master` + sync 欄位（v0.6）
3. `mission_complete` → done + stop；**guild master `POST /archive`**
4. Boot **restore ladder**（pause/resume/ensureLive）
5. 再加 `request_session_restart` + round 計數 + watchdog

---

## Orchestrator 職責

**Bun HTTP server + 確定性 logic（不是 LLM agent）。** 收到 API 請求 / signal 後按固定規則執行；不推理 mission 內容。

- Bell：scan `mission-board/ready/`
- Pickup：建 mission room、handoff、spawn `claude --bg`
- **唯一寫入** `checkpoint.yaml`
- Inbox nudge（`claude -r`）
- Outbox → notify / mailbox
- UI WebSocket：attach PTY relay（**Bun.spawn terminal** on Linux/WSL；browser xterm）
- Pause/resume：`respawn`、folder 狀態
- 可選：file watcher → 刷新任務板 / 大廳

**不做**：硬編 workflow 狀態機；不替 PO 做決策。

---

## Communication flow（簡圖）

```
Guild master ──inbox / attach──► PO (main session)
PO ──spawn Task / agent team──► members（live 協作）
PO / members ──tools/log──────► events.jsonl（審計，給 UI）
PO ──escalate───────────────► outbox ──notify──► Guild master
PO ──distill────────────────► common/memory.md
Specialist ──write───────────► artifacts/ + memories/members/{self}/memory.md
Reporter ──write─────────────► mission-reports/
```

---

## MVP — Prototype API（Plan 1 done）+ Web UI（Plan 2 in progress）

**形式**：Bun **HTTP API server**（daemon）+ **Web UI**（`guild-house/web/`，dev `:3848`）。

**Guild master 操作面**（二選一或並用）：

1. **`guild-desk/`** + **guild-master** skill → API / attach 指令
2. **Web UI** → board, hall, mission room, outbox triage, archive/pause/restore, **browser terminal attach**

```
Eric @ guild-desk (CC + guild-master)  →  Guild House API  →  orchestrator / data/ / CC --bg
Eric terminal attach                →  PO mission session（cwd = guild-house/data/mission-rooms/…）
```

### Prototype 範圍（做）

| 項目 | 說明 |
|------|------|
| Bun daemon + **REST API** | 見下節 API sketch；附 **API doc** |
| **`guild-master` skill** | 在 **`guild-desk/.claude/skills/guild-master/`**；讀 guild-house API doc，代呼叫、組 attach 指令 |
| Folder layout + `mission.md` | intake |
| Bell pickup（API） | ready → active + 建 mission room + `claude --bg` |
| checkpoint + **session id 可查** | API 回傳 attach / resume 用的 id、name |
| PO `agent.md` + handoff | squad、common/memory |
| **outbox.jsonl** + escalate | PO tools + API；`awaiting_guild_master` |
| **events.jsonl** + `tools/log` | Append-only **audit**（milestone, qa_pass…）；**非** team chat |
| Concurrent 上限 4 + queue | **`phase: done` 不佔 slot**（v0.7） |
| Boot **restore ladder** | skip paused/done；explicit restore paths（v0.6） |
| **Web UI** (Plan 2) | Board + bell + hall + mission room + guild master actions + **PTY terminal attach**（Phase 5 done） |

### 延後 / 不做（prototype）

→ 完整清單見 **[backlog.md](./backlog.md)**（Web UI deferred、platform、long-term）。

摘要：inbox nudge、desktop notify、guild mailbox、`awaiting_guild_master` timeout、reporter auto-gen 等 **不在** prototype MVP；guild master 介入以 terminal attach 或 **Web UI Terminal tab** 為主。

### Guild master 介入（prototype）

- **主要方式**：terminal `claudew attach`（skill 用 `session?ensureLive=true` 取得 live attachCmd）
- Skill 職責：查 API → 顯示指令，不代替 guild master attach
- outbox：Eric 用 skill/API 看誰在等 → attach 進 mission 跟 PO 講，或直接改 `inbox.md`（檔案仍可用，但無 auto nudge）

### API sketch（implemented — see guild-house/docs/api.md）

```
GET  /health                           # → 0.10.0
GET  /board
POST /bell

GET  /missions
GET  /missions/:id
GET  /missions/:id/brief
GET  /missions/:id/summary
GET  /missions/:id/room/:path          # optional read-only files
GET  /missions/:id/events
POST /missions/:id/events              # tools/log
GET  /missions/:id/session             # ?ensureLive=true
POST /missions/:id/restore
POST /missions/:id/resume
POST /recover

GET  /outbox
GET  /missions/:id/outbox
POST /missions/:id/outbox/read

POST /missions/:id/signals
POST /missions/:id/pause
POST /missions/:id/archive
POST /missions/:id/escalate

GET  /queue

WS   /ws/missions/:id/attach           # ?token= & optional ?cols=&rows=
```

所有需改 `checkpoint.yaml` 的路徑 **只經 Orchestrator**（含 PO signals、bell pickup、pause/resume、boot respawn）。

### `guild-master` skill 職責（`guild-desk/.claude/skills/guild-master/`）

- **Guild Master** = guild master 的 control-plane 介面；透過 HTTP API 號令 **Guild House**
- 代操作：Bell、列 mission、查 session、列 outbox、**archive**
- 不 spawn CC session 本身（guild master 手動在 terminal 執行 attach）

### Prototype 驗收（happy path — Phase 7）

```
1. ready/{slug}/mission.md → POST /bell → minted id + claude --bg + checkpoint
2. PO 產 squad + memory + artifacts；QA → mission_complete（留 active，釋 slot）
3. GET /outbox 或 escalate → awaiting_guild_master；attach 用 session?ensureLive=true
4. Guild master 驗收 → POST /missions/{id}/archive
5. daemon 重啟 → boot restore active non-done missions
```

### 實作順序（prototype）

1. **guild-house**：repo scaffold + `data/` layout + config（`GUILD_HOME`）
2. Bun server skeleton + `/health`
3. Bell pickup + `claude --bg` + checkpoint
4. Mission / session / board GET APIs
5. outbox 讀寫 + GET outbox API
6. PO `agent.md` + members 模板 + escalate script
7. pause / resume / respawn API
8. **guild-house**：API doc（`docs/api.md`）
9. **guild-desk**：`guild-master` skill + `CLAUDE.md` 對接 API

---

## MVP 順序（完整版，prototype 之後）

> **Plan 2（complete）：** [web-ui-implementation-plan.md](./web-ui-implementation-plan.md)  
> **Plan 3（complete）：** [mission-discovery-plan.md](./mission-discovery-plan.md) · product **0.2.0**  
> **Deferred / future：** [backlog.md](../backlog.md)

**Done (prototype + Plan 2 + Plan 3):** Web UI Phases 0–6 · Mission Discovery · `events.jsonl` + log tool · browser terminal attach

**Moved to backlog:** Files tab · hall reporter iframe · inbox nudge · desktop notify · guild mailbox · timeout 釋 slot · 任務大廳 viz 增強 · 其餘見 backlog

---

## 已確認決策（plan 前）

| # | 決策 |
|---|------|
| 1 | **guild-house**：系統；**guild-desk**：guild master 操作空間；**guild-master**：skill；**guild/ideas/**：note only |
| 2 | **MVP agent runtime**：Claude Code（`--bg` / attach / `-r` / respawn）。已裝 cursor-cli，但不 support agent team，故不採 |
| 3 | **開發環境** Windows + cmd；**目標 OS-neutral**（Bun + 抽象 path/spawn/notify），Windows + Linux 難度中等（見下節） |
| 4 | **同時 active mission 上限**：4 個 PO bg session；超出時 ready queue 不 auto spawn |
| 5 | **`awaiting_guild_master` 時 PO session（MVP）**：**掛著 idle**，佔 concurrent slot |
| 5b | **長遠**：`awaiting_guild_master` **wait timeout** → graceful shutdown → 釋 slot → queue spin up |
| 5c | **v0.7**：**`phase: done` 不佔 slot**；done 留 active 直到 guild master `POST /archive` |

| 6 | **Prototype MVP**：Bun **API** + **Web UI**（Plan 2 complete）；guild master 用 **guild-master** skill 或 browser；介入 **terminal attach**（CLI 或 Web UI Terminal tab） |
| 7 | **Control plane**：guild master 在 **guild-desk** 開 CC + **guild-master** → Guild House API |
| 8 | **`checkpoint.yaml`**：**僅 Orchestrator 寫**；PO 經 **`POST /missions/:id/signals`** 間接更新；Orchestrator = Bun 確定性 logic，**不是 agent** |
| 9 | **CC spawn**：可配置本地 custom claude command（OpenRouter env + model） |
| 10 | **Data**：`guild-house/data/`（gitignore）；API **key** 鉴权；port **3847**；`bun run dev` |
| 11 | **Bell pickup**：spawn `--bg` + initial prompt；**mint mission id** `{slug}-{YYYYMMDD}-{6hex}` if needed |
| 12 | **Mission id**：intake **slug** folder；canonical id minted at bell（legacy demo-001 等仍有效） |
| 12b | **Archive**：`POST /missions/:id/archive` after acceptance；board only；room stays |
| 13 | **CC command**：`claudew`（本地 wrapper，OpenRouter env + model） |
| 14 | **Prototype 包含 events log**（`events.jsonl` + `tools/log`；取代 chatroom；与 outbox 分 phase 实现） |
| 15 | **MVP 开发 agent**：Cursor IDE；**runtime** CC + `claudew` |

### 待 plan 前仍要定（次要）

→ 已移入 [backlog.md](./backlog.md)（mission-board sync、demo mission type 等）

### 跨平台（OS-neutral）備註

- **容易共用**：Bun orchestrator、filesystem layout、WebSocket UI、chokidar、`path.join`、Claude CLI（兩端裝了即可）
- **要抽象一層**：PTY（**Bun native terminal on Linux/WSL**；Windows attach 未支援；`node-pty` 已移除）、desktop notify、daemon 安裝（Windows service vs systemd）、spawn shell（cmd vs sh）
- **策略**：core 不寫 dead OS paths；**WSL/Linux 為 terminal attach 開發主線**；Windows 仍可跑 API + UI（無 browser attach 打字）
- **難度**：中等 — 不是兩套 codebase，主要是邊界 case 與實測

### `awaiting_guild_master` idle 與成本

- **Idle = session 在等輸入、沒在跑 turn** → **不會**持續燒 token/API
- 費用的是 **active turn**（推理、tool use）或 **heartbeat 類週期 wake**（若將來加）
- **MVP idle 代價**：佔 **1/4 concurrent slot** + 本機 process RAM（可接受，實作最簡）
- **長遠 timeout 代價/收益**：blocked mission 讓 slot，queue 可前進；Eric 晚回覆時該 mission 用 resume 接棒，不丟 state
- PO 規則：`awaiting_guild_master` 時 **停派新工、不自行開下一 round**
