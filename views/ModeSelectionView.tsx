import React from 'react';

interface ModeSelectionViewProps {
  onSelect: (hostIsPlayer: boolean) => void;
  onBack: () => void;
}

const ModeSelectionView: React.FC<ModeSelectionViewProps> = ({ onSelect, onBack }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in zoom-in duration-500">
      <div className="text-center space-y-4">
        <h2 className="text-5xl font-black italic tracking-tighter text-white uppercase">Choose Mission Type</h2>
        <p className="text-gray-500 text-xs font-bold tracking-[0.5em] uppercase">選擇您的任務角色</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Agent Mode */}
        <div 
          onClick={() => onSelect(true)}
          className="group relative glass p-10 rounded-2xl border-2 border-white/5 hover:border-red-600/50 transition-all cursor-pointer overflow-hidden shadow-2xl hover:scale-[1.02] active:scale-95"
        >
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-600/5 rounded-full blur-3xl group-hover:bg-red-600/20 transition-all"></div>
          <div className="relative space-y-6">
            <div className="w-16 h-16 bg-red-600 rounded-lg flex items-center justify-center text-3xl shadow-lg shadow-red-900/40">👤</div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white tracking-tight">Agent Mode 潛伏對決</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                房主將作為一名玩家參與遊戲。系統會透過 <span className="text-red-500 font-bold">Gemini AI</span> 自動生成詞彙。
              </p>
            </div>
            <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs font-black uppercase tracking-widest text-red-500">
              <span>Host is Player</span>
              <span className="opacity-0 group-hover:opacity-100 transition-all">Select Mission →</span>
            </div>
          </div>
        </div>

        {/* Observer Mode */}
        <div 
          onClick={() => onSelect(false)}
          className="group relative glass p-10 rounded-2xl border-2 border-white/5 hover:border-amber-500/50 transition-all cursor-pointer overflow-hidden shadow-2xl hover:scale-[1.02] active:scale-95"
        >
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-all"></div>
          <div className="relative space-y-6">
            <div className="w-16 h-16 bg-amber-600 rounded-lg flex items-center justify-center text-3xl shadow-lg shadow-amber-900/40">👁️</div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white tracking-tight">Observer Mode 上帝視角</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                房主僅作為主持人觀戰，不參與遊戲。房主需在準備階段<span className="text-amber-500 font-bold">手動輸入</span>詞彙。
              </p>
            </div>
            <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs font-black uppercase tracking-widest text-amber-500">
              <span>Host is Spectator</span>
              <span className="opacity-0 group-hover:opacity-100 transition-all">Select Mission →</span>
            </div>
          </div>
        </div>
      </div>

      <button 
        onClick={onBack}
        className="block mx-auto text-gray-600 hover:text-white transition-colors text-xs font-black uppercase tracking-[0.3em]"
      >
        ← Back to identification
      </button>
    </div>
  );
};

export default ModeSelectionView;