---
name: web-research
description: 結構化網路研究流程 — plan → search → fetch → synthesize → cite。當 discovery 或 execution mission 需要系統化收集外部資訊時 wire。
---

# Web Research

系統化網路研究流程，從問題定義到引用完整的五階段方法。

---

## 何時 wire 這個 skill

Wire 當以下任一情境需要從外部來源收集資訊：

- **Discovery phase**：探索 idea 可行性、競品分析、市場研究、技術調研
- **Execution mission**：需要參考外部文件（API spec、文件庫、標準規範）、驗證假設、補充 background context

**不要** wire 當：

- 資訊已在 mission brief 或 squad memory 中完整提供（不需外部搜尋）
- 研究結果不影響任務產出（純內部推理任務）
- 需要即時歷史資料或既定事實，而非探索性研究（使用 deep-research skill）

---

## 研究流程

網路研究分為五個連續階段，每個階段的輸出是下一階段的輸入。

### Phase 1：Plan（規劃搜尋策略）

確認研究目標，規劃搜尋策略：

- 明確研究問題：從 mission brief 或 squad 討論中提煉出 **具體、可搜尋的研究問題**
- 拆解問題為數個面向：將大問題拆分為 2–5 個子問題或關鍵面向
- 規劃關鍵字組合：每個面向準備 2–3 組搜尋關鍵字（含同義詞）
- 定義搜尋範圍：技術文件、新聞、學術、官方文件？時間範圍？
- 決定信賴權重：哪些來源類型應給予較高權重（如官方文件 > 部落格）

**輸出：** research plan（簡短 markdown 清單），記錄於 research note 或 memory.md

```
## Research plan
- **Question:** [研究問題]
- **Aspects:**
  1. [面向一] → keywords: ...
  2. [面向二] → keywords: ...
- **Scope:** [文件類型 / 時間範圍]
- **Priority sources:** [高權重來源類型]
```

### Phase 2：Search（多角度搜尋）

執行搜尋，收集結果清單：

- 每組關鍵字使用 `WebSearch` 工具進行搜尋
- 迭代調整：若前幾次搜尋結果不理想，調整關鍵字重新搜尋
- 多角度：用不同觀點的關鍵字搜尋（如優點 vs 缺點、技術 vs 商業）
- domain 限縮：當已知領域時，善用 `allowed_domains` 參數聚焦權威來源

> 搭配使用 `WebSearch` 的 `query`、`allowed_domains`、`blocked_domains` 參數控制搜尋範圍。

**輸出：** 搜尋結果候選列表（URL + 標題 + 簡短摘要）

### Phase 3：Fetch（深入閱讀）

從搜尋結果選擇高價值頁面，使用 `WebFetch` 工具深入閱讀：

- 優先選擇：官方文件、權威媒體、第一手來源
- 多來源：同一事實至少打開 2–3 個獨立來源驗證
- 交叉驗證：對比不同來源的數據和說法，標記矛盾點
- 完整閱讀：獲取完整上下文，不只看片段

> `WebFetch` 會將 URL 轉換為 markdown，可用 `prompt` 參數針對內容提問以提取特定資訊。

**輸出：** 各頁面的關鍵發現摘錄（含來源標記）

### Phase 4：Synthesize（綜合分析）

整合來自不同來源的資訊，形成結構化摘要：

- **歸納共識**：多個獨立來源一致認同的事實
- **標記分歧**：不同來源說法矛盾之處，記錄各自立場與可能原因
- **識別缺口**：研究過程中發現但無法回答的問題
- **時間演變**（若適用）：觀點或數據隨時間的變化
- **信賴評估**：對每個關鍵發現標註信賴等級（高 / 中 / 低），註明原因

**輸出：** 綜合分析區塊，準備產出為 research note 或 memory.md 片段

### Phase 5：Cite（來源引用）

為所有引用資訊提供可追溯的來源紀錄：

- 每條引用附上來源連結
- 使用統一的引用格式（見下方引用格式規範）
- 記錄存取日期（資訊可能隨時間變化）
- 區分直接引用與推論

---

## WebSearch 最佳實踐

