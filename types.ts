
export enum GameStatus {
  LOBBY = 'lobby',
  PLAYING = 'playing',
  VOTING = 'voting',
  FINISHED = 'finished'
}

export enum PlayerRole {
  CIVILIAN = 'civilian',
  UNDERCOVER = 'undercover',
  UNKNOWN = 'unknown'
}

export interface Player {
  id: string;
  game_id: string;
  name: string;
  role: PlayerRole;
  is_host: boolean;
  is_alive: boolean;
  voted_for: string | null;
  created_at: string;
}

export interface Game {
  id: string;
  room_code: string;
  status: GameStatus;
  civilian_word: string | null;
  undercover_word: string | null;
  winner_team: 'civilian' | 'undercover' | null;
  host_is_player: boolean; // 新增：主持人是否參與遊戲
  created_at: string;
}
