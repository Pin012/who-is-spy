import React, { useState } from 'react';
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

  const getMyWord = () => {
    if (currentPlayer.role === PlayerRole.CIVILIAN) return game.civilian_word;
    if (currentPlayer.role === PlayerRole.UNDERCOVER) return game.undercover_word;
    return "未知";
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

  const alivePlayers = players.filter(p => p.is_alive);
  const undercoversAlive = alivePlayers.filter(p => p.role === PlayerRole.UNDERCOVER).length;

  const isUndercoverWin = alivePlayers.length <= 2 && undercoversAlive > 0;
  const isCivilianWin = undercoversAlive === 0;
  const isGameOver = isUndercoverWin || isCivilianWin;

  if (isGameOver) {
    return (
      <div className="glass p-12 rounded-3xl text-center space-y-8 animate-in fade-in zoom-in duration-500 max-w-2xl mx-auto">
        <div className="space-y-4">
          <div className="inline-block p-4 bg-white/5 rounded-full mb-4">
            <span className="text-6xl">{isCivilianWin ? '🛡️' : '🗡️'}</span>
          </div>
          <h2 className={`text-6xl font-black tracking-tighter ${isCivilianWin ? 'text-cyan-400' : 'text-red-500'}`}>
            {isCivilianWin ? '平民勝利' : '臥底勝利'}
          </h2>
          <p className="text-gray-400 text-xl font-medium">正義雖然會遲到，但絕不會缺席...嗎？</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/40 p-6 rounded-2xl border border-white/5">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">平民詞</p>
            <p className="text-2xl font-bold text-white">{game.civilian_word}</p>
          </div>
          <div className="bg-black/40 p-6 rounded-2xl border border-white/5">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">臥底詞</p>
            <p className="text-2xl font-bold text-white">{game.undercover_word}</p>
          </div>
        </div>

        <div className="space-y-4 pt-6">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-[0.3em]">身份全揭曉</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {players.map(p => (
              <div key={p.id} className={`p-3 rounded-xl border text-sm font-bold ${p.role === PlayerRole.UNDERCOVER ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'}`}>
                {p.name}
                <div className="text-[10px] opacity-60 font-normal">{p.role === PlayerRole.UNDERCOVER ? '臥底' : '平民'}</div>
              </div>
            ))}
          </div>
        </div>

        {currentPlayer.is_host && (
          <button 
            onClick={resetGame}
            className="w-full bg-white text-black hover:bg-gray-200 py-4 rounded-2xl font-bold transition-all shadow-xl hover:scale-[1.02] active:scale-95"
          >
            返回大廳重新開局
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/5 p-6 rounded-3xl border border-white/10">
        <div className="flex items-center gap-4">
          <div className={`px-4 py-2 rounded-xl font-bold shadow-lg transition-colors ${game.status === GameStatus.PLAYING ? 'bg-amber-500 text-black' : 'bg-red-500 text-white animate-pulse'}`}>
            {game.status === GameStatus.PLAYING ? '🗣️ 描述與討論' : '🗳️ 抓出臥底吧'}
          </div>
          <p className="text-gray-400 text-sm">存活: <span className="text-white font-bold">{alivePlayers.length}</span> / {players.length}</p>
        </div>
        
        {currentPlayer.is_host && (
          <button 
            onClick={togglePhase}
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-900/20"
          >
            {game.status === GameStatus.PLAYING ? '結束討論，進入投票' : '確認投票結果'}
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {players.map((p) => {
            const voteCount = players.filter(v => v.voted_for === p.id).length;
            const isVotedByMe = currentPlayer.voted_for === p.id;

            return (
              <div 
                key={p.id} 
                onClick={() => game.status === GameStatus.VOTING && p.is_alive && handleVote(p.id)}
                className={`group relative overflow-hidden p-6 rounded-3xl border transition-all duration-300
                  ${!p.is_alive ? 'opacity-30 grayscale border-transparent bg-black/40 cursor-not-allowed' : 
                    isVotedByMe ? 'border-red-500 bg-red-500/20 scale-95 shadow-lg' : 
                    game.status === GameStatus.VOTING ? 'border-white/20 bg-white/5 hover:bg-white/10 cursor-pointer hover:border-red-500/50' : 'border-white/10 bg-white/5'}
                `}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold transition-all ${p.is_host ? 'bg-red-600 ring-2 ring-red-500/50' : 'bg-gray-700'} ${isVotedByMe ? 'ring-4 ring-red-500 ring-offset-4 ring-offset-[#0f1115]' : ''}`}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold text-lg truncate w-full text-center text-white">{p.name} {p.id === currentPlayer.id && '(你)'}</span>
                  {!p.is_alive && <span className="text-[10px] font-bold text-red-500 tracking-widest bg-red-500/10 px-2 py-0.5 rounded">ELIMINATED</span>}
                  
                  {game.status === GameStatus.VOTING && p.is_alive && voteCount > 0 && (
                    <div className="absolute top-2 right-2 bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-lg animate-bounce">
                      {voteCount}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-6">
          <div className="glass p-8 rounded-3xl border border-white/10 text-center space-y-6">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">你的個人卡片</h3>
            
            <div 
              onClick={() => setRevealed(!revealed)}
              className={`aspect-[3/4] w-full max-w-[200px] mx-auto rounded-2xl cursor-pointer transition-all duration-700 relative preserve-3d ${revealed ? '[transform:rotateY(180deg)]' : ''}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#1e2229] to-[#0f1115] rounded-2xl flex flex-col items-center justify-center border-2 border-white/5 shadow-2xl backface-hidden">
                <div className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl">🔍</span>
                </div>
                <span className="text-[10px] font-bold text-white/40 tracking-[0.2em] uppercase">點擊翻牌</span>
              </div>
              
              <div className="absolute inset-0 bg-white rounded-2xl [transform:rotateY(180deg)] backface-hidden flex flex-col items-center justify-center p-6 space-y-4 shadow-2xl overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-2 ${currentPlayer.role === PlayerRole.UNDERCOVER ? 'bg-red-500' : 'bg-cyan-500'}`}></div>
                <span className={`text-[10px] font-black tracking-[0.3em] ${currentPlayer.role === PlayerRole.UNDERCOVER ? 'text-red-600' : 'text-cyan-600'}`}>
                  {currentPlayer.role === PlayerRole.CIVILIAN ? '平民' : '臥底'}
                </span>
                <span className="text-3xl font-black text-black tracking-tighter leading-none">{getMyWord()}</span>
                <div className="w-8 h-1 bg-gray-200 rounded-full"></div>
                <p className="text-[10px] text-gray-400 font-medium italic">點擊隱藏身分</p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
            <h4 className="text-white font-bold mb-3 flex items-center gap-2">
              <span className="text-blue-400">💡</span> 戰場攻略
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              {currentPlayer.role === PlayerRole.CIVILIAN 
                ? "平民請注意：臥底可能在模仿你的用詞。如果你發現有人說得跟你很像，但又有一點點違和感，他可能就是臥底！"
                : "臥底請注意：目前的詞語非常接近。仔細聽別人的描述，試著在你的回合中巧妙地融入他們的資訊。"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameView;