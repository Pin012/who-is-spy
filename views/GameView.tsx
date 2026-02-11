import React, { useState, useEffect, useRef } from 'react';
import { Game, Player, GameStatus, PlayerRole } from '../types';
import { supabase } from '../supabaseClient';

interface GameViewProps {
  game: Game;
  players: Player[];
  currentPlayer: Player;
  onExit: () => void;
}

const AgentIcon = ({ className = "w-2/3 h-2/3" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const SecretStampIcon = ({ className = "w-32 h-32" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" className={className}>
    <circle cx="50" cy="50" r="45" strokeWidth="1.5" strokeDasharray="2.5 2" opacity="0.6" />
    <circle cx="50" cy="50" r="40" strokeWidth="0.6" opacity="0.4" />
    <path d="M20 50h60M50 20v60" strokeWidth="0.9" opacity="0.3" />
    <text x="50" y="52" fontFamily="Times New Roman" fontSize="10" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none">TOP SECRET</text>
    <text x="50" y="65" fontFamily="Times New Roman" fontSize="5" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none" opacity="0.75" style={{ letterSpacing: "0.15em" }}>CLASSIFIED</text>
  </svg>
);

const GameView: React.FC<GameViewProps> = ({ game, players, currentPlayer, onExit }) => {
  const [revealed, setRevealed] = useState(false);
  const [voting, setVoting] = useState(false);
  const [localMessage, setLocalMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sentThisTurn, setSentThisTurn] = useState(false);
  const [showRoundBanner, setShowRoundBanner] = useState(false);
  const [isEliminating, setIsEliminating] = useState(false);
  const [justEliminatedId, setJustEliminatedId] = useState<string | null>(null);

  const [instructionKey, setInstructionKey] = useState(0);
  const prevPlayersRef = useRef<Player[]>([]);

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
    const timer = setTimeout(() => setRevealed(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => { const prev = prevPlayersRef.current; if (prev.length) { const died = prev.find(oldP => oldP.is_alive && players.find(p => p.id === oldP.id)?.is_alive === false); if (died) { setJustEliminatedId(died.id); setTimeout(() => setJustEliminatedId(null), 1200); } } prevPlayersRef.current = players; }, [players]);


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
          setIsEliminating(true);
          await supabase!.from('players').update({ is_alive: false }).eq('id', eliminatedId);
          
          const nextAlivePlayers = players.filter(p => p.id !== eliminatedId && p.is_alive && (game.host_is_player || !p.is_host));
          const undercoversCount = nextAlivePlayers.filter(p => p.role === PlayerRole.UNDERCOVER).length;
          
          const isCivilianWin = undercoversCount === 0;
          const isUndercoverWin = nextAlivePlayers.length <= 2 && undercoversCount > 0;

          setTimeout(() => {
            setIsEliminating(false);
          }, 1200);

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
    // 重置所有玩家為準備狀態
    await supabase!.from('players').update({ 
      is_alive: true, 
      role: PlayerRole.UNKNOWN, 
      voted_for: null, 
      message: null 
    }).eq('id', currentPlayer.id); // 先更新自己
    
    await supabase!.from('players').update({ 
      is_alive: true, 
      role: PlayerRole.UNKNOWN, 
      voted_for: null, 
      message: null 
    }).eq('game_id', game.id);

    // 重置遊戲資訊，觸發所有人回到大廳
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
      // 刪除所有玩家
      await supabase!.from('players').delete().eq('game_id', game.id);
      // 刪除遊戲房間
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
    !currentPlayer.is_alive || // 修改：被淘汰者可以看到訊息
    sentThisTurn || 
    myMessageOnServer || 
    game.status === GameStatus.DEFENDING || 
    game.status === GameStatus.VOTING;

  const canIInput = !isSpectator && currentPlayer.is_alive && 
    (game.status === GameStatus.PLAYING || (game.status === GameStatus.DEFENDING && isSuspect));

  const getPhaseInstruction = () => {
    switch (game.status) {
      case GameStatus.PLAYING:
        return (
          <>
            請各位玩家在以下欄位進行情報描述，並找出詞彙異常的嫌疑人。
            <br />
            <span className="text-zinc-300 opacity-90 text-[11px] font-medium leading-loose">
              (注意：您必須先送出自己的描述，才能看見其他玩家的情報內容)
            </span>
          </>
        );
      case GameStatus.DEFENDING:
        return (
          <>
            偵測到數據衝突！投票結果持平，請嫌疑人進行最後申冤。
            <br />
            <span className="text-zinc-300 opacity-90 text-[11px] font-medium leading-loose">
              (嫌疑人請點擊下方輸入框傳輸辯解信號)
            </span>
          </>
        );
      case GameStatus.VOTING:
        return (
          <>
            情報匯總完成。
            <br />
            <span className="text-zinc-300 opacity-90">請直接點擊玩家頭像進行投票，標記您認為具備威脅的臥底。</span>
          </>
        );
      default:
        return "";
    }
  };

  const TacticalCorners = ({ color = 'red' }) => (
    <>
      <div className={`absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 ${color === 'red' ? 'border-red-600' : color === 'cyan' ? 'border-cyan-500' : 'border-amber-500'} z-20`}></div>
      <div className={`absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 ${color === 'red' ? 'border-red-600' : color === 'cyan' ? 'border-cyan-500' : 'border-amber-500'} z-20`}></div>
      <div className={`absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 ${color === 'red' ? 'border-red-600' : color === 'cyan' ? 'border-cyan-500' : 'border-amber-500'} z-20`}></div>
      <div className={`absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 ${color === 'red' ? 'border-red-600' : color === 'cyan' ? 'border-cyan-500' : 'border-amber-500'} z-20`}></div>
    </>
  );

  const cardWord = isSpectator ? "MASTER" : getMyWord();
  const cardColor = isSpectator 
    ? 'amber' 
    : currentPlayer.role === PlayerRole.UNDERCOVER 
      ? 'red' 
      : 'cyan';

  if (isGameOver) {
    return (
      <div className="glass p-10 rounded-lg text-center space-y-12 animate-in fade-in zoom-in duration-1000 max-w-2xl mx-auto border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)] relative overflow-hidden">
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
               {isCivilianWin ? '平民獲得最終勝利' : '臥底獲得最終勝利'}
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
            <div className={`px-4 py-2 rounded-md font-black uppercase tracking-[0.1em] text-[13px] shadow-lg transition-all 
              ${game.status === GameStatus.PLAYING ? 'bg-red-600 text-white shadow-red-500/20' : 
                game.status === GameStatus.DEFENDING ? 'bg-amber-500 text-black shadow-amber-500/30' : 'bg-red-600 text-white animate-pulse shadow-red-500/40'}`}>
              {game.status === GameStatus.PLAYING ? `回合 ${game.round}  -  情報描述階段` : 
               game.status === GameStatus.DEFENDING ? '偵測到數據衝突！' : '投票淘汰階段'}
            </div>
            <div className="text-left">
              <p className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.4em]">ACTIVE SQUAD</p>
              <p className="text-white font-black text-2xl leading-none drop-shadow-sm">{alivePlayers.length} / {players.filter(p => game.host_is_player || !p.is_host).length}</p>
            </div>
          </div>
          
          <div 
            key={instructionKey}
            className="mt-3 px-2 flex items-start gap-2 relative group overflow-hidden"
          >
            <div className={`absolute inset-0 z-10 pointer-events-none beam-effect`}></div>
            
            <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${game.status === GameStatus.DEFENDING ? 'bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,1)]' : 'bg-red-500 shadow-[0_0_5px_rgba(220,38,38,1)]'} animate-pulse`}></div>
            <div className={`text-[12px] md:text-[13px] font-bold text-white tracking-wide leading-relaxed max-w-[600px] instruction-text`}>
              {getPhaseInstruction()}
            </div>
          </div>
        </div>

        {currentPlayer.is_host && (
          <button onClick={togglePhase} className="w-full md:w-auto bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-lg font-black uppercase tracking-[0.1em] transition-all hover:scale-105 active:scale-95 text-sm shadow-xl shadow-red-900/40 border border-white/10">
            {game.status === GameStatus.PLAYING ? '啟動投票階段' : 
             game.status === GameStatus.DEFENDING ? '重啟投票程序' : '執行淘汰程序'}
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {(game.status === GameStatus.PLAYING || game.status === GameStatus.DEFENDING) && (
            <div className={`glass p-6 rounded-lg border-2 transition-all 
              ${!canIInput ? 'border-zinc-800/50 opacity-60 grayscale' : 'border-red-600/40 shadow-[0_0_40px_rgba(220,38,38,0.15)]'}`}>
              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.4em] mb-3 block">
                {game.status === GameStatus.DEFENDING ? (isSuspect ? 'Defense Transmission (申冤中)' : 'Monitoring Defense (監聽中)') : 'Transmission Input'}
              </label>
              
              {!canIInput ? (
                <div className="py-2 text-zinc-400 italic text-sm flex items-center gap-3">
                   <span className="bg-zinc-900 border border-white/10 px-6 py-3 rounded-md text-xs uppercase tracking-[0.2em] font-bold shadow-inner text-white">
                      {game.status === GameStatus.DEFENDING ? "監控嫌疑人防禦信號中..." : "情報同步作業中..."}
                   </span>
                </div>
              ) : canSeeOthersMessages ? (
                 <div className="py-2 text-red-500 font-bold italic text-sm">
                   <span className="bg-red-600/10 border border-red-600/30 px-6 py-4 rounded-md inline-block animate-[flash_0.6s_ease-out] text-base md:text-xl shadow-[0_0_20px_rgba(220,38,38,0.1)] text-white">
                      {currentPlayer.message || '傳輸鏈路已就緒'}
                   </span>
                 </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={localMessage}
                    onChange={(e) => setLocalMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitMessage()}
                    placeholder={game.status === GameStatus.DEFENDING ? "請發表最後的申冤描述..." : "請輸入你的描述..."}
                    className="flex-1 bg-black/80 border border-white/10 rounded-lg px-5 py-3.5 outline-none text-white font-bold transition-all focus:border-red-600/60 text-base shadow-inner"
                  />
                  <button
                    onClick={handleSubmitMessage}
                    disabled={sendingMessage || !localMessage.trim()}
                    className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-lg font-black uppercase tracking-widest transition-all disabled:opacity-20 text-sm shrink-0 shadow-lg border border-white/10 active:scale-95"
                  >
                    {sendingMessage ? '處理中...' : '發送描述'}
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
              const isJustEliminated = p.id === justEliminatedId;

              const playerRoleText = p.role === PlayerRole.UNDERCOVER ? "臥底" : "平民";
              const playerWord = p.role === PlayerRole.CIVILIAN ? game.civilian_word : (p.role === PlayerRole.UNDERCOVER ? game.undercover_word : "???");

              return (
                <div 
                  key={p.id} 
                  onClick={() => game.status === GameStatus.VOTING && p.is_alive && !isSpectator && handleVote(p.id)}
                  className={`group relative overflow-hidden p-6 rounded-md border-2 transition-all duration-300 flex flex-col items-center gap-5
                    ${!p.is_alive ? 'border-zinc-700/60 bg-black/60 cursor-not-allowed' : 
                      isVotedByMe ? 'border-red-600 bg-red-600/15 scale-95 shadow-[0_0_30px_rgba(220,38,38,0.3)]' : 
                      isSuspected ? 'border-amber-600 bg-amber-600/10 shadow-[0_0_40px_rgba(245,158,11,0.2)]' :
                      game.status === GameStatus.VOTING && !isSpectator ? 'border-white/20 bg-white/5 hover:border-red-600/60 cursor-pointer shadow-xl' : 
                      (p.id === currentPlayer.id ? 'border-red-600/30 bg-red-600/5' : 'border-white/10 bg-white/5 shadow-md')}
                  `}
                >
                  {isSpectator && (
                     <div className="absolute top-2 left-2 z-40 flex flex-col gap-1 items-start pointer-events-none">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${p.role === PlayerRole.UNDERCOVER ? 'bg-red-600 text-white border-red-400' : 'bg-cyan-600 text-white border-cyan-400'}`}>
                            {playerRoleText}
                        </span>
                        <span className="text-[8px] font-bold text-white bg-black/80 px-1.5 rounded border border-white/10">
                            {playerWord}
                        </span>
                     </div>
                  )}

                  {isSuspected && p.is_alive && (
                    <div className="absolute top-0 left-0 w-full bg-amber-600 text-black text-[8px] font-black uppercase tracking-[0.5em] py-1 text-center shadow-lg animate-pulse z-20">
                      High Suspect
                    </div>
                  )}

                  <div className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all shadow-inner border-2 overflow-hidden
                    ${p.id === currentPlayer.id ? 'bg-red-600 text-white border-white/20 shadow-red-900/40' : 
                      isSuspected ? 'bg-amber-600 text-black border-white/20' : 'bg-zinc-900 text-zinc-400 border-white/5'}
                  `}>
                    <AgentIcon />
                  </div>                  
                  <div className="text-center w-full space-y-3">
                    <p className={`font-black text-base md:text-lg leading-tight truncate px-1 uppercase tracking-widest drop-shadow-sm
                      ${!p.is_alive ? 'text-zinc-500 opacity-70' : 'text-white'}`}>
                      {p.name}
                    </p>
                    <div className="h-24 flex items-center justify-center w-full relative">
                      {p.is_alive ? (
                        hasSent ? (
                          canSeeOthersMessages ? (
                            <div className="bg-amber-400/5 border border-amber-400/40 rounded-xl px-4 py-3 w-full shadow-lg shadow-black/40 flex items-center justify-center min-h-[60px] transition-colors text-amber-400">
                               <p className="text-sm md:text-base font-bold leading-tight break-words text-center">
                                 {p.message}
                               </p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <div className="text-[8px] font-black text-red-500 uppercase tracking-[0.4em] animate-pulse text-white">Encoded Intel</div>
                              <div className="w-16 h-1 bg-red-600/20 rounded-full overflow-hidden relative">
                                <div className="absolute inset-0 bg-red-600 animate-[loading_1.5s_infinite]"></div>
                              </div>
                            </div>
                          )
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 opacity-40">
                             <p className="text-[9px] text-zinc-300 font-black uppercase tracking-[0.3em]">
                               {isSuspected ? '等待防禦描述' : '等待通訊輸入'}
                             </p>
                             <div className="flex gap-1">
                                <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce"></span>
                             </div>
                          </div>
                        )
                      ) : (
                        <div className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ease-out ${isJustEliminated?'scale-[2] opacity-100':'scale-100 opacity-95'}`}><div className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${p.role===PlayerRole.UNDERCOVER?'bg-red-600/35 text-red-300 border-red-400/50 shadow-[0_0_18px_rgba(220,38,38,0.35)]':'bg-cyan-500/30 text-cyan-200 border-cyan-300/50 shadow-[0_0_18px_rgba(34,211,238,0.25)]'}`}>{p.role===PlayerRole.UNDERCOVER?'臥底':'平民'}</div></div>
                      )}
                    </div>
                  </div>
                  {game.status === GameStatus.VOTING && p.is_alive && voteCount > 0 && (
                    <div className="absolute top-3 right-3 bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-[0_0_15px_rgba(220,38,38,0.5)] border-2 border-white/20">{voteCount}</div>
                  )}
                  {!p.is_alive && (
                    <div className="absolute inset-0 z-30 pointer-events-none">

                      {/* 蓋在頭像上的淘汰章 */}
                      <div className={`absolute left-1/2 -translate-x-1/2 transition-all duration-700 ease-out ${isJustEliminated ? 'top-24 scale-[2] opacity-100' : 'top-[47px] scale-100 opacity-95'}`}>
                        <div className="bg-red-800/90 text-white/95 px-4 py-1.5 text-[16px] font-black uppercase tracking-[0.25em]
                          rotate-[-12deg]
                          border-2 border-red-700/95
                          shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                          已被淘汰
                        </div>
                      </div>
                    </div>
                  )}



                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
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

                    {/* Confidential */}
                    <div className="absolute top-16 text-center space-y-2 z-10 w-full">
                      <h3 className="mx-auto text-3xl font-black text-white/25 tracking-[0.1em] uppercase">
                        Confidential
                      </h3>
                      <div className="h-[1px] w-24 bg-white/10 mx-auto"></div>
                    </div>

                    {/* Stamp */}
                    <div className="relative transform -rotate-12 opacity-90 scale-110">
                      <div className="absolute inset-0 bg-amber-700/25 blur-2xl rounded-full animate-pulse"></div>
                      <SecretStampIcon className="w-60 h-60 text-amber-700 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" />
                    </div>

                    <div className="absolute bottom-12 w-full text-center space-y-2 z-10">
                        <div className="text-[8px] text-amber-800 font-black tracking-[0.4em] uppercase space-y-1">
                          <p>DO NOT SHARE THIS INFORMATION</p>
                          <p>DESTROY AFTER READING</p>
                        </div>
                    </div>

                </div>

                {/* FRONT FACE (Info) - Visible when flipped (180deg) */}
                <div 
                  className={`absolute inset-0 backface-hidden bg-[#080808] rounded-3xl border border-white/10 overflow-hidden flex flex-col ${cardColor === 'red' ? 'shadow-[0_0_0_1px_rgba(220,38,38,0.15),0_0_24px_rgba(220,38,38,0.12)]' : cardColor === 'cyan' ? 'shadow-[0_0_0_1px_rgba(34,211,238,0.15),0_0_24px_rgba(34,211,238,0.12)]' : 'shadow-[0_0_0_1px_rgba(245,158,11,0.15),0_0_24px_rgba(245,158,11,0.12)]'}`}
                  style={{ 
                    transform: 'rotateY(180deg)', 
                    backfaceVisibility: 'hidden', 
                    WebkitBackfaceVisibility: 'hidden' 
                  }}
                >
                   <div className={`absolute top-0 inset-x-0 h-1.5 ${cardColor === 'red' ? 'bg-red-600 text-red-400' : cardColor === 'cyan' ? 'bg-cyan-400 text-cyan-300' : 'bg-amber-500 text-amber-300'} shadow-[0_0_6px_rgba(255,255,255,0.7),0_0_24px_currentColor]`}></div>
                   
                    {/* Access Card */}
                    <div className="pt-10 text-center relative z-10 px-6">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 mb-4 mx-auto">
                        <span className={`w-1.5 h-1.5 rounded-full ${cardColor === 'red' ? 'bg-red-500' : cardColor === 'cyan' ? 'bg-cyan-400' : 'bg-amber-500'} animate-pulse`}></span>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Access Card</p>
                      </div>
                    </div>

                    {/* Player */}
                    <div className="mt-10 pb-6 text-center relative z-10 px-6">
                      <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.4em] mb-1">PLAYER</p>
                      <h2 className="text-3xl font-black text-white uppercase tracking-wider drop-shadow-lg">{currentPlayer.name}</h2>
                    </div>

                   {/* KeyWord */}
                   <div className="flex-1 py-6 flex flex-col items-center justify-center relative px-6">
                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.5em] mb-3">Code Word</p>
                      <div className={`w-full max-w-[280px] px-6 py-6 rounded-xl border text-center shadow-inner ${cardColor === 'red' ? 'border-red-500/40 bg-red-500/5 shadow-red-900/30' : cardColor === 'cyan' ? 'border-cyan-400/40 bg-cyan-400/5 shadow-cyan-900/30' : 'border-amber-400/40 bg-amber-400/5 shadow-amber-900/30'}`}>
                      <p className={`font-black break-words leading-tight drop-shadow-xl ${getWordStyle(cardWord)} ${cardColor === 'red' ? 'text-red-500' : cardColor === 'cyan' ? 'text-cyan-400' : 'text-amber-500'}`}>{cardWord}</p>
                      </div>
                   </div>

                   {/* Bottom Role */}
                   <div className="pb-12 pt-4 text-center relative z-10 px-8">
                    <p className="mb-2 text-[9px] text-zinc-500 font-black uppercase tracking-[0.4em]">MISSION ROLE</p>
                      <div className={`w-full h-[0.5px] mb-4 opacity-50 ${cardColor === 'red' ? 'bg-red-400/30' : cardColor === 'cyan' ? 'bg-cyan-300/30' : 'bg-amber-300/30'}`}></div>
                      <div className="font-black text-sm uppercase tracking-[0.4em]">
                        {isSpectator ? <div className="flex flex-col items-center text-zinc-300 gap-1.2"><span className="text-[11px] tracking-[0.1em]">COMMANDER</span><span className="text-[13px] tracking-normal">─ 指揮官 ─</span></div> : currentPlayer.role === PlayerRole.UNDERCOVER ? <div className="flex flex-col items-center text-red-500 gap-1.2"><span className="text-[11px] tracking-[0.1em]">UNDERCOVER</span><span className="text-[13px] tracking-normal">─ 臥底 ─</span></div> : <div className="flex flex-col items-center text-cyan-400 gap-1.2"><span className="text-[11px] tracking-[0.1em]">CIVILIAN</span><span className="text-[13px] tracking-normal">─ 平民 ─</span></div>}
                      </div>
                   </div>
                </div>

              </div>
            </div>
            
            <div className="text-center">
               <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/5">
                 <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.3em] animate-pulse">
                    {revealed ? "點擊以隱藏身分" : "點擊以顯示身分"}
                 </p>
               </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
        @keyframes flash {
          0% { opacity: 0; filter: brightness(4); transform: scale(1.05); box-shadow: 0 0 50px rgba(220,38,38,0.6); }
          20% { opacity: 1; filter: brightness(2); }
          100% { opacity: 1; filter: brightness(1); transform: scale(1); }
        }
        
        .beam-effect {
          background: white;
          box-shadow: 0 0 20px 2px white;
          animation: beam-reveal 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .instruction-text {
          animation: text-appear 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes beam-reveal {
          0% { clip-path: inset(50% 100% 50% 0); opacity: 0; }
          20% { clip-path: inset(49% 0 49% 0); opacity: 1; height: 2px; }
          40% { clip-path: inset(49% 0 49% 0); opacity: 1; height: 3px; filter: brightness(2); }
          60% { clip-path: inset(0 0 0 0); opacity: 0.8; height: 100%; }
          100% { clip-path: inset(0 0 0 0); opacity: 0; height: 100%; }
        }

        @keyframes text-appear {
          0% { opacity: 0; transform: translateY(2px); filter: blur(4px); }
          40% { opacity: 0; transform: translateY(2px); filter: blur(4px); }
          70% { opacity: 0.5; transform: translateY(0); filter: blur(2px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
      `}</style>
    </div>
  );
};

export default GameView;