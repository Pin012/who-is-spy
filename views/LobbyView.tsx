
import React, { useState } from 'react';
import { Game, Player, GameStatus, PlayerRole } from '../types';
import { supabase } from '../supabaseClient';
import { generateWordPair } from '../geminiService';

interface LobbyViewProps {
  game: Game;
  players: Player[];
  currentPlayer: Player;
  onStartGame: () => void;
}

const LobbyView: React.FC<LobbyViewProps> = ({ game, players, currentPlayer }) => {
  const [manualCivilian, setManualCivilian] = useState('');
  const [manualUndercover, setManualUndercover] = useState('');
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    if (players.length < 4) return alert("至少需要 4 位玩家才能開始遊戲");
    
    let civWord = manualCivilian;
    let undWord = manualUndercover;

    if (!game.host_is_player) {
      if (!civWord.trim() || !undWord.trim()) return alert("觀戰模式請先設定好兩個詞彙！");
    }

    setStarting(true);
    try {
      // 1. Get words (AI or Manual)
      if (game.host_is_player) {
        const aiWords = await generateWordPair();
        civWord = aiWords.civilianWord;
        undWord = aiWords.undercoverWord;
      }

      // 2. Assign roles
      // If host is spectator, filter host out of role assignment
      const activePlayers = game.host_is_player 
        ? [...players] 
        : players.filter(p => !p.is_host);

      const shuffledPlayers = activePlayers.sort(() => Math.random() - 0.5);
      const undercoverCount = Math.floor(activePlayers.length / 4) || 1;
      
      const updates = players.map(p => {
        if (!game.host_is_player && p.is_host) {
          return { id: p.id, role: PlayerRole.UNKNOWN, is_alive: false, voted_for: null };
        }
        
        const activeIdx = shuffledPlayers.findIndex(ap => ap.id === p.id);
        if (activeIdx === -1) return { id: p.id, role: PlayerRole.UNKNOWN, is_alive: false, voted_for: null };

        return {
          id: p.id,
          role: activeIdx < undercoverCount ? PlayerRole.UNDERCOVER : PlayerRole.CIVILIAN,
          is_alive: true,
          voted_for: null
        };
      });

      // Update players
      for (const update of updates) {
        await supabase!.from('players').update(update).eq('id', update.id);
      }

      // Update game
      await supabase!.from('games').update({
        status: GameStatus.PLAYING,
        civilian_word: civWord,
        undercover_word: undWord
      }).eq('id', game.id);

    } catch (err) {
      alert("開始失敗，請再試一次");
    } finally {
      setStarting(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(game.room_code);
    alert("代碼已複製！");
  };

  return (
    <div className="glass p-10 rounded-3xl shadow-2xl max-w-2xl mx-auto space-y-8 animate-in zoom-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-white italic tracking-tighter">WAITING FOR SQUAD</h2>
          <p className="text-gray-500 text-xs font-bold tracking-widest uppercase">準備進度: {players.length} / 12</p>
        </div>
        <div onClick={copyCode} className="cursor-pointer bg-red-600/10 border border-red-500/20 px-6 py-3 rounded-2xl text-center group transition-all hover:bg-red-600/20">
          <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">Room Access Code</p>
          <p className="text-2xl font-black text-red-500 group-hover:scale-105 transition-transform">{game.room_code}</p>
        </div>
      </div>

      {!game.host_is_player && currentPlayer.is_host && (
        <div className="bg-red-500/5 border border-red-500/10 p-6 rounded-2xl space-y-4">
          <h3 className="text-red-500 text-xs font-black uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            觀戰模式：請輸入對戰詞彙
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 font-bold uppercase ml-1">平民詞</label>
              <input 
                value={manualCivilian}
                onChange={e => setManualCivilian(e.target.value)}
                placeholder="例如：珍珠奶茶"
                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-red-500 outline-none text-white font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 font-bold uppercase ml-1">臥底詞</label>
              <input 
                value={manualUndercover}
                onChange={e => setManualUndercover(e.target.value)}
                placeholder="例如：波霸奶茶"
                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-red-500 outline-none text-white font-bold"
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {players.map((p) => (
          <div key={p.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl text-center flex flex-col items-center gap-2 transition-all hover:border-white/20">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${p.is_host ? 'bg-red-600 shadow-lg shadow-red-900/40 text-white' : 'bg-gray-800 text-gray-400'}`}>
              {p.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-bold truncate w-full text-gray-200">{p.name}</span>
            {p.is_host && <span className="text-[9px] bg-red-600/20 text-red-500 px-2 py-0.5 rounded-full border border-red-500/30 font-black tracking-widest">HOST</span>}
          </div>
        ))}
        {Array.from({ length: Math.max(0, 6 - players.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="border border-dashed border-white/5 rounded-2xl flex items-center justify-center h-28 opacity-20">
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Waiting...</span>
          </div>
        ))}
      </div>

      {currentPlayer.is_host ? (
        <button
          onClick={handleStart}
          disabled={players.length < 4 || starting}
          className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-5 rounded-2xl shadow-2xl shadow-red-900/40 transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-widest text-lg"
        >
          {starting ? "INITIALIZING SQUAD..." : (players.length < 4 ? `NEED ${4 - players.length} MORE AGENTS` : "DEPLOY TO MISSION")}
        </button>
      ) : (
        <div className="text-center bg-white/5 p-4 rounded-xl border border-white/5">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.3em] animate-pulse">
            Waiting for Host to Start the Mission...
          </p>
        </div>
      )}
    </div>
  );
};

export default LobbyView;
