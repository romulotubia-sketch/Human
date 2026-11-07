export type HeroId = 'human' | 'skeleton' | 'zombie' | 'ghoul' | 'ghost' | 'eaglekin' | 'tigerkin';

export type HeroCategory = 'undead_legion' | 'wildborn_tribes' | 'none';

export const HERO_CATEGORY_MAP: Record<HeroId, { category: HeroCategory; label: string; factionName?: string }> = {
  human: { category: 'none', label: 'Default Character' },
  skeleton: { category: 'undead_legion', label: 'Undead Legion', factionName: 'Undead Legion' },
  zombie: { category: 'undead_legion', label: 'Undead Legion', factionName: 'Undead Legion' },
  ghoul: { category: 'undead_legion', label: 'Undead Legion', factionName: 'Undead Legion' },
  ghost: { category: 'undead_legion', label: 'Undead Legion', factionName: 'Undead Legion' },
  eaglekin: { category: 'wildborn_tribes', label: 'Wildborn Tribes', factionName: 'Wildborn Tribes' },
  tigerkin: { category: 'wildborn_tribes', label: 'Wildborn Tribes', factionName: 'Wildborn Tribes' },
};

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

export type EaglekinNormalSkillId =
  | 'piercing_volley'
  | 'homing_feathers'
  | 'hunters_mark'
  | 'windstep'
  | 'rain_of_feathers';

export type EaglekinUltimateSkillId =
  | 'wrath_of_the_sky'
  | 'celestial_barrage'
  | 'final_horizon';

export type EaglekinPassiveSkillId = 'eagle_eyes' | 'predators_precision';

export type TigerkinNormalSkillId =
  | 'predators_pounce'
  | 'rending_flurry'
  | 'tigers_roar'
  | 'savage_pursuit'
  | 'crushing_paw';

export type TigerkinUltimateSkillId =
  | 'king_of_beasts'
  | 'heavenly_tiger'
  | 'apex_devastation';

export type TigerkinPassiveSkillId = 'predators_instinct' | 'feral_momentum';

export type NormalSkillId =
  | HumanNormalSkillId
  | SkeletonNormalSkillId
  | ZombieNormalSkillId
  | GhoulNormalSkillId
  | GhostNormalSkillId
  | EaglekinNormalSkillId
  | TigerkinNormalSkillId;
export type UltimateSkillId =
  | HumanUltimateSkillId
  | SkeletonUltimateSkillId
  | ZombieUltimateSkillId
  | GhoulUltimateSkillId
  | GhostUltimateSkillId
  | EaglekinUltimateSkillId
  | TigerkinUltimateSkillId;
