
# 🕵️‍♂️ Hidden Agenda - 誰是臥底 | 部署與維護手冊

這是一個專為遠端玩家設計的多人即時對戰遊戲。

## 🚀 1. 部署到 Vercel (環境變數設定)

請在 Vercel 的 **Environment Variables** 區塊填入：

| Key (變數名稱) | Value (你的數值) |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `你的 Supabase URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `你的 Supabase Anon Key` |
| `API_KEY` | `你的 Gemini API Key` |

---

## 🛠️ 2. Supabase 資料庫設定

請在 Supabase 的 **SQL Editor** 執行以下指令：

```sql
-- 建立遊戲表
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code TEXT UNIQUE,
  status TEXT DEFAULT 'lobby',
  civilian_word TEXT,
  undercover_word TEXT,
  winner_team TEXT,
  host_is_player BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立玩家表
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

**重要：開啟即時同步 (Realtime)**
1. 到 Supabase 後台左側選單點擊 **Database**。
2. 點擊 **Replication**。
3. 在 `supabase_realtime` 項目中點擊 `0 tables` (或已有的數字)。
4. 將 `games` 和 `players` 的開關都切換為 **ON**。

---

## 🔄 如何同步更新到 GitHub？

1. 在 GitHub 頁面按 `.` 進入編輯器。
2. 將此對話框產生的 XML 內容對應貼入檔案。
3. Commit & Push，Vercel 會自動更新。
