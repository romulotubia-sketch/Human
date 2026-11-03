export type HeroId = 'human' | 'skeleton' | 'zombie' | 'ghoul' | 'ghost';

export enum GamePhase {
  TITLE = 'TITLE',
  HERO_SELECT = 'HERO_SELECT',
  MULTIPLAYER_MENU = 'MULTIPLAYER_MENU',
  MULTIPLAYER_LOBBY = 'MULTIPLAYER_LOBBY',
  GUILD_HOUSE = 'GUILD_HOUSE',
  DUNGEON = 'DUNGEON',
}

export enum SkillCategory {
  NORMAL = 'NORMAL',
  ULTIMATE = 'ULTIMATE',
  PASSIVE = 'PASSIVE',
}

export enum TargetingMode {
  CONE = 'CONE',
  LINE = 'LINE',
  GROUND_AOE = 'GROUND_AOE',
  SELF = 'SELF',
  PASSIVE = 'PASSIVE',
}

export type SkeletonNormalSkillId =
  | 'bone_slash'
  | 'bone_spear'
  | 'ribcage_shield'
  | 'skeletal_rush'
  | 'bone_storm';

export type SkeletonUltimateSkillId =
  | 'bone_colossus'
  | 'army_of_bones'
  | 'reapers_judgment';

export type SkeletonPassiveSkillId = 'eternal_framework' | 'bone_mastery';

export type ZombieNormalSkillId =
  | 'rotting_claw'
  | 'plague_burst'
  | 'flesh_ripper'
  | 'undying_flesh'
  | 'grave_call';

export type ZombieUltimateSkillId =
  | 'abomination_form'
  | 'kingdom_of_the_dead'
  | 'deaths_embrace';

export type ZombiePassiveSkillId = 'carrion_hunger' | 'infectious_touch';

export type GhoulNormalSkillId =
  | 'rending_claws'
  | 'feral_pounce'
  | 'shadow_stalker'
  | 'blood_frenzy'
  | 'predators_leap';

export type GhoulUltimateSkillId =
  | 'apex_predator'
  | 'carnage_unleashed'
  | 'king_of_the_hunt';

export type GhoulPassiveSkillId = 'feral_instinct' | 'predators_momentum';

export type GhostNormalSkillId =
  | 'spectral_bolt'
  | 'phantom_dash'
  | 'soul_drain'
  | 'wailing_scream'
  | 'haunted_possession';

export type GhostUltimateSkillId =
  | 'eternal_nightmare'
  | 'spirit_legion'
  | 'deaths_passage';

export type GhostPassiveSkillId = 'ethereal_body' | 'restless_spirit';

export type HumanNormalSkillId =
  | 'pipe_swing'
  | 'headcracker'
  | 'scrappers_dash'
  | 'improvised_throw'
  | 'street_fighter';

export type HumanUltimateSkillId =
  | 'last_stand'
  | 'scrapstorm'
  | 'one_man_army';

export type HumanPassiveSkillId = 'improvised_fighter' | 'survivors_instinct';

export type NormalSkillId =
  | HumanNormalSkillId
  | SkeletonNormalSkillId
  | ZombieNormalSkillId
  | GhoulNormalSkillId
  | GhostNormalSkillId;
export type UltimateSkillId =
  | HumanUltimateSkillId
  | SkeletonUltimateSkillId
  | ZombieUltimateSkillId
  | GhoulUltimateSkillId
  | GhostUltimateSkillId;
export type PassiveSkillId =
  | HumanPassiveSkillId
  | SkeletonPassiveSkillId
  | ZombiePassiveSkillId
  | GhoulPassiveSkillId
  | GhostPassiveSkillId;

export type ActiveSkillId = NormalSkillId | UltimateSkillId;
export type SkillId = ActiveSkillId | PassiveSkillId;

// Strictly 2 Normal Skills + 1 Ultimate Skill surrounding Basic Attack
export type SkillLoadout = [NormalSkillId, NormalSkillId, UltimateSkillId];

export interface HeroProfile {
  id: HeroId;
  name: string;
  title: string;
  typeLine: string;
  roleDescription: string;
  baseHp: number;
  baseAtk: number;
  baseCrit: string;
  moveSpeed: number;
  normalSkills: NormalSkillId[];
  ultimateSkills: UltimateSkillId[];
  passiveSkills: PassiveSkillId[];
  defaultLoadout: SkillLoadout;
}