export type PassiveSkillId =
  | HumanPassiveSkillId
  | SkeletonPassiveSkillId
  | ZombiePassiveSkillId
  | GhoulPassiveSkillId
  | GhostPassiveSkillId
  | EaglekinPassiveSkillId
  | TigerkinPassiveSkillId;

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
  basicSkillId?: ActiveSkillId;
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
  FEATHER_SHOT = 'FEATHER_SHOT',
  DOUBLE_FEATHER = 'DOUBLE_FEATHER',
  PIERCING_VOLLEY = 'PIERCING_VOLLEY',
  HOMING_FEATHERS = 'HOMING_FEATHERS',
  HUNTERS_MARK = 'HUNTERS_MARK',
  WINDSTEP = 'WINDSTEP',
  RAIN_OF_FEATHERS = 'RAIN_OF_FEATHERS',
  WRATH_OF_THE_SKY = 'WRATH_OF_THE_SKY',
  CELESTIAL_BARRAGE = 'CELESTIAL_BARRAGE',
  FINAL_HORIZON = 'FINAL_HORIZON',
  TIGER_SAVAGE_CLAW = 'TIGER_SAVAGE_CLAW',
  TIGER_REND = 'TIGER_REND',
  PREDATORS_POUNCE = 'PREDATORS_POUNCE',
  RENDING_FLURRY = 'RENDING_FLURRY',
  TIGERS_ROAR = 'TIGERS_ROAR',
  SAVAGE_PURSUIT = 'SAVAGE_PURSUIT',
  CRUSHING_PAW = 'CRUSHING_PAW',
  KING_OF_BEASTS = 'KING_OF_BEASTS',
  HEAVENLY_TIGER = 'HEAVENLY_TIGER',
  APEX_DEVASTATION_RISE = 'APEX_DEVASTATION_RISE',
  APEX_DEVASTATION_SLAM = 'APEX_DEVASTATION_SLAM',
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
  fromPlayer?: boolean;
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
    | 'feral_whirl'
    | 'tiger_savage_slash'
    | 'tiger_cross_rend'
    | 'tiger_rend_crescent'
    | 'rending_flurry_slash'
    | 'crushing_paw_shock'
    | 'apex_claw_fissure';
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
    | 'pounce_impact'
    | 'shadow_smoke_ring'
    | 'carnage_dash_line'
    | 'spectral_mist_node'
    | 'mist_node'
    | 'wailing_wave'
    | 'possession_burst'
    | 'astral_nova'
    | 'scrapper_skid_track'
    | 'headcracker_dent'
    | 'seismic_pipe_shockwave'
    | 'brawler_stance_ring'
    | 'oma_blitz_streak'
    | 'tiger_crush_crater'
    | 'heavenly_tiger_run'
    | 'apex_shockwave_ring'
    | 'tiger_roar_burst'
    | 'savage_pursuit_track';
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
    | 'wide_swing'
    | 'headcracker_anvil'
    | 'overhead_slam'
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
  NECROMANCER = 'NECROMANCER',
  GRAVE_KNIGHT = 'GRAVE_KNIGHT',
  PLAGUE_STALKER = 'PLAGUE_STALKER',
  BOSS_WARDEN = 'BOSS_WARDEN',
  // Mini versions of Undead Legion heroes as normal dungeon monsters:
  MINI_SKELETON = 'MINI_SKELETON',
  MINI_ZOMBIE = 'MINI_ZOMBIE',
  MINI_GHOUL = 'MINI_GHOUL',
  MINI_GHOST = 'MINI_GHOST',
  // Corrupted Heroes appearing as ultra-powerful bosses:
  BOSS_LEGION_SKELETON = 'BOSS_LEGION_SKELETON',
  BOSS_LEGION_ZOMBIE = 'BOSS_LEGION_ZOMBIE',
  BOSS_LEGION_GHOUL = 'BOSS_LEGION_GHOUL',
  BOSS_LEGION_GHOST = 'BOSS_LEGION_GHOST',
  BOSS_LEGION_HUMAN = 'BOSS_LEGION_HUMAN',
  BOSS_LEGION_EAGLEKIN = 'BOSS_LEGION_EAGLEKIN',
  BOSS_LEGION_TIGERKIN = 'BOSS_LEGION_TIGERKIN',
}

export function isBossKind(kind: EnemyKind): boolean {
  return (
    kind === EnemyKind.BOSS_WARDEN ||
    kind === EnemyKind.BOSS_LEGION_SKELETON ||
    kind === EnemyKind.BOSS_LEGION_ZOMBIE ||
    kind === EnemyKind.BOSS_LEGION_GHOUL ||
    kind === EnemyKind.BOSS_LEGION_GHOST ||
    kind === EnemyKind.BOSS_LEGION_HUMAN ||
    kind === EnemyKind.BOSS_LEGION_EAGLEKIN ||
    kind === EnemyKind.BOSS_LEGION_TIGERKIN
  );
}

export function isUndeadLegionBoss(kind: EnemyKind): boolean {
  return (
    kind === EnemyKind.BOSS_LEGION_SKELETON ||
    kind === EnemyKind.BOSS_LEGION_ZOMBIE ||
    kind === EnemyKind.BOSS_LEGION_GHOUL ||
    kind === EnemyKind.BOSS_LEGION_GHOST ||
    kind === EnemyKind.BOSS_LEGION_HUMAN ||
    kind === EnemyKind.BOSS_LEGION_EAGLEKIN ||
    kind === EnemyKind.BOSS_LEGION_TIGERKIN
  );
}

export function isMiniHeroKind(kind: EnemyKind): boolean {
  return (
    kind === EnemyKind.MINI_SKELETON ||
    kind === EnemyKind.MINI_ZOMBIE ||
    kind === EnemyKind.MINI_GHOUL ||
    kind === EnemyKind.MINI_GHOST
  );
}

