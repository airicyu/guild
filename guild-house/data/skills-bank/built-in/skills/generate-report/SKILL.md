---
name: generate-report
description: 從 mission 執行期間的調研、分析成果產出結構化靜態報告 — 四段式模板（executive summary → findings → data → recommendations），self-contained HTML，無伺服器相依
---

# Generate Report

在 mission 執行期間，將研究發現、數據分析或調研結果整理為一份結構化、可分享的靜態 HTML 報告。報告完全 self-contained（inline CSS/JS），不需要伺服器或外部 CDN，可直接在瀏覽器中開啟。

> **設計原則**: 報告即 artifact — 產出為靜態檔案，可被 Guild Web UI 的 **Hall Reporter** 以 iframe 或獨立標籤頁預覽，也可透過 `file://` 或任何靜態伺服器直接開啟。

---

## 何時使用

- Mission 需要產出結構化研究報告或調研摘要
- 需要將多個資料來源的發現組合成一份可讀性高的文件
- 需要產生可分享給 guild master 或其他 team 成員的視覺化報告
- 調研類 mission（與 `web-research` 搭配作為知識工作管線的下游）
- 任何需要「寫報告」作為交付物的 mission

**不要用於：**
- 即時 dashboard 或 real-time 資料監控（需專屬後端）
- 動態內容管理系統（需 CMS 或 server-side rendering）
- 純文字備忘錄或簡報（用 `scratch.md` 或 `mission-brief.md` 即可）

---

## 報告結構模板

所有報告應遵循以下四段式結構。這是核心骨架，mission 可依需求增減子章節：

### 1. Executive Summary（執行摘要）

目標受眾：guild master、決策者、不閱讀全文的人。

```
- 一句話結論（TL;DR）
- 背景與動機（為何進行此研究）
- 三個以內的核心發現
- 一個明確的建議或行動項
```

- 長度：不超過全文的 10%
- 語氣：直接、結論先行，不要鋪陳方法論細節

### 2. Findings（發現）

目標受眾：domain expert、同 team 成員。

```
- 主要發現（2–5 項，每項一個小節）
  - 每項發現：標題 + 一句話摘要 + 證據/依據
- 次要發現或觀察（可選，bullet list）
- 反直覺的結果或意外發現（如有）
```

- 每項發現應獨⽴可讀（讀者可能只跳到其中一項）
- 證據可引用來源、連結原文、附上數據截圖

### 3. Data（數據）

目標受眾：需要驗證或重現結論的人。

```
- 數據概覽（rows / columns 說明、採集時間範圍）
- 原始數據或彙整表格
- 視覺化（圖表、表格）— 嵌入 inline 而非外部連結
- 數據來源與免責聲明
```

- 若數據量大，可只放彙整表，原始數據另存 `mission-reports/visualization/data.csv` 或 similar
- 圖表以 inline `<img>` 或 inline SVG 呈現，不要依賴外部圖床

### 4. Recommendations（建議）

目標受眾：guild master、下一個接手的人。

```
- 行動項（Action items，每個建議搭配明確的下一步）
- 優先級（P0 / P1 / P2）
- 每個建議的預期影響與風險
- 未解決的問題（Open questions）
- 建議後續 mission（如有）
```

- 每個行動項應具體到可開一個新 mission 或 task
- 避免模糊的「繼續觀察」— 改為「若 X 發生，執行 Y」

---

## 靜態 HTML 報告生成指南

### 核心原則

- **Self-contained**：所有 CSS 和 JS 直接 inline 在 `<style>` 和 `<script>` 標籤內，零外部請求
- **No server**：報告以 `file://` 直接開啟即能正常渲染，不需要 HTTP server
- **Responsive**：在 1024px 以上和行動裝置上都有可讀的排版
- **Printable**：CSS media query `@media print` 確保列印時保留內容格式

### 標準做法

1. 從 `template.html` （見本 skill 目錄下）複製為起點
2. 填入四段式內容
3. 嵌入視覺化元素（表格、inline SVG、圖表截圖）
4. 輸出到標準路徑（見下方）

### 範例結構

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>報告標題</title>
  <style>
    /* 所有 CSS inline 在此 */
  </style>
</head>
<body>
  <!-- 內容四段式 -->
  <script>
    /* 可選的 inline JS（如：互動表格搜尋、圖表） */
  </script>
