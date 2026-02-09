import React, { useState, useEffect } from 'react';
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

const SecretStampIcon = ({ className = "w-24 h-24" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className={className}>
    <circle cx="12" cy="12" r="10" strokeDasharray="4 2" />
    <path d="M7 12h10M12 7v10" strokeWidth="0.5" opacity="0.5" />
    <path d="M12 2a10 10 0 0 1 10 10M2 12a10 10 0 0 1 10-10" strokeWidth="2" strokeLinecap="round" />
    <text x="12" y="16" fontSize="3" textAnchor="middle" fill="currentColor" fontWeight="bold" stroke="none">CLASSIFIED</text>
    <path d="M9 9l6 6M15 9l-6 6" strokeWidth="2" />
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

  // 遊戲狀態與回合提示
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

  // 初始自動翻牌 (保留動畫)
  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const getMyWord = (): string => {
    if (currentPlayer.role === PlayerRole.CIVILIAN) return game.civilian_word || "未設定";
    if (currentPlayer.role === PlayerRole.UNDERCOVER) return game.undercover_word || "未設定";
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
    await supabase!.from('players').update({ is_alive: true, role: PlayerRole.UNKNOWN, voted_for: null, message: null }).eq('game_id', game.id);
    await supabase!.from('games').update({ 
      status: GameStatus.LOBBY, civilian_word: null, undercover_word: null, round: 0, suspect_ids: null, winner_team: null, host_is_player: hostIsPlayer
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

  const isSpectator = !game.host_is_player && currentPlayer.is_host;
  const alivePlayers = players.filter(p => p.is_alive && (game.host_is_player || !p.is_host));
  const isGameOver = game.status === GameStatus.FINISHED;
  const isCivilianWin = game.winner_team === 'civilian';
  const myMessageOnServer = (currentPlayer.message || '').trim().length > 0;
  
  const canSeeOthersMessages = isSpectator || sentThisTurn || myMessageOnServer || 
    game.status === GameStatus.DEFENDING || game.status === GameStatus.VOTING;

  const canIInput = !isSpectator && currentPlayer.is_alive && 
    (game.status === GameStatus.PLAYING || (game.status === GameStatus.DEFENDING && isSuspect));

  const cardWord = isSpectator ? "GM Mode" : getMyWord();
  const cardColor = isSpectator ? 'amber' : (currentPlayer.role === PlayerRole.UNDERCOVER ? 'red' : 'cyan');

  // --- UI Components ---
  const TacticalCorners = ({ color }: { color: string }) => {
    const borderColor = color === 'red' ? 'border-red-600' : color === 'cyan' ? 'border-cyan-400' : 'border-amber-500';
    return (
      <>
        <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 ${borderColor}`}></div>
        <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 ${borderColor}`}></div>
        <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 ${borderColor}`}></div>
        <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 ${borderColor}`}></div>
      </>
    );
  };

  if (isGameOver) {
    return (
      <div className="glass p-8 md:p-12 rounded-3xl text-center space-y-10 animate-in fade-in zoom-in duration-700 max-w-4xl mx-auto border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-transparent to-black/80 pointer-events-none"></div>
        <div className="relative z-10 space-y-6">
          <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full border-4 shadow-[0_0_50px_rgba(0,0,0,0.5)] ${isCivilianWin ? 'bg-cyan-900/20 border-cyan-500 text-cyan-400' : 'bg-red-900/20 border-red-600 text-red-600'}`}>
            <span className="text-6xl">{isCivilianWin ? '👮' : '🕵️'}</span>
          </div>
          <div className="space-y-2">
             <p className="text-xs font-black text-zinc-500 uppercase tracking-[0.5em]">Mission Debrief</p>
             <h2 className={`text-6xl md:text-8xl font-black italic uppercase tracking-tighter drop-shadow-lg ${isCivilianWin ? 'text-cyan-400' : 'text-red-600'}`}>
               {isCivilianWin ? 'Civilian Win' : 'Undercover Win'}
             </h2>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          <div className="bg-white/5 p-8 rounded-2xl border border-white/10 flex flex-col items-center gap-4">
             <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">平民詞彙</span>
             <span className="text-4xl font-black text-white">{game.civilian_word}</span>
          </div>
          <div className="bg-white/5 p-8 rounded-2xl border border-white/10 flex flex-col items-center gap-4">
             <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">臥底詞彙</span>
             <span className="text-4xl font-black text-red-500">{game.undercover_word}</span>
          </div>
        </div>

        {currentPlayer.is_host ? (
          <div className="flex flex-col gap-4 relative z-10 max-w-md mx-auto w-full">
            <div className="grid grid-cols-2 gap-4">
               <button onClick={() => handleResetWithMode(true)} className="bg-red-600 hover:bg-red-500 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg">再來一局</button>
               <button onClick={() => handleResetWithMode(false)} className="bg-amber-600 hover:bg-amber-500 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg">轉為觀戰</button>
            </div>
            <button onClick={handleTerminateMission} className="text-zinc-500 hover:text-white py-2 text-xs font-black uppercase tracking-[0.2em]">關閉房間</button>
          </div>
        ) : (
          <div className="text-zinc-500 font-bold uppercase tracking-widest animate-pulse relative z-10">等待房主決定...</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 pb-20 relative animate-in fade-in duration-700">
      {/* 頂部控制與狀態列 */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-black/80 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-xl sticky top-4 z-40">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className={`px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest shadow-lg ${game.status === GameStatus.PLAYING ? 'bg-red-600 text-white' : 'bg-amber-500 text-black'}`}>
            {game.status === GameStatus.PLAYING ? `Round ${game.round}` : game.status === GameStatus.DEFENDING ? 'Defending' : 'Voting'}
          </div>
          <p className="text-xs font-bold text-zinc-400 truncate flex-1">
             {game.status === GameStatus.PLAYING ? '請觀察並描述您的詞彙' : game.status === GameStatus.VOTING ? '請找出臥底並投票' : '平票！請嫌疑人申冤'}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
           {currentPlayer.is_host && (
             <button onClick={togglePhase} className="flex-1 md:flex-none bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest border border-white/10 transition-all">
               {game.status === GameStatus.PLAYING ? '開始投票' : '結算投票'}
             </button>
           )}
           <button onClick={() => currentPlayer.is_host ? handleTerminateMission() : onExit()} className="bg-red-950/30 hover:bg-red-900/50 text-red-500 px-4 py-2 rounded-lg text-xs font-black uppercase border border-red-900/30 transition-all">
             Exit
           </button>
        </div>
      </div>

      {showRoundBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-red-600 text-white px-16 py-8 rotate-[-3deg] shadow-2xl animate-in zoom-in fade-in duration-300 border-y-4 border-black">
             <h2 className="text-5xl font-black italic tracking-tighter uppercase">Round {game.round}</h2>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* 左側：遊戲互動區 */}
        <div className="lg:col-span-8 space-y-6 order-2 lg:order-1">
          {/* 輸入框 */}
          {(game.status === GameStatus.PLAYING || game.status === GameStatus.DEFENDING) && (
            <div className={`relative p-6 rounded-2xl border transition-all duration-300 ${canIInput ? 'bg-black/40 border-red-500/50 shadow-[0_0_30px_rgba(220,38,38,0.1)]' : 'bg-black/20 border-white/5 opacity-50'}`}>
               {!canIInput && <div className="absolute inset-0 z-10 cursor-not-allowed"></div>}
               <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 block">Encryption Channel</label>
               
               {canSeeOthersMessages && hasSendMsg(currentPlayer) ? (
                  <div className="bg-white/5 border border-white/10 p-4 rounded-xl text-center">
                    <p className="text-xl text-white font-bold italic">"{currentPlayer.message}"</p>
                    <p className="text-[10px] text-zinc-500 mt-2 uppercase tracking-widest">Transmission Sent</p>
                  </div>
               ) : (
                  <div className="flex gap-3">
                    <input 
                      value={localMessage}
                      onChange={e => setLocalMessage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSubmitMessage()}
                      placeholder={game.status === GameStatus.DEFENDING ? "請輸入申冤內容..." : "請輸入您的描述..."}
                      className="flex-1 bg-black/50 border border-white/10 rounded-xl px-5 py-4 text-white outline-none focus:border-red-500 transition-all font-bold placeholder:text-zinc-700"
                    />
                    <button 
                      onClick={handleSubmitMessage}
                      disabled={sendingMessage || !localMessage.trim()}
                      className="bg-red-600 hover:bg-red-500 text-white px-8 rounded-xl font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                    >
                      Send
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
                   className={`relative p-4 rounded-xl border-2 transition-all duration-300 flex flex-col items-center gap-3 overflow-hidden
                     ${!p.is_alive ? 'opacity-40 grayscale bg-black border-transparent' : 
                       currentPlayer.voted_for === p.id ? 'border-red-600 bg-red-600/10' :
                       isSuspectTarget ? 'border-amber-500 bg-amber-500/10' :
                       'border-white/5 bg-white/5 hover:bg-white/10'}
                     ${game.status === GameStatus.VOTING && p.is_alive && !isSpectator ? 'cursor-pointer hover:border-white/30' : ''}
                   `}
                 >
                   {isSuspectTarget && <div className="absolute top-0 inset-x-0 h-1 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>}
                   
                   <div className={`w-14 h-14 rounded-full flex items-center justify-center text-zinc-300 bg-black border border-white/10 shadow-inner relative z-10 ${isMe ? 'ring-2 ring-white/20' : ''}`}>
                      <AgentIcon />
                      {game.status === GameStatus.VOTING && voteCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-black border-2 border-black">
                          {voteCount}
                        </div>
                      )}
                   </div>
                   
                   <div className="text-center w-full z-10">
                      <p className="text-sm font-black text-white truncate px-2">{p.name}</p>
                      <div className="h-16 flex items-center justify-center mt-2 w-full">
                         {p.is_alive ? (
                           hasSendMsg(p) ? (
                             canSeeOthersMessages ? (
                               <p className="text-xs font-bold text-zinc-300 italic leading-tight break-words px-2 py-1 bg-black/30 rounded border border-white/5 w-full">"{p.message}"</p>
                             ) : (
                               <span className="text-[10px] font-black text-red-500 uppercase tracking-widest animate-pulse">Encrypted</span>
                             )
                           ) : (
                             <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">...</span>
                           )
                         ) : (
                           <span className="text-red-700 font-black text-xs uppercase tracking-widest border-2 border-red-900/50 px-2 py-1 rounded rotate-[-5deg]">Eliminated</span>
                         )}
                      </div>
                   </div>
                 </div>
               );
            })}
          </div>
        </div>

        {/* 右側：身分卡 (重點優化) */}
        <div className="lg:col-span-4 order-1 lg:order-2">
          <div className="sticky top-24 space-y-6">
            <div className="group perspective-[1000px] w-full max-w-sm mx-auto aspect-[3/4.5]" onClick={() => setRevealed(!revealed)}>
              <div className={`relative w-full h-full transition-all duration-700 preserve-3d cursor-pointer ${revealed ? '[transform:rotateY(180deg)]' : ''}`}>
                
                {/* --- 卡片背面 (Cover) --- 
                    位於 0度。未揭露時顯示。
                    完全統一的視覺，無任何個人資訊 
                */}
                <div className="absolute inset-0 backface-hidden rounded-2xl overflow-hidden bg-[#0a0a0a] border border-white/10 shadow-2xl">
                   {/* 背景紋理 */}
                   <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px'}}></div>
                   <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                   
                   {/* 裝飾邊框 */}
                   <div className="absolute inset-3 border border-white/5 rounded-xl flex items-center justify-center">
                      <div className="absolute inset-0 border border-white/5 rounded-xl scale-[0.98]"></div>
                   </div>

                   {/* 中央圖示 */}
                   <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                      <div className="relative">
                         <div className="absolute inset-0 bg-red-600/20 blur-2xl rounded-full animate-pulse"></div>
                         <SecretStampIcon className="w-32 h-32 text-red-700 opacity-80 relative z-10" />
                      </div>
                      <div className="text-center space-y-1">
                         <h3 className="text-3xl font-black text-zinc-700 tracking-tighter uppercase">Top Secret</h3>
                         <p className="text-[9px] text-red-900 font-black uppercase tracking-[0.6em]">Eyes Only</p>
                      </div>
                   </div>

                   {/* 底部裝飾 */}
                   <div className="absolute bottom-6 w-full text-center">
                      <p className="text-[8px] text-zinc-800 font-mono uppercase tracking-widest">Department of Defense</p>
                   </div>
                </div>

                {/* --- 卡片正面 (Info) --- 
                    位於 180度。揭露時顯示。
                    預先旋轉180度，這樣當容器旋轉180度時，正面會轉正。
                */}
                <div className="absolute inset-0 backface-hidden [transform:rotateY(180deg)] rounded-2xl overflow-hidden bg-[#050505] border border-white/20 shadow-2xl flex flex-col">
                   <div className={`absolute top-0 inset-x-0 h-1.5 ${cardColor === 'red' ? 'bg-red-600' : cardColor === 'cyan' ? 'bg-cyan-400' : 'bg-amber-500'} shadow-[0_0_20px_currentColor]`}></div>
                   <TacticalCorners color={cardColor} />
                   
                   {/* 頂部身分標示 */}
                   <div className="pt-10 pb-4 text-center space-y-2 relative z-10">
                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.5em]">Identity Verified</p>
                      <h2 className="text-2xl font-black text-white uppercase tracking-wider">{currentPlayer.name}</h2>
                   </div>

                   {/* 中央詞彙區 */}
                   <div className="flex-1 flex flex-col items-center justify-center relative p-6">
                      <div className="absolute inset-4 bg-white/5 rounded-lg border border-white/5"></div>
                      <div className={`relative z-10 text-center transition-all duration-1000 delay-300 ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                         <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em] mb-4">Assigned Codeword</p>
                         <p className={`font-black break-words leading-none drop-shadow-2xl
                            ${cardWord.length > 5 ? 'text-4xl' : 'text-5xl'}
                            ${cardColor === 'red' ? 'text-red-500' : cardColor === 'cyan' ? 'text-cyan-400' : 'text-amber-500'}
                         `}>
                            {cardWord}
                         </p>
                      </div>
                   </div>

                   {/* 底部角色區 */}
                   <div className="pb-10 pt-4 text-center relative z-10">
                      <div className={`inline-block px-8 py-3 rounded border-2 font-black text-sm uppercase tracking-[0.3em] shadow-lg
                         ${cardColor === 'red' ? 'border-red-900/50 bg-red-900/10 text-red-500' : 
                           cardColor === 'cyan' ? 'border-cyan-900/50 bg-cyan-900/10 text-cyan-400' : 
                           'border-amber-900/50 bg-amber-900/10 text-amber-500'}
                      `}>
                         {isSpectator ? "指揮官" : (currentPlayer.role === PlayerRole.UNDERCOVER ? "臥底" : "平民")}
                      </div>
                   </div>
                </div>

              </div>
            </div>
            
            <div className="text-center">
               <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em] animate-pulse">
                  {revealed ? "點擊卡片以隱藏資訊" : "點擊卡片以查看身分"}
               </p>
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