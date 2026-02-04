import React from 'react';
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
  const handleStart = async () => {
    if (players.length < 4) return alert("至少需要 4 位玩家才能開始遊戲");

    try {
      // 1. Generate words via Gemini
      const { civilianWord, undercoverWord } = await generateWordPair();

      // 2. Assign roles
      const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
      const undercoverCount = Math.floor(players.length / 4); // Standard rule: 1 per 4 players
      
      const updates = shuffledPlayers.map((p, index) => ({
        id: p.id,
        role: index < undercoverCount ? PlayerRole.UNDERCOVER : PlayerRole.CIVILIAN,
        is_alive: true,
        voted_for: null
      }));

      // Update players
      for (const update of updates) {
        await supabase!.from('players').update(update).eq('id', update.id);
      }

      // Update game
      await supabase!.from('games').update({
        status: GameStatus.PLAYING,
        civilian_word: civilianWord,
        undercover_word: undercoverWord
      }).eq('id', game.id);

    } catch (err) {
      alert("開始失敗，請再試一次");
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(game.room_code);
    alert("代碼已複製！");
  };

  return (
    <div className="glass p-10 rounded-3xl shadow-2xl max-w-2xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white">等待玩家中...</h2>
          <p className="text-gray-400">目前人數: {players.length} 人</p>
        </div>
        <div onClick={copyCode} className="cursor-pointer bg-red-600/20 border border-red-500/30 px-6 py-3 rounded-2xl text-center group transition-all hover:bg-red-600/30">
          <p className="text-xs text-red-400 font-semibold">房間代碼</p>
          <p className="text-2xl font-black text-red-500 group-hover:scale-110 transition-transform">{game.room_code}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {players.map((p) => (
          <div key={p.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl text-center flex flex-col items-center gap-2">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${p.is_host ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
              {p.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium truncate w-full">{p.name}</span>
            {p.is_host && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">房主</span>}
          </div>
        ))}
        {Array.from({ length: Math.max(0, 6 - players.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="border-2 border-dashed border-white/5 rounded-2xl flex items-center justify-center h-28 opacity-30">
            <span className="text-gray-600">等待加入</span>
          </div>
        ))}
      </div>

      {currentPlayer.is_host ? (
        <button
          onClick={handleStart}
          disabled={players.length < 4}
          className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-red-900/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {players.length < 4 ? "需要至少 4 人" : "開始對決"}
        </button>
      ) : (
        <div className="text-center text-gray-500 animate-pulse italic">
          等待房主開始遊戲...
        </div>
      )}
    </div>
  );
};

export default LobbyView;