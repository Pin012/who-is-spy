import React, { useState, useEffect, useRef } from 'react';
import { Game, Player, GameStatus, PlayerRole } from '../types';
import { supabase } from '../supabaseClient';

interface GameViewProps {
  game: Game;
  players: Player[];
  currentPlayer: Player;
  onExit: () => void;
}

const AgentIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const SecretStampIcon = ({ className = "w-32 h-32" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" className={className}>
    <circle cx="50" cy="50" r="45" strokeWidth="2" strokeDasharray="4 2" opacity="0.8" />
    <circle cx="50" cy="50" r="40" strokeWidth="1" opacity="0.5" />
    <path d="M20 50h60" strokeWidth="1" opacity="0.3" />
    <text x="50" y="52" fontFamily="Arial" fontSize="10" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none">TOP SECRET</text>
    <text x="50" y="65" fontFamily="Arial" fontSize="6" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none" opacity="0.8">CLASSIFIED</text>
    <path d="M30 30L70 70M70 30L30 70" strokeWidth="1" opacity="0.4" />
  </svg>
);

const GameView: React.FC<GameViewProps> = ({ game, players, currentPlayer, onExit }) => {
  const [revealed, setRevealed] = useState(false);
  const [voting, setVoting] = useState(false);
  const [localMessage, setLocalMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sentThisTurn, setSentThisTurn] = useState(false);
  const [showRoundBanner, setShowRoundBanner] = useState(false);
  
  const [instructionKey, setInstructionKey] = useState(0);

  useEffect(() => {
    if (game.status === GameStatus.PLAYING) {
      setShowRoundBanner(true);
      const timer = setTimeout(() => setShowRoundBanner(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [game.status, game.round]);

  useEffect(() => {
    setInstructionKey(prev => prev + 1);
    
    if ((game.status === GameStatus.PLAYING || game.status === GameStatus.DEFENDING) && !currentPlayer.message) {
      setSentThisTurn(false);
    }
  }, [game.status, game.round, currentPlayer.message]);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const getMyWord = (): string => {
    if (currentPlayer.role === PlayerRole.CIVILIAN) return game.civilian_word || "未設定";
    if (currentPlayer.role === PlayerRole.UNDERCOVER) return game.undercover_word || "未設定";
    return "N/A";
  };

  const getWordStyle = (word: string) => {
    const len = word?.length || 0;
    if (len > 8) return 'text-2xl tracking-normal';
    if (len > 5) return 'text-4xl tracking-tight';
    return 'text-5xl tracking-wide';
  };

  const isSuspect = game.suspect_ids?.includes(currentPlayer.id) || false;

  const handleVote = async (targetId: string) => {
    if (!currentPlayer.is_alive || game.status !== GameStatus.VOTING || !supabase || voting) return;
    setVoting(true);
    try {
      await supabase!.from('players').update({ voted_for: targetId }).eq('id', currentPlayer.id);
    } finally {
      setVoting(false);
    }
  };

  const handleSubmitMessage = async () => {
    const msg = localMessage.trim();
    if (!msg || !supabase || sendingMessage) return;
    if (game.status === GameStatus.DEFENDING && !isSuspect) return;

    setSendingMessage(true);
    try {
      const { error } = await supabase!.from('players').update({ message: msg }).eq('id', currentPlayer.id);
      if (error) throw error;
      setSentThisTurn(true);
      setLocalMessage('');
    } catch (e: any) {
      console.error("Supabase Submission Error:", e);
      alert(`傳輸失敗！`);
    } finally {
      setSendingMessage(false);
    }
  };

  const togglePhase = async () => {
    if (!supabase) return;
    
    if (game.status === GameStatus.VOTING) {
      const votes: Record<string, number> = {};
      const eligibleVoters = players.filter(p => p.is_alive && (game.host_is_player || !p.is_host));
      eligibleVoters.forEach(p => { if (p.voted_for) votes[p.voted_for] = (votes[p.voted_for] || 0) + 1; });

      const voteValues = Object.values(votes);
      if (voteValues.length > 0) {
        const maxVotes = Math.max(...voteValues);
        const candidatesWithMax = Object.entries(votes).filter(([id, count]) => count === maxVotes);
        
        if (candidatesWithMax.length === 1) {
          const eliminatedId = candidatesWithMax[0][0];
          await supabase!.from('players').update({ is_alive: false }).eq('id', eliminatedId);
          
          const nextAlivePlayers = players.filter(p => p.id !== eliminatedId && p.is_alive && (game.host_is_player || !p.is_host));
          const undercoversCount = nextAlivePlayers.filter(p => p.role === PlayerRole.UNDERCOVER).length;
          
          const isCivilianWin = undercoversCount === 0;
          const isUndercoverWin = nextAlivePlayers.length <= 2 && undercoversCount > 0;

          if (isCivilianWin || isUndercoverWin) {
            setTimeout(async () => {
              await supabase!.from('games').update({ 
                status: GameStatus.FINISHED,
                winner_team: isCivilianWin ? 'civilian' : 'undercover'
              }).eq('id', game.id);
            }, 2500);
          } else {
            setTimeout(async () => {
              await supabase!.from('players').update({ voted_for: null, message: null }).eq('game_id', game.id);
              await supabase!.from('games').update({ 
                status: GameStatus.PLAYING, 
                suspect_ids: null, 
                round: game.round + 1 
              }).eq('id', game.id);
            }, 2000);
          }
          return;
        } else {
          const suspectIds = candidatesWithMax.map(([id]) => id);
          await supabase!.from('players').update({ voted_for: null, message: null }).eq('game_id', game.id);
          await supabase!.from('games').update({ 
            status: GameStatus.DEFENDING, 
            suspect_ids: suspectIds 
          }).eq('id', game.id);
          return;
        }
      }
      await supabase!.from('players').update({ voted_for: null, message: null }).eq('game_id', game.id);
      await supabase!.from('games').update({ status: GameStatus.PLAYING, round: game.round + 1 }).eq('id', game.id);
    } else {
      await supabase!.from('games').update({ status: GameStatus.VOTING }).eq('id', game.id);
    }
  };

  const handleResetWithMode = async (hostIsPlayer: boolean) => {
    if (!supabase || !currentPlayer.is_host) return;
    await supabase!.from('players').update({ 
      is_alive: true, 
      role: PlayerRole.UNKNOWN, 
      voted_for: null, 
      message: null 
    }).eq('id', currentPlayer.id);
    
    await supabase!.from('players').update({ 
      is_alive: true, 
      role: PlayerRole.UNKNOWN, 
      voted_for: null, 
      message: null 
    }).eq('game_id', game.id);

    await supabase!.from('games').update({ 
      status: GameStatus.LOBBY, 
      civilian_word: null, 
      undercover_word: null, 
      round: 0, 
      suspect_ids: null,
      winner_team: null,
      host_is_player: hostIsPlayer
    }).eq('id', game.id);
  };

  const handleTerminateMission = async () => {
    if (!supabase || !currentPlayer.is_host) return;
    if (confirm("確定要徹底終結此房間嗎？所有玩家將退回首頁。")) {
      await supabase!.from('players').delete().eq('game_id', game.id);
      await supabase!.from('games').delete().eq('id', game.id);
      onExit();
    }
  };

  const handleExitGame = async () => {
    if (!supabase) return;
    if (currentPlayer.is_host) {
      await handleTerminateMission();
    } else {
      if (confirm("確定要退出目前任務嗎？")) {
        await supabase!.from('players').delete().eq('id', currentPlayer.id);
        onExit();
      }
    }
  };

  const isSpectator = !game.host_is_player && currentPlayer.is_host;
  const alivePlayers = players.filter(p => p.is_alive && (game.host_is_player || !p.is_host));
  const isGameOver = game.status === GameStatus.FINISHED;
  const isCivilianWin = game.winner_team === 'civilian';

  const myMessageOnServer = (currentPlayer.message || '').trim().length > 0;
  
  const canSeeOthersMessages = 
    isSpectator || 
    sentThisTurn || 
    myMessageOnServer || 
    game.status === GameStatus.DEFENDING || 
    game.status === GameStatus.VOTING;

  const canIInput = !isSpectator && currentPlayer.is_alive && 
    (game.status === GameStatus.PLAYING || (game.status === GameStatus.DEFENDING && isSuspect));

  const TacticalCorners = ({ color = 'red' }) => (
    <>
      <div className={`absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 ${color === 'red' ? 'border-red-600' : color === 'cyan' ? 'border-cyan-500' : 'border-amber-500'} z-20`}></div>
      <div className={`absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 ${color === 'red' ? 'border-red-600' : color === 'cyan' ? 'border-cyan-500' : 'border-amber-500'} z-20`}></div>
      <div className={`absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 ${color === 'red' ? 'border-red-600' : color === 'cyan' ? 'border-cyan-500' : 'border-amber-500'} z-20`}></div>
      <div className={`absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 ${color === 'red' ? 'border-red-600' : color === 'cyan' ? 'border-cyan-500' : 'border-amber-500'} z-20`}></div>
    </>
  );

  const cardWord = isSpectator ? "MASTER" : getMyWord();
  const cardColor = isSpectator ? 'amber' : (currentPlayer.role === PlayerRole.UNDERCOVER ? 'red' : 'cyan');

  if (isGameOver) {
    return (
      <div className="glass p-10 rounded-lg text-center space-y-12 animate-in fade-in zoom-in duration-1000 max-w-2xl mx-auto border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)] relative overflow-hidden">
        <TacticalCorners color={isCivilianWin ? 'cyan' : 'red'} />
        <div className="space-y-4 relative z-10">
          <div className={`inline-block p-8 rounded-full mb-6 border-2 shadow-[0_0_60px_rgba(255,255,255,0.05)] ${isCivilianWin ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-red-600/10 border-red-600/30'}`}>
            <span className="text-8xl drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">{isCivilianWin ? '👮' : '🕵️'}</span>
          </div>
          <div className="space-y-2">
             <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.8em] animate-pulse">Operations Concluded</p>
             <h2 className={`text-7xl font-black tracking-tighter uppercase italic drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] ${isCivilianWin ? 'text-cyan-400' : 'text-red-600'}`}>
               {isCivilianWin ? 'Civilian Victory' : 'Undercover Victory'}
             </h2>
             <div className={`text-lg font-black uppercase tracking-[0.2em] mt-2 ${isCivilianWin ? 'text-cyan-600' : 'text-red-700'}`}>
               {isCivilianWin ? '平民獲得最終勝利' : '臥底已成功掌控局勢'}
             </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          <div className="bg-black/95 p-8 rounded-lg border border-white/10 shadow-inner group transition-all hover:border-cyan-500/60 hover:shadow-[0_0_20px_rgba(34,211,238,0.1)]">
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.6em] mb-3 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span> 平民詞彙
            </p>
            <p className="text-4xl font-black text-white group-hover:text-cyan-400 transition-colors drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{game.civilian_word}</p>
          </div>
          <div className="bg-black/95 p-8 rounded-lg border border-white/10 shadow-inner group transition-all hover:border-red-600/60 hover:shadow-[0_0_20px_rgba(220,38,38,0.1)]">
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.6em] mb-3 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span> 臥底詞彙
            </p>
            <p className="text-4xl font-black text-white group-hover:text-red-600 transition-colors drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{game.undercover_word}</p>
          </div>
        </div>

        <div className="bg-white/[0.03] p-6 rounded-lg border border-white/10 relative z-10">
           <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.6em] mb-5">Dossier Revealed 檔案揭露</p>
           <div className="flex flex-wrap justify-center gap-3">
             {players.filter(p => game.host_is_player || !p.is_host).map(p => (
               <div key={p.id} className={`px-4 py-2 rounded-md border text-xs font-black flex items-center gap-3 transition-all ${p.role === PlayerRole.UNDERCOVER ? 'bg-red-600/20 border-red-600/40 text-red-500 shadow-[0_0_15px_rgba(220,38,38,0.2)]' : 'bg-white/5 border-white/10 text-zinc-400'}`}>
                 <span className="text-lg">{p.role === PlayerRole.UNDERCOVER ? '🕵️' : '👤'}</span>
                 <div className="flex flex-col items-start">
                    <span className="text-white">{p.name}</span>
                    <span className="text-[8px] opacity-70 uppercase">{p.role === PlayerRole.UNDERCOVER ? 'Undercover' : 'Civilian'}</span>
                 </div>
               </div>
             ))}
           </div>
        </div>

        {currentPlayer.is_host ? (
          <div className="flex flex-col gap-4 w-full relative z-10">
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => handleResetWithMode(true)}
                className="bg-red-600 hover:bg-red-500 text-white py-6 rounded-lg font-black transition-all shadow-xl uppercase tracking-widest text-sm active:scale-95 flex flex-col items-center gap-1"
              >
                <span>潛伏對決</span>
                <span className="text-[8px] opacity-60 font-medium">房主加入遊玩</span>
              </button>
              <button 
                onClick={() => handleResetWithMode(false)}
                className="bg-amber-600 hover:bg-amber-500 text-white py-6 rounded-lg font-black transition-all shadow-xl uppercase tracking-widest text-sm active:scale-95 flex flex-col items-center gap-1"
              >
                <span>上帝視角</span>
                <span className="text-[8px] opacity-60 font-medium">房主觀戰模式</span>
              </button>
            </div>
            <button 
              onClick={handleTerminateMission}
              className="bg-white/5 border border-white/10 hover:bg-white/10 text-white py-4 rounded-lg font-black transition-all uppercase tracking-[0.4em] text-xs hover:text-red-500"
            >
              終結任務並退出房間
            </button>
          </div>
        ) : (
          <div className="text-zinc-500 text-xs font-black tracking-widest animate-pulse uppercase">
             Waiting for Commander's next directive...
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-1000 max-w-7xl mx-auto px-4 pb-20 relative">
      <button 
        onClick={handleExitGame}
        className="fixed top-4 right-4 z-[200] flex items-center gap-3 bg-black/60 backdrop-blur-md border border-white/10 hover:border-red-600/50 text-white px-5 py-2.5 rounded-full transition-all shadow-2xl hover:bg-red-950/20 active:scale-95 group"
        title="退出房間"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-zinc-400 group-hover:text-red-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-300 group-hover:text-white transition-colors">EXIT</span>
      </button>

      {showRoundBanner && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="bg-red-600 text-white px-20 py-10 rotate-[-5deg] shadow-[0_0_100px_rgba(220,38,38,0.6)] border-y-4 border-white animate-in zoom-in fade-in duration-300">
             <p className="text-[10px] font-black tracking-[1em] uppercase mb-2 opacity-80">Tactical Synchronization</p>
             <h2 className="text-6xl font-black italic tracking-tighter uppercase drop-shadow-lg">第 {game.round} 回合</h2>
             <p className="mt-4 font-black tracking-[0.4em] text-xs">COMMENCE DESCRIPTION</p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-black/90 backdrop-blur-md p-5 rounded-xl border border-white/15 shadow-[0_10px_40px_rgba(0,0,0,0.5)] relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-1.5 h-full ${game.status === GameStatus.DEFENDING ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse' : 'bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]'}`}></div>
        
        <div className="flex flex-col gap-1 w-full md:w-auto">
          <div className="flex items-center gap-6">
            <div className={`px-4 py-2 rounded-md font-black uppercase tracking-[0.1em] text-[11px] shadow-lg transition-all 
              ${game.status === GameStatus.PLAYING ? 'bg-red-600 text-white shadow-red-500/20' : 
                game.status === GameStatus.DEFENDING ? 'bg-amber-500 text-black shadow-amber-500/30' : 'bg-red-600 text-white animate-pulse shadow-red-500/40'}`}>
              {game.status === GameStatus.PLAYING ? `回合 ${game.round}: 情報描述階段` : 
               game.status === GameStatus.DEFENDING ? '偵測到數據衝突！' : '投票淘汰階段'}
            </div>
            <div className="text-left">
              <p className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.4em] mb-1">Current Directive</p>
              <p className="text-xs font-bold text-zinc-300 truncate">
                {game.status === GameStatus.PLAYING ? '觀察您的身分詞彙並進行隱晦描述' : 
                 game.status === GameStatus.VOTING ? '分析情報，投票找出潛伏的臥底' : '請嫌疑人為自己進行最終辯解'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
           {currentPlayer.is_host && (
             <button onClick={togglePhase} className="flex-1 md:flex-none bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-lg text-xs font-black uppercase tracking-[0.2em] border border-white/10 transition-all active:scale-95">
               {game.status === GameStatus.PLAYING ? '開始投票' : '結算投票'}
             </button>
           )}
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* 左側：遊戲互動區 */}
        <div className="lg:col-span-8 space-y-6 order-2 lg:order-1">
          {/* 輸入框 */}
          {(game.status === GameStatus.PLAYING || game.status === GameStatus.DEFENDING) && (
            <div className={`relative p-8 rounded-2xl border transition-all duration-500 overflow-hidden group
               ${canIInput ? 'bg-black/80 border-red-500/40 shadow-[0_0_50px_rgba(220,38,38,0.1)]' : 'bg-black/40 border-white/5 opacity-60 grayscale'}`}>
               
               {!canIInput && <div className="absolute inset-0 z-20 cursor-not-allowed bg-black/20"></div>}
               
               {/* Decorative Lines */}
               <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/20"></div>
               <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/20"></div>
               <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/20"></div>
               <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/20"></div>

               <div className="mb-6 flex justify-between items-end relative z-10">
                 <label className="text-[10px] font-black text-red-500 uppercase tracking-[0.4em] flex items-center gap-2">
                   <span className={`w-1.5 h-1.5 rounded-full ${canIInput ? 'bg-red-500 animate-pulse' : 'bg-zinc-700'}`}></span>
                   Secure Channel
                 </label>
                 <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">{currentPlayer.name} // TERMINAL_01</span>
               </div>
               
               {canSeeOthersMessages && hasSendMsg(currentPlayer) ? (
                  <div className="bg-white/[0.03] border border-white/10 p-6 rounded-xl text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                    <p className="text-2xl text-white font-black italic tracking-tight">"{currentPlayer.message}"</p>
                    <p className="text-[9px] text-zinc-500 mt-3 uppercase tracking-[0.3em] font-bold">Transmission Encrypted & Sent</p>
                  </div>
               ) : (
                  <div className="flex gap-4 relative z-10">
                    <input 
                      value={localMessage}
                      onChange={e => setLocalMessage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSubmitMessage()}
                      placeholder={game.status === GameStatus.DEFENDING ? "請輸入申冤內容..." : "輸入您的描述..."}
                      className="flex-1 bg-black border border-white/10 rounded-xl px-6 py-5 text-white outline-none focus:border-red-600/50 focus:shadow-[0_0_30px_rgba(220,38,38,0.1)] transition-all font-bold placeholder:text-zinc-700 placeholder:uppercase placeholder:text-xs placeholder:tracking-widest"
                    />
                    <button 
                      onClick={handleSubmitMessage}
                      disabled={sendingMessage || !localMessage.trim()}
                      className="bg-red-600 hover:bg-red-500 text-white px-10 rounded-xl font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95 text-xs"
                    >
                      Transmit
                    </button>
                  </div>
               )}
            </div>
          )}

          {/* 玩家列表 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {players.filter(p => game.host_is_player || !p.is_host).map(p => {
               const isMe = p.id === currentPlayer.id;
               const voteCount = players.filter(v => v.voted_for === p.id).length;
               const isSuspectTarget = game.suspect_ids?.includes(p.id);
               
               return (
                 <div 
                   key={p.id}
                   onClick={() => game.status === GameStatus.VOTING && p.is_alive && !isSpectator && handleVote(p.id)}
                   className={`relative p-5 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-4 overflow-hidden group
                     ${!p.is_alive ? 'opacity-30 grayscale bg-black border-transparent' : 
                       currentPlayer.voted_for === p.id ? 'border-red-600 bg-red-950/20 shadow-[0_0_30px_rgba(220,38,38,0.2)]' :
                       isSuspectTarget ? 'border-amber-500 bg-amber-950/20 shadow-[0_0_30px_rgba(245,158,11,0.2)]' :
                       'border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10'}
                     ${game.status === GameStatus.VOTING && p.is_alive && !isSpectator ? 'cursor-pointer' : ''}
                   `}
                 >
                   {isSuspectTarget && <div className="absolute top-0 inset-x-0 h-1 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>}
                   
                   <div className="relative">
                     <div className={`w-16 h-16 rounded-full flex items-center justify-center text-zinc-300 bg-[#0a0a0a] border border-white/10 shadow-2xl relative z-10 ${isMe ? 'ring-2 ring-white/20' : ''}`}>
                        <AgentIcon className="w-8 h-8" />
                     </div>
                     {game.status === GameStatus.VOTING && voteCount > 0 && (
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-black border-4 border-[#050505] shadow-lg z-20 animate-in zoom-in duration-300">
                          {voteCount}
                        </div>
                     )}
                   </div>
                   
                   <div className="text-center w-full z-10 space-y-3">
                      <p className={`text-sm font-black truncate px-2 ${isMe ? 'text-white' : 'text-zinc-400'}`}>{p.name}</p>
                      
                      <div className="h-auto min-h-[4rem] flex items-center justify-center w-full">
                         {p.is_alive ? (
                           hasSendMsg(p) ? (
                             canSeeOthersMessages ? (
                               <div className="w-full relative group/msg">
                                 <div className="absolute -inset-2 bg-white/5 rounded-lg opacity-0 group-hover/msg:opacity-100 transition-opacity"></div>
                                 <p className="text-xs font-bold text-zinc-300 italic leading-relaxed break-words relative z-10">"{p.message}"</p>
                               </div>
                             ) : (
                               <div className="flex flex-col items-center gap-1">
                                 <span className="text-[8px] font-black text-red-500 uppercase tracking-[0.2em] animate-pulse">Signal Locked</span>
                                 <div className="flex gap-0.5">
                                   <div className="w-1 h-1 bg-red-600 rounded-full animate-bounce [animation-delay:0ms]"></div>
                                   <div className="w-1 h-1 bg-red-600 rounded-full animate-bounce [animation-delay:150ms]"></div>
                                   <div className="w-1 h-1 bg-red-600 rounded-full animate-bounce [animation-delay:300ms]"></div>
                                 </div>
                               </div>
                             )
                           ) : (
                             <span className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">Waiting for input...</span>
                           )
                         ) : (
                           <span className="text-red-700 font-black text-[10px] uppercase tracking-widest border-2 border-red-900/30 px-3 py-1.5 rounded rotate-[-5deg]">Eliminated</span>
                         )}
                      </div>
                   </div>
                 </div>
               );
            })}
          </div>
        </div>

        {/* 右側：身分卡 (重寫版) */}
        <div className="lg:col-span-4 order-1 lg:order-2">
          <div className="sticky top-24 space-y-8">
            {/* 3D Flip Card Container */}
            <div 
              className="group perspective-[1200px] w-full max-w-sm mx-auto aspect-[3/4.5] cursor-pointer select-none" 
              onClick={() => setRevealed(!revealed)}
            >
              <div 
                className="relative w-full h-full transition-all duration-700 preserve-3d"
                style={{ transform: revealed ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
              >
                
                {/* BACK FACE (Cover) - Visible initially (0deg) */}
                <div 
                  className="absolute inset-0 backface-hidden bg-[#0a0a0a] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col items-center justify-center p-6"
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                >
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px'}}></div>
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
                    
                    {/* Border Decoration */}
                    <div className="absolute inset-3 border border-white/5 rounded-2xl opacity-50"></div>
                    <div className="absolute inset-4 border border-white/5 rounded-xl opacity-30"></div>

                    {/* Stamp */}
                    <div className="relative transform -rotate-12 opacity-90 scale-110">
                        <div className="absolute inset-0 bg-red-600/20 blur-2xl rounded-full animate-pulse"></div>
                        <SecretStampIcon className="w-48 h-48 text-red-600" />
                    </div>

                    <div className="absolute bottom-12 text-center space-y-2 z-10">
                        <h3 className="text-3xl font-black text-white/20 tracking-[0.2em] uppercase">Confidential</h3>
                        <div className="h-[1px] w-24 bg-white/10 mx-auto"></div>
                        <p className="text-[9px] text-red-700 font-black tracking-[0.6em] uppercase">Eyes Only</p>
                    </div>

                    <div className="absolute bottom-6 text-[7px] text-white/10 font-mono tracking-widest uppercase">
                        Department of Defense // Level 5 Clearance
                    </div>
                </div>

                {/* FRONT FACE (Info) - Visible when flipped (180deg) */}
                <div 
                  className="absolute inset-0 backface-hidden bg-[#080808] rounded-3xl border border-white/20 shadow-2xl overflow-hidden flex flex-col"
                  style={{ 
                    transform: 'rotateY(180deg)', 
                    backfaceVisibility: 'hidden', 
                    WebkitBackfaceVisibility: 'hidden' 
                  }}
                >
                   <div className={`absolute top-0 inset-x-0 h-1.5 ${cardColor === 'red' ? 'bg-red-600' : cardColor === 'cyan' ? 'bg-cyan-400' : 'bg-amber-500'} shadow-[0_0_20px_currentColor]`}></div>
                   <TacticalCorners color={cardColor} />
                   
                   {/* Top Info */}
                   <div className="pt-12 pb-4 text-center space-y-3 relative z-10 px-6">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                        <span className={`w-1.5 h-1.5 rounded-full ${cardColor === 'red' ? 'bg-red-500' : cardColor === 'cyan' ? 'bg-cyan-400' : 'bg-amber-500'} animate-pulse`}></span>
                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-[0.3em]">Identity Verified</p>
                      </div>
                      <h2 className="text-3xl font-black text-white uppercase tracking-wider drop-shadow-lg">{currentPlayer.name}</h2>
                   </div>

                   {/* Center Word */}
                   <div className="flex-1 flex flex-col items-center justify-center relative p-8">
                      <div className="absolute inset-6 bg-white/[0.02] rounded-2xl border border-white/5"></div>
                      <div className={`relative z-10 text-center transition-all duration-1000 delay-300 ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                         <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.5em] mb-6">Assigned Codeword</p>
                         <p className={`font-black break-words leading-none drop-shadow-2xl ${getWordStyle(cardWord)} ${cardColor === 'red' ? 'text-red-500' : cardColor === 'cyan' ? 'text-cyan-400' : 'text-amber-500'}`}>
                            {cardWord}
                         </p>
                      </div>
                   </div>

                   {/* Bottom Role */}
                   <div className="pb-12 pt-4 text-center relative z-10 px-8">
                      <div className={`block w-full py-4 rounded-xl border-2 font-black text-sm uppercase tracking-[0.4em] shadow-lg transition-all
                         ${cardColor === 'red' ? 'border-red-900/40 bg-red-900/10 text-red-500 shadow-red-900/20' : 
                           cardColor === 'cyan' ? 'border-cyan-900/40 bg-cyan-900/10 text-cyan-400 shadow-cyan-900/20' : 
                           'border-amber-900/40 bg-amber-900/10 text-amber-500 shadow-amber-900/20'}
                      `}>
                         {isSpectator ? "指揮官" : (currentPlayer.role === PlayerRole.UNDERCOVER ? "臥底" : "平民")}
                      </div>
                   </div>
                </div>

              </div>
            </div>
            
            <div className="text-center">
               <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/5">
                 <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.3em] animate-pulse">
                    {revealed ? "Click to conceal intel" : "Click to reveal intel"}
                 </p>
               </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
      `}</style>
    </div>
  );
};

function hasSendMsg(p: Player) {
  return p.message && p.message.trim().length > 0;
}

export default GameView;