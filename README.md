# 🕵️‍♂️ Hidden Agenda - 誰是臥底 | 部署與維護手冊

## 🚀 1. 部署到 Vercel (環境變數設定)

請在 Vercel 的 **Environment Variables** 區塊填入：

| Key (變數名稱) | Value (你的數值) |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `你的 Supabase URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `你的 Supabase Anon Key` |
| `API_KEY` | `你的 Gemini API Key` |

---

## 🛠️ 2. Supabase 資料庫與權限設定

請在 Supabase 的 **SQL Editor** 執行以下指令：

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

-- 2. 提升 Realtime 同步品質 (關鍵：解決刪除時同步失敗)
-- 這能確保刪除 Row 時，Supabase 會傳送所有欄位資訊給訂閱者
ALTER TABLE players REPLICA IDENTITY FULL;
ALTER TABLE games REPLICA IDENTITY FULL;

-- 3. 開啟 RLS 權限政策
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Games" ON games FOR SELECT USING (true);
CREATE POLICY "Public Read Players" ON players FOR SELECT USING (true);
CREATE POLICY "Public Insert Games" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Insert Players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Games" ON games FOR UPDATE USING (true);
CREATE POLICY "Public Update Players" ON players FOR UPDATE USING (true);
CREATE POLICY "Public Delete Players" ON players FOR DELETE USING (true);

-- 4. 開啟即時同步 (Realtime)
-- 請手動到 Database -> Replication -> supabase_realtime 
-- 將 games 和 players 表格勾選為 ON。
```
