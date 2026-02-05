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
  const [localMessage, setLocalMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sentThisTurn, setSentThisTurn] = useState(false);
  const [showRoundBanner, setShowRoundBanner] = useState(false);

  // 當狀態變回 PLAYING 時顯示回合 Banner
  useEffect(() => {
    if (game.status === GameStatus.PLAYING) {
      setShowRoundBanner(true);
      const timer = setTimeout(() => setShowRoundBanner(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [game.status, game.round]);

  useEffect(() => {
    if ((game.status === GameStatus.PLAYING || game.status === GameStatus.DEFENDING) && !currentPlayer.message) {
      setSentThisTurn(false);
    }
  }, [game.status, currentPlayer.message]);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  const getMyWord = () => {
    if (currentPlayer.role === PlayerRole.CIVILIAN) return game.civilian_word;
    if (currentPlayer.role === PlayerRole.UNDERCOVER) return game.undercover_word;
    return "N/A";
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
          
          // 1. 先標記淘汰 (全體玩家會立即看到頭像被蓋上 Eliminated 印章)
          await supabase!.from('players').update({ is_alive: false }).eq('id', eliminatedId);
          
          // 2. 判斷勝負 (手動計算最新的存活狀況)
          const nextAlivePlayers = players.filter(p => p.id !== eliminatedId && p.is_alive && (game.host_is_player || !p.is_host));
          const undercoversCount = nextAlivePlayers.filter(p => p.role === PlayerRole.UNDERCOVER).length;
          
          const isCivilianWin = undercoversCount === 0;
          const isUndercoverWin = nextAlivePlayers.length <= 2 && undercoversCount > 0;

          if (isCivilianWin || isUndercoverWin) {
            // 重要：延遲 2.5 秒，讓大家看完淘汰特效，心理有個底，再揭曉大結局
            setTimeout(async () => {
              await supabase!.from('games').update({ 
                status: GameStatus.FINISHED,
                winner_team: isCivilianWin ? 'civilian' : 'undercover'
              }).eq('id', game.id);
            }, 2500);
          } else {
            // 沒有結束，也要延遲一下再回描述階段，畫面才不會太跳
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
          // 平票
          const suspectIds = candidatesWithMax.map(([id]) => id);
          await supabase!.from('players').update({ voted_for: null, message: null }).eq('game_id', game.id);
          await supabase!.from('games').update({ 
            status: GameStatus.DEFENDING, 
            suspect_ids: suspectIds 
          }).eq('id', game.id);
          return;
        }
      }
      // 無人投票
      await supabase!.from('players').update({ voted_for: null, message: null }).eq('game_id', game.id);
      await supabase!.from('games').update({ status: GameStatus.PLAYING, round: game.round + 1 }).eq('id', game.id);
    } else {
      await supabase!.from('games').update({ status: GameStatus.VOTING }).eq('id', game.id);
    }
  };

  const resetGame = async () => {
    if (!supabase || !currentPlayer.is_host) return;
    await supabase!.from('players').update({ is_alive: true, role: PlayerRole.UNKNOWN, voted_for: null, message: null }).eq('game_id', game.id);
    await supabase!.from('games').update({ 
      status: GameStatus.LOBBY, 
      civilian_word: null, 
      undercover_word: null, 
      round: 0, 
      suspect_ids: null,
      winner_team: null 
    }).eq('id', game.id);
  };

  const isSpectator = !game.host_is_player && currentPlayer.is_host;
  const alivePlayers = players.filter(p => p.is_alive && (game.host_is_player || !p.is_host));
  const isGameOver = game.status === GameStatus.FINISHED;
  const isCivilianWin = game.winner_team === 'civilian';

  const myMessageOnServer = (currentPlayer.message || '').trim().length > 0;
  const canSeeOthersMessages = isSpectator || sentThisTurn || myMessageOnServer;
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

  if (isGameOver) {
    return (
      <div className="glass p-10 rounded-lg text-center space-y-12 animate-in fade-in zoom-in duration-1000 max-w-2xl mx-auto border-white/5 shadow-2xl relative overflow-hidden">
        <TacticalCorners color={isCivilianWin ? 'cyan' : 'red'} />
        <div className="space-y-4 relative z-10">
          <div className={`inline-block p-8 rounded-full mb-6 border-2 shadow-[0_0_50px_rgba(255,255,255,0.1)] ${isCivilianWin ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-red-600/10 border-red-600/30'}`}>
            <span className="text-8xl drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">{isCivilianWin ? '👮' : '🕵️'}</span>
          </div>
          <div className="space-y-2">
             <p className="text-[11px] font-black text-gray-500 uppercase tracking-[0.8em] animate-pulse">Operations Concluded</p>
             <h2 className={`text-7xl font-black tracking-tighter uppercase italic drop-shadow-lg ${isCivilianWin ? 'text-cyan-400' : 'text-red-600'}`}>
               {isCivilianWin ? 'Civilian Victory' : 'Undercover Victory'}
             </h2>
             <div className={`text-lg font-black uppercase tracking-[0.2em] mt-2 ${isCivilianWin ? 'text-cyan-700' : 'text-red-700'}`}>
               {isCivilianWin ? '平民獲得最終勝利' : '臥底已成功掌控局勢'}
             </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          <div className="bg-black/90 p-8 rounded-lg border border-white/10 shadow-inner group transition-all hover:border-cyan-500/40">
            <p className="text-[10px] text-gray-700 font-black uppercase tracking-[0.6em] mb-3 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span> 平民詞彙
            </p>
            <p className="text-4xl font-black text-white group-hover:text-cyan-400 transition-colors drop-shadow-sm">{game.civilian_word}</p>
          </div>
          <div className="bg-black/90 p-8 rounded-lg border border-white/10 shadow-inner group transition-all hover:border-red-600/40">
            <p className="text-[10px] text-gray-700 font-black uppercase tracking-[0.6em] mb-3 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span> 臥底詞彙
            </p>
            <p className="text-4xl font-black text-white group-hover:text-red-600 transition-colors drop-shadow-sm">{game.undercover_word}</p>
          </div>
        </div>

        <div className="bg-white/[0.02] p-6 rounded-lg border border-white/5 relative z-10">
           <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.6em] mb-5">Dossier Revealed 檔案揭露</p>
           <div className="flex flex-wrap justify-center gap-3">
             {players.filter(p => game.host_is_player || !p.is_host).map(p => (
               <div key={p.id} className={`px-4 py-2 rounded-md border text-xs font-black flex items-center gap-3 transition-all ${p.role === PlayerRole.UNDERCOVER ? 'bg-red-600/20 border-red-600/40 text-red-500 shadow-[0_0_15px_rgba(220,38,38,0.1)]' : 'bg-white/5 border-white/10 text-zinc-500'}`}>
                 <span className="text-lg">{p.role === PlayerRole.UNDERCOVER ? '🕵️' : '👤'}</span>
                 <div className="flex flex-col items-start">
                    <span className="text-white">{p.name}</span>
                    <span className="text-[8px] opacity-60 uppercase">{p.role === PlayerRole.UNDERCOVER ? 'Undercover' : 'Civilian'}</span>
                 </div>
               </div>
             ))}
           </div>
        </div>

        {currentPlayer.is_host && (
          <button onClick={resetGame} className="w-full bg-white text-black py-7 rounded-lg font-black transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] uppercase tracking-[0.4em] text-xl hover:scale-[1.03] active:scale-95 relative z-10 hover:bg-zinc-100">
            Confirm & Exit Debrief
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-1000 max-w-7xl mx-auto px-4 pb-20 relative">
      {showRoundBanner && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="bg-red-600 text-white px-20 py-10 rotate-[-5deg] shadow-[0_0_100px_rgba(220,38,38,0.5)] border-y-4 border-white animate-in zoom-in fade-in duration-300">
             <p className="text-[10px] font-black tracking-[1em] uppercase mb-2 opacity-70">Tactical Synchronization</p>
             <h2 className="text-6xl font-black italic tracking-tighter uppercase">Round {game.round}</h2>
             <p className="mt-4 font-black tracking-[0.4em] text-xs">COMMENCE DESCRIPTION</p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-black p-4 rounded-xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-1 h-full ${game.status === GameStatus.DEFENDING ? 'bg-amber-500 animate-pulse' : 'bg-red-600'}`}></div>
        <div className="flex items-center gap-6">
          <div className={`px-3 py-1.5 rounded-md font-black uppercase tracking-[0.2em] text-[8px] shadow-2xl transition-all 
            ${game.status === GameStatus.PLAYING ? 'bg-red-600 text-white' : 
              game.status === GameStatus.DEFENDING ? 'bg-amber-500 text-black' : 'bg-red-600 text-white animate-pulse'}`}>
            {game.status === GameStatus.PLAYING ? `Round ${game.round}: Intel Discussion` : 
             game.status === GameStatus.DEFENDING ? 'TIE DETECTED: Defense Phase' : 'Elimination Vote'}
          </div>
          <div className="text-left">
            <p className="text-[7px] text-gray-700 font-black uppercase tracking-[0.4em]">Active Squad</p>
            <p className="text-white font-black text-xl leading-none">{alivePlayers.length} / {players.filter(p => game.host_is_player || !p.is_host).length}</p>
          </div>
        </div>
        {currentPlayer.is_host && (
          <button onClick={togglePhase} className="w-full md:w-auto bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-lg font-black uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 shadow-xl shadow-red-900/40 text-[10px]">
            {game.status === GameStatus.PLAYING ? 'Execute Vote' : 
             game.status === GameStatus.DEFENDING ? 'Re-start Voting' : 'Confirm Elimination'}
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {(game.status === GameStatus.PLAYING || game.status === GameStatus.DEFENDING) && (
            <div className={`glass p-5 rounded-lg border-2 transition-all 
              ${!canIInput ? 'border-zinc-800 opacity-50 grayscale' : 'border-red-600/30 shadow-[0_0_30px_rgba(220,38,38,0.1)]'}`}>
              <label className="text-[8px] font-black text-gray-500 uppercase tracking-[0.3em] mb-2 block">
                {game.status === GameStatus.DEFENDING ? 'Defense Transmission' : 'Transmission Input'}
              </label>
              
              {!canIInput ? (
                <div className="py-2 text-zinc-500 italic text-sm flex items-center gap-3">
                   <span className="bg-zinc-800 border border-white/5 px-4 py-2 rounded inline-block text-xs uppercase tracking-widest">
                      {game.status === GameStatus.DEFENDING ? (isSpectator ? "Waiting for Suspects..." : "You are safe. Listening...") : "Intel Sync in Progress..."}
                   </span>
                </div>
              ) : canSeeOthersMessages ? (
                 <div className="py-2 text-red-500 font-bold italic text-sm">
                   <span className="bg-red-600/10 border border-red-600/20 px-4 py-2 rounded inline-block animate-[flash_0.6s_ease-out] text-base md:text-lg">
                      {currentPlayer.message || 'Intel Data Sent'}
                   </span>
                 </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={localMessage}
                    onChange={(e) => setLocalMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitMessage()}
                    placeholder={game.status === GameStatus.DEFENDING ? "請為自己申冤描述..." : "請輸入你的描述..."}
                    className="flex-1 bg-black border border-white/5 rounded-md px-4 py-2.5 outline-none text-white font-bold transition-all focus:border-red-600/50 text-sm"
                  />
                  <button
                    onClick={handleSubmitMessage}
                    disabled={sendingMessage || !localMessage.trim()}
                    className="bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-md font-black uppercase tracking-widest transition-all disabled:opacity-20 text-[10px] shrink-0 shadow-lg"
                  >
                    {sendingMessage ? 'Wait...' : 'Send Intel'}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {players.filter(p => game.host_is_player || !p.is_host).map((p) => {
              const voteCount = players.filter(v => v.voted_for === p.id).length;
              const isVotedByMe = currentPlayer.voted_for === p.id;
              const hasSent = (p.message || '').trim().length > 0;
              const isSuspected = game.suspect_ids?.includes(p.id) || false;

              return (
                <div 
                  key={p.id} 
                  onClick={() => game.status === GameStatus.VOTING && p.is_alive && !isSpectator && handleVote(p.id)}
                  className={`group relative overflow-hidden p-6 rounded-md border-2 transition-all duration-300 flex flex-col items-center gap-4
                    ${!p.is_alive ? 'opacity-20 grayscale border-transparent bg-black/40 cursor-not-allowed' : 
                      isVotedByMe ? 'border-red-600 bg-red-600/10 scale-95 shadow-2xl' : 
                      isSuspected ? 'border-amber-600 bg-amber-600/10 shadow-[0_0_30px_rgba(245,158,11,0.2)]' :
                      game.status === GameStatus.VOTING && !isSpectator ? 'border-white/10 bg-white/5 hover:border-red-600/50 cursor-pointer shadow-lg' : 
                      (p.id === currentPlayer.id ? 'border-red-600/20 bg-red-600/5' : 'border-white/5 bg-white/5')}
                  `}
                >
                  {isSuspected && p.is_alive && (
                    <div className="absolute top-0 left-0 w-full bg-amber-600 text-black text-[7px] font-black uppercase tracking-[0.4em] py-0.5 text-center shadow-lg animate-pulse">
                      High Suspect
                    </div>
                  )}

                  <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-xl md:text-2xl font-black transition-all shadow-inner 
                    ${p.id === currentPlayer.id ? 'bg-red-600 text-white shadow-red-900/40' : 
                      isSuspected ? 'bg-amber-600 text-black' : 'bg-zinc-800 text-zinc-500'}
                  `}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-center w-full space-y-2">
                    <p className="text-white font-black text-sm md:text-base leading-tight truncate px-1 uppercase tracking-wider">{p.name}</p>
                    <div className="h-16 flex items-center justify-center w-full">
                      {p.is_alive ? (
                        hasSent ? (
                          canSeeOthersMessages ? (
                            <div className="bg-white/5 border border-white/20 rounded-md px-3 py-2 w-full animate-[flash_0.8s_ease-out] shadow-inner">
                               <p className="text-sm md:text-base text-gray-100 font-black leading-tight break-words text-center">
                                 {p.message}
                               </p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1.5">
                              <div className="text-[7px] font-black text-red-600 uppercase tracking-widest animate-pulse">Encoded Intel</div>
                              <div className="w-12 h-1 bg-red-600/20 rounded-full overflow-hidden relative">
                                <div className="absolute inset-0 bg-red-600 animate-[loading_1s_infinite]"></div>
                              </div>
                            </div>
                          )
                        ) : (
                          <p className="text-[7px] text-zinc-700 font-black uppercase tracking-[0.2em]">Transmission...</p>
                        )
                      ) : (
                        <span className="text-[7px] font-black text-zinc-800 uppercase tracking-widest">Off-line</span>
                      )}
                    </div>
                  </div>
                  {game.status === GameStatus.VOTING && p.is_alive && voteCount > 0 && (
                    <div className="absolute top-2 right-2 bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-2xl border-2 border-black">{voteCount}</div>
                  )}
                  {!p.is_alive && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30 animate-in fade-in zoom-in duration-300">
                      <div className="bg-red-700 text-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] rotate-[-15deg] shadow-[0_0_30px_rgba(220,38,38,1)] border-2 border-red-500 scale-125">
                        Eliminated
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="p-1 rounded-lg border-2 border-red-600/40 bg-zinc-950 shadow-[0_0_60px_rgba(220,38,38,0.25)] relative group overflow-hidden">
            <div 
              onClick={() => setRevealed(!revealed)} 
              className={`aspect-[3/5] w-full max-w-[340px] mx-auto rounded-lg cursor-pointer transition-all duration-1000 relative preserve-3d ${revealed ? '[transform:rotateY(180deg)]' : ''}`}
            >
              <div className="absolute inset-0 bg-[#080808] rounded-lg flex flex-col items-center justify-center border border-white/5 backface-hidden overflow-hidden px-10">
                <TacticalCorners color="red" />
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '16px 16px'}}></div>
                <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mb-8 border border-red-600/20 shadow-[0_0_40px_rgba(220,38,38,0.4)]">
                  <span className="text-6xl drop-shadow-[0_0_15px_rgba(220,38,38,0.6)]">🕵️</span>
                </div>
                <span className="text-[10px] font-black text-white/40 tracking-[0.8em] uppercase mb-2">Access Card</span>
                <span className="text-[8px] font-bold text-gray-800 uppercase tracking-widest text-center leading-relaxed">BIOMETRIC IDENTIFICATION REQ.<br/>LEVEL 4 CLEARANCE</span>
              </div>
              
              <div className="absolute inset-0 bg-[#0a0a0a] rounded-lg [transform:rotateY(180deg)] backface-hidden flex flex-col items-center px-6 py-12 justify-between overflow-hidden border border-white/10 shadow-inner">
                <TacticalCorners color={isSpectator ? 'amber' : (currentPlayer.role === PlayerRole.UNDERCOVER ? 'red' : 'cyan')} />
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{backgroundImage: 'linear-gradient(45deg, #fff 1px, transparent 1px), linear-gradient(-45deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
                
                <div className="w-full text-center">
                   <div className="text-[9px] font-black text-gray-700 uppercase tracking-[0.6em] mb-3">Authorization Data</div>
                   <h2 className={`text-xl font-black uppercase tracking-tighter leading-none flex items-center justify-center gap-3 ${isSpectator ? 'text-amber-500' : 'text-red-600'}`}>
                     <span className={`w-2 h-2 rounded-full ${isSpectator ? 'bg-amber-500' : 'bg-red-600'} animate-pulse`}></span>
                     {isSpectator ? 'Overseer' : 'Hidden Agenda'}
                   </h2>
                </div>
                
                <div className="w-full space-y-2 text-center bg-white/[0.03] py-5 rounded-md border border-white/5 shadow-inner">
                   <p className="text-[8px] text-gray-700 font-bold uppercase tracking-[0.6em]">Profile Metadata</p>
                   <p className="text-2xl font-black text-white leading-none tracking-tight uppercase">{currentPlayer.name}</p>
                </div>

                <div className="w-full text-center">
                   <p className="text-[8px] text-gray-700 font-bold uppercase tracking-[0.6em] mb-4">Designated Intel</p>
                   <div className="bg-black border border-red-900/40 rounded-md py-7 flex items-center justify-center shadow-[inset_0_0_30px_rgba(220,38,38,0.2)] mx-1 relative">
                      <span className={`text-4xl font-black tracking-[0.15em] drop-shadow-[0_0_15px_rgba(251,191,36,0.4)] ${isSpectator ? 'text-amber-500' : 'text-white'}`}>
                        {isSpectator ? "MASTER" : getMyWord()}
                      </span>
                   </div>
                </div>

                <div className="w-full text-center">
                   <div className="space-y-1">
                     <p className="text-[8px] text-gray-700 font-bold uppercase tracking-[0.6em] mb-3">Security Clearance</p>
                     <p className={`font-black text-2xl tracking-[0.05em] uppercase leading-none ${isSpectator ? 'text-amber-500' : (currentPlayer.role === PlayerRole.UNDERCOVER ? 'text-red-600' : 'text-cyan-400')}`}>
                        {isSpectator ? "Observer" : (currentPlayer.role === PlayerRole.UNDERCOVER ? "Undercover" : "Civilian")}
                     </p>
                     {/* 修正後的中文標籤：平民、臥底 */}
                     <div className={`text-[13px] font-black mt-4 inline-block px-6 py-2 rounded-sm border ${isSpectator ? 'text-amber-500 border-amber-500/30 bg-amber-500/10' : (currentPlayer.role === PlayerRole.UNDERCOVER ? 'text-red-600 border-red-600/30 bg-red-600/10' : 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10')}`}>
                        {isSpectator ? "上帝視角" : (currentPlayer.role === PlayerRole.UNDERCOVER ? "臥底" : "平民")}
                     </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-black border border-white/5 p-4 rounded-lg shadow-2xl relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${isSpectator ? 'bg-amber-600' : (currentPlayer.role === PlayerRole.UNDERCOVER ? 'bg-red-600' : 'bg-cyan-600')}`}></div>
            <h4 className="text-white font-black text-[8px] uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
              <span className={`${isSpectator ? 'text-amber-500' : 'text-red-600'} animate-pulse`}>●</span> Operation Directive
            </h4>
            <p className="text-[10px] text-gray-500 leading-relaxed font-medium italic">
              {game.status === GameStatus.DEFENDING ? "平票警告。嫌疑人正進行最終申冤。" : 
               canSeeOthersMessages ? "通訊解碼中。請分析各特務證言，識破潛伏者。" : "通訊鎖定中。請輸入描述以啟動解碼程序。"}
            </p>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes flash {
          0% { opacity: 0; filter: brightness(3); transform: scale(1.05); box-shadow: 0 0 40px rgba(220,38,38,0.5); }
          20% { opacity: 1; filter: brightness(1.8); }
          100% { opacity: 1; filter: brightness(1); transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default GameView;
