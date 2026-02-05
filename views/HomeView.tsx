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
    <div className="grid md:grid-cols-2 gap-10 md:gap-12 items-start max-w-5xl mx-auto px-6">
      {/* Left Column: Entry Form */}
      <div className="glass p-7 md:p-10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] space-y-6 md:space-y-8 animate-in fade-in slide-in-from-left duration-700 relative border border-white/10 w-full max-w-[420px] mx-auto md:mx-0">
        
        {/* Background Watermark */}
        <div className="absolute -top-2 -right-2 p-4 opacity-[0.03] select-none pointer-events-none rotate-12">
          <div className="text-[5rem] md:text-[10rem] font-black italic leading-none text-white">TOP<br/>SECRET</div>
        </div>

        <div className="space-y-2 md:space-y-3 relative z-10">
          <h1 className="text-4xl md:text-7xl font-black tracking-tighter text-white leading-[0.85] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            HIDDEN<br/><span className="text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">AGENDA</span>
          </h1>
          <p className="text-zinc-500 text-[8px] md:text-[11px] font-black tracking-[0.3em] md:tracking-[0.6em] uppercase ml-1">Tactical Deception System</p>
        </div>

        <div className="space-y-5 md:space-y-8 relative z-10">
          {/* Agent Identification */}
          <div className="space-y-2 md:space-y-3">
            <label className="text-[10px] md:text-[11px] font-black text-zinc-300 uppercase tracking-[0.4em] ml-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></span>
              Agent Identification
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="請輸入你的暱稱..."
              className="w-full bg-black/90 border-2 border-white/20 rounded-xl px-4 py-3 md:px-5 md:py-4 focus:border-red-600 outline-none transition-all text-white text-base md:text-lg font-bold placeholder:text-zinc-500 shadow-inner"
            />
          </div>

          <div className="space-y-4 md:space-y-5">
             {/* Join Section */}
             <div className="space-y-2 md:space-y-3">
                <label className="text-[10px] md:text-[11px] font-black text-red-500 uppercase tracking-[0.4em] ml-1">Join active Mission</label>
                <div className="flex flex-row gap-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    placeholder="請輸入房間代碼"
                    className="flex-1 min-w-0 bg-zinc-950 border border-white/20 rounded-xl px-3 py-3 md:px-4 md:py-4 text-center font-bold text-base md:text-lg text-red-500 focus:border-red-600 outline-none transition-all placeholder:text-zinc-500 placeholder:font-bold"
                  />
                  <button
                    onClick={handleJoin}
                    disabled={loading}
                    className="shrink-0 bg-red-600 hover:bg-red-500 text-white px-5 md:px-10 rounded-xl font-black uppercase tracking-widest transition-all disabled:opacity-50 active:scale-95 shadow-lg border border-white/10 text-xs md:text-sm"
                  >
                    Join
                  </button>
                </div>
             </div>

             <div className="relative py-1 md:py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                <div className="relative flex justify-center text-[8px] md:text-[9px] uppercase font-black text-zinc-500 bg-[#0a0a0a] px-3 mx-auto w-fit tracking-[0.4em] md:tracking-[0.5em]">System Override</div>
             </div>

             <button
                onClick={() => {
                  if (!playerName.trim()) return alert("請先輸入代號再建立房間");
                  onCreateClick();
                }}
                disabled={loading}
                className="w-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-black py-4 md:py-5 rounded-xl transition-all active:scale-95 disabled:opacity-50 uppercase tracking-[0.3em] md:tracking-[0.4em] text-[10px] md:text-sm shadow-md"
              >
                Establish New Room
              </button>
          </div>
        </div>
      </div>

      {/* Right Column: Game Instructions */}
      <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-right duration-700 delay-200 relative pt-10 md:pt-0">
        
        {/* Floating Detective Icon */}
        <div className="absolute top-2 right-4 md:-top-16 md:right-0 z-20 pointer-events-none">
          <div className="relative">
            {/* Red Glow Background */}
            <div className="absolute inset-0 bg-red-600/30 blur-2xl rounded-full scale-100 md:scale-125 animate-[breath_5s_easeInOut_infinite]"></div>
            
            {/* The Detective Emoji */}
            <span className="relative text-5xl md:text-8xl drop-shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-[subtle-float_8s_easeInOut_infinite] block">
              🕵️
            </span>
          </div>
        </div>

        <div className="space-y-4 md:space-y-6 relative">
          <div className="space-y-1.5 md:space-y-2">
             <div className="flex items-center gap-2 md:gap-3">
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(220,38,38,1)]"></span>
                <span className="text-[10px] md:text-[11px] font-black text-red-500 uppercase tracking-[0.4em] md:tracking-[0.5em]">Directive Loaded</span>
             </div>
             <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter flex items-center gap-3 md:gap-4">
                <span className="text-red-600 drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]">誰是臥底</span> 遊戲規則
                <div className="flex-1 h-[1px] bg-gradient-to-r from-red-600/40 to-transparent"></div>
             </h2>
          </div>

          <div className="grid gap-3 md:gap-4">
            {[
              { id: "RULE_01", title: "⚔️ 身份分配", desc: "玩家將被隨機分為「平民」與「臥底」。平民會拿到相同的詞彙，而臥底會拿到一個非常接近但不同的詞彙。" },
              { id: "RULE_02", title: "💬 描述討論", desc: "每個人輪流用一句話描述自己的詞彙。描述不能太明顯（會被臥底猜到），也不能太模糊（會被當成臥底）。" },
              { id: "RULE_03", title: "🗳️ 投票淘汰", desc: "所有玩家描述完後，進行投票抓出臥底。如果臥底全被投出，平民獲勝；若平民人數少於 3 人且仍有臥底，臥底獲勝。" }
            ].map((rule, idx) => (
              <div key={idx} className="bg-white/[0.02] p-4 md:p-6 rounded-2xl border border-white/5 space-y-1.5 md:space-y-2 group hover:bg-white/[0.05] transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 md:p-3 opacity-10 group-hover:opacity-30 transition-opacity">
                   <span className="text-[8px] md:text-[9px] font-black font-mono text-zinc-500 tracking-widest">{rule.id}</span>
                </div>
                <h3 className="text-white text-sm md:text-lg font-black flex items-center gap-2 group-hover:text-red-500 transition-colors">
                  {rule.title}
                </h3>
                <p className="text-[11px] md:text-sm text-zinc-300 leading-relaxed font-bold">
                  {rule.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes breath {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        @keyframes subtle-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
};

export default HomeView;