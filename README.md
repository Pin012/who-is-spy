# 誰是臥底（Who Is Spy）

即時多人線上派對遊戲，採用 React + Vite 前端架構，透過 Supabase 提供房間資料儲存與 Realtime 同步，並整合 Gemini 產生題庫詞對。此專案適合用於線上會議團隊暖場、遠端 Team Building 的互動破冰情境。

---

## 目錄
- [專案定位與目標使用者](#專案定位與目標使用者)
- [核心功能](#核心功能)
- [技術架構](#技術架構)
- [系統需求](#系統需求)
- [快速開始（本機開發）](#快速開始本機開發)
- [環境變數](#環境變數)
- [Supabase 資料庫初始化與權限設定](#supabase-資料庫初始化與權限設定)
- [部署流程（Vercel）](#部署流程vercel)
- [遊戲流程與狀態說明](#遊戲流程與狀態說明)
- [資料表欄位對應](#資料表欄位對應)
- [常見問題與故障排除](#常見問題與故障排除)
- [維運與安全注意事項](#維運與安全注意事項)

---

## 專案定位與目標使用者
本文件針對下列讀者提供可直接執行的資訊：

1. **產品/專案管理者**：快速理解功能範圍、部署需求與風險。
2. **前端開發者**：可在本機完成啟動、串接與建置。
3. **維運/DevOps 人員**：可依步驟完成雲端部署與環境設定。
4. **活動主持人或一般使用者**：可理解遊戲運作邏輯與限制。

---

## 核心功能
- 建立房間與房號加入機制。
- 多人即時同步（玩家進出、狀態更新、投票結果）。
- 遊戲階段管理（Lobby / Playing / Defending / Voting / Finished）。
- 主持人可選擇「是否同時作為玩家」。
- 整合 Gemini 自動產生「平民詞 / 臥底詞」詞對，並具備本地備援詞庫。
- 具基本 PWA 安裝提示（行動裝置加入主畫面引導）。

---

## 技術架構
- **前端框架**：React 19
- **建置工具**：Vite 6 + TypeScript
- **資料層/即時同步**：Supabase（PostgreSQL + Realtime）
- **AI 詞庫服務**：Google Gemini（`@google/genai`）

---

## 系統需求
- Node.js 18+（建議 20 LTS）
- npm 9+
- 可用的 Supabase 專案（含 SQL Editor、Realtime 設定權限）
- Gemini API Key（若未提供，仍可使用備援詞庫）

---

## 快速開始（本機開發）

```bash
npm install
npm run dev
```

啟動後，預設由 Vite 提供本機服務（通常為 `http://localhost:5173`）。

正式建置：

```bash
npm run build
npm run preview
```

---

## 環境變數
請在部署平台（如 Vercel）或本機 `.env` 中設定：

| 變數名稱 | 說明 | 必填 |
| :-- | :-- | :-- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案 URL | 是 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名金鑰（前端公開） | 是 |
| `API_KEY` | Gemini API Key（用於 AI 詞對生成） | 建議 |

> 說明：專案使用 Vite `define` 將上述值注入 `process.env.*`，程式碼中以 `process.env.NEXT_PUBLIC_SUPABASE_URL` 等名稱讀取。

---

## Supabase 資料庫初始化與權限設定
請在 Supabase SQL Editor 執行以下腳本：

```sql
-- 1. 確保欄位完整
ALTER TABLE games ADD COLUMN IF NOT EXISTS room_code TEXT UNIQUE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'lobby';
ALTER TABLE games ADD COLUMN IF NOT EXISTS civilian_word TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS undercover_word TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS host_is_player BOOLEAN DEFAULT true;
ALTER TABLE games ADD COLUMN IF NOT EXISTS suspect_ids TEXT[];
ALTER TABLE games ADD COLUMN IF NOT EXISTS round INTEGER DEFAULT 0;

ALTER TABLE players ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'unknown';
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_alive BOOLEAN DEFAULT true;
ALTER TABLE players ADD COLUMN IF NOT EXISTS voted_for TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS message TEXT;

-- 2. 提升 Realtime 同步品質（刪除事件也會攜帶完整列資料）
ALTER TABLE players REPLICA IDENTITY FULL;
ALTER TABLE games REPLICA IDENTITY FULL;

-- 3. 啟用 RLS
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- 4. 建立公開政策（適合 Demo / 內部活動）
CREATE POLICY "Public Read Games" ON games FOR SELECT USING (true);
CREATE POLICY "Public Read Players" ON players FOR SELECT USING (true);
CREATE POLICY "Public Insert Games" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Insert Players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Games" ON games FOR UPDATE USING (true);
CREATE POLICY "Public Update Players" ON players FOR UPDATE USING (true);
CREATE POLICY "Public Delete Players" ON players FOR DELETE USING (true);
```

另外請至：
`Database -> Replication -> supabase_realtime`

將 `games` 與 `players` 表設為 **ON**。

---

## 部署流程（Vercel）
1. 將程式碼推送至 GitHub Repository。
2. 於 Vercel 匯入該 Repository。
3. 在 Vercel Project Settings 設定上述環境變數。
4. 觸發部署。
5. 部署成功後，建立房間並使用兩個以上瀏覽器/裝置測試 Realtime 同步。

---

## 遊戲流程與狀態說明
- `lobby`：玩家加入、等待主持人開局。
- `playing`：玩家發言與推理。
- `defending`：平票申辯階段。
- `voting`：投票階段。
- `finished`：遊戲結束並顯示勝負。

如主持人離開且房內無 Host，前端會觸發全員退出流程，避免殘留無主房間。

---

## 資料表欄位對應
### `games`
- `id`、`room_code`、`status`
- `civilian_word`、`undercover_word`
- `winner_team`
- `host_is_player`
- `suspect_ids`
- `round`
- `created_at`

### `players`
- `id`、`game_id`、`name`
- `role`、`is_host`、`is_alive`
- `voted_for`、`message`
- `created_at`

---

## 常見問題與故障排除
1. **畫面無法連線 Supabase**
   - 檢查 `NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是否正確。
2. **多人狀態不同步**
   - 檢查 Realtime replication 是否已開啟 `games` / `players`。
   - 確認 `REPLICA IDENTITY FULL` 已設定。
3. **AI 詞庫沒有回應**
   - 檢查 `API_KEY`。
   - 若 API 暫時不可用，系統會自動使用備援詞庫。
4. **加入房間失敗**
   - 房號不存在或房間已開始（非 Lobby）時，非主持人將無法加入。

---

## 維運與安全注意事項
- 目前 RLS 政策為「公開可讀寫」型態，**僅建議用於測試、展示或受控活動場域**。
- 若用於公開商業服務，建議導入：
  - 使用者驗證（Supabase Auth）
  - 更細緻的 RLS（以 `auth.uid()`、房主權限、遊戲狀態條件控管）
  - API Key 管理與配額告警
- 建議在正式環境加入錯誤監控（例如 Sentry）與基本行為日誌，便於追蹤異常房間狀態。

---

如需進一步擴充（排行榜、觀戰模式、回合回放、主持人控制台），建議先補齊資料結構版本化與權限模型，再進入功能開發。
