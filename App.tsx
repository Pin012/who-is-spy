import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Game, Player, GameStatus, PlayerRole } from './types';
import HomeView from './views/HomeView';
import LobbyView from './views/LobbyView';
import GameView from './views/GameView';
import ModeSelectionView from './views/ModeSelectionView';

const App: React.FC = () => {
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [isSelectingMode, setIsSelectingMode] = useState(false);
  const [playerName, setPlayerName] = useState('');

  // 衍生當前玩家資料
  const currentPlayer = useMemo(() => 
    players.find(p => p.id === myPlayerId) || null
  , [players, myPlayerId]);

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
          <p className="text-gray-400">請在 Vercel 的環境變數中設定必要欄位。</p>
        </div>
      </div>
    );
  }

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
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'games', 
        filter: `id=eq.${currentGame.id}` 
      }, (payload) => {
        setCurrentGame(payload.new as Game);
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'players',
        filter: `game_id=eq.${currentGame.id}` // 優化：只監聽當前房間的玩家變化
      }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const newP = payload.new as Player;
          setPlayers(prev => {
            const idx = prev.findIndex(p => p.id === newP.id);
            if (idx > -1) {
              const updated = [...prev];
              updated[idx] = newP;
              return updated;
            }
            return [...prev, newP].sort((a, b) => a.created_at.localeCompare(b.created_at));
          });
        } else if (payload.eventType === 'DELETE') {
          setPlayers(prev => prev.filter(p => p.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase!.removeChannel(gameChannel);
    };
  }, [currentGame?.id]);

  const handleJoinGame = async (gameId: string, nameToUse: string, isHost: boolean = false) => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();
      
      if (gameError || !gameData) throw new Error("找不到該房間");

      // 【修正】防止中途加入：如果遊戲狀態不是 LOBBY，且不是房主重新進入，則拒絕加入
      if (gameData.status !== GameStatus.LOBBY && !isHost) {
        throw new Error("任務已在進行中，無法中途加入。");
      }

      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .insert({
          game_id: gameId,
          name: nameToUse,
          is_host: isHost,
          is_alive: true,
          role: PlayerRole.UNKNOWN,
          message: null
        })
        .select()
        .single();

      if (playerError) throw playerError;

      setCurrentGame(gameData);
      setMyPlayerId(playerData.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "加入遊戲失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGame = async (hostIsPlayer: boolean) => {
    if (!supabase) return;
    setLoading(true);
    try {
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .insert({
          room_code: roomCode,
          status: GameStatus.LOBBY,
          host_is_player: hostIsPlayer,
          round: 0
        })
        .select()
        .single();

      if (gameError) throw gameError;
      await handleJoinGame(gameData.id, playerName, true);
    } catch (err) {
      alert("建立遊戲失敗");
    } finally {
      setLoading(false);
      setIsSelectingMode(false);
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

  const renderContent = () => {
    if (currentGame && currentPlayer) {
      if (currentGame.status === GameStatus.LOBBY) {
        return <LobbyView game={currentGame} players={players} currentPlayer={currentPlayer} onStartGame={() => {}} />;
      }
      return <GameView game={currentGame} players={players} currentPlayer={currentPlayer} />;
    }

    if (isSelectingMode) {
      return <ModeSelectionView onSelect={handleCreateGame} onBack={() => setIsSelectingMode(false)} />;
    }

    return (
      <HomeView 
        onCreateClick={() => setIsSelectingMode(true)} 
        onJoin={handleJoinGame} 
        findGame={findGameByCode} 
        loading={loading}
        playerName={playerName}
        setPlayerName={setPlayerName}
      />
    );
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 selection:bg-red-600/30">
      <div className="w-full relative py-12">
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-40">
           <div className="absolute top-[10%] left-[5%] w-[40rem] h-[40rem] bg-red-600/5 blur-[120px] rounded-full animate-pulse"></div>
           <div className="absolute bottom-[10%] right-[5%] w-[35rem] h-[35rem] bg-blue-600/5 blur-[120px] rounded-full animate-pulse [animation-delay:2s]"></div>
        </div>
        <div className="relative z-10">{renderContent()}</div>
      </div>
    </div>
  );
};

export default App;