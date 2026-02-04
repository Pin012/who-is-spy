import React, { useState } from 'react';

interface HomeViewProps {
  onCreateClick: () => void;
  onJoin: (id: string, name: string) => void;
  findGame: (code: string) => Promise<string | undefined>;
  loading: boolean;
  playerName: string;
  setPlayerName: (name: string) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onCreateClick, onJoin, findGame, loading, playerName, setPlayerName }) => {
  const [code, setCode] = useState('');

  const handleJoin = async () => {
    if (!playerName.trim()) return alert("請輸入你的名字");
    if (!code.trim()) return alert("請輸入 6 位數房間代碼");
    const gameId = await findGame(code);
    if (gameId) {
      onJoin(gameId, playerName);
    } else {
      alert("找不到該任務房間，請檢查代碼是否正確");
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto px-4">
      {/* Left Column: Entry Form */}
      <div className="glass p-8 md:p-12 rounded-[3rem] shadow-2xl space-y-12 animate-in fade-in slide-in-from-left duration-700 relative overflow-hidden border border-white/10">
        {/* Background Watermark */}
        <div className="absolute -top-4 -right-4 p-6 opacity-[0.03] select-none pointer-events-none rotate-12">
          <div className="text-[10rem] font-black italic leading-none">TOP<br/>SECRET</div>
        </div>

        <div className="space-y-3 relative z-10">
          <h1 className="text-6xl md:text-7xl font-black tracking-tighter text-white leading-[0.9] drop-shadow-sm">
            HIDDEN<br/><span className="text-red-600">AGENDA</span>
          </h1>
          <p className="text-gray-500 text-[10px] font-black tracking-[0.6em] uppercase ml-1">Tactical Deception System</p>
        </div>

        <div className="space-y-8 relative z-10">
          {/* Agent Identification */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] ml-1">Agent Identification</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="請輸入你的名字"
              className="w-full bg-black/50 border border-white/5 rounded-2xl px-6 py-5 focus:ring-2 focus:ring-red-600 outline-none transition-all text-white text-lg font-bold placeholder:text-zinc-800 shadow-inner"
            />
          </div>

          <div className="space-y-6">
             {/* Join Section */}
             <div className="space-y-3">
                <label className="text-[10px] font-black text-red-900/60 uppercase tracking-[0.3em] ml-1">Join Mission</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    placeholder="CODE"
                    className="flex-1 bg-black border border-white/5 rounded-2xl px-6 py-4 text-center font-mono text-xl tracking-[0.4em] text-red-500 focus:border-red-600/50 outline-none transition-all shadow-inner"
                  />
                  <button
                    onClick={handleJoin}
                    disabled={loading}
                    className="bg-red-600 hover:bg-red-500 text-white px-8 rounded-2xl font-black uppercase tracking-widest transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-red-900/20 text-sm"
                  >
                    Join
                  </button>
                </div>
             </div>

             <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                <div className="relative flex justify-center text-[9px] uppercase font-black text-zinc-700 bg-[#0a0a0a] px-4 mx-auto w-fit tracking-[0.4em]">OR</div>
             </div>

             <button
                onClick={() => {
                  if (!playerName.trim()) return alert("請先輸入名字再建立房間");
                  onCreateClick();
                }}
                disabled={loading}
                className="w-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-black py-5 rounded-2xl transition-all active:scale-95 disabled:opacity-50 uppercase tracking-[0.3em] text-sm"
              >
                Establish New Room
              </button>
          </div>
        </div>
      </div>

      {/* Right Column: Game Instructions - Redesigned to be more meaningful */}
      <div className="space-y-10 animate-in fade-in slide-in-from-right duration-700 delay-200">
        <div className="space-y-6">
          <div className="space-y-1">
             <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em]">Directive Active</span>
             </div>
             <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                遊戲規則說明
                <div className="flex-1 h-[2px] bg-gradient-to-r from-red-600/50 to-transparent"></div>
             </h2>
          </div>

          <div className="grid gap-5">
            {[
              { id: "PROTOCOL_01", title: "⚔️ 身份對決", desc: "玩家將被隨機分為「平民」與「臥底」。平民會拿到相同的詞彙，而臥底會拿到一個非常接近但不同的詞彙。" },
              { id: "PROTOCOL_02", title: "💬 描述討論", desc: "每個人輪流用一句話描述自己的詞彙。描述不能太露骨（會被臥底猜到），也不能太模糊（會被當成臥底）。" },
              { id: "PROTOCOL_03", title: "🗳️ 投票淘汰", desc: "所有玩家描述完後，進行投票抓出臥底。如果臥底全被投出，平民獲勝；若平民人數少於 3 人且仍有臥底，臥底獲勝。" }
            ].map((rule, idx) => (
              <div key={idx} className="bg-white/5 p-6 rounded-3xl border border-white/5 space-y-2 group hover:bg-white/10 transition-colors relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                   <span className="text-[8px] font-black font-mono text-white tracking-widest">{rule.id}</span>
                </div>
                <h3 className="text-white font-bold flex items-center gap-2 group-hover:text-red-500 transition-colors">{rule.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{rule.desc}</p>
              </div>
            ))}
          </div>
        </div>
        
        <div className="p-8 rounded-3xl bg-gradient-to-br from-red-900/10 to-transparent border border-red-900/20 relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-600 transition-all group-hover:w-full group-hover:opacity-5"></div>
          <p className="text-[10px] text-red-500 font-black leading-relaxed uppercase tracking-[0.2em] relative z-10">
            SYSTEM CORE: GEMINI AI POWERED WORD GENERATION.<br/>
            每次任務詞彙皆經過精密演算法計算，確保遊戲公平性與不可預測性。
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomeView;