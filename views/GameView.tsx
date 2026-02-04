import React, { useState, useEffect } from 'react';
import { Game, Player, GameStatus, PlayerRole } from '../types';
import { supabase } from '../supabaseClient';

interface GameViewProps {
  game: Game;
  players: Player[];
  currentPlayer: Player;
}

const GameView: React.FC<GameViewProps> = ({ game, players, currentPlayer }) => {
  const [revealed, setRevealed] = useState(false);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRevealed(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const getMyWord = () => {
    if (currentPlayer.role === PlayerRole.CIVILIAN) return game.civilian_word;
    if (currentPlayer.role === PlayerRole.UNDERCOVER) return game.undercover_word;
    return "N/A";
  };

  const handleVote = async (targetId: string) => {
    if (!currentPlayer.is_alive || game.status !== GameStatus.VOTING || !supabase || voting) return;
    setVoting(true);
    try {
      await supabase!.from('players').update({ voted_for: targetId }).eq('id', currentPlayer.id);
    } finally {
      setVoting(false);
    }
  };

  const togglePhase = async () => {
    if (!supabase) return;
    const nextStatus = game.status === GameStatus.PLAYING ? GameStatus.VOTING : GameStatus.PLAYING;
    
    if (game.status === GameStatus.VOTING) {
      const votes: Record<string, number> = {};
      players.filter(p => p.is_alive).forEach(p => {
        if (p.voted_for) {
          votes[p.voted_for] = (votes[p.voted_for] || 0) + 1;
        }
      });

      let maxVotes = 0;
      let eliminatedId: string | null = null;
      Object.entries(votes).forEach(([id, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
          eliminatedId = id;
        }
      });

      if (eliminatedId) {
        await supabase!.from('players').update({ is_alive: false }).eq('id', eliminatedId);
      }
      
      await supabase!.from('players').update({ voted_for: null }).eq('game_id', game.id);
    }

    await supabase!.from('games').update({ status: nextStatus }).eq('id', game.id);
  };

  const resetGame = async () => {
    if (!supabase || !currentPlayer.is_host) return;
    await supabase!.from('players').update({ 
      is_alive: true, 
      role: PlayerRole.UNKNOWN, 
      voted_for: null 
    }).eq('game_id', game.id);
    
    await supabase!.from('games').update({ 
      status: GameStatus.LOBBY,
      civilian_word: null,
      undercover_word: null,
      winner_team: null
    }).eq('id', game.id);
  };

  const alivePlayers = players.filter(p => p.is_alive && (game.host_is_player || !p.is_host));
  const undercoversAlive = alivePlayers.filter(p => p.role === PlayerRole.UNDERCOVER).length;

  const isUndercoverWin = alivePlayers.length <= 2 && undercoversAlive > 0;
  const isCivilianWin = undercoversAlive === 0;
  const isGameOver = isUndercoverWin || isCivilianWin;

  const isSpectator = !game.host_is_player && currentPlayer.is_host;

  if (isGameOver) {
    return (
      <div className="glass p-12 rounded-[3rem] text-center space-y-10 animate-in fade-in zoom-in duration-700 max-w-2xl mx-auto border-white/5 shadow-2xl">
        <div className="space-y-4">
          <div className="inline-block p-6 bg-white/5 rounded-full mb-4 border border-white/10 shadow-inner">
            <span className="text-7xl">{isCivilianWin ? '👮' : '🕵️'}</span>
          </div>
          <h2 className={`text-7xl font-black tracking-tighter uppercase ${isCivilianWin ? 'text-cyan-400' : 'text-red-600'}`}>
            {isCivilianWin ? 'Mission Cleared' : 'SQUAD WIPED'}
          </h2>
          <p className="text-gray-600 text-xs font-black tracking-[1em] uppercase">Archive Entry Complete</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-black/80 p-8 rounded-3xl border border-white/5 shadow-inner">
            <p className="text-[9px] text-gray-700 font-black uppercase tracking-widest mb-3">Civilian Objective</p>
            <p className="text-3xl font-black text-white">{game.civilian_word}</p>
          </div>
          <div className="bg-black/80 p-8 rounded-3xl border border-white/5 shadow-inner">
            <p className="text-[9px] text-gray-700 font-black uppercase tracking-widest mb-3">Undercover Target</p>
            <p className="text-3xl font-black text-white">{game.undercover_word}</p>
          </div>
        </div>

        {currentPlayer.is_host && (
          <button 
            onClick={resetGame}
            className="w-full bg-white text-black hover:bg-gray-200 py-6 rounded-[1.5rem] font-black transition-all shadow-2xl uppercase tracking-[0.3em] text-lg hover:scale-[1.02] active:scale-95 mt-10"
          >
            Deploy New Mission
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-1000 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-black/80 p-8 rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
        <div className="flex items-center gap-8">
          <div className={`px-6 py-3 rounded-xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl transition-all ${game.status === GameStatus.PLAYING ? 'bg-amber-500 text-black' : 'bg-red-600 text-white animate-pulse'}`}>
            {game.status === GameStatus.PLAYING ? 'Intel Discussion' : 'Elimination Vote'}
          </div>
          <div className="text-left">
            <p className="text-[9px] text-gray-700 font-black uppercase tracking-[0.4em]">Active SQUAD</p>
            <p className="text-white font-black text-2xl leading-none">{alivePlayers.length} / {players.filter(p => game.host_is_player || !p.is_host).length}</p>
          </div>
        </div>
        
        {currentPlayer.is_host && (
          <button 
            onClick={togglePhase}
            className="bg-red-600 hover:bg-red-500 text-white px-12 py-4 rounded-2xl font-black uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 shadow-xl shadow-red-900/40 text-sm"
          >
            {game.status === GameStatus.PLAYING ? 'Execute Vote' : 'Confirm Intel'}
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-6">
          {players.filter(p => game.host_is_player || !p.is_host).map((p) => {
            const voteCount = players.filter(v => v.voted_for === p.id).length;
            const isVotedByMe = currentPlayer.voted_for === p.id;

            return (
              <div 
                key={p.id} 
                onClick={() => game.status === GameStatus.VOTING && p.is_alive && !isSpectator && handleVote(p.id)}
                className={`group relative overflow-hidden p-8 rounded-[2rem] border-2 transition-all duration-300 flex flex-col items-center gap-4
                  ${!p.is_alive ? 'opacity-20 grayscale border-transparent bg-black/40 cursor-not-allowed' : 
                    isVotedByMe ? 'border-red-600 bg-red-600/10 scale-95 shadow-2xl' : 
                    game.status === GameStatus.VOTING && !isSpectator ? 'border-white/10 bg-white/5 hover:border-red-600/50 cursor-pointer shadow-lg' : 'border-white/5 bg-white/5'}
                `}
              >
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black transition-all ${p.is_host ? 'bg-red-600 text-white shadow-xl shadow-red-900/40' : 'bg-gray-800 text-gray-500'}`}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-xl leading-tight truncate px-2">{p.name}</p>
                  {p.id === currentPlayer.id && <p className="text-[9px] text-red-600 font-black tracking-widest mt-1">ACTIVE IDENTITY</p>}
                </div>
                
                {game.status === GameStatus.VOTING && p.is_alive && voteCount > 0 && (
                  <div className="absolute top-4 right-4 bg-red-600 text-white w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shadow-2xl border-2 border-black animate-bounce">
                    {voteCount}
                  </div>
                )}
                {!p.is_alive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="bg-red-700 text-white px-4 py-1 text-[9px] font-black uppercase tracking-[0.4em] rotate-[-15deg] shadow-2xl">Exposed</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Section: Information & Card */}
        <div className="lg:col-span-4 space-y-8">
          <div className="glass p-10 rounded-[2.5rem] border border-white/5 text-center space-y-8 bg-black/60 shadow-2xl">
            <h3 className="text-[9px] font-black text-gray-700 uppercase tracking-[0.6em]">ACCESS CARD [SECURE]</h3>
            
            <div 
              onClick={() => setRevealed(!revealed)}
              className={`aspect-[2/3] w-full max-w-[280px] mx-auto rounded-[2rem] cursor-pointer transition-all duration-1000 relative preserve-3d shadow-[0_35px_60px_-15px_rgba(0,0,0,0.6)] ${revealed ? '[transform:rotateY(180deg)]' : ''}`}
            >
              {/* Card Back */}
              <div className="absolute inset-0 bg-[#080808] rounded-[2rem] flex flex-col items-center justify-center border-4 border-red-900/20 backface-hidden overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-600 to-transparent"></div>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5"></div>
                <div className="w-24 h-24 bg-red-600/5 rounded-full flex items-center justify-center mb-8 border border-red-600/10 relative">
                   <div className="absolute inset-0 border-2 border-red-600/20 rounded-full animate-ping opacity-20"></div>
                   <div className="absolute inset-4 border border-red-600/40 rounded-full animate-spin [animation-duration:3s]"></div>
                   <span className="text-5xl drop-shadow-2xl">🛡️</span>
                </div>
                <span className="text-[11px] font-black text-red-600 tracking-[0.5em] uppercase mb-1 drop-shadow-lg">TOP SECRET</span>
                <span className="text-[8px] font-bold text-gray-800 uppercase tracking-widest">AUTHORIZED PERSONNEL ONLY</span>
              </div>
              
              {/* Card Front (The Doris Style) */}
              <div className={`absolute inset-0 bg-black rounded-[2rem] [transform:rotateY(180deg)] backface-hidden flex flex-col items-center p-10 space-y-5 shadow-2xl overflow-hidden border-[3px] ${isSpectator ? 'border-amber-600' : (currentPlayer.role === PlayerRole.UNDERCOVER ? 'border-red-600 shadow-red-900/20' : 'border-cyan-600 shadow-cyan-900/20')}`}>
                <div className="text-[8px] font-black text-gray-700 uppercase tracking-[0.4em] mb-2">ACCESS CARD</div>
                
                <h4 className="text-red-600 font-black text-xl tracking-tighter uppercase leading-none text-center">
                   WHO IS<br/>UNDERCOVER
                </h4>
                
                <div className="w-full space-y-1 pt-2">
                   <p className="text-[8px] text-gray-700 font-black uppercase text-center tracking-widest">Agent Identification</p>
                   <p className="text-2xl font-black text-white text-center leading-tight truncate px-2">{currentPlayer.name}</p>
                </div>

                <div className="w-full space-y-3 py-6 relative">
                   <p className="text-[8px] text-gray-700 font-black uppercase text-center tracking-widest">Mission Code Word</p>
                   <div className="bg-gradient-to-br from-black to-zinc-950 border border-white/5 rounded-2xl py-8 flex items-center justify-center shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] border-red-900/20">
                      <span className="text-4xl font-black text-amber-500 tracking-wider drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                        {isSpectator ? "MASTER" : getMyWord()}
                      </span>
                   </div>
                </div>

                <div className="w-full space-y-2">
                   <p className="text-[8px] text-gray-700 font-black uppercase text-center tracking-widest">Clearance Status</p>
                   <div className="text-center">
                     <p className={`font-black text-lg tracking-[0.3em] ${isSpectator ? 'text-amber-500' : (currentPlayer.role === PlayerRole.UNDERCOVER ? 'text-red-600' : 'text-cyan-500')}`}>
                        {isSpectator ? "SPECTATOR" : (currentPlayer.role === PlayerRole.UNDERCOVER ? "UNDERCOVER" : "CIVILIAN")}
                     </p>
                     <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5 opacity-60">
                        {isSpectator ? "- 觀戰管理員 -" : (currentPlayer.role === PlayerRole.UNDERCOVER ? "- 潛伏臥底 -" : "- 特勤平民 -")}
                     </p>
                   </div>
                </div>

                <div className="pt-6 text-center space-y-1 opacity-30">
                   <p className="text-[7px] text-gray-600 font-bold leading-tight">DO NOT SHARE THIS INFORMATION.</p>
                   <p className="text-[7px] text-gray-600 font-bold leading-tight uppercase">Destroy after mission completion.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-black/80 border border-white/5 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${currentPlayer.role === PlayerRole.UNDERCOVER ? 'bg-red-600' : 'bg-cyan-600'}`}></div>
            <h4 className="text-white font-black text-[10px] uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
              <span className="text-red-600 animate-pulse">●</span> Intelligence Briefing
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed font-medium italic">
              {isSpectator 
                ? "監控中：目標平民詞「" + game.civilian_word + "」，標靶臥底詞「" + game.undercover_word + "」。請引導團隊進行邏輯分析。"
                : (currentPlayer.role === PlayerRole.CIVILIAN 
                  ? "警告：敵方特務已滲透。仔細聆聽每一句描述，任何細微的語意偏差都可能是致命破綻。" 
                  : "滲透成功：你的詞彙與他人不同。保持冷靜，透過他人的描述推斷平民詞，並建立具說服力的掩護。")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameView;