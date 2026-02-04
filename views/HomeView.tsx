
import React, { useState } from 'react';

interface HomeViewProps {
  onCreate: (name: string, hostIsPlayer: boolean) => void;
  onJoin: (id: string, name: string) => void;
  findGame: (code: string) => Promise<string | undefined>;
  loading: boolean;
}

const HomeView: React.FC<HomeViewProps> = ({ onCreate, onJoin, findGame, loading }) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const handleCreate = (hostIsPlayer: boolean) => {
    if (!name.trim()) return alert("請輸入你的名字");
    onCreate(name, hostIsPlayer);
  };

  const handleJoin = async () => {
    if (!name.trim()) return alert("請輸入你的名字");
    if (!code.trim()) return alert("請輸入遊戲代碼");
    const gameId = await findGame(code);
    if (gameId) {
      onJoin(gameId, name);
    } else {
      alert("找不到該遊戲代碼");
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-8 items-start">
      <div className="glass p-10 rounded-3xl shadow-2xl space-y-8 animate-in fade-in slide-in-from-left duration-500">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">Hidden Agenda</h1>
          <p className="text-red-500 text-sm font-bold tracking-[0.4em] uppercase">Who is the Undercover?</p>
        </div>

        <div className="space-y-4">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">你的特工代號</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="輸入你的名字"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 focus:ring-2 focus:ring-red-600 outline-none transition-all text-white font-bold"
          />
        </div>

        <div className="space-y-6">
          <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="輸入遊戲代碼"
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm uppercase font-mono tracking-widest text-red-500"
              />
              <button
                onClick={handleJoin}
                disabled={loading}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
              >
                加入
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleCreate(true)}
              disabled={loading}
              className="group bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-900/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <div className="text-lg">建立並加入</div>
              <div className="text-[10px] opacity-60 font-medium">系統自動出題</div>
            </button>
            <button
              onClick={() => handleCreate(false)}
              disabled={loading}
              className="group border border-white/20 hover:border-white/40 text-white font-bold py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50"
            >
              <div className="text-lg">建立並觀戰</div>
              <div className="text-[10px] opacity-60 font-medium">主持人手動出題</div>
            </button>
          </div>
        </div>
      </div>

      <div className="glass p-10 rounded-3xl shadow-2xl space-y-6 animate-in fade-in slide-in-from-right duration-500">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-red-500">🚨</span> 遊戲模式說明
        </h2>

        <div className="space-y-6">
          <section className="bg-white/5 p-4 rounded-xl border border-white/5">
            <h3 className="text-white font-bold mb-2 flex items-center gap-2">👤 建立並加入 (推薦)</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              主持人會作為一名玩家參與對決。遊戲詞彙將由 <span className="text-red-500 font-bold">Gemini AI</span> 根據難度與趣味性自動生成，確保所有人（包括主持人）在翻牌前都不知道內容。
            </p>
          </section>

          <section className="bg-white/5 p-4 rounded-xl border border-white/5">
            <h3 className="text-white font-bold mb-2 flex items-center gap-2">👁️ 建立並觀戰</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              主持人僅負責引導流程，不參與描述與投票。主持人需在準備階段<span className="text-red-500 font-bold">自行輸入</span>兩組對應詞彙。適合用於會議暖場或需要特定主題的派對。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default HomeView;