| 實踐 | 說明 |
|------|------|
| **多關鍵字組合** | 同一面向準備 2–3 組不同關鍵字，避免單一詞組的 bias |
| **多角度搜尋** | 從正反雙方、不同利害關係人角度搜尋，獲取全面觀點 |
| **限制 domain** | 已知領域設定 `allowed_domains` 提高品質（如 `developer.mozilla.org`、`arxiv.org`） |
| **排除低品質** | 用 `blocked_domains` 排除 spam、內容農場、已知低品質來源 |
| **迭代搜尋** | 第一輪結果指引第二輪的關鍵字調整；3–5 輪迭代可達到 saturation |
| **時效性注意** | 留意搜尋結果的日期，確保資訊未過時 |
| **語系策略** | 根據研究主題選擇合適語系；技術主題優先英文來源 |

### 典型搜尋模式（fan-out）

```
Round 1: 寬泛關鍵字 → 了解領域輪廓
Round 2: 聚焦子主題 → 深入特定面向
Round 3: 驗證關鍵說法 → 交叉比對
Round 4: 填補缺口 → 針對空白處補搜
```

> 此 fan-out 模式參考 Claude Code 內建 `deep-research` skill 的多階段搜尋策略。

---

## WebFetch 最佳實踐

| 實踐 | 說明 |
|------|------|
| **選擇權威來源** | 官方文件、學術論文、業界報告優先；部落格、論壇次之 |
| **fetch 完整頁面** | 不要只讀摘要或 snippet；取得完整上下文 |
| **交叉驗證** | 同一數據至少從 2–3 個獨立來源確認 |
| **記錄矛盾** | 不同來源說法不一致時，標記並記錄可能原因 |
| **使用 prompt 參數** | `WebFetch` 支援 `prompt` 參數針對內容提問，加速提取關鍵資訊 |
| **評估來源權威性** | 發布機構、作者資歷、引用次數、更新日期皆為權威性指標 |

---

## 引用格式

所有引用使用以下 markdown 相容格式：

```
[頁面標題](URL) — Accessed YYYY-MM-DD
```

### 引用範例

```
[WebSocket API - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) — Accessed 2026-07-10
[State of JS 2025](https://stateofjs.com/) — Accessed 2026-07-09
```

### 引用規則

- 每條引用獨立成行
- 存取日期為讀取頁面的實際日期
- 若引用特定段落，可在 URL 後加上 `#section` anchor
- 多來源引用同一事實時，列出所有來源，用 `; ` 分隔：
  ```
  [Source A](url-a) — Accessed 2026-07-10; [Source B](url-b) — Accessed 2026-07-10
  ```
- 直接引用（quote）需加引號並標註頁面位置；推論需明確標記「根據 A 和 B 推論」

---

## 輸出格式

### Research note（完整研究記錄）

研究完成後輸出的 research note 為完整 markdown 區塊：

```markdown
## Research: [主題名稱]

### 背景
[研究動機與背景簡述]

### 關鍵發現
- [發現一]（來源引用）
- [發現二]（來源引用）

### 分歧與缺口
- [分歧點或未解答問題]

### 結論
[綜合分析結論]

## Sources
- [Source Title](URL) — Accessed YYYY-MM-DD
- [Source Title](URL) — Accessed YYYY-MM-DD
```

### Memory.md 片段（輕量記錄）

適合記錄到 squad memory 的簡潔格式：

```markdown
## Research findings: [主題]

- [發現一]（[Source Title](URL) — Accessed YYYY-MM-DD）
- [發現二]（[Source Title](URL) — Accessed YYYY-MM-DD）

> Research date: YYYY-MM-DD
```

### 輸出規則

- 每個 research note 結尾必含 `## Sources` 列表
- 來源引用可集中於 `## Sources`，也可 inline 在發現後方
- 若研究結果將傳遞給 `generate-report` 等 downstream skill，使用完整 research note 格式以方便消費
- 信賴等級標註：`[高]`、`[中]`、`[低]` 前綴在發現前

---

## Related skills

| Skill | 關係 |
|-------|------|
| `generate-report` | 本 skill 的 research note 可作為 report skill 的輸入；兩者可串接形成研究→報告管線 |
| `deep-research`（Claude Code 內建） | 深度、多來源、fact-checked 研究；本 skill 為較輕量的結構化研究流程，適合快速、聚焦的研究任務 |

---

## 參考

- Claude Code 內建 `deep-research` skill：fan-out 搜尋、adversarial verify、多來源綜合模式
- Claude Code `WebSearch` 工具：支援 `query`（搜尋字串）、`allowed_domains`（限縮 domain）、`blocked_domains`（排除 domain）參數
- Claude Code `WebFetch` 工具：URL fetch → markdown 轉換，支援 `prompt` 參數針對內容提問
- 現有 skills bank 格式參考：`built-in/skills/modify-guild/SKILL.md`