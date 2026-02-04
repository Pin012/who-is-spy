# 🕵️‍♂️ Hidden Agenda - 誰是臥底 | 部署與維護手冊

這是一個專為遠端玩家設計的多人即時對戰遊戲。

## 🔴 為什麼編輯器裡有一堆紅線？

如果你在 GitHub 網頁版編輯器看到很多紅線（錯誤提示），**請忽略它們！** 

**原因：** 
本專案採用現代的 **Import Maps** 技術（直接在瀏覽器執行，不經過繁瑣的打包編譯）。因為你的 GitHub 專案裡沒有安裝 `node_modules`，所以編輯器會「以為」找不到 React 或 Supabase。

**解決方案：**
我已經新增了 `tsconfig.json`，這應該能消除大部分的紅線。只要你的網站在 Vercel 上能正常打開，這些紅線就不會影響遊戲。

---

## 🔄 如何將 AI 生成的程式碼同步到 GitHub？

1.  **進入 GitHub 編輯器**：在你的 GitHub 儲存庫頁面，按下鍵盤的 **`.`** (英文句點)。
2.  **複製貼上**：從這個對話框中複製檔案內容，直接貼到對應的檔案裡。
3.  **提交變更 (Commit)**：點擊左側的「Source Control」圖示，輸入更新訊息，點擊 **Commit and Push**。
4.  **自動部署**：Vercel 會自動更新網站。

---

## 🚀 1. 部署到 Vercel (環境變數設定)

請在 Vercel 的 **Environment Variables** 區塊填入：

| Key (變數名稱) | Value (你的數值) |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `你的 Supabase URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `你的 Supabase Anon Key` |
| `API_KEY` | `你的 Gemini API Key` |

---

## 🛠️ 2. Supabase 資料庫設定

請在 Supabase 的 **SQL Editor** 執行：

```sql
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code TEXT UNIQUE,
  status TEXT DEFAULT 'lobby',
  civilian_word TEXT,
  undercover_word TEXT,
  winner_team TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT DEFAULT 'unknown',
  is_host BOOLEAN DEFAULT false,
  is_alive BOOLEAN DEFAULT true,
  voted_for TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**記得：** 在 Supabase 後台開啟 Realtime 功能（勾選兩張表）。
