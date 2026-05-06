import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Game, Player, GameStatus, PlayerRole } from './types';
import HomeView from './views/HomeView';
import LobbyView from './views/LobbyView';
import GameView from './views/GameView';
import ModeSelectionView from './views/ModeSelectionView';

const STORAGE_KEYS = {
  PLAYER_ID: 'spy_player_id',
  GAME_ID: 'spy_game_id',
  A2HS_DISMISSED_UNTIL: 'a2hs_dismissed_until',
  A2HS_NEVER_SHOW: 'a2hs_never_show'
};

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const App: React.FC = () => {
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(true);
  
  const [isSelectingMode, setIsSelectingMode] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [showA2HS, setShowA2HS] = useState(false);
  const [a2hsPlatform, setA2hsPlatform] = useState<'ios' | 'android' | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPrompt | null>(null);

  const currentPlayer = useMemo(() => 
    players.find(p => p.id === myPlayerId) || null
  , [players, myPlayerId]);

  // 1. 初始化時嘗試恢復連線
  useEffect(() => {
    const recoverSession = async () => {
      if (!supabase) return setIsRecovering(false);
      
      const storedPlayerId = localStorage.getItem(STORAGE_KEYS.PLAYER_ID);
      const storedGameId = localStorage.getItem(STORAGE_KEYS.GAME_ID);

      if (storedPlayerId && storedGameId) {
        try {
          const { data: playerData, error: pError } = await supabase
            .from('players')
            .select('*')
            .eq('id', storedPlayerId)
            .single();

          if (pError || !playerData) throw new Error("Session expired");

          const { data: gameData, error: gError } = await supabase
            .from('games')
            .select('*')
            .eq('id', storedGameId)
            .single();

          if (gError || !gameData) throw new Error("Game not found");

          setMyPlayerId(playerData.id);
          setCurrentGame(gameData);
          setPlayerName(playerData.name);
        } catch (err) {
          console.log("自動恢復失敗:", err);
          localStorage.removeItem(STORAGE_KEYS.PLAYER_ID);
          localStorage.removeItem(STORAGE_KEYS.GAME_ID);
        }
      }
      setIsRecovering(false);
    };

    recoverSession();
  }, []);

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
        if (payload.eventType === 'DELETE') {
          handleExitGame();
        } else {
          setCurrentGame(payload.new as Game);
        }
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'players',
        filter: `game_id=eq.${currentGame.id}`
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
          if (payload.old.id === myPlayerId) {
            handleExitGame();
          }
          setPlayers(prev => prev.filter(p => p.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase!.removeChannel(gameChannel);
    };
  }, [currentGame?.id, myPlayerId]);

  // 核心邏輯：監控玩家清單，如果沒有 Host 了，大家都要離開
  useEffect(() => {
    if (currentGame && players.length > 0) {
      const hasHost = players.some(p => p.is_host);
      if (!hasHost) {
        handleExitGame();
      }
    }
  }, [players, currentGame]);

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobile) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    if (!isIos && !isAndroid) return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const neverShow = localStorage.getItem(STORAGE_KEYS.A2HS_NEVER_SHOW) === '1';
    if (neverShow) return;

    const dismissedUntil = Number(localStorage.getItem(STORAGE_KEYS.A2HS_DISMISSED_UNTIL) || '0');
    if (Date.now() < dismissedUntil) return;

    setA2hsPlatform(isIos ? 'ios' : 'android');

    const timer = window.setTimeout(() => {
      setShowA2HS(true);
    }, 10000);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredInstallPrompt);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const dismissA2HS = (days: number) => {
    const dismissedUntil = Date.now() + days * 24 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEYS.A2HS_DISMISSED_UNTIL, String(dismissedUntil));
    setShowA2HS(false);
  };

  const neverShowA2HS = () => {
    localStorage.setItem(STORAGE_KEYS.A2HS_NEVER_SHOW, '1');
    setShowA2HS(false);
  };

  const triggerAndroidInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      neverShowA2HS();
      return;
    }
    dismissA2HS(7);
  };

  const handleExitGame = () => {
    localStorage.removeItem(STORAGE_KEYS.PLAYER_ID);
    localStorage.removeItem(STORAGE_KEYS.GAME_ID);
    setCurrentGame(null);
    setMyPlayerId(null);
    setPlayers([]);
  };

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

      localStorage.setItem(STORAGE_KEYS.PLAYER_ID, playerData.id);
      localStorage.setItem(STORAGE_KEYS.GAME_ID, gameId);

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
    if (isRecovering) {
      return (
        <div className="text-center space-y-4 py-20">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-red-500 font-black tracking-[0.3em] uppercase text-xs">正在恢復加密連線...</p>
        </div>
      );
    }

    if (currentGame && currentPlayer) {
      if (currentGame.status === GameStatus.LOBBY) {
        return <LobbyView game={currentGame} players={players} currentPlayer={currentPlayer} onStartGame={() => {}} onExit={handleExitGame} />;
      }
      return <GameView game={currentGame} players={players} currentPlayer={currentPlayer} onExit={handleExitGame} />;
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
        {showA2HS && a2hsPlatform && (
          <div className="fixed bottom-4 left-4 right-4 z-40 md:hidden">
            <div className="rounded-2xl border-2 border-red-400/70 bg-[#0a0a0a]/95 backdrop-blur p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_24px_60px_rgba(0,0,0,0.65)]">
              <div className="rounded-[0.9rem] border border-zinc-700/80 bg-gradient-to-b from-zinc-900 to-zinc-950 p-4">
              <p className="text-[10px] tracking-[0.3em] uppercase text-red-400 font-bold mb-2">快捷啟動</p>
              {a2hsPlatform === 'ios' ? (
                <>
                  <p className="text-sm text-zinc-100 font-semibold">將遊戲加入主畫面</p>
                  <p className="text-xs text-zinc-300 mt-1">在 Safari 點「分享」→「加入主畫面」，下次一鍵開局。</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-zinc-100 font-semibold">安裝到主畫面</p>
                  <p className="text-xs text-zinc-300 mt-1">加入後可像 App 一樣快速開啟，不用再找網址。</p>
                </>
              )}
              <div className="mt-3 flex gap-2">
                {a2hsPlatform === 'android' ? (
                  <button onClick={triggerAndroidInstall} className="flex-1 rounded-lg bg-red-600 text-white text-sm font-bold py-2">
                    立即加入
                  </button>
                ) : (
                  <button onClick={() => dismissA2HS(7)} className="flex-1 rounded-lg bg-red-600 text-white text-sm font-bold py-2">
                    我知道了
                  </button>
                )}
                <button onClick={() => dismissA2HS(7)} className="rounded-lg border border-zinc-600 text-zinc-200 text-sm px-3 py-2">
                  稍後
                </button>
                <button onClick={neverShowA2HS} className="rounded-lg border border-zinc-700 text-zinc-400 text-sm px-3 py-2">
                  不再提示
                </button>
              </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