export interface SkillDefinition {
  id: SkillId;
  heroId: HeroId;
  name: string;
  category: SkillCategory;
  targeting: TargetingMode;
  shortDesc: string;
  description: string;
  cooldown: number;
  range: number;
  radiusOrAngle: number;
  maxRank: number;
  baseMultiplier: number;
  rankMultiplier: number;
  glowColor: string;
  secondaryColor: string;
}

export interface GameSettings {
  skillButtonScale: number;
  joystickScale: number;
  landscapeLock: boolean;
  sfxVolume: number;
}

export interface AimState {
  active: boolean;
  slotIndex: number;
  skillId: ActiveSkillId | null;
  isManual: boolean;
  angle: number;
  distanceRatio: number;
  willCancel: boolean;
}

export enum SwordAnimState {
  IDLE = 'IDLE',
  BASIC_1 = 'BASIC_1',
  BASIC_2 = 'BASIC_2',
  BASIC_3 = 'BASIC_3',
  BASIC_4 = 'BASIC_4',
  BONE_SLASH = 'BONE_SLASH',
  BONE_SPEAR = 'BONE_SPEAR',
  RIBCAGE_SHIELD = 'RIBCAGE_SHIELD',
  SKELETAL_RUSH = 'SKELETAL_RUSH',
  BONE_STORM = 'BONE_STORM',
  BONE_COLOSSUS_CAST = 'BONE_COLOSSUS_CAST',
  ARMY_OF_BONES = 'ARMY_OF_BONES',
  REAPERS_JUDGMENT = 'REAPERS_JUDGMENT',
  ROTTING_CLAW = 'ROTTING_CLAW',
  PLAGUE_BURST = 'PLAGUE_BURST',
  FLESH_RIPPER = 'FLESH_RIPPER',
  UNDYING_FLESH = 'UNDYING_FLESH',
  GRAVE_CALL = 'GRAVE_CALL',
  ABOMINATION_CAST = 'ABOMINATION_CAST',
  DEATHS_EMBRACE = 'DEATHS_EMBRACE',
  RENDING_CLAWS = 'RENDING_CLAWS',
  FERAL_POUNCE = 'FERAL_POUNCE',
  SHADOW_STALKER = 'SHADOW_STALKER',
  BLOOD_FRENZY = 'BLOOD_FRENZY',
  PREDATORS_LEAP = 'PREDATORS_LEAP',
  APEX_PREDATOR_CAST = 'APEX_PREDATOR_CAST',
  CARNAGE_UNLEASHED = 'CARNAGE_UNLEASHED',
  KING_OF_THE_HUNT = 'KING_OF_THE_HUNT',
  SPECTRAL_BOLT = 'SPECTRAL_BOLT',
  PHANTOM_DASH = 'PHANTOM_DASH',
  SOUL_DRAIN = 'SOUL_DRAIN',
  WAILING_SCREAM = 'WAILING_SCREAM',
  HAUNTED_POSSESSION = 'HAUNTED_POSSESSION',
  ETERNAL_NIGHTMARE = 'ETERNAL_NIGHTMARE',
  SPIRIT_LEGION = 'SPIRIT_LEGION',
  DEATHS_PASSAGE = 'DEATHS_PASSAGE',
  PIPE_SWING = 'PIPE_SWING',
  HEADCRACKER = 'HEADCRACKER',
  SCRAPPERS_DASH = 'SCRAPPERS_DASH',
  IMPROVISED_THROW = 'IMPROVISED_THROW',
  STREET_FIGHTER = 'STREET_FIGHTER',
  LAST_STAND_SWING = 'LAST_STAND_SWING',
  LAST_STAND_SLAM = 'LAST_STAND_SLAM',
  SCRAPSTORM_CAST = 'SCRAPSTORM_CAST',
  ONE_MAN_ARMY_BLITZ = 'ONE_MAN_ARMY_BLITZ',
  ONE_MAN_ARMY_SPIN = 'ONE_MAN_ARMY_SPIN',
}

export interface SwordTrailPoint {
  active: boolean;
  hand: 0 | 1;
  tipX: number;
  tipY: number;
  baseX: number;
  baseY: number;
  age: number;
  maxAge: number;
  color: string;
  glowColor: string;
  isSkillTrail: boolean;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  endSize: number;
  age: number;
  maxAge: number;
  color: string;
  glow: boolean;
  shape: 'circle' | 'spark' | 'bone' | 'ring';
  rotation: number;
  vRot: number;
}

