import React, { useState, useEffect } from 'react';
import { Game, Player, GameStatus, PlayerRole } from '../types';
import { supabase } from '../supabaseClient';
import { generateWordPair } from '../geminiService';

interface LobbyViewProps {
  game: Game;
  players: Player[];
  currentPlayer: Player;
  onStartGame: () => void;
  onExit: () => void;
}

const AgentIcon = ({ className = "w-2/3 h-2/3" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const LobbyView: React.FC<LobbyViewProps> = ({ game, players, currentPlayer, onExit }) => {
  const [manualCivilian, setManualCivilian] = useState('');
  const [manualUndercover, setManualUndercover] = useState('');
  const [starting, setStarting] = useState(false);
  const [generatingWords, setGeneratingWords] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const agents = game.host_is_player 
    ? players 
    : players.filter(p => !p.is_host);
  
  const host = players.find(p => p.is_host);
  const participantCount = agents.length;
  const minRequired = 3;

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const handleStart = async () => {
    if (participantCount < minRequired) return alert(`至少需要 ${minRequired} 位特務才能開始遊戲`);
    
    let civWord = manualCivilian;
    let undWord = manualUndercover;

    if (!game.host_is_player) {
      if (!civWord.trim() || !undWord.trim()) return alert("指揮官模式請先設定好兩個詞彙！");
    }

    setStarting(true);
    try {
      if (game.host_is_player) {
        const aiWords = await generateWordPair();
        civWord = aiWords.civilianWord;
        undWord = aiWords.undercoverWord;
      }

      const shuffledAgents = [...agents].sort(() => Math.random() - 0.5);
      const undercoverCount = Math.floor(participantCount / 4) || 1;
      
      const updates = players.map(p => {
        if (!game.host_is_player && p.is_host) {
          return { 
            id: p.id, 
            role: PlayerRole.UNKNOWN, 
            is_alive: false, 
            voted_for: null,
            message: null 
          };
        }
        
        const agentIdx = shuffledAgents.findIndex(sa => sa.id === p.id);
        return {
          id: p.id,
          role: agentIdx < undercoverCount ? PlayerRole.UNDERCOVER : PlayerRole.CIVILIAN,
          is_alive: true,
          voted_for: null,
          message: null 
        };
      });

      for (const update of updates) {
        await supabase!.from('players').update(update).eq('id', update.id);
      }

      await supabase!.from('games').update({
        status: GameStatus.PLAYING,
        civilian_word: civWord,
        undercover_word: undWord,
        round: 1,
        suspect_ids: null
      }).eq('id', game.id);

    } catch (err) {
      alert("開始失敗，請再試一次");
    } finally {
      setStarting(false);
    }
  };

  const handleGenerateWords = async () => {
    setGeneratingWords(true);
    try {
      const aiWords = await generateWordPair();
      setManualCivilian(aiWords.civilianWord);
      setManualUndercover(aiWords.undercoverWord);
    } catch (err) {
      alert("AI 出題失敗，請稍後再試");
    } finally {
      setGeneratingWords(false);
    }
  };

  const handleKick = async (playerId: string) => {
    if (!supabase || !currentPlayer.is_host) return;
    if (confirm("確定要將該玩家移出房間嗎？")) {
      await supabase.from('players').delete().eq('id', playerId);
    }
  };

  const handleLeave = async () => {
    if (!supabase) return;
    const msg = currentPlayer.is_host ? "關閉房間會終結所有隊員的任務，確定嗎？" : "確定要退出房間嗎？";
    if (confirm(msg)) {
      if (currentPlayer.is_host) {
        // 房主退出，刪除整間房的玩家（觸發 App.tsx 的 hasHost 偵測）
        await supabase.from('players').delete().eq('game_id', game.id);
      } else {
        await supabase.from('players').delete().eq('id', currentPlayer.id);
      }
      onExit();
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(game.room_code);
    setShowToast(true);
  };

  return (
    <div className="glass p-5 md:p-10 rounded-2xl shadow-2xl max-w-2xl mx-auto space-y-6 md:space-y-8 animate-in zoom-in duration-300 border border-white/5 relative">
      {showToast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] bg-black border border-white/20 text-white px-6 py-2 rounded-full text-[10px] font-black tracking-widest uppercase animate-in fade-in slide-in-from-top-4 duration-300 shadow-[0_0_30px_rgba(0,0,0,0.8)]">
           Access Code Copied
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase leading-tight">Lobby</h2>
          <div className="flex flex-wrap items-center gap-2">
             <div className="px-2 py-0.5 bg-red-600/10 border border-red-600/30 rounded text-[8px] md:text-[9px] font-black text-red-500 uppercase tracking-widest">
               {game.host_is_player ? "Active Deployment" : "Surveillance"}
             </div>
             <p className="text-gray-500 text-[9px] md:text-[10px] font-bold tracking-widest uppercase">Active Agents: {participantCount}</p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div onClick={copyCode} className="flex-1 md:flex-none cursor-pointer bg-red-600/10 border border-red-500/20 px-4 py-3 rounded-lg text-center group transition-all hover:bg-red-600/20">
            <p className="text-[8px] text-red-500 font-black uppercase tracking-widest">Access Code</p>
            <p className="text-xl font-black text-red-500 group-hover:scale-105 transition-transform">{game.room_code}</p>
          </div>
          <button onClick={handleLeave} className="bg-zinc-900 border border-white/5 px-4 py-3 rounded-lg text-[10px] font-black text-zinc-500 uppercase tracking-widest hover:text-white hover:bg-red-900/40 transition-all">
            Exit
          </button>
        </div>
      </div>

      {!game.host_is_player && currentPlayer.is_host && (
        <div className="bg-white/5 border border-white/10 p-5 rounded-xl space-y-4 shadow-inner">
          <h3 className="text-amber-500 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
            Overseer Control
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input 
                value={manualCivilian}
                onChange={e => setManualCivilian(e.target.value)}
                placeholder="平民詞：例如 自行車"
                className="w-full bg-black/60 border border-white/5 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-amber-500 outline-none text-white font-bold transition-all placeholder:text-zinc-800"
              />

            <input 
              value={manualUndercover}
              onChange={e => setManualUndercover(e.target.value)}
              placeholder="臥底詞：例如 電動車"
              className="w-full bg-black/60 border border-white/5 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-amber-500 outline-none text-white font-bold transition-all placeholder:text-zinc-800"
            />
          </div>
            <div className="flex gap-2">
              <button
                onClick={handleGenerateWords}
                disabled={generatingWords || starting}
                className="shrink-0 px-3 py-2 rounded-lg text-[12px] font-black tracking-widest uppercase bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {generatingWords ? "生成中" : "AI出題"}
              </button>
            </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {host && (
          <div className={`p-4 rounded-xl border-2 text-center flex flex-col items-center gap-2 transition-all shadow-lg relative ${!game.host_is_player ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white/5 border-white/10'}`}>
            <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-inner bg-red-600 text-white shadow-red-900/40 overflow-hidden`}>
              <AgentIcon />
            </div>
            <span className="text-xs md:text-sm font-black truncate w-full text-gray-100">{host.name}</span>
            <span className={`text-[7px] md:text-[8px] px-2 py-0.5 rounded-full font-black tracking-widest border bg-red-600/20 text-red-500 border-red-500/30`}>
              {game.host_is_player ? "HOST" : "GM"}
            </span>
          </div>
        )}

        {players.filter(p => !p.is_host).map((p) => (
          <div key={p.id} className="bg-white/5 border border-white/10 p-4 rounded-xl text-center flex flex-col items-center gap-2 transition-all hover:border-white/20 shadow-md group relative">
            {currentPlayer.is_host && (
              <button 
                onClick={() => handleKick(p.id)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-red-600 text-white text-[8px] font-black px-2 py-1 rounded transition-all hover:bg-red-500"
              >
                KICK
              </button>
            )}
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 overflow-hidden">
              <AgentIcon />
            </div>
            <span className="text-xs md:text-sm font-bold truncate w-full text-zinc-300">{p.name}</span>
            <span className="text-[7px] md:text-[8px] bg-zinc-900 text-zinc-600 px-2 py-0.5 rounded-full border border-white/5 font-black tracking-widest uppercase">Agent</span>
          </div>
        ))}
      </div>

      {currentPlayer.is_host ? (
        <button
          onClick={handleStart}
          disabled={participantCount < minRequired || starting}
          className={`w-full font-black py-4 md:py-5 rounded-lg shadow-2xl transition-all active:scale-[0.98] disabled:opacity-20 disabled:cursor-not-allowed uppercase tracking-[0.2em] md:tracking-[0.3em] text-sm md:text-lg
            ${game.host_is_player ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/40' : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/40'}
          `}
        >
          {starting ? "Initializing..." : (participantCount < minRequired ? `Need ${minRequired - participantCount} more Agents` : "鎖定玩家並開始遊戲")}
        </button>
      ) : (
        <div className="text-center bg-white/5 p-4 md:p-5 rounded-lg border border-white/5">
          <p className="text-gray-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest animate-pulse">
            Awaiting Command Center Authorization...
          </p>
        </div>
      )}
    </div>
  );
};

export default LobbyView;
