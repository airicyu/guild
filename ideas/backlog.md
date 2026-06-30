# Guild House — Backlog

> 尚未排期的功能與改進。**產品真相：** [guild-house/specs/product.md](../guild-house/specs/product.md) · **API：** [guild-house/docs/api.md](../guild-house/docs/api.md) · **歷史計劃：** [archive/](./archive/)

格式：**問題** → **要做什麼** → **備註**（API / 檔案路徑）

---

## Web UI — near-term

API 多半已存在；主要是 `guild-house/web/` 加畫面。

### Mission room「Files」分頁

- **問題：** Mission room 只有 Brief / Checkpoint / Events / Outbox / Terminal；guild master 要看 `squad.md`、各 member 的 `memory.md` 得開檔案總管或 attach。
- **要做什麼：** 在 `/missions/:id` 加 **Files** tab（或左側檔案清單 + 右側預覽）。用既有 `GET /missions/:id/room/:path` 拉內容，用 `MarkdownView` 渲染。第一版至少支援：`squad.md`、`memories/common/memory.md`、`memories/members/{role}/memory.md`。
- **備註：** 路徑 allowlist 見 `room-read.ts` / [api.md](../guild-house/docs/api.md)。

### Mission room「Artifacts」瀏覽

- **問題：** PO 產出在 `artifacts/`（設計稿、中間結果），UI 完全看不到。
- **要做什麼：** 在 mission room 加唯讀 **Artifacts** 區塊：列出 `artifacts/` 下檔案樹（或扁平 list），點檔案用 room API 預覽 markdown / 顯示「二進位檔請在本機開」。不需上傳或編輯。
- **備註：** 若 room API 尚無 directory listing，需先加 `GET .../room` index 或固定幾條常見路徑。

### Hall 任務卡 Reporter 預覽

- **問題：** 有些 mission 會在 room 內產生 `mission-reports/visualization/overview.html`（靜態報表），hall 上完全沒入口。
- **要做什麼：** 在 `/hall` 的 `MissionCard` 上：若 summary 或 probe 顯示該 HTML 存在，顯示「Open report」或內嵌 **iframe** 縮圖預覽；點擊進 mission room 或全螢幕 iframe。沒有檔案時不顯示（現有卡片行為不變）。
- **備註：** 只**顯示**既有檔案；不負責讓 PO **生成**報表（生成仍靠 agent / 腳本）。

### Board 頂部 Slot 卡片寬度統一

- **問題：** Board 頁 Discovery slots 與 Execution slots 兩張 `SlotMeter` 寬度不一致，視覺不整齊。
- **要做什麼：** 調整 `SlotMeter` / board header flex：兩卡同 min-width 或共用 grid，文案換行時仍對齊。
- **備註：** 純 CSS；`BoardPage.tsx` + `SlotMeter.tsx`。

### 左側導航 Missions 數量 badge

- **問題：** 左欄 **Discovering** 有數字 badge（`board.discovering.length`），**Missions** 沒有；working 任務數量不直覺。
- **要做什麼：** 在 `Layout.tsx` 的 Missions nav item 加 badge，數字來源建議 `GET /board` → `working.length`（或 `GET /missions` 中 `board === working` 的 count）。樣式與 Discovering / Outbox badge 一致。
- **備註：** 可複用現有 `board` query cache。

---

## Web UI — deferred

### 瀏覽器桌面通知（Outbox）

- **問題：** 只有打開 Web UI 時才看到 outbox badge；guild master 在別的分頁工作會錯過 escalation。
- **要做什麼：** 當 `GET /outbox` 的 unread count 從 0 變 >0（或出現新 entry id）時，用 **Notification API** 發一則系統通知，點擊導向 `/outbox` 或對應 mission/idea room。需處理權限請求與「勿擾」開關（可放 header settings）。
- **備註：** 不依賴後端；與 polling 共存即可。

### Playwright 煙霧測試