export interface ToxicCloudZone {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  age: number;
  maxAge: number;
  tickTimer: number;
  dps: number;
}

export interface DelayedClawMark {
  active: boolean;
  x: number;
  y: number;
  angle: number;
  radius: number;
  age: number;
  maxAge: number;
  damage: number;
  erupted: boolean;
}

export interface SlashWaveEffect {
  active: boolean;
  kind:
    | 'triple_claw'
    | 'cross_claw'
    | 'blade_arc'
    | 'minion_claw'
    | 'enemy_slash'
    | 'boss_cleave'
    | 'feral_slash'
    | 'twin_rend'
    | 'rending_finale'
    | 'shadow_ambush'
    | 'feral_whirl';
  x: number;
  y: number;
  angle: number;
  radius: number;
  arcSpan: number;
  direction: 1 | -1;
  age: number;
  maxAge: number;
  primaryColor: string;
  secondaryColor: string;
}

export interface GroundEffect {
  active: boolean;
  kind:
    | 'flesh_tear_track'
    | 'grave_portal'
    | 'kingdom_sigil'
    | 'plague_crater'
    | 'enemy_slam_crack'
    | 'contagion_ring'
    | 'predator_crater'
    | 'shadow_smoke_ring'
    | 'carnage_dash_line'
    | 'spectral_mist_node'
    | 'wailing_wave'
    | 'possession_burst'
    | 'astral_nova'
    | 'scrapper_skid_track'
    | 'headcracker_dent'
    | 'seismic_pipe_shockwave'
    | 'brawler_stance_ring'
    | 'oma_blitz_streak';
  x: number;
  y: number;
  x2: number;
  y2: number;
  angle: number;
  radius: number;
  age: number;
  maxAge: number;
  color: string;
  secondaryColor: string;
}

export interface PipeStrikeEffect {
  active: boolean;
  kind:
    | 'basic_jab'
    | 'basic_batter'
    | 'pipe_swing_cone'
    | 'headcracker_anvil'
    | 'knee_burst'
    | 'street_sweep'
    | 'last_stand_cleave'
    | 'oma_tornado';
  x: number;
  y: number;
  angle: number;
  radius: number;
  direction: 1 | -1;
  age: number;
  maxAge: number;
  primaryColor: string;
  secondaryColor: string;
}

export interface ScrapDebrisPiece {
  active: boolean;
  shape: 'gear' | 'rebar' | 'stone' | 'plate' | 'bolt';
  state: 'rising' | 'orbit' | 'hurl';
  orbitAngle: number;
  orbitRadius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  vSpin: number;
  targetEnemyId: number;
  launchDelay: number;
  age: number;
  maxAge: number;
  damage: number;
  trail: Array<{ x: number; y: number }>;
}

export interface SpectralRiftZone {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  age: number;
  pullDuration: number;
  maxAge: number;
  pullStrength: number;
  explosionDamage: number;
  detonated: boolean;
}

export interface OrbitingSpirit {
  active: boolean;
  orbitAngle: number;
  orbitRadius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: 'orbit' | 'charge';
  targetEnemyId: number;
  chargeDelay: number;
  age: number;
  maxAge: number;
  damage: number;
  trail: Array<{ x: number; y: number }>;
}

export interface SoulDrainTether {
  active: boolean;
  enemyId: number;
  fromX: number;
  fromY: number;
  age: number;
  maxAge: number;
  tickAccum: number;
  dps: number;
}

export interface LifeSiphonBeam {
  active: boolean;
  fromX: number;
  fromY: number;
  age: number;
  maxAge: number;
  color: string;
}

export interface FloatingText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  isCrit: boolean;
  age: number;
  maxAge: number;
}

export enum EnemyKind {
  TRAINING_DUMMY = 'TRAINING_DUMMY',
  RATTLER = 'RATTLER',
  ARCHER = 'ARCHER',
  BRUTE = 'BRUTE',
  BOSS_WARDEN = 'BOSS_WARDEN',
}

