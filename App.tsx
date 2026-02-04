
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Game, Player, GameStatus, PlayerRole } from './types';
import HomeView from './views/HomeView';
import LobbyView from './views/LobbyView';
import GameView from './views/GameView';

const App: React.FC = () => {
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);

  // 檢查所有必要的金鑰是否存在
  const missingKeys = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missingKeys.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missingKeys.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!process.env.API_KEY) missingKeys.push("API_KEY (Gemini API)");

  if (missingKeys.length > 0 || !supabase) {
    return (
      <div className="min-h-screen bg-[#0f1115] flex items-center justify-center p-4">
        <div className="glass p-10 rounded-3xl max-w-lg w-full text-center space-y-6 border-red-500/20">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-white">尚未完成部署設定</h1>
          <p className="text-gray-400">
            請在 Vercel 的環境變數中設定以下欄位，否則遊戲無法運行：
          </p>
          <div className="bg-black/40 p-4 rounded-xl text-left space-y-2">
            {missingKeys.map(key => (
              <div key={key} className="flex items-center gap-2 text-red-400 font-mono text-sm">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                {key}
              </div>
            ))}
          </div>
          <div className="pt-4">
            <a 
              href="https://vercel.com" 
              target="_blank" 
              className="inline-block bg-white text-black px-6 py-2 rounded-xl font-bold hover:bg-gray-200 transition-colors"
            >
              去 Vercel 設定
            </a>
          </div>
          <p className="text-xs text-gray-500 italic">設定完成後，請重新部署或重整頁面。</p>
        </div>
      </div>
    );
  }

  // Sync game and players
  useEffect(() => {
    if (!currentGame || !supabase) return;

    const fetchPlayers = async () => {
      const { data } = await supabase!
        .from('players')
        .select('*')
        .eq('game_id', currentGame.id)
        .order('created_at', { ascending: true });
      if (data) setPlayers(data);
    };

    fetchPlayers();

    const gameChannel = supabase!
      .channel(`game-${currentGame.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${currentGame.id}` }, (payload) => {
        setCurrentGame(payload.new as Game);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${currentGame.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setPlayers(prev => [...prev, payload.new as Player]);
        } else if (payload.eventType === 'UPDATE') {
          setPlayers(prev => prev.map(p => p.id === payload.new.id ? (payload.new as Player) : p));
          if (payload.new.id === currentPlayer?.id) {
            setCurrentPlayer(payload.new as Player);
          }
        }
      })
      .subscribe();

    return () => {
      supabase!.removeChannel(gameChannel);
    };
  }, [currentGame?.id, currentPlayer?.id]);

  const handleJoinGame = async (gameId: string, playerName: string, isHost: boolean = false) => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();
      
      if (gameError || !gameData) throw new Error("找不到該房間");

      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .insert({
          game_id: gameId,
          name: playerName,
          is_host: isHost,
          is_alive: true,
          role: PlayerRole.UNKNOWN
        })
        .select()
        .single();

      if (playerError) throw playerError;

      setCurrentGame(gameData);
      setCurrentPlayer(playerData);
    } catch (err) {
      alert(err instanceof Error ? err.message : "加入遊戲失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGame = async (playerName: string, hostIsPlayer: boolean) => {
    if (!supabase) return;
    setLoading(true);
    try {
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .insert({
          room_code: roomCode,
          status: GameStatus.LOBBY,
          host_is_player: hostIsPlayer
        })
        .select()
        .single();

      if (gameError) throw gameError;
      await handleJoinGame(gameData.id, playerName, true);
    } catch (err) {
      alert("建立遊戲失敗，請檢查資料庫連線");
    } finally {
      setLoading(false);
    }
  };

  const findGameByCode = async (code: string) => {
    if (!supabase) return undefined;
    const { data } = await supabase
      .from('games')
      .select('id')
      .eq('room_code', code.toUpperCase())
      .single();
    return data?.id;
  };

  return (
    <div className="min-h-screen bg-[#0f1115] flex items-center justify-center p-4">
      <div className="w-full max-w-6xl relative">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-900/10 blur-[100px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[100px] rounded-full"></div>

        {!currentGame ? (
          <HomeView onCreate={handleCreateGame} onJoin={handleJoinGame} findGame={findGameByCode} loading={loading} />
        ) : currentGame.status === GameStatus.LOBBY ? (
          <LobbyView game={currentGame} players={players} currentPlayer={currentPlayer!} onStartGame={() => {}} />
        ) : (
          <GameView game={currentGame} players={players} currentPlayer={currentPlayer!} />
        )}
      </div>
    </div>
  );
};

export default App;