export type EnemyAttackType =
  | 'slash'
  | 'shoot'
  | 'slam'
  | 'nova'
  | 'dash'
  | 'whirlwind'
  | 'thrust'
  | 'volley'
  | 'poison_lob'
  | 'shockwave_line'
  | 'charge'
  | 'spell'
  | 'pounce'
  | 'cross_slash'
  | 'frost_nova';

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
  windupType: EnemyAttackType;
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
  huntersMarkTimer?: number;
  precisionHits?: number;
  // Undead Legion member boss and attack variation extras:
  isLegionBoss?: boolean;
  legionHeroId?: HeroId;
  plagueBurstAccum?: number;
  specialCooldowns?: Record<string, number>;
  bossPhase?: number;
  activeAuraTimer?: number;
  activeAuraType?: string;
  attackVariant?: string;
  shieldHp?: number;
  maxShieldHp?: number;
  bossTransformTimer?: number;
  bossBuffTimer?: number;
  bossStealthTimer?: number;
  bossScytheTimer?: number;
  comboCount?: number;
  isElite?: boolean;
  eliteAffix?: EliteAffix;
  dummyStats?: DummyCombatStats;
}

export type EliteAffix = 'ironclad' | 'berserker' | 'molten' | 'swift' | 'vampiric' | 'tempest';

export interface DummyCombatStats {
  isActive: boolean;
  totalDamage: number;
  dps: number;
  rollingDps: number;
  peakDps: number;
  hitCount: number;
  critCount: number;
  critRate: number;
  lastHitDamage: number;
  maxHitDamage: number;
  combatDuration: number;
  lastHitTime: number;
  recentHits?: { time: number; damage: number }[];
}

export interface CombatVfxEvent {
  id: number;
  kind: 'basic_slash' | 'skill_cast' | 'crit_impact' | 'heavy_slam' | 'elemental_burst';
  screenX: number;
  screenY: number;
  angle: number;
  color: string;
  secondaryColor?: string;
  size?: number;
  label?: string;
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
    | 'boss_shard'
    | 'feather_shot'
    | 'double_feather'
    | 'piercing_feather'
    | 'homing_feather'
    | 'sky_feather'
    | 'celestial_feather'
    | 'final_feather'
    | 'horizon_feather'
    | 'tiger_rend_wave'
    | 'heavenly_tiger_beast'
    | 'enemy_fireball';
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
  isBasicAttack?: boolean;
  homing?: boolean;
}

export interface PickupOrb {
  id?: number;
  active: boolean;
  kind: 'xp' | 'heal' | 'shard' | 'boss_essence' | 'equipment';
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  age: number;
  equipmentItemId?: string;
}

export interface RectZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

import { Blessing } from './blessing';

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
    | 'portal_guild'
    | 'blessing_statue'
    | 'anvil'
    | 'blacksmith_npc'
    | 'forge';
  x: number;
  y: number;
  w: number;
  h: number;
  solid: boolean;
  opened?: boolean;
  label?: string;
  spawnTime?: number;
  chargeProgress?: number;
}

export interface DungeonRoom {
  id: number;
  kind: 'start' | 'combat' | 'treasure' | 'boss' | 'guild' | 'blacksmith';
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
  kind: 'chest' | 'portal_next' | 'portal_guild' | 'blessing_statue' | 'boss_essence' | 'blacksmith';
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
  nearInteraction:
    | 'door_dungeon'
    | 'skill_shrine'
    | 'chest'
    | 'portal_next'
    | 'portal_guild'
    | 'blessing_statue'
    | 'equipment_drop'
    | 'boss_blessing'
    | null;
  nearInteractionLabel?: string | null;
  bossInfo: {
    name: string;
    hp: number;
    maxHp: number;
    shield?: number;
    isLegionBoss?: boolean;
    title?: string;
  } | null;
  runOutcome: 'victory' | 'defeat' | null;
  minimap: MinimapSnapshot | null;
  isDowned?: boolean;
  reviveProgress?: number;
  portalWaiting?: {
    readyCount: number;
    requiredCount: number;
    portalTarget?: 'next' | 'lobby';
  } | null;
  activeBlessings?: Blessing[];
  maxBlessings?: number;
  dummyStats?: DummyCombatStats | null;
}