- **問題：** 回歸靠手動點 board / bell / mission room，重構後易漏。
- **要做什麼：** 加 `guild-house/web` 或 monorepo 層級 Playwright：`/health` mock 或 test fixture 下驗證 board 渲染、bell POST、mission detail 分頁切換。不要求真實 Claude spawn。
- **備註：** CI 可選；本地 `bun run test:e2e`。

### SSE 取代部分 polling

- **問題：** Board / hall / mission summary 用 TanStack Query 固定間隔輪詢，API 與瀏覽器都浪費。
- **要做什麼：** 後端加例如 `GET /events` SSE（board 變更、outbox 新增、session liveness）；Web 訂閱後 invalidate 對應 `queryKeys`。可分期：先 outbox，再 board。
- **備註：** 需 API 設計 + `server.ts`；polling 可保留為 fallback。

### 多使用者 / 角色

- **問題：** 全站單一 `GUILD_API_KEY` + 單一 `GUILD_MASTER_NAME`；無法區分唯讀觀察者與操作者。
- **要做什麼：** 產品層定義角色（例如 observer / guild master），API 層 Bearer 對應權限（bell、archive、approve 是否允許）；Web 依 403 隱藏按鈕。非 LDAP——仍是少量 shared secret 或 token per role。
- **備註：** 大範圍；先寫 spec 再動手。

### 生產環境由 Bun 提供靜態 UI

- **問題：** 開發要兩個 terminal（API + Vite）；部署時希望單一 `:3847` 服務 API + `web/dist`。
- **要做什麼：** `guild-house` 在 prod 模式 `serve` `web/dist`（或 `GUILD_UI=1`），`/api` 與 SPA fallback 路由正確；文件寫清 build + start 流程。
- **備註：** Plan 2 曾列為 polish；與日常 dev 無關但部署需要。

---

## Platform / orchestrator

### Inbox 寫入 → 自動 nudge PO / discovery lead

- **問題：** Guild master 在 mission/discovery room 寫 `inbox.md`（或透過未來 UI 寫入）後，checkpoint 會設 `inbox_pending: true`，但 **bg session 不會自動收到**，要靠 guild master attach 親口說。
- **要做什麼：** Orchestrator 監聽 `inbox.md` 變更（或提供 `POST .../inbox` API 寫檔後）：對 live PO / intake lead 執行 **`claude -r` / resume 注入** 一段固定 prompt（「讀 inbox.md 再繼續」）。與現有 handoff 文案對齊（見 `scaffold.ts`）。
- **備註：** 高價值 unattended 體驗；需定義 debounce、session 不在線時是否只設 flag。

### `awaiting_guild_master` 逾時釋放 slot

- **問題：** PO 發 `awaiting_guild_master` 後 session **idle 仍佔** working slot（見 product spec）；queue 裡的任務一直進不來。
- **要做什麼：** Checkpoint 加「等待開始時間」；逾時（例如 30 分鐘，可 env 設定）後 orchestrator：**優雅停 PO** → `phase` 維持 blocked 或 paused → 移出 working slot 計數 → **tick 可啟動 queue 下一個**。Outbox 留紀錄；guild master 仍可稍後 attach 處理。
- **備註：** 與 inbox nudge 互補（一個催 PO 繼續，一個釋放資源）。

### Parking 上 `mission.md` 與 room 不同步

- **問題：** 任務在 **parking** 時，board 上的 `mission.md` 可能被人工編輯；bell 進 working 後 PO 讀的是 room 內 **mission-brief 複本**，兩邊不一致。
- **要做什麼：** 定規則並實作其一：(a) promote / pickup 時以 board 版覆寫 brief；(b) 偵測 diff 寫入 outbox 提醒；(c) 禁止改 parking 檔、只能改 room。需寫進 `specs/product.md` 再改 `promote` / pickup 路徑。
- **備註：** 邊界情況；影響 discovery → parking → queued 流程。

### Mission brief 在 UI 難讀

