import { HeroId, NormalSkillId, SkillLoadout, UltimateSkillId, WorldMap } from './game';

export interface LobbyPlayer {
  id: string;
  name: string;
  heroId: HeroId;
  loadout: SkillLoadout;
  ready: boolean;
  isHost: boolean;
  connected: boolean;
}

export interface RoomDetails {
  roomCode: string;
  hostId: string;
  status: 'lobby' | 'playing' | 'game_over';
  floor: number;
  players: LobbyPlayer[];
  maxPlayers: number;
  createdAt: number;
}

export interface RemotePlayerSyncState {
  id: string;
  name: string;
  heroId: HeroId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  walkPhase: number;
  hp: number;
  maxHp: number;
  shield: number;
  swordAnim: number;
  swordX: number;
  swordY: number;
  swordAngle: number;
  offhandX: number;
  offhandY: number;
  offhandAngle: number;
  swordScale: number;
  swordGlowColor: string;
  swordGlowIntensity: number;
  colossusTimer: number;
  boneStormTimer: number;
  undyingTimer: number;
  bloodFrenzyTimer: number;
  nightmareTimer: number;
  lastStandTimer: number;
  oneManArmyTimer: number;
  isDowned: boolean;
  reviveProgress: number; // 0 to 1
}

export interface SyncEnemyState {
  id: number;
  kind: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  facing: number;
  isAttacking: boolean;
  windupTimer: number;
  telegraphProgress: number;
  targetPlayerId?: string;
  isDead?: boolean;
}

export interface SyncLootItem {
  id: number;
  kind: 'shard' | 'heal' | 'xp';
  x: number;
  y: number;
  value: number;
  active: boolean;
}

export interface ClientAttackMessage {
  comboStep: number;
  facing: number;
  x: number;
  y: number;
  reach: number;
}

export interface ClientSkillMessage {
  skillId: string;
  isManual: boolean;
  angle: number;
  distanceRatio: number;
  x: number;
  y: number;
}
