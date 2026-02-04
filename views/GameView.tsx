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
  const [isTie, setIsTie] = useState(false);
  const [sentThisTurn, setSentThisTurn] = useState(false);

  useEffect(() => {
    if (game.status === GameStatus.PLAYING && !currentPlayer.message) {
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
    setSendingMessage(true);
    try {
      const { error } = await supabase!.from('players').update({ message: msg }).eq('id', currentPlayer.id);
      if (error) throw error;
      setSentThisTurn(true);
      setLocalMessage('');
    } catch (e: any) {
      console.error("Supabase Submission Error:", e);
      alert(`傳輸失敗！錯誤訊息：${e.message || 'Unknown'}`);
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
          setIsTie(false);
        } else {
          setIsTie(true);
        }
      }
      await supabase!.from('players').update({ voted_for: null, message: null }).eq('game_id', game.id);
    }
    const nextStatus = game.status === GameStatus.PLAYING ? GameStatus.VOTING : GameStatus.PLAYING;
    await supabase!.from('games').update({ status: nextStatus }).eq('id', game.id);
  };

  const resetGame = async () => {
    if (!supabase || !currentPlayer.is_host) return;
    await supabase!.from('players').update({ is_alive: true, role: PlayerRole.UNKNOWN, voted_for: null, message: null }).eq('game_id', game.id);
    await supabase!.from('games').update({ status: GameStatus.LOBBY, civilian_word: null, undercover_word: null }).eq('id', game.id);
  };

  const isSpectator = !game.host_is_player && currentPlayer.is_host;
  const alivePlayers = players.filter(p => p.is_alive && (game.host_is_player || !p.is_host));
  const undercoversAlive = alivePlayers.filter(p => p.role === PlayerRole.UNDERCOVER).length;
  const isGameOver = (alivePlayers.length <= 2 && undercoversAlive > 0) || undercoversAlive === 0;
  const isCivilianWin = undercoversAlive === 0;

  const myMessageOnServer = (currentPlayer.message || '').trim().length > 0;
  const canSeeOthersMessages = isSpectator || sentThisTurn || myMessageOnServer;

  // 戰術邊框組件
  const TacticalCorners = ({ color = 'red' }) => (
    <>
      <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 ${color === 'red' ? 'border-red-600' : color === 'cyan' ? 'border-cyan-500' : 'border-amber-500'} z-20`}></div>
      <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 ${color === 'red' ? 'border-red-600' : color === 'cyan' ? 'border-cyan-500' : 'border-amber-500'} z-20`}></div>
      <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 ${color === 'red' ? 'border-red-600' : color === 'cyan' ? 'border-cyan-500' : 'border-amber-500'} z-20`}></div>
      <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 ${color === 'red' ? 'border-red-600' : color === 'cyan' ? 'border-cyan-500' : 'border-amber-500'} z-20`}></div>
    </>
  );

  if (isGameOver) {
    return (
      <div className="glass p-10 rounded-xl text-center space-y-10 animate-in fade-in zoom-in duration-700 max-w-2xl mx-auto border-white/5 shadow-2xl relative overflow-hidden">
        <TacticalCorners color={isCivilianWin ? 'cyan' : 'red'} />
        <div className="space-y-4">
          <div className="inline-block p-6 bg-white/5 rounded-full mb-4 border border-white/10 shadow-inner"><span className="text-7xl">{isCivilianWin ? '👮' : '🕵️'}</span></div>
          <h2 className={`text-5xl font-black tracking-tighter uppercase ${isCivilianWin ? 'text-cyan-400' : 'text-red-600'}`}>{isCivilianWin ? 'Mission Cleared' : 'Squad Wiped'}</h2>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-black/80 p-8 rounded-lg border border-white/5 shadow-inner">
            <p className="text-[9px] text-gray-700 font-black uppercase tracking-widest mb-3">Civilian Objective</p>
            <p className="text-3xl font-black text-white">{game.civilian_word}</p>
          </div>
          <div className="bg-black/80 p-8 rounded-lg border border-white/5 shadow-inner">
            <p className="text-[9px] text-gray-700 font-black uppercase tracking-widest mb-3">Undercover Target</p>
            <p className="text-3xl font-black text-white">{game.undercover_word}</p>
          </div>
        </div>
        {currentPlayer.is_host && <button onClick={resetGame} className="w-full bg-white text-black py-6 rounded-lg font-black transition-all shadow-2xl uppercase tracking-[0.3em] text-lg hover:scale-[1.02] active:scale-95">Deploy New Mission</button>}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-1000 max-w-7xl mx-auto px-4 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-black p-4 rounded-xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-1 h-full ${isTie ? 'bg-amber-500 animate-pulse' : 'bg-red-600'}`}></div>
        <div className="flex items-center gap-6">
          <div className={`px-3 py-1.5 rounded-md font-black uppercase tracking-[0.2em] text-[8px] shadow-2xl transition-all ${game.status === GameStatus.PLAYING ? 'bg-amber-500 text-black' : 'bg-red-600 text-white animate-pulse'}`}>
            {isTie ? 'Tie Detected' : (game.status === GameStatus.PLAYING ? 'Intel Discussion' : 'Elimination Vote')}
          </div>
          <div className="text-left">
            <p className="text-[7px] text-gray-700 font-black uppercase tracking-[0.4em]">Active Squad</p>
            <p className="text-white font-black text-xl leading-none">{alivePlayers.length} / {players.filter(p => game.host_is_player || !p.is_host).length}</p>
          </div>
        </div>
        {currentPlayer.is_host && (
          <button onClick={togglePhase} className="w-full md:w-auto bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-lg font-black uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 shadow-xl shadow-red-900/40 text-[10px]">
            {game.status === GameStatus.PLAYING ? 'Execute Vote' : 'Confirm Intel'}
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {game.status === GameStatus.PLAYING && !isSpectator && currentPlayer.is_alive && (
            <div className={`glass p-5 rounded-lg border-2 transition-all ${ canSeeOthersMessages ? 'border-zinc-800 opacity-50' : 'border-red-600/30 shadow-[0_0_30px_rgba(220,38,38,0.1)]'}`}>
              <label className="text-[8px] font-black text-gray-500 uppercase tracking-[0.3em] mb-2 block">Transmission Input</label>
              {canSeeOthersMessages ? (
                 <div className="py-2 text-red-500 font-bold italic text-sm">
                   " {currentPlayer.message || 'Intel Data Sent'} " <span className="ml-2 text-[9px] uppercase tracking-tighter text-gray-600">[Syncing...]</span>
                 </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={localMessage}
                    onChange={(e) => setLocalMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitMessage()}
                    placeholder="請輸入你的描述..."
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

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {players.filter(p => game.host_is_player || !p.is_host).map((p) => {
              const voteCount = players.filter(v => v.voted_for === p.id).length;
              const isVotedByMe = currentPlayer.voted_for === p.id;
              const hasSent = (p.message || '').trim().length > 0;

              return (
                <div 
                  key={p.id} 
                  onClick={() => game.status === GameStatus.VOTING && p.is_alive && !isSpectator && handleVote(p.id)}
                  className={`group relative overflow-hidden p-5 rounded-lg border-2 transition-all duration-300 flex flex-col items-center gap-3
                    ${!p.is_alive ? 'opacity-20 grayscale border-transparent bg-black/40 cursor-not-allowed' : 
                      isVotedByMe ? 'border-red-600 bg-red-600/10 scale-95 shadow-2xl' : 
                      game.status === GameStatus.VOTING && !isSpectator ? 'border-white/10 bg-white/5 hover:border-red-600/50 cursor-pointer shadow-lg' : 
                      (p.id === currentPlayer.id ? 'border-red-600/20 bg-red-600/5' : 'border-white/5 bg-white/5')}
                  `}
                >
                  <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-lg md:text-xl font-black transition-all shadow-inner 
                    ${p.id === currentPlayer.id ? 'bg-red-600 text-white shadow-red-900/40' : 'bg-zinc-800 text-zinc-500'}
                  `}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-center w-full space-y-1">
                    <p className="text-white font-bold text-xs md:text-sm leading-tight truncate px-1">{p.name}</p>
                    <div className="h-10 flex items-center justify-center">
                      {p.is_alive ? (
                        hasSent ? (
                          canSeeOthersMessages ? (
                            <p className="text-[10px] text-gray-400 font-medium italic leading-tight line-clamp-2">"{p.message}"</p>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <div className="text-[7px] font-black text-red-600 uppercase tracking-widest animate-pulse">Encoded</div>
                              <div className="w-10 h-0.5 bg-red-600/20 rounded-full overflow-hidden relative">
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
                    <div className="absolute top-1.5 right-1.5 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-2xl border-2 border-black">{voteCount}</div>
                  )}
                  {!p.is_alive && <div className="absolute inset-0 flex items-center justify-center bg-black/60"><div className="bg-red-700 text-white px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.2em] rotate-[-15deg] shadow-2xl">Eliminated</div></div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* --- 重新設計的橫向身份卡 --- */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-1 rounded-md border-2 border-red-600/40 bg-zinc-950 shadow-[0_0_60px_rgba(220,38,38,0.15)] relative group">
            <div 
              onClick={() => setRevealed(!revealed)} 
              className={`aspect-[5/3] w-full max-w-[400px] mx-auto rounded-md cursor-pointer transition-all duration-1000 relative preserve-3d ${revealed ? '[transform:rotateY(180deg)]' : ''}`}
            >
              {/* 卡片背面 (未解鎖狀態) */}
              <div className="absolute inset-0 bg-[#080808] rounded-md flex flex-col items-center justify-center border border-white/5 backface-hidden overflow-hidden px-4">
                <TacticalCorners color="red" />
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '16px 16px'}}></div>
                <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center mb-4 border border-red-600/20 shadow-[0_0_20px_rgba(220,38,38,0.2)]">
                  <span className="text-4xl drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">🕵️</span>
                </div>
                <span className="text-[10px] font-black text-white/40 tracking-[0.6em] uppercase mb-1">Access Required</span>
                <span className="text-[7px] font-bold text-gray-800 uppercase tracking-widest text-center">Biometric Authorization Protocol</span>
              </div>
              
              {/* 卡片正面 (身份顯示) */}
              <div className="absolute inset-0 bg-[#0a0a0a] rounded-md [transform:rotateY(180deg)] backface-hidden flex flex-row items-stretch overflow-hidden border border-white/10 shadow-inner">
                <TacticalCorners color={isSpectator ? 'amber' : (currentPlayer.role === PlayerRole.UNDERCOVER ? 'red' : 'cyan')} />
                
                {/* 左側資訊區 */}
                <div className="w-1/3 border-r border-white/5 bg-white/[0.02] p-4 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="text-[7px] font-black text-gray-700 uppercase tracking-widest">Operator</div>
                    <p className="text-sm font-black text-white leading-tight truncate">{currentPlayer.name}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[7px] font-black text-gray-700 uppercase tracking-widest">Clearance</div>
                    <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-sm border inline-block
                      ${isSpectator ? 'text-amber-500 border-amber-500/20 bg-amber-500/5' : (currentPlayer.role === PlayerRole.UNDERCOVER ? 'text-red-600 border-red-600/20 bg-red-600/5' : 'text-cyan-500 border-cyan-500/20 bg-cyan-500/5')}
                    `}>
                      LVL 0{isSpectator ? '9' : (currentPlayer.role === PlayerRole.UNDERCOVER ? '4' : '1')}
                    </div>
                  </div>
                </div>

                {/* 右側主顯區 */}
                <div className="flex-1 p-5 flex flex-col justify-between items-center bg-gradient-to-br from-black to-zinc-900/40">
                  <div className="w-full flex justify-between items-start">
                    <div className="text-[7px] font-bold text-gray-500 uppercase tracking-[0.3em]">Identity Hub</div>
                    <div className="text-[7px] font-mono text-zinc-800">SN-82920-X</div>
                  </div>

                  <div className="text-center space-y-2 w-full">
                    <p className="text-[7px] text-gray-700 font-bold uppercase tracking-[0.4em]">Designated Word</p>
                    <div className="bg-black border border-white/5 rounded-sm py-3 px-6 shadow-inner relative group-hover:border-red-600/20 transition-colors">
                      <span className={`text-2xl font-black tracking-widest drop-shadow-[0_0_8px_rgba(251,191,36,0.2)] ${isSpectator ? 'text-amber-500' : 'text-white'}`}>
                        {isSpectator ? "OVERSEER" : getMyWord()}
                      </span>
                    </div>
                  </div>

                  <div className="w-full flex justify-between items-end">
                    <div className="text-left">
                      <p className="text-[7px] text-gray-700 font-bold uppercase tracking-widest">Status</p>
                      <p className={`font-black text-xs tracking-widest uppercase ${isSpectator ? 'text-amber-500' : (currentPlayer.role === PlayerRole.UNDERCOVER ? 'text-red-600' : 'text-cyan-400')}`}>
                        {isSpectator ? "Spectator" : (currentPlayer.role === PlayerRole.UNDERCOVER ? "Undercover" : "Civilian Agent")}
                      </p>
                    </div>
                    <div className="opacity-10 grayscale scale-75 origin-bottom-right">
                      <span className="text-2xl">⚡</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-black border border-white/5 p-4 rounded-lg shadow-2xl relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${isSpectator ? 'bg-amber-600' : (currentPlayer.role === PlayerRole.UNDERCOVER ? 'bg-red-600' : 'bg-cyan-600')}`}></div>
            <h4 className="text-white font-black text-[8px] uppercase tracking-[0.3em] mb-1.5 flex items-center gap-2">
              <span className={`${isSpectator ? 'text-amber-500' : 'text-red-600'} animate-pulse`}>●</span> Intel Protocol
            </h4>
            <p className="text-[9px] text-gray-500 leading-relaxed font-medium italic">
              {canSeeOthersMessages ? "通訊解碼完成。潛伏者可能就在你身邊，觀察詞彙細微的差異。" : "授權協議生效中。請先提交您的詞彙描述以與特務網路同步情報。"}
            </p>
          </div>
        </div>
      </div>
      <style>{`@keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
    </div>
  );
};

export default GameView;