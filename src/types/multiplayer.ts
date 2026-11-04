import {
  ActiveSkillId,
  EnemyAttackType,
  EnemyKind,
  HeroId,
  SkillLoadout,
  SwordAnimState,
  WorldMap,
} from './game';

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
  level: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  walkPhase: number;
  hp: number;
  maxHp: number;
  shield: number;
  swordAnim: SwordAnimState;
  swordX: number;
  swordY: number;
  swordAngle: number;
  offhandX: number;
  offhandY: number;
  offhandAngle: number;
  swordScale: number;
  swordGlowColor: string;
  swordGlowIntensity: number;
  isScytheForm: boolean;
  colossusTimer: number;
  boneStormTimer: number;
  ribShieldTimer: number;
  undyingTimer: number;
  stealthTimer: number;
  ambushReady: boolean;
  bloodFrenzyTimer: number;
  phantomMistTimer: number;
  possessingTimer: number;
  nightmareTimer: number;
  pipeThrown: boolean;
  kneeStrikeTimer?: number;
  lastStandTimer: number;
  oneManArmyTimer: number;
  airborneHeight: number;
  wingFlapTimer?: number;
  rainOfFeathersTimer?: number;
  celestialBarrageTimer?: number;
  celestialBarrageWings?: number;
  wrathSkyTimer?: number;
  kingOfBeastsTimer?: number;
  tigerRoarTimer?: number;
  isDowned: boolean;
  reviveProgress: number;
  frenzyStacks?: number;
  connected?: boolean;
  disconnected?: boolean;
  isHost?: boolean;
}

export interface SyncEnemyState {
  id: number;
  kind: EnemyKind;
  name?: string;
  radius?: number;
  roomId?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  shieldHp?: number;
  maxShieldHp?: number;
  facing: number;
  walkPhase: number;
  windupTimer: number;
  windupDuration: number;
  windupType: EnemyAttackType;
  windupAngle: number;
  slowTimer?: number;
  staggerTimer?: number;
  poisonTimer?: number;
  fearTimer?: number;
  possessedTimer?: number;
  isBoss?: boolean;
  isLegionBoss?: boolean;
  legionHeroId?: HeroId;
  bossTransformTimer?: number;
  bossBuffTimer?: number;
  bossStealthTimer?: number;
  bossScytheTimer?: number;
}

export interface SyncEnemyAttackEvent {
  enemyId: number;
  kind: EnemyKind;
  attackType: EnemyAttackType;
  x: number;
  y: number;
  endX?: number;
  endY?: number;
  angle: number;
  damage: number;
  radius?: number;
  isBoss?: boolean;
  isLegionBoss?: boolean;
  legionSkillId?: string;
  skillLabel?: string;
  skillColor?: string;
}

export interface SyncLootItem {
  id: number;
  kind: 'shard' | 'heal' | 'xp' | 'boss_essence';
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
  isAmbush?: boolean;
  isTransformed?: boolean;
  pipeThrown?: boolean;
}

export interface ClientSkillMessage {
  skillId: ActiveSkillId;
  rank: number;
  isManual: boolean;
  angle: number;
  distanceRatio: number;
  x: number;
  y: number;
  isTransformed?: boolean;
}

export interface FullGameSyncPayload {
  roomCode: string;
  floor: number;
  status: 'lobby' | 'playing' | 'game_over';
  roomDetails: RoomDetails;
  dungeonMap: WorldMap | null;
  map?: WorldMap | null;
  enemies: Array<any>;
  loot: SyncLootItem[];
  players: RemotePlayerSyncState[] | Record<string, RemotePlayerSyncState>;
  floorCleared: boolean;
}
