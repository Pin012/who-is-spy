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
    <div className="grid md:grid-cols-2 gap-8 md:gap-16 items-center max-w-6xl mx-auto px-4">
      {/* Left Column: Entry Form */}
      <div className="glass p-8 md:p-12 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] space-y-10 animate-in fade-in slide-in-from-left duration-700 relative border border-white/10">
        
        {/* Floating Spy Icon Container */}
        <div className="absolute -top-12 -left-6 md:-top-16 md:-left-10 z-20 animate-[float_4s_easeInOut_infinite]">
          <div className="relative group">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-red-600/30 blur-2xl rounded-full group-hover:bg-red-600/50 transition-all duration-700 scale-75"></div>
            {/* The Spy Icon */}
            <div className="relative bg-zinc-950 border-2 border-red-600/40 w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center text-6xl md:text-7xl shadow-[0_0_30px_rgba(220,38,38,0.4)] transition-transform hover:scale-110">
              <span className="drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">🕵️</span>
              {/* Decorative Ring */}
              <div className="absolute inset-0 border border-white/10 rounded-full animate-[spin_10s_linear_infinite]"></div>
              <div className="absolute inset-2 border border-dashed border-red-600/20 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Background Watermark */}
        <div className="absolute -top-4 -right-4 p-6 opacity-[0.05] select-none pointer-events-none rotate-12">
          <div className="text-[8rem] md:text-[12rem] font-black italic leading-none text-white">TOP<br/>SECRET</div>
        </div>

        <div className="space-y-3 relative z-10 pt-4">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white leading-[0.8] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            HIDDEN<br/><span className="text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">AGENDA</span>
          </h1>
          <p className="text-zinc-400 text-[10px] md:text-xs font-black tracking-[0.5em] md:tracking-[0.8em] uppercase ml-1 opacity-80">Tactical Deception System</p>
        </div>

        <div className="space-y-8 md:space-y-10 relative z-10">
          {/* Agent Identification */}
          <div className="space-y-4">
            <label className="text-xs font-black text-zinc-300 uppercase tracking-[0.4em] ml-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></span>
              Agent Identification
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="請輸入你的代號..."
              className="w-full bg-black/80 border-2 border-white/10 rounded-xl px-6 py-5 focus:border-red-600/60 outline-none transition-all text-white text-xl font-bold placeholder:text-zinc-700 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]"
            />
          </div>

          <div className="space-y-6 md:space-y-8">
             {/* Join Section */}
             <div className="space-y-4">
                <label className="text-xs font-black text-red-500/80 uppercase tracking-[0.4em] ml-1">Join active Mission</label>
                <div className="flex flex-row gap-3">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    placeholder="CODE"
                    className="flex-1 min-w-0 bg-zinc-950 border-2 border-white/5 rounded-xl px-4 py-5 text-center font-mono text-2xl tracking-[0.4em] text-red-500 focus:border-red-600/40 outline-none transition-all shadow-inner"
                  />
                  <button
                    onClick={handleJoin}
                    disabled={loading}
                    className="shrink-0 bg-red-600 hover:bg-red-500 text-white px-8 md:px-12 rounded-xl font-black uppercase tracking-widest transition-all disabled:opacity-50 active:scale-95 shadow-[0_10px_30px_rgba(220,38,38,0.3)] border border-white/10"
                  >
                    Join
                  </button>
                </div>
             </div>

             <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t-2 border-white/5"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase font-black text-zinc-500 bg-[#0a0a0a] px-6 mx-auto w-fit tracking-[0.5em]">System Override</div>
             </div>

             <button
                onClick={() => {
                  if (!playerName.trim()) return alert("請先輸入代號再建立房間");
                  onCreateClick();
                }}
                disabled={loading}
                className="w-full bg-white/5 border-2 border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-black py-5 md:py-6 rounded-xl transition-all active:scale-95 disabled:opacity-50 uppercase tracking-[0.4em] text-sm md:text-base shadow-xl"
              >
                Establish New Room
              </button>
          </div>
        </div>
      </div>

      {/* Right Column: Game Instructions */}
      <div className="space-y-10 md:space-y-12 animate-in fade-in slide-in-from-right duration-700 delay-200">
        <div className="space-y-8">
          <div className="space-y-2">
             <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,1)]"></span>
                <span className="text-xs font-black text-red-500 uppercase tracking-[0.5em]">Rules Loaded</span>
             </div>
             <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter flex items-center gap-4">
                <span className="text-red-600 drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]">誰是臥底</span> 遊戲規則
                <div className="flex-1 h-[2px] bg-gradient-to-r from-red-600/60 to-transparent"></div>
             </h2>
          </div>

          <div className="grid gap-4 md:gap-6">
            {[
              { id: "RULE_01", title: "⚔️ 身份分配", desc: "玩家將被隨機分為「平民」與「臥底」。平民會拿到相同的詞彙，而臥底會拿到一個非常接近但不同的詞彙。" },
              { id: "RULE_02", title: "💬 描述討論", desc: "每個人輪流用一句話描述自己的詞彙。描述不能太明顯（會被臥底猜到），也不能太模糊（會被當成臥底）。" },
              { id: "RULE_03", title: "🗳️ 投票淘汰", desc: "所有玩家描述完後，進行投票抓出臥底。如果臥底全被投出，平民獲勝；若平民人數少於 3 人且仍有臥底，臥底獲勝。" }
            ].map((rule, idx) => (
              <div key={idx} className="bg-white/[0.03] p-6 md:p-8 rounded-2xl border border-white/10 space-y-3 group hover:bg-white/[0.07] transition-all relative overflow-hidden shadow-lg">
                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                   <span className="text-[10px] font-black font-mono text-zinc-500 tracking-widest">{rule.id}</span>
                </div>
                <h3 className="text-white text-lg md:text-xl font-black flex items-center gap-3 group-hover:text-red-500 transition-colors">
                  {rule.title}
                </h3>
                <p className="text-sm md:text-base text-zinc-300 leading-relaxed font-bold">
                  {rule.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0); }
          50% { transform: translateY(-15px) rotate(3deg); }
        }
      `}</style>
    </div>
  );
};

export default HomeView;
