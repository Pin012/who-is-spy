
import React, { useState } from 'react';

interface HomeViewProps {
  onCreate: (name: string) => void;
  onJoin: (id: string, name: string) => void;
  findGame: (code: string) => Promise<string | undefined>;
  loading: boolean;
}

const HomeView: React.FC<HomeViewProps> = ({ onCreate, onJoin, findGame, loading }) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return alert("請輸入你的名字");
    onCreate(name);
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
      {/* Left Panel: Join/Create */}
      <div className="glass p-10 rounded-3xl shadow-2xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold tracking-tight text-white">Hidden Agenda</h1>
          <p className="text-gray-400 text-lg italic">Who is the Undercover?</p>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-300">你的名字</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="輸入你的名字"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 focus:ring-2 focus:ring-red-500 outline-none transition-all"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-black/20 p-6 rounded-2xl border border-white/5 space-y-4">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="輸入遊戲代碼"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm uppercase"
            />
            <button
              onClick={handleJoin}
              disabled={loading}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
            >
              加入遊戲
            </button>
          </div>

          <div className="bg-black/20 p-6 rounded-2xl border border-white/5 space-y-4 flex flex-col justify-between">
            <p className="text-center text-sm text-gray-400">開啟一場新對決</p>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-red-900/20 transition-all disabled:opacity-50"
            >
              建立新遊戲
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel: Guide */}
      <div className="glass p-10 rounded-3xl shadow-2xl space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-blue-400">❓</span> 誰是臥底 遊戲快速指南
        </h2>

        <div className="space-y-6">
          <section>
            <h3 className="text-red-400 font-semibold mb-2 flex items-center gap-2">🎯 遊戲目標</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
              <li><span className="text-cyan-400 font-bold">平民</span>：找出並淘汰所有臥底。</li>
              <li><span className="text-red-400 font-bold">臥底</span>：隱藏身份，存活到最後。</li>
            </ul>
          </section>

          <section>
            <h3 className="text-blue-400 font-semibold mb-2 flex items-center gap-2">🔄 遊戲流程</h3>
            <ol className="space-y-3 text-sm text-gray-300">
              <li className="flex gap-3"><span className="bg-white/10 w-6 h-6 flex items-center justify-center rounded-full text-xs">1</span> <div><b>查看詞語</b>：記住你的身份和詞語。</div></li>
              <li className="flex gap-3"><span className="bg-white/10 w-6 h-6 flex items-center justify-center rounded-full text-xs">2</span> <div><b>描述詞語</b>：每個回合，用一句話描述你的詞。</div></li>
              <li className="flex gap-3"><span className="bg-white/10 w-6 h-6 flex items-center justify-center rounded-full text-xs">3</span> <div><b>討論投票</b>：根據描述，找出可疑的玩家並投票。</div></li>
              <li className="flex gap-3"><span className="bg-white/10 w-6 h-6 flex items-center justify-center rounded-full text-xs">4</span> <div><b>淘汰玩家</b>：票數最高的玩家出局。</div></li>
            </ol>
          </section>

          <section>
            <h3 className="text-yellow-400 font-semibold mb-2 flex items-center gap-2">🏆 勝利條件</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
              <li>平民勝利：所有臥底都被淘汰。</li>
              <li>臥底勝利：存活到場上剩餘2人時仍在場。</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default HomeView;