export interface EnemyEntity {
  id: number;
  kind: EnemyKind;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  atk: number;
  speed: number;
  facing: number;
  walkPhase: number;
  attackCooldown: number;
  windupTimer: number;
  windupDuration: number;
  windupType: 'slash' | 'shoot' | 'slam' | 'nova' | 'dash';
  windupAngle: number;
  attackAnimTimer: number;
  attackAnimDuration: number;
  hitFlash: number;
  roomId: number;
  weaponAngle: number;
  weaponSwing: number;
  armorCrackTimer: number;
  poisonTimer: number;
  poisonDps: number;
  poisonTickAccum: number;
  slowTimer: number;
  preyMarkTimer: number;
  pounceMarkTimer: number;
  fearTimer: number;
  possessedTimer: number;
  staggerTimer: number;
}

export interface AlliedMinion {
  id: number;
  style: HeroId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  atk: number;
  facing: number;
  walkPhase: number;
  lifeTimer: number;
  maxLife: number;
  spawnTimer: number;
  attackTimer: number;
  attackAnimTimer: number;
  attackAnimDuration: number;
  comboSide: 1 | -1;
  weaponSwing: number;
}

export interface Projectile {
  active: boolean;
  fromPlayer: boolean;
  kind:
    | 'bone_spear'
    | 'dark_wave'
    | 'homing_splinter'
    | 'life_leech_orb'
    | 'crimson_rend_wave'
    | 'ghost_wisp'
    | 'ghost_soul_orb'
    | 'spectral_bolt'
    | 'thrown_pipe'
    | 'enemy_arrow'
    | 'boss_shard';
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  damage: number;
  isCrit: boolean;
  pierce: boolean;
  hitIds: Set<number>;
  life: number;
  maxLife: number;
  color: string;
  targetEnemyId?: number;
  returning?: boolean;
  spinAngle?: number;
  visualOnly?: boolean;
}

export interface PickupOrb {
  id?: number;
  active: boolean;
  kind: 'xp' | 'heal' | 'shard';
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  age: number;
}

export interface RectZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorldProp {
  id: string;
  kind:
    | 'hearth'
    | 'rug'
    | 'door_dungeon'
    | 'skill_shrine'
    | 'bookshelf'
    | 'counter'
    | 'pillar'
    | 'torch'
    | 'chest'
    | 'portal_next'
    | 'portal_guild';
  x: number;
  y: number;
  w: number;
  h: number;
  solid: boolean;
  opened?: boolean;
  label?: string;
}

export interface DungeonRoom {
  id: number;
  kind: 'start' | 'combat' | 'treasure' | 'boss' | 'guild';
  x: number;
  y: number;
  w: number;
  h: number;
  cleared: boolean;
}

export interface WorldMap {
  isGuild: boolean;
  floor: number;
  width: number;
  height: number;
  walkableRects: RectZone[];
  rooms: DungeonRoom[];
  props: WorldProp[];
  spawnX: number;
  spawnY: number;
}

export interface MinimapEnemyDot {
  x: number;
  y: number;
  isBoss: boolean;
  isVulnerable: boolean;
}

export interface MinimapMarker {
  x: number;
  y: number;
  kind: 'chest' | 'portal_next' | 'portal_guild';
}

export interface MinimapTeammateDot {
  id: string;
  name: string;
  heroId: HeroId;
  x: number;
  y: number;
  isDowned: boolean;
}

export interface MinimapSnapshot {
  width: number;
  height: number;
  playerX: number;
  playerY: number;
  playerFacing: number;
  walkableRects: RectZone[];
  rooms: DungeonRoom[];
  enemies: MinimapEnemyDot[];
  markers: MinimapMarker[];
  teammates?: MinimapTeammateDot[];
}

export interface HudSnapshot {
  heroId: HeroId;
  hp: number;
  maxHp: number;
  shield: number;
  level: number;
  xp: number;
  xpToNext: number;
  boneShards: number;
  skillPoints: number;
  floor: number;
  enemiesRemaining: number;
  cooldowns: Record<ActiveSkillId, number>;
  maxCooldowns: Record<ActiveSkillId, number>;
  nearInteraction: 'door_dungeon' | 'skill_shrine' | 'chest' | 'portal_next' | 'portal_guild' | null;
  bossInfo: { name: string; hp: number; maxHp: number } | null;
  runOutcome: 'victory' | 'defeat' | null;
  minimap: MinimapSnapshot | null;
  isDowned?: boolean;
  reviveProgress?: number;
  portalWaiting?: { readyCount: number; requiredCount: number } | null;
}