</body>
</html>
```

### HTML 注意事項

- **無 CDN 連結** — 不要引用 `cdn.jsdelivr.net`、`unpkg.com`、`cdnjs.cloudflare.com` 等
- **無外部字型** — 使用 system font stack（`-apple-system, "Noto Sans TC", sans-serif`）
- **無 iframe** — 若需嵌入外部內容，使用截圖或摘錄文字替代
- **圖表** — 優先使用 inline SVG；若截圖需 base64 data URI 嵌入

---

## 視覺化建議

### 表格使用時機

| 時機 | 範例 | 說明 |
|------|------|------|
| 比較多個項目的屬性 | 競品功能比較表 | 表格優於長條圖當項目 > 10 |
| 精確數值展示 | 價格對照、版本號 | 表格保留精確度，圖表犧牲精確度換取趨勢 |
| 少量數據 | 3–10 行的小型資料集 | 表格比圖表更直接 |

表格設計原則：
- 表頭加 `scope="col"` 或 `scope="row"`
- 數字靠右對齊，文字靠左對齊
- 斑馬紋行（`tr:nth-child(even)`）提高可讀性
- 表格寬度以 `max-width: 100%; overflow-x: auto` 包裹以支援行動裝置

### 圖表類型選擇指南

| 圖表類型 | 用途 | 適用時機 |
|---------|------|---------|
| **長條圖 (Bar)** | 比較類別間的數值 | 類別數量 3–12、需要精確比較大小時（如：各季度營收） |
| **折線圖 (Line)** | 顯示時間序列趨勢 | 連續時間點 > 5、重點在趨勢走向不在精確值（如：DAU 變化） |
| **圓餅圖 (Pie)** | 顯示比例組成 | 類別 2–5、加總為 100%；不要用於超過 5 個類別或時間比較 |
| **散佈圖 (Scatter)** | 顯示兩變數相關性 | 資料點較多（> 20）、想探索相關性模式（如：價格 vs 銷量） |

圖表實作建議：

- **靜態圖表**：先以試算表或 Python/npm script 產出 PNG 圖檔 → base64 嵌入 HTML → 直接 inline `<img>`
- **互動圖表**（可選）：使用 inline `<script>` 嵌入輕量 SVG 圖表（例如：用原生 DOM 繪製 SVG 長條圖，不依賴任何函式庫）
- **不要**：安裝 npm package、引用 CDN、使用需要建置步驟的圖表框架

### 色彩注意事項

- 使用高對比色（至少 WCAG AA 標準，contrast ratio ≥ 4.5:1）
- 不要單靠顏色傳達資訊（附上文字標籤或圖案）
- 灰階友善（在黑白列印時仍有可讀性）

---

## 標準輸出路徑

### 主要路徑（優先）

```
mission-reports/visualization/overview.html
```

所有報告應以 `overview.html` 為檔名輸出到 `mission-reports/visualization/` 目錄。此路徑為標準慣例，未來 Hall Reporter 會以此路徑為預設來源。

### 替代路徑

```
artifacts/reports/{report-name}.html
```

當 mission 需要產出多份報告時，使用 `artifacts/reports/` 存放補充報告或階段報告。主要報告仍應放在 `mission-reports/visualization/overview.html`。

### 建議目錄結構

```
mission-room/
  mission-reports/
    visualization/
      overview.html          ← 主要報告
      data.csv               ← 原始數據（可選）
      images/                ← 嵌入的圖檔（可選）
  artifacts/
    reports/
      interim-phase-1.html    ← 階段性補充報告
      appendix-methodology.html ← 附錄
```

---

## Hall Reporter 相容性

Guild 的 Hall Reporter 是一個未來將實現的功能，用於在 Web UI 的 Hall 中預覽 mission 產出的報告。

### 慣例（Conventions）

為了確保未來 Hall Reporter 可以自動發現和預覽報告，報告應遵循以下慣例：

1. **標準路徑**：主要報告固定在 `mission-reports/visualization/overview.html`
2. **Self-contained**：報告 HTML 是獨立的，沒有跨檔案依賴（圖表若無法 base64 嵌入，放在同目錄 `images/` 下）
3. **無需伺服器**：報告以 `file://` 開啟即能正常顯示
4. **單一入口**：若有多份報告，`overview.html` 為主要入口，內含連結指向 `artifacts/reports/` 中的補充報告

### 預期的 Hall Reporter 行為

（此為未來實作參考，非本 skill 實作範圍）

```
- Hall Reporter 掃描 mission room 下的 mission-reports/visualization/overview.html
- 以 iframe 或獨立標籤頁方式預覽報告
- 若報告不存在則不顯示
- 支援重新整理（重新讀取 HTML 檔案）
```

### 與 Hall Reporter 的協定

```
Path: mission-reports/visualization/overview.html
Format: self-contained HTML
Metadata: <title> 標籤提供報告名稱
Update: 檔案覆蓋即更新（Hall Reporter 可偵測檔案變更後重新載入 iframe）
```

---

## 與其他 skills 的互補

### web-research → generate-report（知識工作管線）

這是最主要的管線組合。執行流程：

```
web-research（收集資料） → 整理發現 → generate-report（產出報告）
```

在本 skill 中引用 web-research 的發現時，建議：

1. 從 web-research 的 `memories/common/memory.md` 或 `scratch.md` 提取關鍵發現
2. 在 Findings 章節引用 web-research 的原始來源
3. 在 Data 章節附上 web-research 的原始筆記路徑（`../web-research/memories/...`）

### 與其他 skills 的關係

| Skill | 關係 | 說明 |
|-------|------|------|
| `web-research` | 上游 | 提供資料來源和發現；generate-report 為其下游輸出端 |
| `ad-hoc-create` | 平行 | 當報告中的建議需要開新 mission 時，可用 ad-hoc-create 實作 |
| `modify-git-project` | 下游（可選） | 若報告涉及 codebase 分析，modify-git-project 可作為建議的實作端 |

### 獨立使用

generate-report 不依賴任何其他 skill。即使 mission 沒有 wire web-research，仍可在任何有資料輸出的 mission 中獨立使用。