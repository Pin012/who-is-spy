
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

  // Auto-flip effect: Automatically show the card when the game starts
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
      <div className="glass p-12 rounded-3xl text-center space-y-8 animate-in fade-in zoom-in duration-500 max-w-2xl mx-auto border-white/5">
        <div className="space-y-4">
          <div className="inline-block p-4 bg-white/5 rounded-full mb-4 border border-white/10">
            <span className="text-6xl">{isCivilianWin ? '👮' : '🕵️'}</span>
          </div>
          <h2 className={`text-6xl font-black tracking-tighter uppercase ${isCivilianWin ? 'text-cyan-400' : 'text-red-500'}`}>
            {isCivilianWin ? 'Civilians Win' : 'Undercover Win'}
          </h2>
          <p className="text-gray-500 text-sm font-bold tracking-[0.5em] uppercase">Mission Terminated</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/60 p-6 rounded-2xl border border-white/5">
            <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-2">Civilian Word</p>
            <p className="text-2xl font-black text-white">{game.civilian_word}</p>
          </div>
          <div className="bg-black/60 p-6 rounded-2xl border border-white/5">
            <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-2">Undercover Word</p>
            <p className="text-2xl font-black text-white">{game.undercover_word}</p>
          </div>
        </div>

        <div className="space-y-4 pt-6 text-left">
          <h3 className="text-center text-[10px] font-black text-gray-600 uppercase tracking-[0.3em]">Agent Roles Uncovered</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {players.filter(p => game.host_is_player || !p.is_host).map(p => (
              <div key={p.id} className={`p-4 rounded-xl border-2 transition-all ${p.role === PlayerRole.UNDERCOVER ? 'border-red-500/30 bg-red-500/5 text-red-500' : 'border-cyan-500/30 bg-cyan-500/5 text-cyan-500'}`}>
                <div className="text-xs font-black uppercase mb-1">{p.role === PlayerRole.UNDERCOVER ? 'Undercover' : 'Civilian'}</div>
                <div className="text-lg font-bold truncate text-white">{p.name}</div>
              </div>
            ))}
          </div>
        </div>

        {currentPlayer.is_host && (
          <button 
            onClick={resetGame}
            className="w-full bg-white text-black hover:bg-gray-200 py-5 rounded-2xl font-black transition-all shadow-2xl uppercase tracking-widest mt-8"
          >
            Re-Deploy Mission
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-1000">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-black/60 p-6 rounded-3xl border border-white/10 shadow-2xl">
        <div className="flex items-center gap-6">
          <div className={`px-5 py-2 rounded-xl font-black uppercase tracking-widest text-sm shadow-xl transition-all ${game.status === GameStatus.PLAYING ? 'bg-amber-500 text-black' : 'bg-red-600 text-white animate-pulse'}`}>
            {game.status === GameStatus.PLAYING ? 'Discussion Phase' : 'Elimination Vote'}
          </div>
          <div className="text-left">
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Active Agents</p>
            <p className="text-white font-black text-xl leading-none">{alivePlayers.length} / {players.filter(p => game.host_is_player || !p.is_host).length}</p>
          </div>
        </div>
        
        {currentPlayer.is_host && (
          <button 
            onClick={togglePhase}
            className="bg-red-600 hover:bg-red-500 text-white px-10 py-3 rounded-xl font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl shadow-red-900/40"
          >
            {game.status === GameStatus.PLAYING ? 'Start Voting' : 'Confirm Results'}
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {players.filter(p => game.host_is_player || !p.is_host).map((p) => {
            const voteCount = players.filter(v => v.voted_for === p.id).length;
            const isVotedByMe = currentPlayer.voted_for === p.id;

            return (
              <div 
                key={p.id} 
                onClick={() => game.status === GameStatus.VOTING && p.is_alive && !isSpectator && handleVote(p.id)}
                className={`group relative overflow-hidden p-6 rounded-3xl border-2 transition-all duration-300 flex flex-col items-center gap-3
                  ${!p.is_alive ? 'opacity-20 grayscale border-transparent bg-black/40 cursor-not-allowed' : 
                    isVotedByMe ? 'border-red-600 bg-red-600/10 scale-95' : 
                    game.status === GameStatus.VOTING && !isSpectator ? 'border-white/10 bg-white/5 hover:border-red-600/50 cursor-pointer' : 'border-white/5 bg-white/5'}
                `}
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black transition-all ${p.is_host ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-500'}`}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-lg leading-tight truncate px-2">{p.name}</p>
                  {p.id === currentPlayer.id && <p className="text-[10px] text-red-500 font-black tracking-widest">YOU</p>}
                </div>
                
                {game.status === GameStatus.VOTING && p.is_alive && voteCount > 0 && (
                  <div className="absolute top-3 right-3 bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-2xl border-2 border-black animate-bounce">
                    {voteCount}
                  </div>
                )}
                {!p.is_alive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-red-600/90 text-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] rotate-12">Eliminated</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-6">
          <div className="glass p-8 rounded-3xl border border-white/5 text-center space-y-6 bg-black/40">
            <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.5em]">Identity Access Card</h3>
            
            <div 
              onClick={() => setRevealed(!revealed)}
              className={`aspect-[2/3] w-full max-w-[240px] mx-auto rounded-3xl cursor-pointer transition-all duration-1000 relative preserve-3d shadow-2xl ${revealed ? '[transform:rotateY(180deg)]' : ''}`}
            >
              {/* Back of Card (Consistent for everyone) */}
              <div className="absolute inset-0 bg-[#0a0a0a] rounded-3xl flex flex-col items-center justify-center border-4 border-red-900/30 backface-hidden overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-600 to-transparent"></div>
                <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mb-6 border border-red-600/20">
                   <div className="w-12 h-12 border-4 border-red-600 rounded-full animate-ping opacity-20"></div>
                   <span className="absolute text-4xl">🕵️</span>
                </div>
                <span className="text-[10px] font-black text-red-600 tracking-[0.4em] uppercase mb-1">Top Secret</span>
                <span className="text-[8px] font-bold text-gray-700 uppercase">Classified Information</span>
                <div className="mt-8 flex gap-1">
                   {[1,2,3,4].map(i => <div key={i} className="w-1 h-8 bg-white/5 rounded-full"></div>)}
                </div>
              </div>
              
              {/* Front of Card (Doris Style) */}
              <div className={`absolute inset-0 bg-black rounded-3xl [transform:rotateY(180deg)] backface-hidden flex flex-col items-center p-8 space-y-4 shadow-2xl overflow-hidden border-2 ${isSpectator ? 'border-amber-500' : (currentPlayer.role === PlayerRole.UNDERCOVER ? 'border-red-600' : 'border-cyan-500')}`}>
                <div className="text-[8px] font-black text-gray-700 uppercase tracking-widest">Access Card</div>
                <div className="w-full text-center py-2">
                   <h4 className="text-red-600 font-black text-lg tracking-tighter uppercase leading-none">Who is Undercover</h4>
                </div>
                
                <div className="w-full space-y-1">
                   <p className="text-[8px] text-gray-600 font-black uppercase text-center tracking-widest">Player</p>
                   <p className="text-xl font-bold text-white text-center leading-tight truncate">{currentPlayer.name}</p>
                </div>

                <div className="w-full space-y-2 py-4">
                   <p className="text-[8px] text-gray-600 font-black uppercase text-center tracking-widest">Your Word</p>
                   <div className="bg-black border border-red-900/30 rounded-xl py-6 flex items-center justify-center shadow-inner">
                      <span className="text-3xl font-black text-amber-500 tracking-widest">
                        {isSpectator ? "MASTER" : getMyWord()}
                      </span>
                   </div>
                </div>

                <div className="w-full space-y-1">
                   <p className="text-[8px] text-gray-600 font-black uppercase text-center tracking-widest">Status</p>
                   <p className={`text-center font-black tracking-widest ${isSpectator ? 'text-amber-500' : (currentPlayer.role === PlayerRole.UNDERCOVER ? 'text-red-600' : 'text-cyan-500')}`}>
                      {isSpectator ? "SPECTATOR" : (currentPlayer.role === PlayerRole.UNDERCOVER ? "UNDERCOVER" : "CIVILIAN")}
                   </p>
                   <p className="text-[10px] text-gray-500 font-bold text-center">
                      {isSpectator ? "- 觀戰中 -" : (currentPlayer.role === PlayerRole.UNDERCOVER ? "- 臥底 -" : "- 平民 -")}
                   </p>
                </div>

                <div className="pt-4 text-center space-y-1">
                   <p className="text-[7px] text-gray-700 font-bold leading-tight">DO NOT SHARE THIS INFORMATION.</p>
                   <p className="text-[7px] text-gray-700 font-bold leading-tight uppercase">Destroy after reading.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 p-6 rounded-3xl shadow-xl">
            <h4 className="text-white font-black text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="text-red-600">⚠</span> Intelligence Report
            </h4>
            <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
              {isSpectator 
                ? "身為主持人，請密切注意頻道中的描述。如果發現有人掉隊，可以在投票階段引導大家討論。當前的平民詞為：" + game.civilian_word + "，臥底詞為：" + game.undercover_word
                : (currentPlayer.role === PlayerRole.CIVILIAN 
                  ? "分析顯示：臥底正隱藏在你的描述之中。請留意那些描述模糊或略帶遲疑的特工。" 
                  : "警告：你已被標記為臥底。唯一生存路徑是完美模仿平民的描述，並在投票時混淆視聽。")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameView;