- **問題：** `GET /missions/:id/brief` 回傳的 markdown 常含 YAML frontmatter、多餘空行、標題層級混亂；Brief tab 直接 `MarkdownView` 不好看。
- **要做什麼：** 前端或 API 正規化：剝 frontmatter、折疊 metadata、統一標題樣式；或 brief 模板約束 PO 輸出格式。先從 **最常見** 的 hello-world / discovery 產物修。
- **備註：** 可只做 Web 層 `brief` preprocessor，不必動磁碟檔。

---

## Long-term product

保留方向夠具體的項目；其餘已刪（見下方「已移除」）。

### 可重用 Guild skills

- **要做什麼：** 把某次 mission 驗證過的 prompt / tool 模式抽成 **可安裝 skill**（類似 guild-master），在 `templates/mission-room` 或 member `agent.md` 裡引用，減少每次重寫。
- **備註：** 偏內容與模板治理，不是單一 PR。

### Mission 子任務拆分

- **要做什麼：** PO 在 plan 階段把 work 拆成 subtask，每項對應 `artifacts/subtasks/{slug}/` 與 checkpoint 追蹤；Web hall 可顯示子任務進度條。
- **備註：** 需 checkpoint schema + PO playbook 變更。

### Mission 結束 retrospective

- **要做什麼：** `mission_complete` 後可選流程：PO 寫 `artifacts/retrospective.md`，guild master 在 UI 核准後，系統把可重用段落提煉到 guild 級 `ideas/` 或 skill 庫。
- **備註：** 與「可重用 skills」銜接。

### Hall 成員狀態視覺化

- **要做什麼：** `/hall` 不只卡片列表：用簡單動畫/圖示表示 PO running、blocked、evaluator 活動（資料來自 checkpoint phase + events 最近幾筆），類似「任務大廳」而非純表格。
- **備註：** 讀取為主；不取代 terminal attach。

### Memory 規模化

- **要做什麼：** 當 `memories/**/memory.md` 過長時：拆檔（按 topic / 日期）、PO 用 tool **按需讀取**、summary 索引檔；避免每次全量塞進 context。
- **備註：** Orchestrator scaffold + member tools + 可選 Files tab 聯動。

---

## 建議優先順序

1. **Files tab + Artifacts 瀏覽** — 每日在瀏覽器看 mission 內容
2. **Inbox nudge + awaiting 逾時** — queue 不被 idle PO 卡死
3. **UI polish** — slot 寬度、missions nav badge
4. **Hall reporter iframe** — 有報表的 mission 才受益
5. 其餘按產品成熟度再開

---

## 已移除（太簡短、重複、或明確不做）

| 原條目 | 原因 |
|--------|------|
| Mission.md intake editor | **刻意不做** — intake 用 IDE / drop folder；寫在 backlog 易誤解為要做 |
| Reporter auto-gen | 與「Hall iframe」重疊；生成是 agent 責任，不是 UI backlog |
| Guild mailbox | 與現有 `GET /outbox` + 桌面通知重疊；概念未定義 |
| inbox nudge（Web 段） | 併入 Platform「Inbox nudge」 |
| `awaiting_guild_master` timeout（Web 段） | 併入 Platform 逾時釋放 slot |
| `GET /board/summary` | 未定義 enriched 欄位；現有 `/board` + `/missions` 已夠用，需時再開 spec |
| Kanban drag | **產品決策：不做** — 階段只透過 API（promote / bell / archive） |
| Bell chime sound | 裝飾性過強，價值低 |
| Mobile layout polish | 空泛；具體 breakpoint 問題出現再開 ticket |
| `dev:all` / Settings page / `docs/web-ui.md` | DX 錦上添花；`dev:ui` + header API key modal 已夠 |
| File watcher auto-pickup | 已有 `GUILD_TICK_INTERVAL_MINUTES`；fs watch 另需規格 |
| Reporting notification channel | 空泛 |
| Trophy / gamification、Agent personality | 願景口號，無可執行範圍 |
| Demo mission type | 與 hello-world / E2E 重疊；需要時直接寫一個 mission package |
