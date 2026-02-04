import React, { useState } from 'react';

interface HomeViewProps {
  onCreateClick: () => void; // 點擊建立後觸發模式選擇
  onJoin: (id: string, name: string) => void;
  findGame: (code: string) => Promise<string | undefined>;
  loading: boolean;
  playerName: string;
  setPlayerName: (name: string) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onCreateClick, onJoin, findGame, loading, playerName, setPlayerName }) => {
  const [code, setCode] = useState('');

  const handleJoin = async () => {
    if (!playerName.trim()) return alert("請輸入你的特工代號");
    if (!code.trim()) return alert("請輸入 6 位數房間代碼");
    const gameId = await findGame(code);
    if (gameId) {
      onJoin(gameId, playerName);
    } else {
      alert("找不到該任務房間，請檢查代碼是否正確");
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
      {/* Left Column: Entry Form */}
      <div className="glass p-10 rounded-[2.5rem] shadow-2xl space-y-10 animate-in fade-in slide-in-from-left duration-700 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <div className="text-6xl font-black">TOP SECRET</div>
        </div>

        <div className="space-y-2 relative">
          <h1 className="text-6xl font-black tracking-tighter text-white">HIDDEN<br/><span className="text-red-600">AGENDA</span></h1>
          <p className="text-gray-500 text-xs font-bold tracking-[0.5em] uppercase">Tactical Deception Game</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Agent Identification</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="輸入你的代號 (例如: Doris)"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 focus:ring-2 focus:ring-red-600 outline-none transition-all text-white text-lg font-bold placeholder:text-gray-700 shadow-inner"
            />
          </div>

          <div className="bg-red-600/5 p-8 rounded-3xl border border-red-600/10 space-y-6">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-red-900 uppercase tracking-widest ml-1 text-center block">Join Existing Mission</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    placeholder="ROOM CODE"
                    className="flex-1 bg-black border border-red-900/30 rounded-xl px-4 py-3 text-center font-mono text-xl tracking-[0.3em] text-red-500 focus:border-red-500 outline-none transition-all shadow-inner"
                  />
                  <button
                    onClick={handleJoin}
                    disabled={loading}
                    className="bg-red-600 hover:bg-red-500 text-white px-8 rounded-xl font-black uppercase tracking-widest transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-red-900/20"
                  >
                    Join
                  </button>
                </div>
             </div>

             <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-red-900/20"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase font-black text-red-900/40 bg-[#0a0a0a] px-4 mx-auto w-fit italic">Or initiate new</div>
             </div>

             <button
                onClick={() => {
                  if (!playerName.trim()) return alert("請先輸入代號再建立房間");
                  onCreateClick();
                }}
                disabled={loading}
                className="w-full border-2 border-white/10 hover:border-white/30 text-white font-black py-5 rounded-2xl transition-all active:scale-95 disabled:opacity-50 uppercase tracking-[0.2em] shadow-xl"
              >
                Create New Room
              </button>
          </div>
        </div>
      </div>

      {/* Right Column: Game Instructions */}
      <div className="space-y-8 animate-in fade-in slide-in-from-right duration-700">
        <div className="space-y-4">
          <h2 className="text-3xl font-black flex items-center gap-3">
            <span className="text-red-600">01</span> 遊戲規則說明
          </h2>
          <div className="grid gap-4">
            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-2">
              <h3 className="text-white font-bold flex items-center gap-2">⚔️ 身份對決</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                玩家將被隨機分為「平民」與「臥底」。平民會拿到相同的詞彙，而臥底會拿到一個非常接近但不同的詞彙。
              </p>
            </div>
            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-2">
              <h3 className="text-white font-bold flex items-center gap-2">💬 描述討論</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                每個人輪流用一句話描述自己的詞彙。描述不能太露骨（會被臥底猜到），也不能太模糊（會被當成臥底）。
              </p>
            </div>
            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-2">
              <h3 className="text-white font-bold flex items-center gap-2">🗳️ 投票淘汰</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                所有玩家描述完後，進行投票抓出臥底。如果臥底全被投出，平民獲勝；若平民人數少於 3 人且仍有臥底，臥底獲勝。
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-6 rounded-2xl bg-gradient-to-r from-red-900/20 to-transparent border-l-4 border-red-600">
          <p className="text-xs text-red-500 font-bold leading-relaxed uppercase tracking-wider">
            系統支援由 Gemini AI 自動出題，每次任務詞彙皆不重複，挑戰你的觀察力與演技。
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomeView;