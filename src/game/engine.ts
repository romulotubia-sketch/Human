import { soundEngine } from '../audio/soundEngine';
import {
  ALL_ACTIVE_SKILL_IDS,
  createInitialSkillRanks,
  HERO_PROFILES,
  HERO_SKILLS,
} from '../data/heroSkills';
import {
  ActiveSkillId,
  AimState,
  AlliedMinion,
  DelayedClawMark,
  EnemyEntity,
  EnemyKind,
  FloatingText,
  GroundEffect,
  HeroId,
  isBossKind,
  isMiniHeroKind,
  isUndeadLegionBoss,
  HudSnapshot,
  LifeSiphonBeam,
  MinimapEnemyDot,
  MinimapMarker,
  MinimapTeammateDot,
  OrbitingSpirit,
  Particle,
  PickupOrb,
  PipeStrikeEffect,
  Projectile,
  ScrapDebrisPiece,
  SkillId,
  SlashWaveEffect,
  SkillLoadout,
  SoulDrainTether,
  SpectralRiftZone,
  SwordAnimState,
  SwordTrailPoint,
  ToxicCloudZone,
  WorldMap,
  WorldProp,
} from '../types/game';
import { Blessing, BlessingModifier } from '../types/blessing';
import { getBlessingOptions } from '../data/heroBlessings';
import { allocEntityId, buildGuildHouse, buildProceduralDungeon } from './dungeonGenerator';
import { PlayerRenderState, RemotePlayerRenderState, renderGameWorld } from './renderer';
import { equipmentManager } from './equipmentManager';
import { EquipmentDropPayload, EquipmentItemId } from '../types/equipment';
import { EQUIPMENT_BY_ID, EQUIPMENT_COLLECTIONS } from '../data/equipmentData';

import { multiplayerClient } from './multiplayerClient';
import {
  ClientAttackMessage,
  ClientSkillMessage,
  FullGameSyncPayload,
  RemotePlayerSyncState,
  SyncEnemyAttackEvent,
  SyncEnemyState,
  SyncLootItem,
} from '../types/multiplayer';

const MAX_PARTICLES = 300;
const MAX_TRAIL_PTS = 96;
const MAX_FLOATING_TEXTS = 54;
const MAX_PROJECTILES = 72;
const MAX_PICKUPS = 64;
const MAX_TOXIC_CLOUDS = 10;
const MAX_SLASH_WAVES = 56;
const MAX_GROUND_EFFECTS = 44;
const MAX_SIPHON_BEAMS = 24;
const MAX_DELAYED_MARKS = 24;
const MAX_SPECTRAL_RIFTS = 4;
const MAX_ORBITING_SPIRITS = 16;
const MAX_SOUL_TETHERS = 10;
const MAX_PIPE_STRIKES = 40;
const MAX_SCRAP_DEBRIS = 24;

const STATIC_MAX_COOLDOWNS: Record<ActiveSkillId, number> = {} as any;
for (const id of ALL_ACTIVE_SKILL_IDS) {
  STATIC_MAX_COOLDOWNS[id] = HERO_SKILLS[id].cooldown;
}

export class GameEngine {
  private heroId: HeroId = 'human';
  private map: WorldMap;
  private enemies: EnemyEntity[] = [];
  private minions: AlliedMinion[] = [];
  public isMultiplayer = false;
  private remotePlayers: Map<string, RemotePlayerRenderState> = new Map();
  private lastMultiplayerReviveSend = 0;
  private currentRevivingPlayerName: string | null = null;
  private currentReviveProgress = 0;
  private localIsDowned = false;
  private localReviveProgress = 0;
  private portalWaitingState: {
    readyCount: number;
    requiredCount: number;
    portalTarget?: 'next' | 'lobby';
  } | null = null;
  private portalTransitionCooldown = 0;
  private pendingPortalAction: { kind: 'next' | 'lobby'; timer: number } | null = null;

  // Object pools for zero-GC 60fps smoothness
  private particles: Particle[] = [];
  private swordTrail: SwordTrailPoint[] = [];
  private floatingTexts: FloatingText[] = [];
  private projectiles: Projectile[] = [];
  private pickups: PickupOrb[] = [];
  private toxicClouds: ToxicCloudZone[] = [];
  private slashWaves: SlashWaveEffect[] = [];
  private groundEffects: GroundEffect[] = [];
  private siphonBeams: LifeSiphonBeam[] = [];
  private delayedClawMarks: DelayedClawMark[] = [];
  private spectralRifts: SpectralRiftZone[] = [];
  private orbitingSpirits: OrbitingSpirit[] = [];
  private soulTethers: SoulDrainTether[] = [];
  private pipeStrikes: PipeStrikeEffect[] = [];
  private scrapDebris: ScrapDebrisPiece[] = [];

  // Camera
  private camX = 480;
  private camY = 360;
  private shakeTimer = 0;
  private shakeStrength = 0;

  // Player progression & stats
  private skillRanks: Record<SkillId, number>;
  private level = 1;
  private xp = 0;
  private xpToNext = 100;
  private boneShards = 0;
  private skillPoints = 0;

  // Blessings system (Max 6 blessings per run)
  private activeBlessings: Blessing[] = [];
  public readonly maxBlessings = 6;
  private activeLoadout: SkillLoadout = [...HERO_PROFILES.human.defaultLoadout];
  private onPromptBlessing?: (options: Blessing[]) => void;
  private onPortalWarp?: (kind: 'next' | 'lobby') => void;
  private onEquipmentDrop?: (drop: EquipmentDropPayload) => void;
  private currentAttackIsBasic = false;

  private baseMaxHp = HERO_PROFILES.human.baseHp;

  private baseAtk = HERO_PROFILES.human.baseAtk;
  private moveSpeed = HERO_PROFILES.human.moveSpeed;

  // Player runtime state
  private player: PlayerRenderState = {
    heroId: 'human',
    x: 480,
    y: 365,
    vx: 0,
    vy: 0,
    facing: Math.PI * 0.5,
    walkPhase: 0,
    hp: 260,
    maxHp: 260,
    shield: 0,
    hitFlash: 0,
    colossusTimer: 0,
    boneStormTimer: 0,
    ribShieldTimer: 0,
    undyingTimer: 0,
    stealthTimer: 0,
    ambushReady: false,
    bloodFrenzyTimer: 0,
    frenzyStacks: 0,
    momentumStacks: 0,
    phantomMistTimer: 0,
    possessingTimer: 0,
    nightmareTimer: 0,
    restlessStacks: 0,
    etherealShimmerTimer: 0,
    pipeThrown: false,
    kneeStrikeTimer: 0,
    lastStandTimer: 0,
    oneManArmyTimer: 0,
    instinctSurrounded: false,
    airborneHeight: 0,
    attackLunge: 0,
    attackTwist: 0,
    attackSquash: 0,
    swordX: 506,
    swordY: 360,
    swordAngle: -0.4,
    offhandX: 454,
    offhandY: 360,
    offhandAngle: Math.PI + 0.4,
    swordScale: 1,
    swordAnim: SwordAnimState.IDLE,
    swordGlowColor: '#fb923c',
    swordGlowIntensity: 0.25,
    isScytheForm: false,
    dashGhostTrail: [
      { x: 0, y: 0, alpha: 0 },
      { x: 0, y: 0, alpha: 0 },
      { x: 0, y: 0, alpha: 0 },
      { x: 0, y: 0, alpha: 0 },
    ],
  };

  // Input & Controls
  private joyX = 0;
  private joyY = 0;
  private basicAttackHeld = false;
  private aimState: AimState = {
    active: false,
    slotIndex: -1,
    skillId: null,
    isManual: false,
    angle: 0,
    distanceRatio: 0.6,
    willCancel: false,
  };

  // Combat timers & smooth 60fps body/stride dynamics
  private basicCooldown = 0;
  private comboStep = 0;
  private comboResetTimer = 0;
  private attackImpulseVx = 0;
  private attackImpulseVy = 0;
  private targetAttackTwist = 0;

  private swordAnimTimer = 0;
  private swordAnimDuration = 0.2;
  private swordCastAngle = 0;
  private trailSampleAccum = 0;

  private dashTimer = 0;
  private dashSkillKind: 'skeletal_rush' | 'flesh_ripper' = 'skeletal_rush';
  private dashStartX = 0;
  private dashStartY = 0;
  private dashVx = 0;
  private dashVy = 0;
  private dashHitIds = new Set<number>();
  private ghostSampleAccum = 0;

  private stormTickTimer = 0;
  private undyingTickTimer = 0;
  private pendingRottingClawTimer = 0;
  private rottingClawHitsLeft = 0;
  private pendingRottingClawAngle = 0;
  private pendingRottingClawMult = 1;
  private carrionStrikeCounter = 0;

  // Ghoul – Feral Stalker runtime timers & smooth blitz-glide state
  private momentumTimer = 0;
  private ambushMult = 2.35;
  private shadowStepTimer = 0;
  private shadowDestX = 0;
  private shadowDestY = 0;
  private shadowTargetFacing = 0;
  private rendingHitsLeft = 0;
  private pendingRendingTimer = 0;
  private pendingRendingAngle = 0;
  private pendingRendingMult = 1;
  private pounceTimer = 0;
  private pounceDuration = 0.24;
  private pounceStartX = 0;
  private pounceStartY = 0;
  private pounceTargetX = 0;
  private pounceTargetY = 0;
  private pounceMult = 1;
  private pounceIsPredatorLeap = false;
  private pounceRadius = 52;
  private pendingLeapSweepTimer = 0;
  private pendingLeapSweepMult = 1;
  private frenzySlashTimer = 0;
  private frenzySide: 1 | -1 = 1;
  private carnageDashesLeft = 0;
  private carnageDashTimer = 0;
  private carnageMult = 1;
  private carnageLastTargetId = -1;
  private huntStrikesLeft = 0;
  private huntChainTimer = 0;
  private huntMult = 1;
  private blitzTimer = 0;
  private blitzDuration = 0.12;
  private blitzStartX = 0;
  private blitzStartY = 0;
  private blitzTargetX = 0;
  private blitzTargetY = 0;

  // Ghost – Ethereal Spirit runtime timers & spectral mechanics
  private restlessTimer = 0;
  private phantomDashTimer = 0;
  private phantomVx = 0;
  private phantomVy = 0;
  private phantomMistNodeAccum = 0;
  private phantomMistDamageTick = 0;
  private phantomMult = 1;
  private possessedEnemyId = -1;
  private possessionHostAtkAccum = 0;
  private possessionExitMult = 1;
  private wailingEchoLeft = 0;
  private wailingEchoTimer = 0;
  private wailingRange = 185;

  // Human – Pipe Brawler runtime timers & street-fighting choreography
  private scrappersDashTimer = 0;
  private scrappersDashVx = 0;
  private scrappersDashVy = 0;
  private scrappersDashMult = 1;
  private streetComboBeat = 0;
  private streetComboTimer = 0;
  private streetComboAngle = 0;
  private streetComboMult = 1;
  private lastStandSwingsLeft = 0;
  private lastStandSwingTimer = 0;
  private lastStandSlamPending = false;
  private lastStandSlamTimer = 0;
  private lastStandMult = 1;
  private omaBlitzLeft = 0;
  private omaBlitzTimer = 0;
  private omaFinisherPending = false;
  private omaFinisherTimer = 0;
  private omaMult = 1;
  private omaLastEnemyId = -1;
  private improvisedHitCounter = 0;
  private applyingOffGuardProc = false;
  private instinctCounterCooldown = 0;

  // Tigerkin – Feral Berserker runtime timers & combat state
  private pounceIsTigerkin = false;
  private rendingFlurryHitsLeft = 0;
  private rendingFlurryTimer = 0;
  private rendingFlurryAngle = 0;
  private rendingFlurryMult = 1;
  private savagePursuitTimer = 0;
  private savagePursuitVx = 0;
  private savagePursuitVy = 0;
  private savagePursuitMult = 1;
  private savagePursuitHitIds = new Set<number>();
  private apexDevastationState: 'none' | 'rising' | 'slamming' = 'none';
  private apexDevastationTimer = 0;
  private apexDevastationTargetX = 0;
  private apexDevastationTargetY = 0;
  private apexDevastationMult = 1;

  private doorCooldown = 0;

  private cooldowns: Record<ActiveSkillId, number>;

  private runOutcome: 'victory' | 'defeat' | null = null;
  private bossSpawnedPortals = false;
  private elapsedTime = 0;
  private hudEmitAccum = 0;
  private onHudUpdate: (hud: HudSnapshot) => void;
  private onPhaseChange: (isGuild: boolean) => void;

  constructor(
    initialHeroId: HeroId,
    initialRanks: Record<SkillId, number>,
    onHudUpdate: (hud: HudSnapshot) => void,
    onPhaseChange: (isGuild: boolean) => void
  ) {
    this.heroId = initialHeroId;
    this.player.heroId = initialHeroId;
    this.skillRanks = { ...initialRanks };
    this.onHudUpdate = onHudUpdate;
    this.onPhaseChange = onPhaseChange;

    this.cooldowns = {} as Record<ActiveSkillId, number>;
    for (const id of ALL_ACTIVE_SKILL_IDS) {
      this.cooldowns[id] = 0;
    }

    this.initPools();
    const guild = buildGuildHouse();
    this.map = guild.map;
    this.enemies = guild.enemies;
    this.syncHeroBaseStats();
    this.initEquipmentProcs();
    this.recalcStats(true);
    this.resetPlayerPosition(this.map.spawnX, this.map.spawnY);
  }

  private initPools() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 3,
        endSize: 0,
        age: 0,
        maxAge: 0.4,
        color: '#ffffff',
        glow: false,
        shape: 'circle',
        rotation: 0,
        vRot: 0,
      });
    }
    for (let i = 0; i < MAX_TRAIL_PTS; i++) {
      this.swordTrail.push({
        active: false,
        hand: 0,
        tipX: 0,
        tipY: 0,
        baseX: 0,
        baseY: 0,
        age: 0,
        maxAge: 0.22,
        color: '#ffffff',
        glowColor: '#67e8f9',
        isSkillTrail: false,
      });
    }
    for (let i = 0; i < MAX_FLOATING_TEXTS; i++) {
      this.floatingTexts.push({
        active: false,
        x: 0,
        y: 0,
        vy: -38,
        text: '',
        color: '#ffffff',
        isCrit: false,
        age: 0,
        maxAge: 0.75,
      });
    }
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      this.projectiles.push({
        active: false,
        fromPlayer: true,
        kind: 'bone_spear',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        angle: 0,
        radius: 10,
        damage: 10,
        isCrit: false,
        pierce: false,
        hitIds: new Set<number>(),
        life: 0,
        maxLife: 1,
        color: '#67e8f9',
      });
    }
    for (let i = 0; i < MAX_PICKUPS; i++) {
      this.pickups.push({
        active: false,
        kind: 'xp',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        value: 10,
        age: 0,
      });
    }
    for (let i = 0; i < MAX_TOXIC_CLOUDS; i++) {
      this.toxicClouds.push({
        active: false,
        x: 0,
        y: 0,
        radius: 140,
        age: 0,
        maxAge: 3.8,
        tickTimer: 0,
        dps: 20,
      });
    }
    for (let i = 0; i < MAX_SLASH_WAVES; i++) {
      this.slashWaves.push({
        active: false,
        kind: 'triple_claw',
        x: 0,
        y: 0,
        angle: 0,
        radius: 75,
        arcSpan: 1.5,
        direction: 1,
        age: 0,
        maxAge: 0.22,
        primaryColor: '#ecfccb',
        secondaryColor: '#84cc16',
      });
    }
    for (let i = 0; i < MAX_GROUND_EFFECTS; i++) {
      this.groundEffects.push({
        active: false,
        kind: 'grave_portal',
        x: 0,
        y: 0,
        x2: 0,
        y2: 0,
        angle: 0,
        radius: 60,
        age: 0,
        maxAge: 1.5,
        color: '#a3e635',
        secondaryColor: '#a855f7',
      });
    }
    for (let i = 0; i < MAX_SIPHON_BEAMS; i++) {
      this.siphonBeams.push({
        active: false,
        fromX: 0,
        fromY: 0,
        age: 0,
        maxAge: 0.5,
        color: '#4ade80',
      });
    }
    for (let i = 0; i < MAX_DELAYED_MARKS; i++) {
      this.delayedClawMarks.push({
        active: false,
        x: 0,
        y: 0,
        angle: 0,
        radius: 68,
        age: 0,
        maxAge: 0.48,
        damage: 25,
        erupted: false,
      });
    }
    for (let i = 0; i < MAX_SPECTRAL_RIFTS; i++) {
      this.spectralRifts.push({
        active: false,
        x: 0,
        y: 0,
        radius: 170,
        age: 0,
        pullDuration: 1.55,
        maxAge: 2.25,
        pullStrength: 185,
        explosionDamage: 80,
        detonated: false,
      });
    }
    for (let i = 0; i < MAX_ORBITING_SPIRITS; i++) {
      this.orbitingSpirits.push({
        active: false,
        orbitAngle: 0,
        orbitRadius: 56,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        state: 'orbit',
        targetEnemyId: -1,
        chargeDelay: 0,
        age: 0,
        maxAge: 6,
        damage: 45,
        trail: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
      });
    }
    for (let i = 0; i < MAX_SOUL_TETHERS; i++) {
      this.soulTethers.push({
        active: false,
        enemyId: -1,
        fromX: 0,
        fromY: 0,
        age: 0,
        maxAge: 2.2,
        tickAccum: 0,
        dps: 24,
      });
    }
    for (let i = 0; i < MAX_PIPE_STRIKES; i++) {
      this.pipeStrikes.push({
        active: false,
        kind: 'basic_jab',
        x: 0,
        y: 0,
        angle: 0,
        radius: 90,
        direction: 1,
        age: 0,
        maxAge: 0.2,
        primaryColor: '#fb923c',
        secondaryColor: '#e2e8f0',
      });
    }
    for (let i = 0; i < MAX_SCRAP_DEBRIS; i++) {
      this.scrapDebris.push({
        active: false,
        shape: 'gear',
        state: 'orbit',
        orbitAngle: 0,
        orbitRadius: 64,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        spin: 0,
        vSpin: 12,
        targetEnemyId: -1,
        launchDelay: 0,
        age: 0,
        maxAge: 6,
        damage: 40,
        trail: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
      });
    }
  }

  private syncHeroBaseStats() {
    const profile = HERO_PROFILES[this.heroId];
    this.baseMaxHp = profile.baseHp;
    this.baseAtk = profile.baseAtk;
    this.moveSpeed = profile.moveSpeed;
    this.player.swordGlowColor =
      this.heroId === 'human'
        ? '#fb923c'
        : this.heroId === 'zombie'
          ? '#a3e635'
          : this.heroId === 'ghoul'
            ? '#fb7185'
            : this.heroId === 'ghost'
              ? '#818cf8'
              : this.heroId === 'eaglekin'
                ? '#38bdf8'
                : '#67e8f9';
  }

  private resetHumanTimers() {
    this.player.pipeThrown = false;
    this.player.kneeStrikeTimer = 0;
    this.player.lastStandTimer = 0;
    this.player.oneManArmyTimer = 0;
    this.player.instinctSurrounded = false;
    this.scrappersDashTimer = 0;
    this.scrappersDashVx = 0;
    this.scrappersDashVy = 0;
    this.streetComboBeat = 0;
    this.streetComboTimer = 0;
    this.lastStandSwingsLeft = 0;
    this.lastStandSwingTimer = 0;
    this.lastStandSlamPending = false;
    this.lastStandSlamTimer = 0;
    this.omaBlitzLeft = 0;
    this.omaBlitzTimer = 0;
    this.omaFinisherPending = false;
    this.omaFinisherTimer = 0;
    this.omaLastEnemyId = -1;
    this.instinctCounterCooldown = 0;
  }

  private resetGhoulTimers() {
    this.player.stealthTimer = 0;
    this.player.ambushReady = false;
    this.player.bloodFrenzyTimer = 0;
    this.player.frenzyStacks = 0;
    this.player.momentumStacks = 0;
    this.player.airborneHeight = 0;
    this.player.attackLunge = 0;
    this.player.attackTwist = 0;
    this.player.attackSquash = 0;
    this.attackImpulseVx = 0;
    this.attackImpulseVy = 0;
    this.momentumTimer = 0;
    this.shadowStepTimer = 0;
    this.rendingHitsLeft = 0;
    this.pendingRendingTimer = 0;
    this.pounceTimer = 0;
    this.pendingLeapSweepTimer = 0;
    this.frenzySlashTimer = 0;
    this.carnageDashesLeft = 0;
    this.carnageDashTimer = 0;
    this.huntStrikesLeft = 0;
    this.huntChainTimer = 0;
    this.blitzTimer = 0;
  }

  private resetGhostTimers() {
    this.player.phantomMistTimer = 0;
    this.player.possessingTimer = 0;
    this.player.nightmareTimer = 0;
    this.player.restlessStacks = 0;
    this.player.etherealShimmerTimer = 0;
    this.restlessTimer = 0;
    this.phantomDashTimer = 0;
    this.phantomVx = 0;
    this.phantomVy = 0;
    this.phantomMistNodeAccum = 0;
    this.phantomMistDamageTick = 0;
    this.possessedEnemyId = -1;
    this.possessionHostAtkAccum = 0;
    this.wailingEchoLeft = 0;
    this.wailingEchoTimer = 0;
  }

  // Eaglekin Sky Marksman state variables
  private windstepDashTimer = 0;
  private windstepDashVx = 0;
  private windstepDashVy = 0;
  private rainOfFeathersVolleysLeft = 0;
  private rainOfFeathersVolleyTimer = 0;
  private rainOfFeathersTargetX = 0;
  private rainOfFeathersTargetY = 0;
  private rainOfFeathersRadius = 115;
  private rainOfFeathersMult = 0.58;
  private wrathSkyVolleysLeft = 0;
  private wrathSkyVolleyTimer = 0;
  private wrathSkyTargetX = 0;
  private wrathSkyTargetY = 0;
  private wrathSkyRadius = 230;
  private wrathSkyMult = 2.85;
  private celestialBarrageTimer = 0;
  private celestialBarrageTickTimer = 0;
  private celestialBarrageMult = 0.85;

  private resetEaglekinTimers() {
    this.player.wingFlapTimer = 0;
    this.player.huntersMarkTargetId = null;
    this.player.rainOfFeathersTimer = 0;
    this.player.celestialBarrageTimer = 0;
    this.player.celestialBarrageWings = 0;
    this.player.wrathSkyTimer = 0;
    this.player.precisionStacks = 0;
    this.player.lastTargetHitId = null;
    this.player.airborneHeight = 0;
    this.windstepDashTimer = 0;
    this.windstepDashVx = 0;
    this.windstepDashVy = 0;
    this.rainOfFeathersVolleysLeft = 0;
    this.rainOfFeathersVolleyTimer = 0;
    this.wrathSkyVolleysLeft = 0;
    this.wrathSkyVolleyTimer = 0;
    this.celestialBarrageTimer = 0;
    this.celestialBarrageTickTimer = 0;
  }

  private breakWeaponTrail() {
    for (let i = 0; i < this.swordTrail.length; i++) {
      this.swordTrail[i].active = false;
    }
  }

  public resetRunProgression() {
    this.skillRanks = createInitialSkillRanks();
    this.skillPoints = 0;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = 100;
    this.activeBlessings = [];
    this.syncHeroBaseStats();
    this.recalcStats(true);
    this.emitHudSnapshot();
  }

  public setHero(heroId: HeroId) {
    if (this.heroId === heroId) return;
    this.heroId = heroId;
    this.player.heroId = heroId;
    this.player.colossusTimer = 0;
    this.player.boneStormTimer = 0;
    this.player.ribShieldTimer = 0;
    this.player.undyingTimer = 0;
    this.player.shield = 0;
    this.player.isScytheForm = false;
    this.pendingRottingClawTimer = 0;
    this.rottingClawHitsLeft = 0;
    this.resetHumanTimers();
    this.resetGhoulTimers();
    this.resetGhostTimers();
    this.resetEaglekinTimers();
    this.clearPools();
    this.resetRunProgression();
  }

  public getHero(): HeroId {
    return this.heroId;
  }

  public getSkillRanks(): Record<SkillId, number> {
    return { ...this.skillRanks };
  }

  public getSkillPoints(): number {
    return this.skillPoints;
  }

  public upgradeSkill(skillId: SkillId): boolean {
    // Skills can only be upgraded inside the crypt dungeon, not in the Guild House
    if (this.map.isGuild) return false;
    if (this.runOutcome !== null) return false;
    if (this.skillPoints <= 0) return false;
    const def = HERO_SKILLS[skillId];
    const cur = this.skillRanks[skillId] || 1;
    if (cur >= def.maxRank) return false;

    this.skillRanks[skillId] = cur + 1;
    this.skillPoints -= 1;
    this.recalcStats(false);
    soundEngine.playPickup();
    this.emitHudSnapshot();
    return true;
  }

  public setOnPromptBlessing(cb: (options: Blessing[]) => void) {
    this.onPromptBlessing = cb;
  }

  public setOnPortalWarp(cb: (kind: 'next' | 'lobby') => void) {
    this.onPortalWarp = cb;
  }

  public setOnEquipmentDrop(cb: (drop: EquipmentDropPayload) => void) {
    this.onEquipmentDrop = cb;
  }

  public applyEquipmentChanges() {
    this.recalcStats(false);
    this.emitHudSnapshot();
  }

  private initEquipmentProcs() {
    equipmentManager.onTriggerBoneShockwave = () => {
      if (!equipmentManager.getIsDungeonActive()) return;
      this.triggerEquipmentBoneShockwave();
    };
    equipmentManager.onTriggerGhostwalkEcho = () => {
      if (!equipmentManager.getIsDungeonActive()) return;
      this.triggerEquipmentGhostwalkEcho();
    };
    equipmentManager.onTriggerApexClawWave = () => {
      if (!equipmentManager.getIsDungeonActive()) return;
      this.triggerEquipmentApexClawWave();
    };
    equipmentManager.onTriggerLastSurvivorProc = () => {
      if (!equipmentManager.getIsDungeonActive()) return;
      this.triggerEquipmentLastSurvivorProc();
    };
    equipmentManager.onTriggerTempestWingsHurricane = () => {
      if (!equipmentManager.getIsDungeonActive()) return;
      this.triggerEquipmentTempestWingsHurricane();
    };
    equipmentManager.onTriggerRoarOfApex = () => {
      if (!equipmentManager.getIsDungeonActive()) return;
      this.triggerEquipmentRoarOfApex();
    };
    equipmentManager.onTriggerSeekingSpirit = (_x, _y) => {
      if (!equipmentManager.getIsDungeonActive()) return;
      this.spawnSeekingSpirit(45);
    };
    equipmentManager.onTriggerShrapnelExplosion = (x, y) => {
      if (!equipmentManager.getIsDungeonActive()) return;
      this.spawnShrapnelExplosion(x, y, 40);
    };
    equipmentManager.onTriggerToxicBurst = (x, y) => {
      if (!equipmentManager.getIsDungeonActive()) return;
      this.spawnToxicBurst(x, y, 35);
    };
    equipmentManager.onTriggerWindBlade = (_x, _y, _angle) => {
      if (!equipmentManager.getIsDungeonActive()) return;
      this.spawnWindBlade(30);
    };
  }

  private triggerEquipmentBoneShockwave() {
    soundEngine.playSkill('ultimate');
    this.triggerShake(0.24, 6.0);
    this.spawnRingEffect(this.player.x, this.player.y, 180, '#f8fafc');
    this.spawnRingEffect(this.player.x, this.player.y, 120, '#67e8f9');
    this.spawnBurstParticles(this.player.x, this.player.y - 10, '#f8fafc', 30, true);
    this.spawnFloatingText(this.player.x, this.player.y - 48, 'BONE SHOCKWAVE!', '#67e8f9', true);

    const dmg = Math.round(this.getEffectiveAtk() * 2.2);
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.kind === EnemyKind.TRAINING_DUMMY) continue;
      if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= 185 + e.radius) {
        this.damageEnemy(e, dmg, true, '#67e8f9');
        if (e.hp > 0 && !isBossKind(e.kind)) {
          e.staggerTimer = Math.max(e.staggerTimer, 1.0);
        }
      }
    }
  }

  private triggerEquipmentGhostwalkEcho() {
    soundEngine.playGhostWisp(1.25);
    this.spawnFloatingText(this.player.x, this.player.y - 48, 'GHOSTWALK ECHO!', '#2dd4bf', true);
    this.spawnRingEffect(this.player.x, this.player.y, 90, '#2dd4bf');

    for (let i = 0; i < 4; i++) {
      const sa = this.player.facing + (i - 1.5) * 0.32;
      this.spawnProjectile({
        fromPlayer: true,
        kind: 'ghost_soul_orb',
        x: this.player.x + Math.cos(sa) * 20,
        y: this.player.y - 10 + Math.sin(sa) * 20,
        vx: Math.cos(sa) * 440,
        vy: Math.sin(sa) * 440,
        angle: sa,
        radius: 14,
        damage: Math.round(this.getEffectiveAtk() * 0.95),
        isCrit: Math.random() < 0.3,
        pierce: true,
        maxLife: 1.1,
        color: '#2dd4bf',
      });
    }
  }

  private triggerEquipmentApexClawWave() {
    soundEngine.playFeralClaw(1.3, true);
    this.triggerShake(0.18, 5.0);
    this.spawnFloatingText(this.player.x, this.player.y - 48, 'APEX INSTINCT!', '#f43f5e', true);
    const facing = this.player.facing;

    this.spawnSlashWave(
      'twin_rend',
      this.player.x + Math.cos(facing) * 24,
      this.player.y - 8 + Math.sin(facing) * 24,
      facing,
      175,
      Math.PI * 1.35,
      1,
      0.32,
      '#fff1f2',
      '#e11d48'
    );
    this.spawnArcBurst(this.player.x, this.player.y, facing, 130, '#f43f5e', 18);

    const dmg = Math.round(this.getEffectiveAtk() * 2.4);
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.kind === EnemyKind.TRAINING_DUMMY) continue;
      if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= 180 + e.radius) {
        this.damageEnemy(e, dmg, true, '#f43f5e');
      }
    }
  }

  private triggerEquipmentLastSurvivorProc() {
    soundEngine.playSkill('shield');
    this.triggerShake(0.2, 5.5);
    this.player.shield += 120;
    this.spawnRingEffect(this.player.x, this.player.y, 110, '#fb923c');
    this.spawnBurstParticles(this.player.x, this.player.y - 10, '#fde047', 24, true);
    this.spawnFloatingText(this.player.x, this.player.y - 48, "SURVIVOR'S RESOLVE!", '#fb923c', true);

    for (const e of this.enemies) {
      if (e.hp <= 0 || e.kind === EnemyKind.TRAINING_DUMMY) continue;
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d <= 120 + e.radius) {
        const ka = Math.atan2(e.y - this.player.y, e.x - this.player.x);
        this.tryMoveEntity(e.x, e.y, Math.cos(ka) * 75, Math.sin(ka) * 75, e.radius, (nx, ny) => {
          e.x = nx;
          e.y = ny;
        });
        this.damageEnemy(e, Math.round(this.getEffectiveAtk() * 1.2), false, '#fb923c');
      }
    }
  }

  private triggerEquipmentTempestWingsHurricane() {
    soundEngine.playSkyScreech(1.1);
    this.triggerShake(0.25, 6.5);
    this.spawnRingEffect(this.player.x, this.player.y, 200, '#38bdf8');
    this.spawnRingEffect(this.player.x, this.player.y, 130, '#e0f2fe');
    this.spawnFloatingText(this.player.x, this.player.y - 50, 'TEMPEST HURRICANE!', '#38bdf8', true);

    const dmg = Math.round(this.getEffectiveAtk() * 1.8);
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.kind === EnemyKind.TRAINING_DUMMY) continue;
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d <= 210 + e.radius) {
        const pullX = (this.player.x - e.x) * 0.35;
        const pullY = (this.player.y - e.y) * 0.35;
        this.tryMoveEntity(e.x, e.y, pullX, pullY, e.radius, (nx, ny) => {
          e.x = nx;
          e.y = ny;
        });
        e.slowTimer = Math.max(e.slowTimer, 2.5);
        this.damageEnemy(e, dmg, true, '#38bdf8');
      }
    }
  }

  private triggerEquipmentRoarOfApex() {
    soundEngine.playTigerRoar(1.2);
    this.triggerShake(0.28, 7.5);
    this.spawnRingEffect(this.player.x, this.player.y, 220, '#f59e0b');
    this.spawnRingEffect(this.player.x, this.player.y, 140, '#fbbf24');
    this.spawnBurstParticles(this.player.x, this.player.y - 10, '#fde047', 32, true);
    this.spawnFloatingText(this.player.x, this.player.y - 50, 'ROAR OF APEX!', '#fbbf24', true);

    const dmg = Math.round(this.getEffectiveAtk() * 2.0);
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.kind === EnemyKind.TRAINING_DUMMY) continue;
      if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= 220 + e.radius) {
        e.slowTimer = Math.max(e.slowTimer, 3.5);
        if (!isBossKind(e.kind)) {
          e.staggerTimer = Math.max(e.staggerTimer, 1.5);
        }
        this.damageEnemy(e, dmg, true, '#fbbf24');
      }
    }
  }

  private spawnSeekingSpirit(damage: number) {
    soundEngine.playGhostWisp(1.1);
    const target = this.findNearestEnemy(380);
    const ang = target
      ? Math.atan2(target.y - this.player.y, target.x - this.player.x)
      : this.player.facing;

    this.spawnProjectile({
      fromPlayer: true,
      kind: 'ghost_wisp',
      x: this.player.x,
      y: this.player.y - 10,
      vx: Math.cos(ang) * 480,
      vy: Math.sin(ang) * 480,
      angle: ang,
      radius: 12,
      damage: Math.round(damage),
      isCrit: false,
      pierce: false,
      maxLife: 1.2,
      color: '#5eead4',
      targetEnemyId: target?.id,
    });
  }

  private spawnShrapnelExplosion(x: number, y: number, damage: number) {
    soundEngine.playPipeClang(1.2, false);
    this.spawnBurstParticles(x, y, '#fb923c', 16, true);
    this.spawnRingEffect(x, y, 90, '#fb923c');
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.kind === EnemyKind.TRAINING_DUMMY) continue;
      if (Math.hypot(e.x - x, e.y - y) <= 90 + e.radius) {
        this.damageEnemy(e, Math.round(damage), false, '#fb923c');
      }
    }
  }

  private spawnToxicBurst(x: number, y: number, damage: number) {
    this.spawnToxicCloud(x, y, 95, 3.5, damage * 0.45);
    this.spawnRingEffect(x, y, 100, '#a3e635');
    this.spawnBurstParticles(x, y, '#84cc16', 14, true);
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.kind === EnemyKind.TRAINING_DUMMY) continue;
      if (Math.hypot(e.x - x, e.y - y) <= 100 + e.radius) {
        e.poisonTimer = Math.max(e.poisonTimer, 4.0);
        e.poisonDps = Math.max(e.poisonDps, damage * 0.5);
      }
    }
  }

  private spawnWindBlade(damage: number) {
    soundEngine.playFeatherShoot(1.25);
    const ang = this.player.facing;
    this.spawnProjectile({
      fromPlayer: true,
      kind: 'feather_shot',
      x: this.player.x + Math.cos(ang) * 20,
      y: this.player.y - 8 + Math.sin(ang) * 20,
      vx: Math.cos(ang) * 720,
      vy: Math.sin(ang) * 720,
      angle: ang,
      radius: 16,
      damage: Math.round(damage),
      isCrit: true,
      pierce: true,
      maxLife: 0.9,
      color: '#38bdf8',
    });
  }

  private spawnEquipmentPickup(x: number, y: number, itemId: EquipmentItemId) {
    for (const orb of this.pickups) {
      if (!orb.active) {
        orb.active = true;
        orb.kind = 'equipment';
        orb.equipmentItemId = itemId;
        orb.x = x;
        orb.y = y;
        orb.vx = (Math.random() - 0.5) * 40;
        orb.vy = (Math.random() - 0.5) * 40;
        orb.value = 1;
        orb.age = 0;
        return;
      }
    }
  }

  public setActiveLoadout(loadout: SkillLoadout) {
    this.activeLoadout = [...loadout];
  }

  public getActiveBlessings(): Blessing[] {
    return [...this.activeBlessings];
  }

  public addBlessing(blessing: Blessing): boolean {
    if (!blessing) return false;
    if (this.activeBlessings.length >= this.maxBlessings) return false;
    if (this.activeBlessings.some((b) => b.id === blessing.id)) return false;
    this.activeBlessings.push(blessing);
    soundEngine.playSkill('shield');
    const color = blessing.glowColor || '#fde047';
    this.spawnBurstParticles(this.player.x, this.player.y - 12, color, 28, true);
    this.spawnFloatingText(
      this.player.x,
      this.player.y - 48,
      `BLESSING: ${blessing.name}!`,
      color,
      true
    );
    if (blessing.modifiers?.shieldBonus) {
      this.player.shield += blessing.modifiers.shieldBonus;
    }
    this.recalcStats(false);
    this.emitHudSnapshot();
    return true;
  }

  public promptBlessingSelection() {
    if (this.activeBlessings.length >= this.maxBlessings) return;
    const currentIds = this.activeBlessings.map((b) => b.id);
    const options = getBlessingOptions(this.heroId, this.activeLoadout, currentIds, 3);
    if (options.length > 0 && this.onPromptBlessing) {
      this.onPromptBlessing(options);
    }
  }

  public getBlessingDamageMult(skillId: ActiveSkillId | 'basic_attack'): number {
    let mult = 0;
    for (const b of this.activeBlessings) {
      if (b.skillId === skillId || b.skillId === 'all_skills') {
        if (b.modifiers.damageMultBonus) mult += b.modifiers.damageMultBonus;
      }
    }
    return mult;
  }

  public getBlessingCooldownReduction(skillId: ActiveSkillId | 'basic_attack'): number {
    let cdr = 0;
    for (const b of this.activeBlessings) {
      if (b.skillId === skillId || b.skillId === 'all_skills') {
        if (b.modifiers.cooldownReduction) cdr += b.modifiers.cooldownReduction;
      }
    }
    return Math.min(0.65, cdr);
  }

  public getBlessingRadiusBonus(skillId: ActiveSkillId | 'basic_attack'): number {
    let rad = 0;
    for (const b of this.activeBlessings) {
      if (b.skillId === skillId || b.skillId === 'all_skills') {
        if (b.modifiers.radiusMultBonus) rad += b.modifiers.radiusMultBonus;
      }
    }
    return rad;
  }

  public getBlessingLifesteal(skillId?: ActiveSkillId | 'basic_attack'): number {
    let ls = 0;
    for (const b of this.activeBlessings) {
      if (!skillId || b.skillId === skillId || b.skillId === 'all_skills' || b.skillId === 'basic_attack') {
        if (b.modifiers.lifestealPct) ls += b.modifiers.lifestealPct;
      }
    }
    return Math.min(0.65, ls);
  }

  public getBlessingExtraProjectiles(skillId: ActiveSkillId | 'basic_attack'): number {
    let proj = 0;
    for (const b of this.activeBlessings) {
      if (b.skillId === skillId || b.skillId === 'all_skills') {
        if (b.modifiers.extraProjectiles) proj += b.modifiers.extraProjectiles;
      }
    }
    return proj;
  }

  public getBlessingShieldBonus(skillId?: ActiveSkillId | 'basic_attack'): number {
    let s = 0;
    for (const b of this.activeBlessings) {
      if (!skillId || b.skillId === skillId || b.skillId === 'all_skills') {
        if (b.modifiers.shieldBonus) s += b.modifiers.shieldBonus;
      }
    }
    return s;
  }

  public hasBlessingEffect(
    skillId: ActiveSkillId | 'basic_attack',
    effectKey: keyof BlessingModifier
  ): boolean {
    return this.activeBlessings.some(
      (b) =>
        (b.skillId === skillId || b.skillId === 'all_skills' || b.skillId === 'basic_attack') &&
        Boolean(b.modifiers[effectKey])
    );
  }


  private recalcStats(fullHeal: boolean) {
    const prevMax = this.player.maxHp;
    let passiveHpBonus = 0;
    if (this.heroId === 'human') {
      passiveHpBonus = (this.skillRanks.survivors_instinct || 1) * 24;
    } else if (this.heroId === 'skeleton') {
      passiveHpBonus = (this.skillRanks.eternal_framework || 1) * 30;
    } else if (this.heroId === 'zombie') {
      passiveHpBonus = (this.skillRanks.carrion_hunger || 1) * 28;
    } else if (this.heroId === 'ghost') {
      passiveHpBonus = (this.skillRanks.ethereal_body || 1) * 16;
    } else {
      passiveHpBonus = (this.skillRanks.predators_momentum || 1) * 20;
    }
    const eqStats = equipmentManager.getComputedStats(this.heroId);
    const newMax =
      this.baseMaxHp +
      (this.level - 1) * (this.heroId === 'ghost' ? 24 : 30) +
      passiveHpBonus +
      eqStats.flatMaxHpBonus;
    this.player.maxHp = newMax;
    if (fullHeal) {
      this.player.hp = newMax;
    } else if (newMax > prevMax) {
      this.player.hp = Math.min(newMax, this.player.hp + (newMax - prevMax));
    }
  }

  private resetPlayerPosition(x: number, y: number) {
    this.player.x = x;
    this.player.y = y;
    this.player.swordX = x + 26;
    this.player.swordY = y - 8;
    this.player.offhandX = x - 26;
    this.player.offhandY = y - 8;
    this.player.airborneHeight = 0;
    this.camX = x;
    this.camY = y;
    this.clearPools();
  }

  private clearPools() {
    for (const p of this.particles) p.active = false;
    for (const t of this.swordTrail) t.active = false;
    for (const pr of this.projectiles) pr.active = false;
    for (const pk of this.pickups) pk.active = false;
    for (const tc of this.toxicClouds) tc.active = false;
    for (const sw of this.slashWaves) sw.active = false;
    for (const ge of this.groundEffects) ge.active = false;
    for (const sb of this.siphonBeams) sb.active = false;
    for (const dm of this.delayedClawMarks) dm.active = false;
    for (const sr of this.spectralRifts) sr.active = false;
    for (const os of this.orbitingSpirits) os.active = false;
    for (const st of this.soulTethers) st.active = false;
    for (const ps of this.pipeStrikes) ps.active = false;
    for (const sd of this.scrapDebris) sd.active = false;
    this.minions = [];
  }

  public enterGuildHouse() {
    equipmentManager.setDungeonActive(false);
    this.isMultiplayer = false;
    this.remotePlayers.clear();
    this.localIsDowned = false;
    this.localReviveProgress = 0;
    this.portalWaitingState = null;
    this.currentRevivingPlayerName = null;
    this.currentReviveProgress = 0;
    this.player.isDowned = false;
    this.player.reviveProgress = 0;
    this.activeBlessings = [];

    const guild = buildGuildHouse();
    this.map = guild.map;
    this.enemies = guild.enemies;
    this.runOutcome = null;
    this.bossSpawnedPortals = false;
    this.pendingPortalAction = null;
    this.portalTransitionCooldown = 0.85;
    this.doorCooldown = 1.0;
    this.resetRunProgression();
    this.player.shield = 0;
    this.player.colossusTimer = 0;
    this.player.boneStormTimer = 0;
    this.player.ribShieldTimer = 0;
    this.player.undyingTimer = 0;
    this.pendingRottingClawTimer = 0;
    this.resetHumanTimers();
    this.resetGhoulTimers();
    this.resetGhostTimers();
    this.resetPlayerPosition(this.map.spawnX, this.map.spawnY);
    this.onPhaseChange(true);
    this.emitHudSnapshot();
  }

  public enterDungeon(floor = 1) {
    equipmentManager.setDungeonActive(true);
    this.isMultiplayer = false;
    this.remotePlayers.clear();
    this.localIsDowned = false;
    this.localReviveProgress = 0;
    this.portalWaitingState = null;
    this.currentRevivingPlayerName = null;
    this.currentReviveProgress = 0;
    this.player.isDowned = false;
    this.player.reviveProgress = 0;

    const dungeon = buildProceduralDungeon(floor);
    this.map = dungeon.map;
    this.enemies = dungeon.enemies;
    this.runOutcome = null;
    this.bossSpawnedPortals = false;
    this.pendingPortalAction = null;
    this.portalTransitionCooldown = 0.85;
    this.doorCooldown = 1.0;
    this.pendingRottingClawTimer = 0;
    this.resetHumanTimers();
    this.resetGhoulTimers();
    this.resetGhostTimers();
    if (floor === 1) {
      this.resetRunProgression();
    } else {
      this.recalcStats(false);
      this.healPlayer(Math.round(this.player.maxHp * 0.45), false);
    }
    this.resetPlayerPosition(this.map.spawnX, this.map.spawnY);
    soundEngine.playSkill('rush');
    this.onPhaseChange(false);
    this.emitHudSnapshot();
  }

  private createRemotePlayerRenderState(
    id: string,
    name: string,
    heroId: HeroId,
    spawnX: number,
    spawnY: number
  ): RemotePlayerRenderState {
    const baseHp = HERO_PROFILES[heroId]?.baseHp || 240;
    const glow =
      heroId === 'tigerkin'
        ? '#f59e0b'
        : heroId === 'eaglekin'
          ? '#38bdf8'
          : heroId === 'human'
            ? '#fb923c'
            : heroId === 'ghost'
              ? '#818cf8'
              : heroId === 'ghoul'
                ? '#fb7185'
                : heroId === 'zombie'
                  ? '#a3e635'
                  : '#67e8f9';
    return {
      id,
      name,
      heroId,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      facing: Math.PI * 0.5,
      walkPhase: 0,
      hp: baseHp,
      maxHp: baseHp,
      shield: 0,
      hitFlash: 0,
      colossusTimer: 0,
      boneStormTimer: 0,
      ribShieldTimer: 0,
      undyingTimer: 0,
      stealthTimer: 0,
      ambushReady: false,
      bloodFrenzyTimer: 0,
      frenzyStacks: 0,
      momentumStacks: 0,
      phantomMistTimer: 0,
      possessingTimer: 0,
      nightmareTimer: 0,
      restlessStacks: 0,
      etherealShimmerTimer: 0,
      pipeThrown: false,
      kneeStrikeTimer: 0,
      lastStandTimer: 0,
      oneManArmyTimer: 0,
      instinctSurrounded: false,
      airborneHeight: 0,
      attackLunge: 0,
      attackTwist: 0,
      attackSquash: 0,
      swordX: spawnX + 24,
      swordY: spawnY - 10,
      swordAngle: -0.35,
      offhandX: spawnX - 24,
      offhandY: spawnY - 10,
      offhandAngle: Math.PI + 0.35,
      swordScale: 1,
      swordAnim: SwordAnimState.IDLE,
      swordGlowColor: glow,
      swordGlowIntensity: 0.4,
      isScytheForm: false,
      dashGhostTrail: [],
      isDowned: false,
      reviveProgress: 0,
      disconnected: false,
    };
  }

  public startMultiplayerGame(
    floor: number,
    dungeonMap: WorldMap,
    enemies: EnemyEntity[],
    players: Array<{ id: string; name: string; heroId: HeroId; isHost?: boolean }>
  ) {
    this.isMultiplayer = true;
    equipmentManager.setDungeonActive(true);
    this.map = dungeonMap;
    this.map.floor = floor;
    this.enemies = enemies.map((e) => ({ ...e }));
    this.runOutcome = null;
    this.bossSpawnedPortals = false;
    this.pendingPortalAction = null;
    this.portalTransitionCooldown = 0.85;
    this.localIsDowned = false;
    this.localReviveProgress = 0;
    this.portalWaitingState = null;
    this.currentRevivingPlayerName = null;
    this.currentReviveProgress = 0;
    this.player.isDowned = false;
    this.player.reviveProgress = 0;
    this.remotePlayers.clear();
    this.resetHumanTimers();
    this.resetGhoulTimers();
    this.resetGhostTimers();
    this.clearPools();
    if (floor === 1) {
      this.resetRunProgression();
    }

    const localId = multiplayerClient.getLocalPlayerId();
    let idx = 0;
    for (const p of players) {
      const angle = (idx * Math.PI * 2) / Math.max(1, players.length);
      const sx = dungeonMap.spawnX + Math.cos(angle) * 28;
      const sy = dungeonMap.spawnY + Math.sin(angle) * 20;
      if (p.id === localId) {
        if (p.heroId && p.heroId !== this.heroId) {
          this.heroId = p.heroId;
          this.player.heroId = p.heroId;
        }
        this.syncHeroBaseStats();
        this.recalcStats(true);
        this.player.shield = 0;
        this.resetPlayerPosition(sx, sy);
        multiplayerClient.sendPlayerHealOrShield(this.player.maxHp, 0);
      } else {
        this.remotePlayers.set(
          p.id,
          this.createRemotePlayerRenderState(p.id, p.name, p.heroId, sx, sy)
        );
      }
      idx++;
    }

    soundEngine.playSkill('rush');
    this.onPhaseChange(false);
    this.emitHudSnapshot();
  }

  public syncFullMultiplayerState(payload: FullGameSyncPayload) {
    this.isMultiplayer = true;
    const worldMap = payload.dungeonMap || payload.map;
    if (worldMap) {
      this.map = worldMap;
      this.map.floor = payload.floor;
    }
    this.enemies = payload.enemies.map((e) => ({ ...e }));
    this.runOutcome = null;
    this.portalWaitingState = null;
    this.remotePlayers.clear();
    this.clearPools();

    const localId = multiplayerClient.getLocalPlayerId();
    const playersList = Array.isArray(payload.players)
      ? payload.players
      : Object.values(payload.players || {});
    for (const st of playersList) {
      const id = st.id;
      if (id === localId) {
        this.setHero(st.heroId);
        this.resetPlayerPosition(st.x, st.y);
        this.player.hp = st.hp;
        this.player.maxHp = Math.max(this.player.maxHp, st.maxHp);
        this.player.shield = st.shield;
        this.localIsDowned = Boolean(st.isDowned);
        this.localReviveProgress = st.reviveProgress || 0;
        this.player.isDowned = this.localIsDowned;
        this.player.reviveProgress = this.localReviveProgress;
      } else {
        const rp = this.createRemotePlayerRenderState(
          id,
          st.name || 'Hero',
          st.heroId || 'human',
          st.x,
          st.y
        );
        rp.hp = st.hp;
        rp.maxHp = st.maxHp;
        rp.shield = st.shield;
        rp.isDowned = Boolean(st.isDowned);
        rp.reviveProgress = st.reviveProgress || 0;
        rp.disconnected = Boolean(st.disconnected);
        this.remotePlayers.set(id, rp);
      }
    }

    for (const item of payload.loot || []) {
      this.spawnPickup(item.x, item.y, item.kind, item.value, item.id, true);
    }

    this.onPhaseChange(false);
    this.emitHudSnapshot();
  }

  public updateMultiplayerTick(
    players: Record<string, RemotePlayerSyncState>,
    enemies: SyncEnemyState[]
  ) {
    if (!this.isMultiplayer) return;

    const localId = multiplayerClient.getLocalPlayerId();
    const seenRemoteIds = new Set<string>();

    for (const [id, state] of Object.entries(players)) {
      if (id === localId) {
        this.localIsDowned = Boolean(state.isDowned);
        this.localReviveProgress = state.reviveProgress || 0;
        this.player.isDowned = this.localIsDowned;
        this.player.reviveProgress = this.localReviveProgress;
        if (this.localIsDowned) {
          this.player.hp = 0;
        }
        continue;
      }

      seenRemoteIds.add(id);
      let rp = this.remotePlayers.get(id);
      if (!rp) {
        rp = this.createRemotePlayerRenderState(
          state.id,
          state.name || 'Hero',
          state.heroId || 'human',
          state.x,
          state.y
        );
        this.remotePlayers.set(id, rp);
      }

      const distJump = Math.hypot(state.x - rp.x, state.y - rp.y);
      const posBlend = distJump > 260 ? 1.0 : 0.45;
      rp.heroId = state.heroId || rp.heroId;
      rp.name = state.name || rp.name;
      rp.x += (state.x - rp.x) * posBlend;
      rp.y += (state.y - rp.y) * posBlend;
      rp.vx = state.vx;
      rp.vy = state.vy;
      rp.facing = this.blendAngle(rp.facing, state.facing, 0.55);
      rp.walkPhase = state.walkPhase;
      rp.hp = state.hp;
      rp.maxHp = state.maxHp;
      rp.shield = state.shield;
      rp.isDowned = Boolean(state.isDowned);
      rp.reviveProgress = state.reviveProgress || 0;
      rp.disconnected = Boolean(state.disconnected);

      rp.swordAnim = state.swordAnim || SwordAnimState.IDLE;
      rp.swordX += (state.swordX - rp.swordX) * 0.55;
      rp.swordY += (state.swordY - rp.swordY) * 0.55;
      rp.swordAngle = this.blendAngle(rp.swordAngle, state.swordAngle, 0.6);
      rp.offhandX += (state.offhandX - rp.offhandX) * 0.55;
      rp.offhandY += (state.offhandY - rp.offhandY) * 0.55;
      rp.offhandAngle = this.blendAngle(rp.offhandAngle, state.offhandAngle, 0.6);
      rp.swordScale = state.swordScale || 1;
      rp.swordGlowColor = state.swordGlowColor || rp.swordGlowColor;
      rp.swordGlowIntensity = state.swordGlowIntensity ?? 0.45;
      rp.isScytheForm = Boolean(state.isScytheForm);

      rp.colossusTimer = state.colossusTimer || 0;
      rp.boneStormTimer = state.boneStormTimer || 0;
      rp.ribShieldTimer = state.ribShieldTimer || 0;
      rp.undyingTimer = state.undyingTimer || 0;
      rp.stealthTimer = state.stealthTimer || 0;
      rp.ambushReady = Boolean(state.ambushReady);
      rp.bloodFrenzyTimer = state.bloodFrenzyTimer || 0;
      rp.frenzyStacks = state.frenzyStacks || 0;
      rp.phantomMistTimer = state.phantomMistTimer || 0;
      rp.possessingTimer = state.possessingTimer || 0;
      rp.nightmareTimer = state.nightmareTimer || 0;
      rp.pipeThrown = Boolean(state.pipeThrown);
      rp.kneeStrikeTimer = state.kneeStrikeTimer || 0;
      rp.lastStandTimer = state.lastStandTimer || 0;
      rp.oneManArmyTimer = state.oneManArmyTimer || 0;
      rp.airborneHeight = state.airborneHeight || 0;
      rp.wingFlapTimer = state.wingFlapTimer || 0;
      rp.rainOfFeathersTimer = state.rainOfFeathersTimer || 0;
      rp.celestialBarrageTimer = state.celestialBarrageTimer || 0;
      rp.celestialBarrageWings = state.celestialBarrageWings || 0;
      rp.wrathSkyTimer = state.wrathSkyTimer || 0;
      rp.kingOfBeastsTimer = state.kingOfBeastsTimer || 0;
      rp.tigerRoarTimer = state.tigerRoarTimer || 0;
    }

    for (const existingId of Array.from(this.remotePlayers.keys())) {
      if (!seenRemoteIds.has(existingId)) {
        this.remotePlayers.delete(existingId);
      }
    }

    for (const se of enemies) {
      const e = this.enemies.find((item) => item.id === se.id);
      if (e) {
        const jump = Math.hypot(se.x - e.x, se.y - e.y);
        const blend = jump > 220 ? 1.0 : 0.48;
        e.x += (se.x - e.x) * blend;
        e.y += (se.y - e.y) * blend;
        e.vx = se.vx;
        e.vy = se.vy;
        e.hp = se.hp;
        e.maxHp = se.maxHp;
        if (se.shieldHp !== undefined) e.shieldHp = se.shieldHp;
        if (se.maxShieldHp !== undefined) e.maxShieldHp = se.maxShieldHp;
        if (se.bossTransformTimer !== undefined) {
          e.bossTransformTimer = Math.max(e.bossTransformTimer || 0, se.bossTransformTimer);
        }
        if (se.bossBuffTimer !== undefined) {
          e.bossBuffTimer = Math.max(e.bossBuffTimer || 0, se.bossBuffTimer);
        }
        if (se.bossStealthTimer !== undefined) {
          e.bossStealthTimer = Math.max(e.bossStealthTimer || 0, se.bossStealthTimer);
        }
        if (se.bossScytheTimer !== undefined) {
          e.bossScytheTimer = Math.max(e.bossScytheTimer || 0, se.bossScytheTimer);
        }
        e.facing = this.blendAngle(e.facing, se.facing, 0.5);
        e.windupTimer = se.windupTimer;
        e.windupDuration = se.windupDuration;
        e.windupType = se.windupType;
        e.windupAngle = se.windupAngle;
        e.slowTimer = Math.max(e.slowTimer, se.slowTimer || 0);
        e.staggerTimer = Math.max(e.staggerTimer, se.staggerTimer || 0);
        e.poisonTimer = Math.max(e.poisonTimer, se.poisonTimer || 0);
        e.fearTimer = Math.max(e.fearTimer, se.fearTimer || 0);
        e.possessedTimer = Math.max(e.possessedTimer, se.possessedTimer || 0);
      } else if (se.hp > 0) {
        // Dynamically instantiate server-summoned Undead Legion minions & guards
        this.enemies.push({
          id: se.id,
          kind: se.kind,
          name:
            se.name ||
            (se.kind === EnemyKind.BOSS_LEGION_SKELETON
              ? 'Corrupted Skeleton'
              : se.kind === EnemyKind.BOSS_LEGION_ZOMBIE
                ? 'Corrupted Zombie'
                : se.kind === EnemyKind.BOSS_LEGION_GHOUL
                  ? 'Corrupted Ghoul'
                  : se.kind === EnemyKind.BOSS_LEGION_GHOST
                    ? 'Corrupted Ghost'
                    : se.kind === EnemyKind.MINI_SKELETON
                      ? 'Legion Boneblade'
                      : se.kind === EnemyKind.MINI_ZOMBIE
                        ? 'Legion Plaguebearer'
                        : se.kind === EnemyKind.MINI_GHOUL
                          ? 'Legion Shadow Stalker'
                          : se.kind === EnemyKind.MINI_GHOST
                            ? 'Legion Nether Spirit'
                            : 'Graveyard Foe'),
          x: se.x,
          y: se.y,
          vx: se.vx,
          vy: se.vy,
          radius: se.radius || (isMiniHeroKind(se.kind) ? 16 : 18),
          hp: se.hp,
          maxHp: se.maxHp,
          atk: 18,
          speed: 120,
          facing: se.facing,
          walkPhase: se.walkPhase,
          attackCooldown: 0.8,
          windupTimer: se.windupTimer,
          windupDuration: se.windupDuration,
          windupType: se.windupType,
          windupAngle: se.windupAngle,
          attackAnimTimer: 0,
          attackAnimDuration: 0.25,
          hitFlash: 0,
          roomId: se.roomId ?? 0,
          weaponAngle: 0,
          weaponSwing: 0,
          armorCrackTimer: 0,
          poisonTimer: se.poisonTimer || 0,
          poisonDps: 0,
          poisonTickAccum: 0,
          slowTimer: se.slowTimer || 0,
          preyMarkTimer: 0,
          pounceMarkTimer: 0,
          fearTimer: se.fearTimer || 0,
          possessedTimer: se.possessedTimer || 0,
          staggerTimer: se.staggerTimer || 0,
          shieldHp: se.shieldHp,
          maxShieldHp: se.maxShieldHp,
          isLegionBoss: se.isLegionBoss,
          legionHeroId: se.legionHeroId,
          bossTransformTimer: se.bossTransformTimer,
          bossBuffTimer: se.bossBuffTimer,
          bossStealthTimer: se.bossStealthTimer,
          bossScytheTimer: se.bossScytheTimer,
        });
        this.spawnRingEffect(se.x, se.y, 44, '#c084fc');
      }
    }
  }

  public handleRemotePlayerAttack(
    playerId: string,
    data: Omit<ClientAttackMessage, 'type'>
  ) {
    const rp = this.remotePlayers.get(playerId);
    if (!rp || rp.isDowned) return;

    rp.facing = data.facing;
    rp.swordAnim =
      data.comboStep === 1
        ? SwordAnimState.BASIC_1
        : data.comboStep === 2
          ? SwordAnimState.BASIC_2
          : data.comboStep === 4
            ? SwordAnimState.BASIC_4
            : SwordAnimState.BASIC_3;

    const isTransformed = rp.colossusTimer > 0;
    const reach = data.reach || (isTransformed ? 146 : 100);

    if (rp.heroId === 'human') {
      if (rp.pipeThrown) {
        soundEngine.playPipeSwing(1.28);
        this.spawnPipeStrike(
          'knee_burst',
          data.x + Math.cos(data.facing) * 10,
          data.y - 6 + Math.sin(data.facing) * 10,
          data.facing,
          82,
          1,
          0.18,
          '#fb923c',
          '#ffffff'
        );
        return;
      }
      if (data.comboStep === 3) {
        soundEngine.playPipeClang(1.04, false);
        this.spawnPipeStrike(
          'basic_batter',
          data.x,
          data.y - 8,
          data.facing,
          reach * 1.06,
          1,
          0.26,
          '#f97316',
          '#f8fafc'
        );
      } else {
        soundEngine.playPipeSwing(1.1);
        this.spawnPipeStrike(
          'basic_jab',
          data.x,
          data.y - 8,
          data.facing,
          reach * 0.94,
          data.comboStep === 2 ? -1 : 1,
          0.22,
          '#fb923c',
          '#e2e8f0'
        );
      }
    } else if (rp.heroId === 'ghost') {
      const originX = rp.swordX || data.x + Math.cos(data.facing - 0.8) * 26;
      const originY = rp.swordY || data.y - 14;
      const nearest = this.findNearestEnemyFrom(data.x, data.y, 350);
      const targetId = nearest ? nearest.id : -1;

      if (data.comboStep === 1 || data.comboStep === 2) {
        const bank = data.comboStep === 1 ? -0.38 : 0.38;
        const launchAng = data.facing + bank;
        soundEngine.playGhostWisp(1.1);
        this.spawnProjectile({
          fromPlayer: true,
          visualOnly: true,
          kind: 'ghost_wisp',
          x: originX,
          y: originY,
          vx: Math.cos(launchAng) * 440,
          vy: Math.sin(launchAng) * 440,
          angle: launchAng,
          radius: 13,
          damage: 0,
          isCrit: false,
          pierce: false,
          maxLife: 1.15,
          color: data.comboStep === 1 ? '#2dd4bf' : '#818cf8',
          targetEnemyId: targetId,
        });
      } else {
        soundEngine.playGhostWisp(0.88);
        this.spawnProjectile({
          fromPlayer: true,
          visualOnly: true,
          kind: 'ghost_soul_orb',
          x: originX,
          y: originY,
          vx: Math.cos(data.facing) * 395,
          vy: Math.sin(data.facing) * 395,
          angle: data.facing,
          radius: 18,
          damage: 0,
          isCrit: false,
          pierce: false,
          maxLife: 1.25,
          color: '#c084fc',
          targetEnemyId: targetId,
        });
        for (const flank of [-0.52, 0.52]) {
          const wAng = data.facing + flank;
          this.spawnProjectile({
            fromPlayer: true,
            visualOnly: true,
            kind: 'ghost_wisp',
            x: originX,
            y: originY,
            vx: Math.cos(wAng) * 455,
            vy: Math.sin(wAng) * 455,
            angle: wAng,
            radius: 11,
            damage: 0,
            isCrit: false,
            pierce: false,
            maxLife: 1.15,
            color: '#2dd4bf',
            targetEnemyId: targetId,
          });
        }
      }
    } else if (rp.heroId === 'ghoul') {
      soundEngine.playSlash(1.2);
      if (data.isAmbush) {
        this.spawnSlashWave(
          'shadow_ambush',
          data.x + Math.cos(data.facing) * 16,
          data.y - 8 + Math.sin(data.facing) * 16,
          data.facing,
          (reach + 24) * 0.9,
          Math.PI * 1.15,
          1,
          0.26,
          '#fff1f2',
          '#e11d48'
        );
      } else if (data.comboStep === 4) {
        this.spawnSlashWave(
          'feral_whirl',
          data.x,
          data.y - 8,
          data.facing,
          reach * 0.92,
          Math.PI * 1.9,
          1,
          0.26,
          '#fff1f2',
          '#e11d48'
        );
      } else {
        this.spawnSlashWave(
          data.comboStep === 3 ? 'twin_rend' : 'feral_slash',
          data.x,
          data.y - 8,
          data.facing,
          reach * 0.86,
          data.comboStep === 3 ? Math.PI * 1.08 : Math.PI * 0.86,
          data.comboStep === 2 ? -1 : 1,
          0.24,
          '#fff1f2',
          isTransformed ? '#f43f5e' : '#fb7185'
        );
      }
    } else if (rp.heroId === 'zombie') {
      soundEngine.playSlash(0.95);
      this.spawnSlashWave(
        data.comboStep === 3 ? 'cross_claw' : 'triple_claw',
        data.x,
        data.y - 8,
        data.facing,
        reach * 0.88,
        data.comboStep === 3 ? Math.PI * 1.06 : Math.PI * 0.86,
        data.comboStep === 2 ? -1 : 1,
        0.24,
        '#ecfccb',
        isTransformed ? '#c084fc' : '#a3e635'
      );
    } else if (rp.heroId === 'tigerkin') {
      if (data.comboStep === 2) {
        soundEngine.playFeralClaw(1.05, true);
        this.spawnSlashWave(
          'tiger_cross_rend',
          data.x,
          data.y - 8,
          data.facing,
          reach * 1.05,
          Math.PI * 1.15,
          1,
          0.26,
          '#fef08a',
          '#f59e0b'
        );
        this.spawnProjectile({
          fromPlayer: true,
          visualOnly: true,
          kind: 'tiger_rend_wave',
          x: data.x + Math.cos(data.facing) * 22,
          y: data.y - 8 + Math.sin(data.facing) * 22,
          vx: Math.cos(data.facing) * 600,
          vy: Math.sin(data.facing) * 600,
          angle: data.facing,
          radius: 26,
          damage: 0,
          isCrit: false,
          pierce: true,
          maxLife: 0.55,
          color: '#f59e0b',
        });
      } else {
        soundEngine.playFeralClaw(1.18, false);
        this.spawnSlashWave(
          'tiger_savage_slash',
          data.x,
          data.y - 8,
          data.facing,
          reach * 0.92,
          Math.PI * 0.95,
          1,
          0.22,
          '#fef08a',
          '#f59e0b'
        );
      }
    } else if (rp.heroId === 'eaglekin') {
      const spawnX = data.x + Math.cos(data.facing) * 16;
      const spawnY = data.y - 10 + Math.sin(data.facing) * 16;
      const eagleRange = data.reach || 340;
      rp.wingFlapTimer = 0.24;
      soundEngine.playWingFlap(data.comboStep === 3 ? 0.95 : 1.15);
      soundEngine.playFeatherShoot(data.comboStep === 3 ? 0.88 : 1.05);

      if (data.comboStep === 1) {
        this.spawnProjectile({
          fromPlayer: true,
          visualOnly: true,
          kind: 'feather_shot',
          x: spawnX,
          y: spawnY,
          vx: Math.cos(data.facing) * 640,
          vy: Math.sin(data.facing) * 640,
          angle: data.facing,
          radius: 14,
          damage: 0,
          isCrit: false,
          pierce: false,
          maxLife: eagleRange / 640 + 0.1,
          color: '#38bdf8',
        });
      } else if (data.comboStep === 2) {
        for (const sign of [-1, 1]) {
          const fAng = data.facing + sign * 0.08;
          this.spawnProjectile({
            fromPlayer: true,
            visualOnly: true,
            kind: 'double_feather',
            x: spawnX + Math.cos(fAng + Math.PI / 2) * (sign * 6),
            y: spawnY + Math.sin(fAng + Math.PI / 2) * (sign * 6),
            vx: Math.cos(fAng) * 660,
            vy: Math.sin(fAng) * 660,
            angle: fAng,
            radius: 13,
            damage: 0,
            isCrit: false,
            pierce: true,
            maxLife: eagleRange / 660 + 0.1,
            color: '#0284c7',
          });
        }
      } else {
        this.spawnProjectile({
          fromPlayer: true,
          visualOnly: true,
          kind: 'piercing_feather',
          x: spawnX,
          y: spawnY,
          vx: Math.cos(data.facing) * 780,
          vy: Math.sin(data.facing) * 780,
          angle: data.facing,
          radius: 22,
          damage: 0,
          isCrit: false,
          pierce: true,
          maxLife: eagleRange / 780 + 0.12,
          color: '#e0f2fe',
        });
        this.spawnRingEffect(spawnX, spawnY, 32, '#e0f2fe');
      }
    } else {
      soundEngine.playSlash(1.04);
      this.spawnSlashWave(
        'blade_arc',
        data.x,
        data.y - 8,
        data.facing,
        reach * 0.9,
        data.comboStep === 3 ? Math.PI * 1.15 : Math.PI * 0.88,
        data.comboStep === 2 ? -1 : 1,
        0.24,
        '#f8fafc',
        isTransformed ? '#fbbf24' : '#67e8f9'
      );
    }
  }

  public handleRemotePlayerSkill(
    playerId: string,
    data: Omit<ClientSkillMessage, 'type'>
  ) {
    const rp = this.remotePlayers.get(playerId);
    if (!rp) return;

    const skillId = data.skillId;
    const def = HERO_SKILLS[skillId];
    if (!def) return;

    const ang = data.angle;
    const dist = (data.distanceRatio || 0.65) * def.range;
    const tx = data.x + Math.cos(ang) * dist;
    const ty = data.y + Math.sin(ang) * dist;
    rp.facing = ang;

    // Authentic hero-specific VFX for all 5 heroes' active & ultimate skills
    switch (skillId) {
      // --- SKELETON ---
      case 'bone_slash':
        soundEngine.playSlash(1.22);
        this.spawnSlashWave('blade_arc', data.x, data.y - 8, ang, def.range * 0.88, def.radiusOrAngle, 1, 0.24, '#ffffff', def.glowColor);
        this.spawnArcBurst(data.x, data.y, ang, def.range * 0.75, def.glowColor, 14);
        break;
      case 'bone_spear':
        soundEngine.playSkill('spear');
        this.spawnProjectile({
          fromPlayer: true,
          visualOnly: true,
          kind: 'bone_spear',
          x: data.x + Math.cos(ang) * 24,
          y: data.y - 8 + Math.sin(ang) * 24,
          vx: Math.cos(ang) * 680,
          vy: Math.sin(ang) * 680,
          angle: ang,
          radius: 18,
          damage: 0,
          isCrit: false,
          pierce: true,
          maxLife: def.range / 680 + 0.08,
          color: def.glowColor,
        });
        break;
      case 'ribcage_shield':
        soundEngine.playSkill('shield');
        this.spawnRingEffect(data.x, data.y, def.range, '#fde68a');
        break;
      case 'skeletal_rush':
        soundEngine.playSkill('rush');
        this.spawnSoftMotes(data.x, data.y, ang, 46, '#67e8f9', 8);
        break;
      case 'bone_storm':
        soundEngine.playSkill('storm');
        rp.boneStormTimer = 4.5;
        this.spawnRingEffect(data.x, data.y, def.range, '#67e8f9');
        break;
      case 'bone_colossus':
        soundEngine.playSkill('ultimate');
        rp.colossusTimer = 8.5;
        this.spawnGroundEffect('enemy_slam_crack', data.x, data.y, 0, 0, 0, def.range * 0.85, 1.5, '#fde047', '#f59e0b');
        this.spawnRingEffect(data.x, data.y, def.range, '#fbbf24');
        break;
      case 'army_of_bones':
        soundEngine.playSkill('ultimate');
        this.spawnGroundEffect('grave_portal', tx, ty, 0, 0, 0, def.radiusOrAngle * 0.85, 2.2, '#4ade80', '#86efac');
        this.spawnRingEffect(tx, ty, def.radiusOrAngle, '#4ade80');
        break;
      case 'reapers_judgment':
        soundEngine.playSkill('ultimate');
        this.spawnSlashWave('boss_cleave', data.x, data.y - 10, ang, def.range * 0.92, def.radiusOrAngle, 1, 0.32, '#f8fafc', '#c084fc');
        this.spawnProjectile({
          fromPlayer: true,
          visualOnly: true,
          kind: 'dark_wave',
          x: data.x + Math.cos(ang) * 32,
          y: data.y - 8 + Math.sin(ang) * 32,
          vx: Math.cos(ang) * 460,
          vy: Math.sin(ang) * 460,
          angle: ang,
          radius: 42,
          damage: 0,
          isCrit: false,
          pierce: true,
          maxLife: 0.72,
          color: '#c084fc',
        });
        break;

      // --- ZOMBIE ---
      case 'rotting_claw':
        soundEngine.playSlash(0.95);
        this.spawnSlashWave('triple_claw', data.x, data.y - 8, ang, def.range * 0.88, def.radiusOrAngle, 1, 0.24, '#ecfccb', '#84cc16');
        this.spawnSlashWave('cross_claw', data.x, data.y - 8, ang, def.range * 0.94, def.radiusOrAngle, -1, 0.32, '#ecfccb', '#c084fc');
        break;
      case 'plague_burst':
        soundEngine.playSkill('storm');
        this.spawnToxicCloud(data.x, data.y, def.range, 4.2, 0);
        this.spawnGroundEffect('contagion_ring', data.x, data.y, 0, 0, 0, def.range * 1.08, 0.75, '#a3e635', '#a855f7');
        this.spawnRingEffect(data.x, data.y, def.range, '#a3e635');
        break;
      case 'flesh_ripper':
        soundEngine.playSkill('rush');
        this.spawnSlashWave('cross_claw', data.x + Math.cos(ang) * 28, data.y - 8 + Math.sin(ang) * 28, ang, 74, 1.4, 1, 0.25, '#ecfccb', '#fb7185');
        this.spawnGroundEffect('flesh_tear_track', data.x, data.y + 8, tx, ty + 8, ang, 85, 1.1, '#a3e635', '#fb7185');
        break;
      case 'undying_flesh':
        soundEngine.playSkill('shield');
        rp.undyingTimer = 5.5;
        this.spawnGroundEffect('contagion_ring', data.x, data.y, 0, 0, 0, 96, 0.65, '#4ade80', '#a3e635');
        this.spawnRingEffect(data.x, data.y, 98, '#22c55e');
        break;
      case 'grave_call':
        soundEngine.playSkill('spear');
        this.spawnGroundEffect('grave_portal', tx, ty, 0, 0, 0, def.radiusOrAngle * 0.92, 2.4, '#a855f7', '#a3e635');
        this.spawnRingEffect(tx, ty, def.radiusOrAngle, '#a855f7');
        break;
      case 'abomination_form':
        soundEngine.playSkill('ultimate');
        rp.colossusTimer = 9.0;
        this.spawnGroundEffect('plague_crater', data.x, data.y, 0, 0, 0.2, def.range, 1.7, '#a3e635', '#c084fc');
        this.spawnRingEffect(data.x, data.y, def.range, '#a3e635');
        break;
      case 'kingdom_of_the_dead':
        soundEngine.playSkill('ultimate');
        this.spawnGroundEffect('grave_portal', tx, ty, 0, 0, 0, def.radiusOrAngle, 2.8, '#84cc16', '#c084fc');
        this.spawnRingEffect(tx, ty, def.radiusOrAngle, '#84cc16');
        break;
      case 'deaths_embrace':
        soundEngine.playSkill('ultimate');
        this.spawnGroundEffect('plague_crater', data.x, data.y, 0, 0, 0, def.range, 2.0, '#a855f7', '#a3e635');
        this.spawnRingEffect(data.x, data.y, def.range, '#a855f7');
        this.spawnToxicCloud(data.x, data.y, def.range * 0.85, 3.6, 0);
        break;

      // --- GHOUL ---
      case 'rending_claws':
        soundEngine.playSlash(1.22);
        this.spawnSlashWave('feral_slash', data.x, data.y - 8, ang, def.range * 0.9, def.radiusOrAngle, 1, 0.22, '#fff1f2', '#fb7185');
        this.spawnSlashWave('twin_rend', data.x, data.y - 8, ang, def.range, def.radiusOrAngle * 1.1, -1, 0.3, '#fff1f2', '#e11d48');
        break;
      case 'feral_pounce':
        soundEngine.playSkill('rush');
        this.spawnGroundEffect('pounce_impact', tx, ty + 6, 0, 0, ang, 72, 0.65, '#fb7185', '#fda4af');
        this.spawnSlashWave('twin_rend', tx, ty - 8, ang, 78, Math.PI * 1.15, 1, 0.24, '#fff1f2', '#f43f5e');
        break;
      case 'shadow_stalker':
        soundEngine.playSkill('rush');
        this.spawnSoftMotes(data.x, data.y - 10, ang, 36, '#fda4af', 10);
        break;
      case 'blood_frenzy':
        soundEngine.playSkill('storm');
        rp.bloodFrenzyTimer = 5.0;
        this.spawnRingEffect(data.x, data.y, 92, '#f43f5e');
        break;
      case 'predators_leap':
        soundEngine.playSkill('rush');
        this.spawnGroundEffect('pounce_impact', tx, ty + 6, 0, 0, ang, def.radiusOrAngle, 0.85, '#f43f5e', '#fde047');
        this.spawnSlashWave('feral_whirl', tx, ty - 8, ang, def.radiusOrAngle * 1.05, Math.PI * 1.9, 1, 0.28, '#fff1f2', '#e11d48');
        break;
      case 'apex_predator':
        soundEngine.playSkill('ultimate');
        rp.colossusTimer = 9.0;
        this.spawnGroundEffect('pounce_impact', data.x, data.y + 6, 0, 0, 0, def.range, 1.1, '#e11d48', '#fda4af');
        this.spawnRingEffect(data.x, data.y, def.range, '#f43f5e');
        break;
      case 'carnage_unleashed':
      case 'king_of_the_hunt':
        soundEngine.playSkill('ultimate');
        this.spawnSlashWave('feral_whirl', data.x, data.y - 8, ang, 128, Math.PI * 1.9, 1, 0.3, '#fff1f2', '#e11d48');
        this.spawnRingEffect(data.x, data.y, 130, '#fb7185');
        break;

      // --- GHOST ---
      case 'spectral_bolt':
        soundEngine.playGhostWisp(0.95);
        this.spawnProjectile({
          fromPlayer: true,
          visualOnly: true,
          kind: 'spectral_bolt',
          x: data.x + Math.cos(ang) * 24,
          y: data.y - 12 + Math.sin(ang) * 24,
          vx: Math.cos(ang) * 620,
          vy: Math.sin(ang) * 620,
          angle: ang,
          radius: 22,
          damage: 0,
          isCrit: false,
          pierce: true,
          maxLife: def.range / 620 + 0.1,
          color: '#2dd4bf',
        });
        break;
      case 'phantom_dash':
        soundEngine.playGhostWisp(1.22);
        this.spawnGroundEffect('mist_node', data.x, data.y, 0, 0, ang, 54, 1.4, '#2dd4bf', '#818cf8');
        this.spawnGroundEffect('mist_node', tx, ty, 0, 0, ang, 58, 1.4, '#818cf8', '#2dd4bf');
        break;
      case 'soul_drain':
        soundEngine.playGhostWisp(0.86);
        this.spawnGroundEffect('astral_nova', data.x, data.y, 0, 0, 0, def.range * 0.72, 0.55, '#2dd4bf', '#818cf8');
        break;
      case 'wailing_scream':
        soundEngine.playSkill('storm');
        this.spawnGroundEffect('wailing_wave', data.x, data.y - 6, 0, 0, 0, def.range, 0.52, '#5eead4', '#818cf8');
        break;
      case 'haunted_possession':
        soundEngine.playGhostWisp(1.1);
        this.spawnGroundEffect('possession_burst', tx, ty, 0, 0, 0, 68, 0.5, '#c084fc', '#2dd4bf');
        break;
      case 'eternal_nightmare':
        soundEngine.playSkill('ultimate');
        rp.nightmareTimer = 8.0;
        this.spawnGroundEffect('wailing_wave', data.x, data.y, 0, 0, 0, def.range, 0.65, '#818cf8', '#c084fc');
        break;
      case 'spirit_legion':
        soundEngine.playSkill('ultimate');
        this.spawnGroundEffect('astral_nova', data.x, data.y, 0, 0, 0, 120, 0.55, '#2dd4bf', '#818cf8');
        break;
      case 'deaths_passage':
        soundEngine.playSkill('ultimate');
        this.spawnSpectralRift(tx, ty, def.radiusOrAngle, 1.55, 2.25, 0, 0);
        break;

      // --- HUMAN ---
      case 'pipe_swing':
        soundEngine.playPipeClang(0.96, false);
        this.spawnPipeStrike('wide_swing', data.x, data.y - 8, ang, def.range, 1, 0.25, '#fb923c', '#f8fafc');
        break;
      case 'headcracker':
        soundEngine.playPipeClang(0.85, true);
        this.spawnPipeStrike('overhead_slam', tx, ty - 6, ang, def.radiusOrAngle * 1.15, 1, 0.28, '#f97316', '#fde047');
        this.spawnGroundEffect('headcracker_dent', tx, ty + 4, 0, 0, ang, def.radiusOrAngle * 1.18, 1.15, '#fb923c', '#fde047');
        break;
      case 'scrappers_dash':
        soundEngine.playPipeSwing(1.15);
        this.spawnPipeStrike('street_sweep', data.x + Math.cos(ang) * 20, data.y - 8 + Math.sin(ang) * 20, ang, 74, 1, 0.22, '#fb923c', '#e2e8f0');
        this.spawnGroundEffect('scrapper_skid_track', data.x, data.y + 8, tx, ty + 8, ang, 96, 1.1, '#fb923c', '#e2e8f0');
        break;
      case 'improvised_throw':
        soundEngine.playPipeSwing(1.26);
        this.spawnProjectile({
          fromPlayer: true,
          visualOnly: true,
          kind: 'thrown_pipe',
          x: data.x + Math.cos(ang) * 22,
          y: data.y - 10 + Math.sin(ang) * 22,
          vx: Math.cos(ang) * 660,
          vy: Math.sin(ang) * 660,
          angle: ang,
          radius: 26,
          damage: 0,
          isCrit: false,
          pierce: true,
          maxLife: 0.9,
          color: '#fb923c',
          returning: false,
          spinAngle: ang,
        });
        break;
      case 'street_fighter':
        soundEngine.playPipeClang(0.95, true);
        this.spawnGroundEffect('brawler_stance_ring', data.x, data.y + 4, 0, 0, ang, def.range * 0.76, 0.52, '#f59e0b', '#f8fafc');
        this.spawnPipeStrike('street_sweep', data.x, data.y - 8, ang, def.range, 1, 0.28, '#f59e0b', '#ffffff');
        break;
      case 'last_stand':
        soundEngine.playSkill('ultimate');
        soundEngine.playPipeClang(0.84, true);
        rp.lastStandTimer = 4.5;
        this.spawnGroundEffect('brawler_stance_ring', data.x, data.y + 4, 0, 0, 0, 125, 0.65, '#f97316', '#fde047');
        this.spawnPipeStrike('last_stand_cleave', data.x, data.y - 8, ang, 190, 1, 0.28, '#f97316', '#fde047');
        break;
      case 'scrapstorm':
        soundEngine.playSkill('ultimate');
        soundEngine.playPipeClang(0.8, true);
        this.spawnGroundEffect('headcracker_dent', data.x, data.y + 4, 0, 0, ang, 135, 0.95, '#94a3b8', '#fb923c');
        this.spawnPipeStrike('street_sweep', data.x, data.y - 8, ang, 142, 1, 0.28, '#fb923c', '#cbd5e1');
        break;
      case 'one_man_army':
        soundEngine.playSkill('ultimate');
        rp.oneManArmyTimer = 1.65;
        this.spawnGroundEffect('brawler_stance_ring', data.x, data.y + 4, 0, 0, 0, 118, 0.55, '#fb923c', '#ffffff');
        this.spawnPipeStrike('street_sweep', data.x, data.y - 8, ang, 165, 1, 0.28, '#fb923c', '#ffffff');
        break;

      // --- EAGLEKIN ---
      case 'piercing_volley':
        soundEngine.playWingFlap(1.22);
        soundEngine.playFeatherShoot(1.1);
        rp.wingFlapTimer = 0.35;
        this.spawnArcBurst(data.x, data.y - 10, ang, def.range * 0.5, '#38bdf8', 12);
        break;
      case 'homing_feathers':
        soundEngine.playWingFlap(1.15);
        soundEngine.playFeatherShoot(1.25);
        rp.wingFlapTimer = 0.35;
        this.spawnRingEffect(data.x, data.y - 10, 52, '#06b6d4');
        break;
      case 'hunters_mark':
        soundEngine.playSkyScreech(1.2);
        rp.wingFlapTimer = 0.3;
        this.spawnRingEffect(tx, ty, 48, '#38bdf8');
        break;
      case 'windstep':
        soundEngine.playWingFlap(0.9);
        soundEngine.playSkill('rush');
        rp.wingFlapTimer = 0.32;
        this.spawnRingEffect(data.x, data.y, 75, '#38bdf8');
        break;
      case 'rain_of_feathers':
        soundEngine.playWingFlap(1.05);
        soundEngine.playSkill('storm');
        rp.airborneHeight = 28;
        rp.rainOfFeathersTimer = 3.0;
        this.spawnRingEffect(tx, ty, def.radiusOrAngle, '#38bdf8');
        break;
      case 'wrath_of_the_sky':
        soundEngine.playSkyScreech(0.9);
        soundEngine.playSkill('ultimate');
        rp.airborneHeight = 44;
        rp.wrathSkyTimer = 4.2;
        this.spawnRingEffect(tx, ty, def.radiusOrAngle, '#0284c7');
        break;
      case 'celestial_barrage':
        soundEngine.playSkyScreech(1.1);
        soundEngine.playSkill('ultimate');
        rp.celestialBarrageTimer = 8.5;
        rp.celestialBarrageWings = 4;
        this.spawnRingEffect(data.x, data.y, 110, '#38bdf8');
        break;
      case 'final_horizon':
        soundEngine.playSkyScreech(0.85);
        soundEngine.playSkill('ultimate');
        rp.wingFlapTimer = 0.5;
        this.spawnRingEffect(data.x, data.y - 10, 68, '#38bdf8');
        break;

      // --- TIGERKIN ---
      case 'predators_pounce':
        soundEngine.playSkill('rush');
        this.spawnSlashWave('crushing_paw_shock', tx, ty - 8, ang, def.radiusOrAngle * 1.25, Math.PI * 1.4, 1, 0.28, '#fef08a', '#f59e0b');
        this.spawnGroundEffect('tiger_crush_crater', tx, ty, 0, 0, ang, def.radiusOrAngle, 1.2, '#f59e0b', '#fef08a');
        this.spawnRingEffect(tx, ty, def.radiusOrAngle * 1.1, '#f59e0b');
        break;
      case 'rending_flurry':
        soundEngine.playFeralClaw(1.25, false);
        this.spawnSlashWave('rending_flurry_slash', data.x, data.y - 8, ang, def.range * 0.95, def.radiusOrAngle, 1, 0.24, '#fef08a', '#f59e0b');
        break;
      case 'tigers_roar':
        soundEngine.playTigerRoar(1.0);
        rp.tigerRoarTimer = 4.0;
        this.spawnGroundEffect('tiger_roar_burst', data.x, data.y, 0, 0, 0, def.range, 0.65, '#f59e0b', '#fbbf24');
        this.spawnRingEffect(data.x, data.y, def.range, '#f59e0b');
        break;
      case 'savage_pursuit':
        soundEngine.playSkill('rush');
        this.spawnGroundEffect('savage_pursuit_track', data.x, data.y, tx, ty, ang, 90, 0.45, '#f59e0b', '#fef08a');
        this.spawnSlashWave('tiger_cross_rend', tx, ty - 8, ang, 85, Math.PI * 1.1, 1, 0.26, '#fef08a', '#f59e0b');
        break;
      case 'crushing_paw':
        soundEngine.playSkill('ultimate');
        this.spawnGroundEffect('tiger_crush_crater', data.x, data.y, 0, 0, ang, def.radiusOrAngle, 1.3, '#f59e0b', '#fef08a');
        this.spawnSlashWave('crushing_paw_shock', data.x, data.y - 8, ang, def.radiusOrAngle * 1.15, Math.PI * 1.4, 1, 0.28, '#fef08a', '#f59e0b');
        break;
      case 'king_of_beasts':
        soundEngine.playTigerRoar(0.9);
        rp.kingOfBeastsTimer = 10.0;
        this.spawnRingEffect(data.x, data.y, def.range, '#fbbf24');
        this.spawnGroundEffect('tiger_roar_burst', data.x, data.y, 0, 0, 0, def.range, 0.8, '#fbbf24', '#f59e0b');
        break;
      case 'heavenly_tiger':
        soundEngine.playTigerRoar(1.1);
        this.spawnProjectile({
          fromPlayer: true,
          visualOnly: true,
          kind: 'heavenly_tiger_beast',
          x: data.x,
          y: data.y - 12,
          vx: Math.cos(ang) * 680,
          vy: Math.sin(ang) * 680,
          angle: ang,
          radius: 75,
          damage: 0,
          isCrit: false,
          pierce: true,
          maxLife: 0.95,
          color: '#fbbf24',
        });
        break;
      case 'apex_devastation':
        soundEngine.playTigerRoar(0.85);
        this.spawnGroundEffect('apex_shockwave_ring', tx, ty, 0, 0, ang, def.radiusOrAngle, 1.5, '#fbbf24', '#f59e0b');
        this.spawnSlashWave('apex_claw_fissure', tx, ty - 8, ang, def.radiusOrAngle * 1.15, Math.PI * 1.6, 1, 0.35, '#fef08a', '#f59e0b');
        break;
    }
  }

  public handleRemotePlayerDamaged(
    playerId: string,
    hp: number,
    shield: number,
    damage: number,
    isDowned: boolean
  ) {
    const localId = multiplayerClient.getLocalPlayerId();
    if (playerId === localId) {
      this.player.hp = hp;
      this.player.shield = shield;
      if (shield <= 0) {
        this.player.ribShieldTimer = 0;
      }
      if (damage > 0) {
        this.player.hitFlash = 0.14;
        this.triggerShake(0.12, 4);
        soundEngine.playHit(false);
        this.spawnFloatingText(this.player.x, this.player.y - 32, `-${damage}`, '#fb7185', false);
      } else {
        this.spawnFloatingText(this.player.x, this.player.y - 32, 'BLOCKED', '#fde68a', false);
      }
      if (isDowned) {
        this.localIsDowned = true;
        this.player.isDowned = true;
        this.aimState.active = false;
        this.basicAttackHeld = false;
      }
      this.emitHudSnapshot();
      return;
    }

    const rp = this.remotePlayers.get(playerId);
    if (rp) {
      rp.hp = hp;
      rp.shield = shield;
      rp.hitFlash = 0.14;
      rp.isDowned = isDowned;
      if (damage > 0) {
        this.spawnFloatingText(rp.x, rp.y - 32, `-${damage}`, '#fb7185', false);
      }
    }
  }

  public handleRemoteEnemyAttack(evt: SyncEnemyAttackEvent) {
    const e = this.enemies.find((item) => item.id === evt.enemyId);
    if (e) {
      e.x = evt.endX ?? evt.x;
      e.y = evt.endY ?? evt.y;
      e.facing = evt.angle;
      e.windupTimer = 0;
      e.weaponSwing = 1.65;
      e.attackAnimDuration =
        evt.attackType === 'slam' || evt.attackType === 'nova' || evt.attackType === 'frost_nova'
          ? 0.35
          : 0.26;
      e.attackAnimTimer = e.attackAnimDuration;
    }

    if (evt.skillLabel) {
      this.spawnFloatingText(
        (evt.endX ?? evt.x),
        (evt.endY ?? evt.y) - 48,
        evt.skillLabel,
        evt.skillColor || '#fde047',
        true
      );
    }

    // Authentic Undead Legion Hero Skill & Basic Attack VFX in Multiplayer!
    if (evt.legionSkillId) {
      const sx = evt.x;
      const sy = evt.y;
      const ex = evt.endX ?? evt.x;
      const ey = evt.endY ?? evt.y;
      const ang = evt.angle;
      switch (evt.legionSkillId) {
        // --- CORRUPTED SKELETON ---
        case 'skeleton_basic':
          soundEngine.playSlash(1.18);
          this.spawnSlashWave('blade_arc', sx, sy - 8, ang, 108, 1.5, 1, 0.24, '#ffffff', '#67e8f9');
          this.spawnArcBurst(sx, sy, ang, 86, '#67e8f9', 10);
          return;
        case 'bone_slash':
          soundEngine.playSlash(1.22);
          this.spawnSlashWave('blade_arc', sx, sy - 8, ang, 118, 1.65, 1, 0.25, '#ffffff', '#67e8f9');
          this.spawnArcBurst(sx, sy, ang, 95, '#67e8f9', 16);
          return;
        case 'bone_spear':
          soundEngine.playSkill('spear');
          this.spawnProjectile({
            fromPlayer: false,
            visualOnly: true,
            kind: 'bone_spear',
            x: sx + Math.cos(ang) * 26,
            y: sy - 8 + Math.sin(ang) * 26,
            vx: Math.cos(ang) * 440,
            vy: Math.sin(ang) * 440,
            angle: ang,
            radius: 16,
            damage: 0,
            isCrit: false,
            pierce: true,
            maxLife: 1.4,
            color: '#67e8f9',
          });
          return;
        case 'ribcage_shield':
          soundEngine.playSkill('shield');
          if (e) e.bossBuffTimer = 6.0;
          this.spawnRingEffect(sx, sy, 95, '#fde68a');
          return;
        case 'skeletal_rush':
          soundEngine.playSkill('rush');
          this.spawnGroundEffect('flesh_tear_track', sx, sy + 8, ex, ey + 8, ang, 88, 0.85, '#67e8f9', '#f8fafc');
          this.spawnSlashWave('blade_arc', ex, ey - 8, ang, 92, 1.45, 1, 0.24, '#ffffff', '#67e8f9');
          return;
        case 'bone_storm':
          soundEngine.playSkill('storm');
          if (e) e.bossBuffTimer = 4.5;
          this.spawnSlashWave('feral_whirl', sx, sy - 8, ang, 120, Math.PI * 1.95, 1, 0.3, '#ffffff', '#67e8f9');
          this.spawnRingEffect(sx, sy, 120, '#67e8f9');
          return;
        case 'bone_colossus':
          soundEngine.playSkill('ultimate');
          if (e) e.bossTransformTimer = 8.5;
          this.triggerShake(0.24, 6);
          this.spawnGroundEffect('enemy_slam_crack', sx, sy, 0, 0, 0, 130, 1.5, '#fde047', '#f59e0b');
          this.spawnRingEffect(sx, sy, 150, '#fbbf24');
          for (let k = 0; k < 10; k++) {
            const sa = (k * Math.PI * 2) / 10;
            this.spawnProjectile({
              fromPlayer: false,
              visualOnly: true,
              kind: 'bone_spear',
              x: sx + Math.cos(sa) * 28,
              y: sy + Math.sin(sa) * 28,
              vx: Math.cos(sa) * 290,
              vy: Math.sin(sa) * 290,
              angle: sa,
              radius: 12,
              damage: 0,
              isCrit: false,
              pierce: false,
              maxLife: 1.8,
              color: '#fde047',
            });
          }
          return;
        case 'army_of_bones':
          soundEngine.playSkill('ultimate');
          this.spawnGroundEffect('grave_portal', sx, sy, 0, 0, 0, 105, 2.2, '#4ade80', '#86efac');
          this.spawnRingEffect(sx, sy, 115, '#4ade80');
          return;
        case 'reapers_judgment':
          soundEngine.playSkill('ultimate');
          if (e) e.bossScytheTimer = 1.4;
          this.triggerShake(0.26, 7);
          this.spawnSlashWave('boss_cleave', ex, ey - 10, ang, 140, Math.PI * 1.6, 1, 0.34, '#f8fafc', '#c084fc');
          this.spawnProjectile({
            fromPlayer: false,
            visualOnly: true,
            kind: 'dark_wave',
            x: ex + Math.cos(ang) * 30,
            y: ey - 8 + Math.sin(ang) * 30,
            vx: Math.cos(ang) * 390,
            vy: Math.sin(ang) * 390,
            angle: ang,
            radius: 38,
            damage: 0,
            isCrit: false,
            pierce: true,
            maxLife: 0.95,
            color: '#c084fc',
          });
          return;

        // --- CORRUPTED ZOMBIE ---
        case 'zombie_basic':
          soundEngine.playSlash(0.95);
          this.spawnSlashWave('triple_claw', sx, sy - 8, ang, 100, 1.45, 1, 0.24, '#ecfccb', '#a3e635');
          return;
        case 'rotting_claw':
          soundEngine.playSlash(0.95);
          this.spawnSlashWave('triple_claw', sx, sy - 8, ang, 106, 1.5, 1, 0.24, '#ecfccb', '#84cc16');
          this.spawnSlashWave('cross_claw', sx, sy - 8, ang, 112, 1.55, -1, 0.32, '#ecfccb', '#c084fc');
          return;
        case 'plague_burst':
          soundEngine.playSkill('storm');
          this.spawnGroundEffect('contagion_ring', ex, ey, 0, 0, 0, 115, 0.75, '#a3e635', '#a855f7');
          this.spawnToxicCloud(ex, ey, 95, 4.0, 0, false);
          this.spawnRingEffect(ex, ey, 105, '#a3e635');
          return;
        case 'flesh_ripper':
          soundEngine.playSkill('rush');
          this.spawnSlashWave('cross_claw', ex, ey - 8, ang, 86, 1.45, 1, 0.26, '#ecfccb', '#fb7185');
          this.spawnGroundEffect('flesh_tear_track', sx, sy + 8, ex, ey + 8, ang, 95, 1.0, '#a3e635', '#fb7185');
          return;
        case 'undying_flesh':
          soundEngine.playSkill('shield');
          if (e) e.bossBuffTimer = 5.5;
          this.spawnGroundEffect('contagion_ring', sx, sy, 0, 0, 0, 96, 0.65, '#4ade80', '#a3e635');
          this.spawnRingEffect(sx, sy, 98, '#22c55e');
          return;
        case 'grave_call':
          soundEngine.playSkill('spear');
          this.spawnGroundEffect('grave_portal', sx, sy, 0, 0, 0, 95, 2.4, '#a855f7', '#a3e635');
          this.spawnRingEffect(sx, sy, 98, '#a855f7');
          return;
        case 'abomination_form':
          soundEngine.playSkill('ultimate');
          if (e) e.bossTransformTimer = 9.0;
          this.triggerShake(0.26, 7);
          this.spawnGroundEffect('plague_crater', sx, sy, 0, 0, 0.2, 145, 1.7, '#a3e635', '#c084fc');
          this.spawnRingEffect(sx, sy, 150, '#84cc16');
          this.spawnToxicCloud(sx, sy, 95, 4.5, 0, false);
          return;
        case 'kingdom_of_the_dead':
          soundEngine.playSkill('ultimate');
          this.spawnGroundEffect('kingdom_sigil', ex, ey, 0, 0, 0, 145, 4.0, '#4ade80', '#c084fc');
          this.spawnRingEffect(ex, ey, 145, '#4ade80');
          return;
        case 'deaths_embrace':
          soundEngine.playSkill('ultimate');
          this.triggerShake(0.28, 7.5);
          this.spawnGroundEffect('plague_crater', sx, sy, 0, 0, 0, 165, 2.0, '#a855f7', '#a3e635');
          this.spawnGroundEffect('contagion_ring', sx, sy, 0, 0, 0, 170, 0.85, '#c084fc', '#4ade80');
          this.spawnRingEffect(sx, sy, 165, '#a855f7');
          return;

        // --- CORRUPTED GHOUL ---
        case 'ghoul_basic':
          soundEngine.playSlash(1.25);
          this.spawnSlashWave('feral_slash', sx, sy - 8, ang, 98, 1.45, 1, 0.22, '#fff1f2', '#fb7185');
          return;
        case 'rending_claws':
          soundEngine.playSlash(1.26);
          this.spawnSlashWave('feral_slash', sx, sy - 8, ang, 102, 1.5, 1, 0.22, '#fff1f2', '#fb7185');
          this.spawnSlashWave('rending_finale', sx, sy - 8, ang, 112, 1.65, -1, 0.28, '#fff1f2', '#e11d48');
          this.spawnProjectile({
            fromPlayer: false,
            visualOnly: true,
            kind: 'crimson_rend_wave',
            x: sx + Math.cos(ang) * 28,
            y: sy - 8 + Math.sin(ang) * 28,
            vx: Math.cos(ang) * 430,
            vy: Math.sin(ang) * 430,
            angle: ang,
            radius: 30,
            damage: 0,
            isCrit: false,
            pierce: true,
            maxLife: 0.55,
            color: '#f43f5e',
          });
          return;
        case 'feral_pounce':
          soundEngine.playSkill('rush');
          this.spawnGroundEffect('predator_crater', ex, ey, 0, 0, ang, 76, 1.1, '#f43f5e', '#fb7185');
          this.spawnSlashWave('twin_rend', ex, ey - 8, ang, 84, Math.PI * 1.15, 1, 0.24, '#fff1f2', '#e11d48');
          return;
        case 'shadow_stalker':
          soundEngine.playSkill('rush');
          if (e) e.bossStealthTimer = 1.8;
          this.spawnGroundEffect('shadow_smoke_ring', sx, sy, 0, 0, 0, 64, 0.5, '#4c0519', '#fb7185');
          this.spawnGroundEffect('shadow_smoke_ring', ex, ey, 0, 0, 0, 68, 0.5, '#4c0519', '#fb7185');
          this.spawnSlashWave('shadow_ambush', ex, ey - 8, ang, 86, Math.PI * 1.15, 1, 0.26, '#fff1f2', '#e11d48');
          return;
        case 'blood_frenzy':
          soundEngine.playSkill('storm');
          if (e) e.bossBuffTimer = 5.0;
          this.spawnRingEffect(sx, sy, 92, '#fb7185');
          return;
        case 'predators_leap':
          soundEngine.playSkill('rush');
          this.spawnGroundEffect('predator_crater', ex, ey, 0, 0, ang, 92, 1.25, '#f43f5e', '#fda4af');
          this.spawnSlashWave('feral_whirl', ex, ey - 8, ang, 102, Math.PI * 1.95, 1, 0.28, '#fff1f2', '#e11d48');
          return;
        case 'apex_predator':
          soundEngine.playSkill('ultimate');
          if (e) e.bossTransformTimer = 8.5;
          this.spawnGroundEffect('predator_crater', sx, sy, 0, 0, 0, 125, 1.5, '#f43f5e', '#fda4af');
          this.spawnSlashWave('feral_whirl', sx, sy - 10, ang, 125, Math.PI * 2, 1, 0.32, '#fff1f2', '#e11d48');
          this.spawnRingEffect(sx, sy, 130, '#fb7185');
          return;
        case 'carnage_unleashed':
          soundEngine.playSkill('ultimate');
          this.spawnGroundEffect('carnage_dash_line', sx, sy - 4, ex, ey - 4, ang, 95, 0.45, '#fb7185', '#fff1f2');
          this.spawnSlashWave('feral_whirl', ex, ey - 8, ang, 130, Math.PI * 1.95, 1, 0.32, '#fff1f2', '#f43f5e');
          for (let k = 0; k < 12; k++) {
            const sa = (k * Math.PI * 2) / 12;
            this.spawnProjectile({
              fromPlayer: false,
              visualOnly: true,
              kind: 'crimson_rend_wave',
              x: ex + Math.cos(sa) * 26,
              y: ey + Math.sin(sa) * 26,
              vx: Math.cos(sa) * 320,
              vy: Math.sin(sa) * 320,
              angle: sa,
              radius: 14,
              damage: 0,
              isCrit: false,
              pierce: false,
              maxLife: 1.2,
              color: '#f43f5e',
            });
          }
          return;
        case 'king_of_the_hunt':
          soundEngine.playSkill('ultimate');
          this.spawnGroundEffect('shadow_smoke_ring', sx, sy, 0, 0, 0, 118, 0.65, '#4c0519', '#fb7185');
          this.spawnSlashWave('shadow_ambush', ex, ey - 8, ang, 92, Math.PI * 1.25, 1, 0.28, '#fff1f2', '#e11d48');
          this.spawnRingEffect(ex, ey, 110, '#e11d48');
          return;

        // --- CORRUPTED GHOST ---
        case 'ghost_basic':
          soundEngine.playGhostWisp(1.05);
          for (const off of [-0.25, 0.25]) {
            const wa = ang + off;
            this.spawnProjectile({
              fromPlayer: false,
              visualOnly: true,
              kind: 'ghost_wisp',
              x: sx + Math.cos(wa) * 24,
              y: sy - 12 + Math.sin(wa) * 24,
              vx: Math.cos(wa) * 285,
              vy: Math.sin(wa) * 285,
              angle: wa,
              radius: 11,
              damage: 0,
              isCrit: false,
              pierce: false,
              maxLife: 1.5,
              color: off < 0 ? '#2dd4bf' : '#818cf8',
            });
          }
          return;
        case 'spectral_bolt':
          soundEngine.playGhostWisp(0.92);
          this.spawnGroundEffect('astral_nova', sx + Math.cos(ang) * 22, sy - 12 + Math.sin(ang) * 22, 0, 0, ang, 38, 0.28, '#2dd4bf', '#818cf8');
          for (let s = 0; s < 3; s++) {
            const sa = ang + (s - 1) * 0.28;
            this.spawnProjectile({
              fromPlayer: false,
              visualOnly: true,
              kind: 'spectral_bolt',
              x: sx + Math.cos(sa) * 24,
              y: sy - 10 + Math.sin(sa) * 24,
              vx: Math.cos(sa) * 320,
              vy: Math.sin(sa) * 320,
              angle: sa,
              radius: 14,
              damage: 0,
              isCrit: false,
              pierce: true,
              maxLife: 1.6,
              color: '#2dd4bf',
            });
          }
          return;
        case 'phantom_dash':
          soundEngine.playGhostWisp(1.22);
          if (e) e.bossStealthTimer = 0.65;
          this.spawnGroundEffect('spectral_mist_node', sx, sy, 0, 0, ang, 54, 1.5, '#2dd4bf', '#818cf8');
          this.spawnGroundEffect('spectral_mist_node', (sx + ex) * 0.5, (sy + ey) * 0.5, 0, 0, ang, 48, 1.5, '#818cf8', '#2dd4bf');
          this.spawnGroundEffect('spectral_mist_node', ex, ey, 0, 0, ang, 58, 1.5, '#2dd4bf', '#818cf8');
          return;
        case 'soul_drain':
          soundEngine.playGhostWisp(0.86);
          this.spawnGroundEffect('astral_nova', sx, sy, 0, 0, 0, 96, 0.6, '#2dd4bf', '#818cf8');
          this.spawnSiphonBeam(ex, ey - 10, 0.5, '#5eead4');
          return;
        case 'wailing_scream':
          soundEngine.playWail();
          this.triggerShake(0.18, 4.5);
          this.spawnGroundEffect('wailing_wave', sx, sy - 6, 0, 0, 0, 125, 0.55, '#5eead4', '#818cf8');
          this.spawnRingEffect(sx, sy, 125, '#c084fc');
          return;
        case 'haunted_possession':
          soundEngine.playGhostWisp(1.1);
          this.spawnGroundEffect('possession_burst', ex, ey, 0, 0, 0, 74, 0.55, '#c084fc', '#2dd4bf');
          this.spawnBurstParticles(ex, ey, '#c084fc', 14, true);
          return;
        case 'eternal_nightmare':
          soundEngine.playSkill('ultimate');
          if (e) e.bossTransformTimer = 8.5;
          this.spawnGroundEffect('wailing_wave', sx, sy, 0, 0, 0, 150, 0.7, '#818cf8', '#c084fc');
          this.spawnGroundEffect('astral_nova', ex, ey, 0, 0, 0, 130, 1.5, '#818cf8', '#2dd4bf');
          return;
        case 'spirit_legion':
          soundEngine.playSkill('ultimate');
          this.spawnGroundEffect('astral_nova', sx, sy, 0, 0, 0, 125, 0.6, '#2dd4bf', '#818cf8');
          for (let k = 0; k < 12; k++) {
            const sa = (k * Math.PI * 2) / 12;
            this.spawnProjectile({
              fromPlayer: false,
              visualOnly: true,
              kind: 'ghost_wisp',
              x: sx + Math.cos(sa) * 25,
              y: sy + Math.sin(sa) * 25,
              vx: Math.cos(sa) * 260,
              vy: Math.sin(sa) * 260,
              angle: sa,
              radius: 10,
              damage: 0,
              isCrit: false,
              pierce: false,
              maxLife: 1.9,
              color: k % 2 === 0 ? '#2dd4bf' : '#c084fc',
            });
          }
          return;
        case 'deaths_passage':
          soundEngine.playSkill('ultimate');
          this.spawnGroundEffect('astral_nova', ex, ey, 0, 0, 0, 135, 1.6, '#c084fc', '#5eead4');
          this.spawnRingEffect(ex, ey, 135, '#c084fc');
          return;
      }
    }

    const isBoss = Boolean(evt.isBoss || isBossKind(evt.kind));
    const attackRad = evt.radius ?? 24;

    if (evt.attackType === 'slash') {
      soundEngine.playSlash(1.28);
      this.spawnSlashWave(
        isBoss ? 'boss_cleave' : 'enemy_slash',
        evt.x,
        evt.y - 8,
        evt.angle,
        isBoss ? attackRad + 68 : attackRad + 44,
        1.45,
        1,
        0.22,
        '#ffe4e6',
        isBoss ? '#f43f5e' : '#fb7185'
      );
      this.spawnArcBurst(evt.x, evt.y, evt.angle, attackRad + 36, '#fb7185', 8);
    } else if (evt.attackType === 'whirlwind') {
      const whirlRad = evt.radius ?? (isBoss ? 130 : attackRad + 56);
      soundEngine.playSlash(1.1);
      this.triggerShake(isBoss ? 0.18 : 0.08, isBoss ? 4.5 : 2.5);
      this.spawnSlashWave(
        'feral_whirl',
        evt.x,
        evt.y - 8,
        evt.angle,
        whirlRad,
        Math.PI * 1.95,
        1,
        0.26,
        '#ffe4e6',
        isBoss ? '#f43f5e' : '#fb7185'
      );
      this.spawnRingEffect(evt.x, evt.y, whirlRad, isBoss ? '#f43f5e' : '#fb7185');
    } else if (evt.attackType === 'thrust') {
      soundEngine.playSlash(1.4);
      const reach = isBoss ? 160 : 110;
      if (e && evt.endX !== undefined && evt.endY !== undefined) {
        e.x = evt.endX;
        e.y = evt.endY;
      }
      this.spawnSlashWave(
        'twin_rend',
        evt.endX ?? evt.x,
        (evt.endY ?? evt.y) - 8,
        evt.angle,
        reach * 0.7,
        0.8,
        1,
        0.2,
        '#ffffff',
        '#fb7185'
      );
    } else if (evt.attackType === 'cross_slash') {
      soundEngine.playSlash(1.32);
      this.triggerShake(0.12, 3.6);
      const crossRad = isBoss ? 115 : 78;
      this.spawnSlashWave(
        'twin_rend',
        evt.x,
        evt.y - 8,
        evt.angle - 0.3,
        crossRad,
        1.45,
        1,
        0.24,
        '#ffe4e6',
        '#e11d48'
      );
      this.spawnSlashWave(
        'twin_rend',
        evt.x,
        evt.y - 8,
        evt.angle + 0.3,
        crossRad,
        1.45,
        -1,
        0.24,
        '#fef2f2',
        '#fb7185'
      );
      this.spawnProjectile({
        fromPlayer: false,
        visualOnly: true,
        kind: 'boss_shard',
        x: evt.x + Math.cos(evt.angle) * 24,
        y: evt.y + Math.sin(evt.angle) * 24,
        vx: Math.cos(evt.angle) * 320,
        vy: Math.sin(evt.angle) * 320,
        angle: evt.angle,
        radius: 10,
        damage: 0,
        isCrit: false,
        pierce: false,
        maxLife: 1.4,
        color: '#f43f5e',
      });
    } else if (evt.attackType === 'frost_nova') {
      soundEngine.playSkill('shield');
      this.triggerShake(0.16, 4.2);
      const frostRad = isBoss ? 140 : 96;
      this.spawnGroundEffect('astral_nova', evt.x, evt.y, 0, 0, 0, frostRad, 1.35, '#38bdf8', '#818cf8');
      this.spawnRingEffect(evt.x, evt.y, frostRad, '#38bdf8');
      this.spawnBurstParticles(evt.x, evt.y, '#bae6fd', 18, true);
      const count = isBoss ? 10 : 6;
      for (let k = 0; k < count; k++) {
        const sa = evt.angle + (k * Math.PI * 2) / count;
        this.spawnProjectile({
          fromPlayer: false,
          visualOnly: true,
          kind: 'spectral_bolt',
          x: evt.x + Math.cos(sa) * 22,
          y: evt.y + Math.sin(sa) * 22,
          vx: Math.cos(sa) * 235,
          vy: Math.sin(sa) * 235,
          angle: sa,
          radius: 8,
          damage: 0,
          isCrit: false,
          pierce: false,
          maxLife: 1.7,
          color: '#38bdf8',
        });
      }
    } else if (evt.attackType === 'slam') {
      const slamRad = isBoss ? 135 : 78;
      this.triggerShake(isBoss ? 0.22 : 0.12, isBoss ? 6 : 3.5);
      const hitX = evt.x + (isBoss ? 0 : Math.cos(evt.angle) * 18);
      const hitY = evt.y + (isBoss ? 0 : Math.sin(evt.angle) * 14);
      this.spawnGroundEffect(
        'enemy_slam_crack',
        hitX,
        hitY,
        0,
        0,
        evt.angle,
        slamRad * 0.92,
        1.35,
        isBoss ? '#fb7185' : '#f97316',
        '#fde047'
      );
      if (isBoss) {
        this.spawnSlashWave(
          'boss_cleave',
          evt.x,
          evt.y - 10,
          evt.angle,
          slamRad * 0.9,
          Math.PI * 1.4,
          1,
          0.28,
          '#fef2f2',
          '#f43f5e'
        );
      }
      this.spawnRingEffect(evt.x, evt.y, slamRad, isBoss ? '#f43f5e' : '#f97316');
      this.spawnBurstParticles(hitX, hitY, isBoss ? '#fb7185' : '#fdba74', 14, true);
    } else if (evt.attackType === 'shockwave_line') {
      this.triggerShake(0.18, 4.8);
      const lineLen = isBoss ? 280 : 220;
      const endX = evt.x + Math.cos(evt.angle) * lineLen;
      const endY = evt.y + Math.sin(evt.angle) * lineLen;
      this.spawnGroundEffect(
        'enemy_slam_crack',
        evt.x,
        evt.y,
        endX,
        endY,
        evt.angle,
        lineLen,
        1.4,
        '#f97316',
        '#fde047'
      );
      this.spawnBurstParticles(endX, endY, '#f97316', 12, true);
    } else if (evt.attackType === 'nova') {
      this.triggerShake(0.18, 4.8);
      this.spawnSlashWave(
        'boss_cleave',
        evt.x,
        evt.y - 10,
        evt.angle,
        86,
        Math.PI * 1.95,
        1,
        0.3,
        '#fef2f2',
        '#fb7185'
      );
      const count = isBoss ? 10 : 8;
      for (let k = 0; k < count; k++) {
        const sa = evt.angle + (k * Math.PI * 2) / count;
        this.spawnProjectile({
          fromPlayer: false,
          visualOnly: true,
          kind: 'boss_shard',
          x: evt.x + Math.cos(sa) * 24,
          y: evt.y + Math.sin(sa) * 24,
          vx: Math.cos(sa) * 265,
          vy: Math.sin(sa) * 265,
          angle: sa,
          radius: 10,
          damage: 0,
          isCrit: false,
          pierce: false,
          maxLife: 1.9,
          color: '#fb7185',
        });
      }
    } else if (evt.attackType === 'shoot') {
      const bowX = evt.x + Math.cos(evt.angle) * 22;
      const bowY = evt.y - 6 + Math.sin(evt.angle) * 22;
      const isSpectral =
        evt.kind === EnemyKind.MINI_GHOST ||
        evt.kind === EnemyKind.BOSS_LEGION_GHOST ||
        evt.kind === EnemyKind.NECROMANCER;
      this.spawnBurstParticles(bowX, bowY, isSpectral ? '#38bdf8' : '#bef264', 6, true);
      this.spawnProjectile({
        fromPlayer: false,
        visualOnly: true,
        kind: isSpectral ? 'spectral_bolt' : 'enemy_arrow',
        x: bowX,
        y: bowY,
        vx: Math.cos(evt.angle) * 320,
        vy: Math.sin(evt.angle) * 320,
        angle: evt.angle,
        radius: 8,
        damage: 0,
        isCrit: false,
        pierce: false,
        maxLife: 1.6,
        color: isSpectral ? '#38bdf8' : '#bef264',
      });
    } else if (evt.attackType === 'volley') {
      const bowX = evt.x + Math.cos(evt.angle) * 22;
      const bowY = evt.y - 6 + Math.sin(evt.angle) * 22;
      this.spawnBurstParticles(bowX, bowY, '#bef264', 8, true);
      for (const offset of [-0.28, 0, 0.28]) {
        const va = evt.angle + offset;
        this.spawnProjectile({
          fromPlayer: false,
          visualOnly: true,
          kind: 'enemy_arrow',
          x: bowX,
          y: bowY,
          vx: Math.cos(va) * 300,
          vy: Math.sin(va) * 300,
          angle: va,
          radius: 7,
          damage: 0,
          isCrit: false,
          pierce: false,
          maxLife: 1.6,
          color: '#bef264',
        });
      }
    } else if (evt.attackType === 'poison_lob') {
      const tx = evt.endX ?? evt.x + Math.cos(evt.angle) * 140;
      const ty = evt.endY ?? evt.y + Math.sin(evt.angle) * 140;
      this.spawnGroundEffect('plague_crater', tx, ty, 0, 0, 0, 52, 1.4, '#84cc16', '#bef264');
      this.spawnToxicCloud(tx, ty, 55, 3.8, 0, false);
      this.spawnBurstParticles(tx, ty, '#a3e635', 12, true);
    } else if (evt.attackType === 'dash' || evt.attackType === 'charge') {
      const endX = evt.endX ?? evt.x;
      const endY = evt.endY ?? evt.y;
      if (e) {
        e.x = endX;
        e.y = endY;
      }
      this.spawnGroundEffect(
        'flesh_tear_track',
        evt.x,
        evt.y + 10,
        endX,
        endY + 10,
        evt.angle,
        120,
        0.9,
        '#fb7185',
        '#fde68a'
      );
      this.spawnSlashWave(
        'boss_cleave',
        endX,
        endY - 10,
        evt.angle,
        76,
        1.5,
        1,
        0.26,
        '#fef2f2',
        '#f43f5e'
      );
    } else if (evt.attackType === 'pounce') {
      const px = evt.endX ?? evt.x + Math.cos(evt.angle) * 130;
      const py = evt.endY ?? evt.y + Math.sin(evt.angle) * 130;
      if (e) {
        e.x = px;
        e.y = py;
      }
      this.triggerShake(0.15, 4.0);
      this.spawnGroundEffect('predator_crater', px, py, 0, 0, 0, 50, 1.2, '#f43f5e', '#fb7185');
      this.spawnSlashWave('twin_rend', px, py - 6, evt.angle, 60, 1.4, 1, 0.22, '#ffffff', '#e11d48');
    } else if (evt.attackType === 'spell') {
      this.spawnGroundEffect('astral_nova', evt.x, evt.y, 0, 0, 0, 75, 1.4, '#38bdf8', '#c084fc');
      const count = isBoss ? 5 : 3;
      const half = (count - 1) * 0.5;
      for (let s = 0; s < count; s++) {
        const sa = evt.angle + (s - half) * 0.36;
        this.spawnProjectile({
          fromPlayer: false,
          visualOnly: true,
          kind: 'spectral_bolt',
          x: evt.x + Math.cos(sa) * 22,
          y: evt.y + Math.sin(sa) * 22,
          vx: Math.cos(sa) * 245,
          vy: Math.sin(sa) * 245,
          angle: sa,
          radius: 8,
          damage: 0,
          isCrit: false,
          pierce: false,
          maxLife: 2.0,
          color: '#38bdf8',
        });
      }
    }
  }

  public handleRemoteEnemyDamaged(data: {
    enemyId: number;
    hp: number;
    shieldHp?: number;
    damage: number;
    isCrit: boolean;
    sparkColor: string;
    attackerId: string;
  }) {
    const enemy = this.enemies.find((e) => e.id === data.enemyId);
    if (!enemy) return;
    enemy.hp = data.hp;
    if (data.shieldHp !== undefined) {
      enemy.shieldHp = data.shieldHp;
    }

    if (data.attackerId !== multiplayerClient.getLocalPlayerId()) {
      enemy.hitFlash = 0.11;
      this.spawnFloatingText(
        enemy.x + (Math.random() - 0.5) * 16,
        enemy.y - enemy.radius - 14,
        data.isCrit ? `${Math.round(data.damage)}!` : `${Math.round(data.damage)}`,
        data.isCrit ? '#fde047' : data.sparkColor || '#f8fafc',
        data.isCrit
      );
      this.spawnBurstParticles(
        enemy.x,
        enemy.y - 8,
        data.sparkColor || '#ffffff',
        data.isCrit ? 8 : 4,
        true
      );
    }
  }

  public handleRemoteEnemyDied(data: {
    enemyId: number;
    killerId: string;
    loot: SyncLootItem[];
  }) {
    const e = this.enemies.find((item) => item.id === data.enemyId);
    if (e) {
      e.hp = 0;
      soundEngine.playHit(true);
      this.spawnBurstParticles(e.x, e.y, '#f5f0e6', 14, false);
      this.spawnBurstParticles(e.x, e.y - 6, '#fb7185', 8, true);

      if (data.killerId === multiplayerClient.getLocalPlayerId()) {
        this.triggerLocalKillPassives(e);
      }

      if (isBossKind(e.kind)) {
        let bossHeroId: HeroId = 'skeleton';
        if (e.legionHeroId) {
          bossHeroId = e.legionHeroId;
        } else if (e.kind === EnemyKind.BOSS_LEGION_SKELETON) {
          bossHeroId = 'skeleton';
        } else if (e.kind === EnemyKind.BOSS_LEGION_GHOST) {
          bossHeroId = 'ghost';
        } else if (e.kind === EnemyKind.BOSS_LEGION_ZOMBIE) {
          bossHeroId = 'zombie';
        } else if (e.kind === EnemyKind.BOSS_LEGION_GHOUL) {
          bossHeroId = 'ghoul';
        } else if (e.kind === EnemyKind.BOSS_LEGION_HUMAN) {
          bossHeroId = 'human';
        } else if (e.kind === EnemyKind.BOSS_LEGION_EAGLEKIN) {
          bossHeroId = 'eaglekin';
        } else if (e.kind === EnemyKind.BOSS_LEGION_TIGERKIN) {
          bossHeroId = 'tigerkin';
        }
        const dropPayload = equipmentManager.rollBossDrop(bossHeroId);
        soundEngine.playPickup();
        this.onEquipmentDrop?.(dropPayload);
      }
    }

    if (data.loot) {
      for (const item of data.loot) {
        this.spawnPickup(item.x, item.y, item.kind, item.value, item.id, true);
      }
    }
  }

  public handleRemoteLootCollected(
    lootId: number,
    collectorId: string,
    kind: 'xp' | 'heal' | 'shard' | 'boss_essence',
    value: number
  ) {
    for (const orb of this.pickups) {
      if (orb.active && orb.id === lootId) {
        orb.active = false;
        break;
      }
    }

    soundEngine.playPickup();
    const isLocalCollector = collectorId === multiplayerClient.getLocalPlayerId();

    // Shared cooperative XP & Bone Shards for all squad members; heal orb restores collector
    if (kind === 'xp') {
      this.gainXp(value);
    } else if (kind === 'shard') {
      this.boneShards += value;
    } else if (kind === 'heal' && isLocalCollector) {
      this.healPlayer(value, true);
    } else if (kind === 'boss_essence' && isLocalCollector) {
      soundEngine.playSkill('ultimate');
      this.spawnRingEffect(this.player.x, this.player.y, 140, '#fbbf24');
      this.spawnBurstParticles(this.player.x, this.player.y - 12, '#fde047', 32, true);
      this.spawnFloatingText(this.player.x, this.player.y - 44, 'BOSS ESSENCE CLAIMED!', '#fbbf24', true);
      if (this.activeBlessings.length < this.maxBlessings) {
        setTimeout(() => {
          this.promptBlessingSelection();
        }, 300);
      }
    }
    this.emitHudSnapshot();
  }

  public handleRemoteChestOpened(propId: string, _openerId: string, openerName: string = 'Ally') {
    const prop = this.map.props.find((p) => p.id === propId);
    const cx = prop ? prop.x + prop.w / 2 : this.player.x;
    const cy = prop ? prop.y + prop.h / 2 : this.player.y;
    if (prop) {
      prop.opened = true;
    }

    const rollSp = Math.random() < 0.25;
    if (rollSp) {
      this.skillPoints += 1;
      this.boneShards += 20;
    } else {
      this.boneShards += 35;
    }
    if (!this.localIsDowned) {
      this.healPlayer(Math.round(this.player.maxHp * 0.4), false);
    }
    soundEngine.playSkill('shield');
    this.spawnBurstParticles(cx, cy, '#fde047', 22, true);
    this.spawnFloatingText(
      this.player.x,
      this.player.y - 36,
      rollSp ? `${openerName} Chest: +1 SP!` : `${openerName} Chest: +35 Shards`,
      rollSp ? '#fde047' : '#93c5fd',
      true
    );
    this.emitHudSnapshot();
  }

  public handleRemotePlayerDowned(playerId: string, name: string) {
    if (playerId === multiplayerClient.getLocalPlayerId()) {
      this.localIsDowned = true;
      this.localReviveProgress = 0;
      this.player.isDowned = true;
      this.player.reviveProgress = 0;
      this.player.hp = 0;
      this.aimState.active = false;
      this.basicAttackHeld = false;
      this.spawnFloatingText(this.player.x, this.player.y - 38, 'DOWNED! WAIT FOR ALLY', '#ef4444', true);
      this.spawnBurstParticles(this.player.x, this.player.y, '#f43f5e', 16, true);
      this.emitHudSnapshot();
      return;
    }

    const rp = this.remotePlayers.get(playerId);
    if (rp) {
      rp.isDowned = true;
      rp.hp = 0;
      rp.reviveProgress = 0;
      this.spawnFloatingText(rp.x, rp.y - 35, `${name} DOWNED!`, '#ef4444', true);
      this.spawnBurstParticles(rp.x, rp.y, '#f43f5e', 14, true);
    }
  }

  public handleRemotePlayerRevived(targetId: string, _reviverId: string, hp: number) {
    soundEngine.playSkill('shield');
    if (targetId === multiplayerClient.getLocalPlayerId()) {
      this.localIsDowned = false;
      this.localReviveProgress = 0;
      this.player.isDowned = false;
      this.player.reviveProgress = 0;
      this.player.hp = Math.max(1, Math.min(this.player.maxHp, hp || Math.round(this.player.maxHp * 0.45)));
      this.spawnFloatingText(this.player.x, this.player.y - 40, 'REVIVED!', '#4ade80', true);
      this.spawnBurstParticles(this.player.x, this.player.y, '#4ade80', 18, true);
      this.emitHudSnapshot();
      return;
    }

    const rp = this.remotePlayers.get(targetId);
    if (rp) {
      rp.isDowned = false;
      rp.hp = hp || Math.round(rp.maxHp * 0.45);
      rp.reviveProgress = 0;
      this.currentRevivingPlayerName = null;
      this.currentReviveProgress = 0;
      this.spawnFloatingText(rp.x, rp.y - 35, `${rp.name} REVIVED!`, '#22c55e', true);
      this.spawnBurstParticles(rp.x, rp.y, '#4ade80', 16, true);
    }
  }

  public handleRemotePlayerDisconnected(playerId: string) {
    const rp = this.remotePlayers.get(playerId);
    if (rp) {
      rp.disconnected = true;
    }
  }

  public handleRemotePlayerReconnected(playerId: string) {
    const rp = this.remotePlayers.get(playerId);
    if (rp) {
      rp.disconnected = false;
    }
  }

  public handleRemotePlayerLeft(playerId: string) {
    this.remotePlayers.delete(playerId);
  }

  public handleRemoteFloorCleared(floor: number) {
    if (this.bossSpawnedPortals) return;
    this.bossSpawnedPortals = true;
    this.skillPoints += 1;
    this.boneShards += 60;
    soundEngine.playPortalSpawn();
    this.triggerShake(0.24, 5.5);

    this.spawnFloatingText(
      this.player.x,
      this.player.y - 54,
      'PORTALS AWAKENED! +1 SP · +60 SHARDS',
      '#fde047',
      true
    );

    const bossRoom =
      this.map.rooms.find((r) => r.kind === 'boss') || this.map.rooms[this.map.rooms.length - 1];
    if (bossRoom) {
      bossRoom.cleared = true;
      const portalY = Math.round(bossRoom.y + bossRoom.h * 0.5 - 38 - 34);
      const guildPortalX = Math.round(bossRoom.x + bossRoom.w * 0.5 - 120 - 34);
      const nextPortalX = Math.round(bossRoom.x + bossRoom.w * 0.5 + 120 - 34);
      const guildPortalId = `portal_guild_${floor}`;
      const nextPortalId = `portal_next_${floor}`;

      const existingGuild = this.map.props.find((p) => p.id === guildPortalId);
      if (existingGuild) {
        existingGuild.spawnTime = this.elapsedTime;
        existingGuild.chargeProgress = 0;
      } else {
        this.map.props.push({
          id: guildPortalId,
          kind: 'portal_guild',
          x: guildPortalX,
          y: portalY,
          w: 68,
          h: 68,
          solid: false,
          label: 'Return to Lobby',
          spawnTime: this.elapsedTime,
          chargeProgress: 0,
        });
      }

      const existingNext = this.map.props.find((p) => p.id === nextPortalId);
      if (existingNext) {
        existingNext.spawnTime = this.elapsedTime;
        existingNext.chargeProgress = 0;
      } else {
        this.map.props.push({
          id: nextPortalId,
          kind: 'portal_next',
          x: nextPortalX,
          y: portalY,
          w: 68,
          h: 68,
          solid: false,
          label: `Next Dungeon · Floor ${floor + 1}`,
          spawnTime: this.elapsedTime,
          chargeProgress: 0,
        });
      }

      this.spawnRingEffect(guildPortalX + 34, portalY + 34, 92, '#f59e0b');
      this.spawnBurstParticles(guildPortalX + 34, portalY + 34, '#fde047', 26, true);
      this.spawnRingEffect(nextPortalX + 34, portalY + 34, 92, '#38bdf8');
      this.spawnBurstParticles(nextPortalX + 34, portalY + 34, '#38bdf8', 28, true);
    }
    this.emitHudSnapshot();
  }

  public handleRemotePortalWaiting(
    readyCount: number,
    requiredCount: number,
    portalTarget: 'next' | 'lobby' = 'next'
  ) {
    this.portalWaitingState = { readyCount, requiredCount, portalTarget };
    this.emitHudSnapshot();
  }

  public handleRemoteNextFloor(floor: number, dungeonMap: WorldMap, enemies: EnemyEntity[]) {
    this.onPortalWarp?.('next');
    soundEngine.playPortalWarp(false);
    this.map = dungeonMap;
    this.map.floor = floor;
    this.enemies = enemies.map((e) => ({ ...e }));
    this.runOutcome = null;
    this.bossSpawnedPortals = false;
    this.pendingPortalAction = null;
    this.portalTransitionCooldown = 0.9;
    this.portalWaitingState = null;
    this.localIsDowned = false;
    this.localReviveProgress = 0;
    this.player.isDowned = false;
    this.player.reviveProgress = 0;
    this.currentRevivingPlayerName = null;
    this.currentReviveProgress = 0;

    this.healPlayer(Math.round(this.player.maxHp * 0.45), false);
    this.resetPlayerPosition(dungeonMap.spawnX, dungeonMap.spawnY);
    multiplayerClient.sendPlayerHealOrShield(this.player.hp, 0);

    for (const rp of this.remotePlayers.values()) {
      rp.x = dungeonMap.spawnX;
      rp.y = dungeonMap.spawnY;
      rp.isDowned = false;
      rp.reviveProgress = 0;
    }

    this.spawnFloatingText(
      this.player.x,
      this.player.y - 45,
      `GRAVEYARD OF THE FALLEN · FLOOR ${floor}`,
      '#fbbf24',
      true
    );
    this.onPhaseChange(false);
    this.emitHudSnapshot();
  }

  public handleMultiplayerGameOver() {
    this.runOutcome = 'defeat';
    this.aimState.active = false;
    this.basicAttackHeld = false;
    this.emitHudSnapshot();
  }

  public leaveMultiplayerGame() {
    this.isMultiplayer = false;
    this.remotePlayers.clear();
    this.portalWaitingState = null;
    this.pendingPortalAction = null;
    this.localIsDowned = false;
    this.localReviveProgress = 0;
    this.player.isDowned = false;
    this.player.reviveProgress = 0;
    this.currentRevivingPlayerName = null;
    this.currentReviveProgress = 0;
    this.clearPools();
    this.runOutcome = null;
    this.enterGuildHouse();
  }

  public resetMultiplayerToLobby() {
    equipmentManager.setDungeonActive(false);
    this.onPortalWarp?.('lobby');
    soundEngine.playPortalWarp(true);
    this.isMultiplayer = false;
    this.remotePlayers.clear();
    this.portalWaitingState = null;
    this.pendingPortalAction = null;
    this.localIsDowned = false;
    this.localReviveProgress = 0;
    this.player.isDowned = false;
    this.player.reviveProgress = 0;
    this.currentRevivingPlayerName = null;
    this.currentReviveProgress = 0;
    this.clearPools();
    this.runOutcome = null;
  }

  public getRemotePlayersList(): RemotePlayerRenderState[] {
    return Array.from(this.remotePlayers.values());
  }

  public getReviveStatus(): { targetName: string | null; progress: number } {
    return {
      targetName: this.currentRevivingPlayerName,
      progress: this.currentReviveProgress,
    };
  }

  public setJoystick(nx: number, ny: number) {
    this.joyX = nx;
    this.joyY = ny;
  }

  public setBasicAttackHeld(held: boolean) {
    if (this.localIsDowned) {
      this.basicAttackHeld = false;
      return;
    }
    this.basicAttackHeld = held;
    if (held && this.basicCooldown <= 0) {
      this.triggerBasicAttack();
    }
  }

  public updateSkillAim(
    active: boolean,
    slotIndex: number,
    skillId: ActiveSkillId | null,
    isManual: boolean,
    angle: number,
    distanceRatio: number,
    willCancel: boolean
  ) {
    if (!active || this.localIsDowned) {
      this.aimState.active = false;
      this.aimState.skillId = null;
      return;
    }
    let resolvedAngle = angle;
    if (!isManual && skillId) {
      const def = HERO_SKILLS[skillId];
      const nearest = this.findNearestEnemy(Math.max(def.range + 95, 360));
      resolvedAngle = nearest
        ? Math.atan2(nearest.y - this.player.y, nearest.x - this.player.x)
        : this.player.facing;
    }
    this.aimState = {
      active: true,
      slotIndex,
      skillId,
      isManual,
      angle: resolvedAngle,
      distanceRatio,
      willCancel,
    };
  }

  public castSkill(
    skillId: ActiveSkillId,
    isManual: boolean,
    manualAngle: number,
    distanceRatio: number
  ) {
    this.aimState.active = false;
    if (this.runOutcome === 'defeat' || this.localIsDowned) return;
    if (this.player.possessingTimer > 0 && skillId !== 'haunted_possession') return;
    if (this.cooldowns[skillId] > 0) return;

    const prevShield = this.player.shield;
    const def = HERO_SKILLS[skillId];
    const rank = Math.max(1, this.skillRanks[skillId] || 1);
    const blessingDmg = this.getBlessingDamageMult(skillId);
    const mult = def.baseMultiplier + (rank - 1) * def.rankMultiplier + blessingDmg;
    const cdr = this.getBlessingCooldownReduction(skillId);
    const eqStats = equipmentManager.getComputedStats(this.heroId);
    const totalCdr = Math.min(0.65, cdr + eqStats.cooldownReduction);

    equipmentManager.onUseSkill(this.heroId);

    // Auto-target nearest enemy unless manually dragged
    let targetAngle = manualAngle;
    let targetDist = distanceRatio * def.range;

    if (!isManual) {
      if (skillId === 'windstep') {
        const joyDist = Math.hypot(this.joyX, this.joyY);
        if (joyDist > 0.08) {
          targetAngle = Math.atan2(this.joyY, this.joyX);
        } else {
          targetAngle = this.player.facing;
        }
        targetDist = def.range;
      } else {
        const searchRad = Math.max(def.range + 115, 380);
        const nearest = this.findNearestEnemy(searchRad);
        if (nearest) {
          const dx = nearest.x - this.player.x;
          const dy = nearest.y - this.player.y;
          targetAngle = Math.atan2(dy, dx);
          targetDist = Math.min(def.range, Math.hypot(dx, dy));
        } else {
          targetAngle = this.player.facing;
          targetDist = def.range * 0.65;
        }
      }
    }

    this.player.facing = targetAngle;
    this.cooldowns[skillId] = Math.max(0.18, def.cooldown * (1 - totalCdr));
    this.swordCastAngle = targetAngle;
    this.player.swordGlowColor = def.glowColor;
    this.player.swordGlowIntensity = 1.25;
    this.player.isScytheForm = skillId === 'reapers_judgment';

    if (this.isMultiplayer) {
      multiplayerClient.sendSkill(
        skillId,
        this.skillRanks[skillId] || 1,
        isManual,
        targetAngle,
        distanceRatio,
        this.player.x,
        this.player.y
      );
    }

    // =========================================================================
    // SKELETON ACTIVE & ULTIMATE SKILLS
    // =========================================================================
    if (skillId === 'bone_slash') {
      this.player.swordAnim = SwordAnimState.BONE_SLASH;
      this.swordAnimDuration = 0.26;
      this.swordAnimTimer = 0.26;
      soundEngine.playSlash(1.22);

      this.spawnSlashWave(
        'blade_arc',
        this.player.x,
        this.player.y - 8,
        targetAngle,
        def.range * 0.88,
        def.radiusOrAngle,
        1,
        0.24,
        '#ffffff',
        def.glowColor
      );
      this.hitEnemiesInCone(targetAngle, def.range, def.radiusOrAngle, mult, 0.2, def.glowColor, 0);
      this.spawnArcBurst(this.player.x, this.player.y, targetAngle, def.range * 0.78, def.glowColor, 18);
    } else if (skillId === 'bone_spear') {
      this.player.swordAnim = SwordAnimState.BONE_SPEAR;
      this.swordAnimDuration = 0.28;
      this.swordAnimTimer = 0.28;
      const { dmg, isCrit } = this.rollPlayerDamage(mult, 0.08);
      const extraSpears = this.getBlessingExtraProjectiles('bone_spear');
      const spearCount = 1 + extraSpears;
      const spread = 0.18;
      for (let sp = 0; sp < spearCount; sp++) {
        const offsetAng = spearCount > 1 ? (sp - (spearCount - 1) / 2) * spread : 0;
        const ang = targetAngle + offsetAng;
        this.spawnProjectile({
          fromPlayer: true,
          kind: 'bone_spear',
          x: this.player.x + Math.cos(ang) * 24,
          y: this.player.y - 8 + Math.sin(ang) * 24,
          vx: Math.cos(ang) * 680,
          vy: Math.sin(ang) * 680,
          angle: ang,
          radius: 18,
          damage: dmg,
          isCrit,
          pierce: true,
          maxLife: def.range / 680 + 0.08,
          color: def.glowColor,
        });
      }
    } else if (skillId === 'ribcage_shield') {
      this.player.swordAnim = SwordAnimState.RIBCAGE_SHIELD;
      this.swordAnimDuration = 0.34;
      this.swordAnimTimer = 0.34;
      soundEngine.playSkill('shield');

      const bonusShield = this.getBlessingShieldBonus('ribcage_shield');
      const shieldVal = Math.round(this.player.maxHp * (0.35 + (rank - 1) * 0.08)) + bonusShield;
      this.player.shield += shieldVal;
      this.player.ribShieldTimer = 5.5;
      this.spawnFloatingText(this.player.x, this.player.y - 36, `+${shieldVal} Shield`, '#fde68a', false);
      this.spawnRingEffect(this.player.x, this.player.y, def.range, '#fde68a');

      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
        if (d <= def.range + e.radius) {
          const { dmg, isCrit } = this.rollPlayerDamage(mult, 0);
          this.damageEnemy(e, dmg, isCrit, '#fde68a');
          if (e.kind !== EnemyKind.TRAINING_DUMMY && !isBossKind(e.kind)) {
            const ka = Math.atan2(e.y - this.player.y, e.x - this.player.x);
            this.tryMoveEntity(e.x, e.y, Math.cos(ka) * 38, Math.sin(ka) * 38, e.radius, (nx, ny) => {
              e.x = nx;
              e.y = ny;
            });
          }
        }
      }
    } else if (skillId === 'skeletal_rush') {
      this.player.swordAnim = SwordAnimState.SKELETAL_RUSH;
      this.swordAnimDuration = 0.24;
      this.swordAnimTimer = 0.24;
      soundEngine.playSkill('rush');

      const dashSpeed = def.range / 0.21;
      this.dashSkillKind = 'skeletal_rush';
      this.dashStartX = this.player.x;
      this.dashStartY = this.player.y;
      this.dashTimer = 0.21;
      this.dashVx = Math.cos(targetAngle) * dashSpeed;
      this.dashVy = Math.sin(targetAngle) * dashSpeed;
      this.dashHitIds.clear();
    } else if (skillId === 'bone_storm') {
      this.player.swordAnim = SwordAnimState.BONE_STORM;
      this.swordAnimDuration = 0.4;
      this.swordAnimTimer = 0.4;
      this.player.boneStormTimer = 4.5;
      this.stormTickTimer = 0.05;
      soundEngine.playSkill('storm');
      this.spawnRingEffect(this.player.x, this.player.y, def.range, '#67e8f9');
    } else if (skillId === 'bone_colossus') {
      this.player.swordAnim = SwordAnimState.BONE_COLOSSUS_CAST;
      this.swordAnimDuration = 0.45;
      this.swordAnimTimer = 0.45;
      this.player.colossusTimer = 8.5;
      const bonusShield = Math.round(this.player.maxHp * 0.45);
      this.player.shield = Math.max(this.player.shield, bonusShield);
      soundEngine.playSkill('ultimate');
      this.triggerShake(0.24, 6);
      this.spawnGroundEffect('enemy_slam_crack', this.player.x, this.player.y, 0, 0, 0, def.range * 0.85, 1.5, '#fde047', '#f59e0b');
      this.spawnRingEffect(this.player.x, this.player.y, def.range, '#fbbf24');
      this.spawnFloatingText(this.player.x, this.player.y - 48, 'BONE COLOSSUS!', '#fde047', true);

      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= def.range + e.radius) {
          const { dmg, isCrit } = this.rollPlayerDamage(mult, 0.15);
          this.damageEnemy(e, dmg, isCrit, '#fbbf24');
        }
      }
    } else if (skillId === 'army_of_bones') {
      this.player.swordAnim = SwordAnimState.ARMY_OF_BONES;
      this.swordAnimDuration = 0.38;
      this.swordAnimTimer = 0.38;
      soundEngine.playSkill('ultimate');
      this.triggerShake(0.18, 4.5);

      const cx = this.player.x + Math.cos(targetAngle) * targetDist;
      const cy = this.player.y + Math.sin(targetAngle) * targetDist;
      this.spawnGroundEffect('grave_portal', cx, cy, 0, 0, 0, def.radiusOrAngle * 0.85, 2.2, '#4ade80', '#86efac');
      this.spawnRingEffect(cx, cy, def.radiusOrAngle, '#4ade80');

      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - cx, e.y - cy) <= def.radiusOrAngle + e.radius) {
          const { dmg, isCrit } = this.rollPlayerDamage(mult, 0.1);
          this.damageEnemy(e, dmg, isCrit, '#4ade80');
        }
      }

      const count = rank >= 3 ? 4 : 3;
      this.summonMinions('skeleton', cx, cy, count, 0.42 + (rank - 1) * 0.1, 90 + rank * 25, 13, targetAngle);
    } else if (skillId === 'reapers_judgment') {
      this.player.swordAnim = SwordAnimState.REAPERS_JUDGMENT;
      this.swordAnimDuration = 0.44;
      this.swordAnimTimer = 0.44;
      soundEngine.playSkill('ultimate');
      this.triggerShake(0.28, 7.5);

      const cleaveRange = this.player.colossusTimer > 0 ? def.range * 1.2 : def.range;
      this.spawnSlashWave(
        'boss_cleave',
        this.player.x,
        this.player.y - 10,
        targetAngle,
        cleaveRange * 0.92,
        def.radiusOrAngle,
        1,
        0.32,
        '#f8fafc',
        '#c084fc'
      );
      this.hitEnemiesInCone(targetAngle, cleaveRange, def.radiusOrAngle, mult, 0.25, '#c084fc', 0);
      this.spawnArcBurst(this.player.x, this.player.y, targetAngle, cleaveRange * 0.85, '#c084fc', 26);

      const { dmg, isCrit } = this.rollPlayerDamage(mult * 0.65, 0.2);
      this.spawnProjectile({
        fromPlayer: true,
        kind: 'dark_wave',
        x: this.player.x + Math.cos(targetAngle) * 32,
        y: this.player.y - 8 + Math.sin(targetAngle) * 32,
        vx: Math.cos(targetAngle) * 460,
        vy: Math.sin(targetAngle) * 460,
        angle: targetAngle,
        radius: 42,
        damage: dmg,
        isCrit,
        pierce: true,
        maxLife: 0.72,
        color: '#c084fc',
      });
    }

    // =========================================================================
    // ZOMBIE ACTIVE & ULTIMATE SKILLS (HEAVILY EMPHASIZED VFX)
    // =========================================================================
    else if (skillId === 'rotting_claw') {
      this.player.swordAnim = SwordAnimState.ROTTING_CLAW;
      this.swordAnimDuration = 0.34;
      this.swordAnimTimer = 0.34;
      soundEngine.playSlash(0.95);

      const abomBoost = this.player.colossusTimer > 0 ? 1.38 : 1.0;
      const clawRange = def.range * abomBoost;

      // Strike 1 of 3: Wide venomous 3-talon right rake + immediate 40% movement slow!
      this.spawnSlashWave(
        'triple_claw',
        this.player.x,
        this.player.y - 8,
        targetAngle,
        clawRange * 0.88,
        def.radiusOrAngle,
        1,
        0.24,
        '#ecfccb',
        '#84cc16'
      );
      this.hitEnemiesInCone(targetAngle, clawRange, def.radiusOrAngle, mult * 0.45, 0.08, '#84cc16', 3.2);
      this.spawnArcBurst(this.player.x, this.player.y, targetAngle, clawRange * 0.8, '#a3e635', 16);

      // Queue rapid Strike 2 (left 3-claw rake) & Strike 3 (X-cross 6-claw finisher)!
      this.rottingClawHitsLeft = 2;
      this.pendingRottingClawTimer = 0.095;
      this.pendingRottingClawAngle = targetAngle;
      this.pendingRottingClawMult = mult * 0.45;
    } else if (skillId === 'plague_burst') {
      this.player.swordAnim = SwordAnimState.PLAGUE_BURST;
      this.swordAnimDuration = 0.36;
      this.swordAnimTimer = 0.36;
      soundEngine.playSkill('storm');
      this.triggerShake(0.15, 4);

      const burstRadius = this.player.colossusTimer > 0 ? def.range * 1.25 : def.range;
      this.spawnToxicCloud(this.player.x, this.player.y, burstRadius, 4.2, this.getEffectiveAtk() * mult * 0.35);
      this.spawnGroundEffect(
        'contagion_ring',
        this.player.x,
        this.player.y,
        0,
        0,
        0,
        burstRadius * 1.08,
        0.75,
        '#a3e635',
        '#a855f7'
      );
      this.spawnRingEffect(this.player.x, this.player.y, burstRadius, '#a3e635');
      this.spawnRingEffect(this.player.x, this.player.y, burstRadius * 0.72, '#a855f7');
      this.spawnBurstParticles(this.player.x, this.player.y - 8, '#84cc16', 22, true);
      this.spawnBurstParticles(this.player.x, this.player.y - 8, '#c084fc', 12, true);

      // Initial plague detonation + lingering contagious plague infection
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= burstRadius + e.radius) {
          const { dmg, isCrit } = this.rollPlayerDamage(mult * 0.68, 0.05);
          e.slowTimer = Math.max(e.slowTimer, 2.2);
          this.damageEnemy(e, dmg, isCrit, '#a3e635');
        }
      }
    } else if (skillId === 'flesh_ripper') {
      this.player.swordAnim = SwordAnimState.FLESH_RIPPER;
      this.swordAnimDuration = 0.26;
      this.swordAnimTimer = 0.26;
      soundEngine.playSkill('rush');
      this.triggerShake(0.14, 3.8);

      const dashSpeed = def.range / 0.21;
      this.dashSkillKind = 'flesh_ripper';
      this.dashStartX = this.player.x;
      this.dashStartY = this.player.y;
      this.dashTimer = 0.21;
      this.dashVx = Math.cos(targetAngle) * dashSpeed;
      this.dashVy = Math.sin(targetAngle) * dashSpeed;
      this.dashHitIds.clear();

      // Leading 6-talon X-rend wave tearing open the lunge path!
      this.spawnSlashWave(
        'cross_claw',
        this.player.x + Math.cos(targetAngle) * 28,
        this.player.y - 8 + Math.sin(targetAngle) * 28,
        targetAngle,
        74,
        1.4,
        1,
        0.25,
        '#ecfccb',
        '#fb7185'
      );
      this.spawnBurstParticles(this.player.x, this.player.y - 8, '#bef264', 14, true);
    } else if (skillId === 'undying_flesh') {
      this.player.swordAnim = SwordAnimState.UNDYING_FLESH;
      this.swordAnimDuration = 0.38;
      this.swordAnimTimer = 0.38;
      this.player.undyingTimer = 5.5;
      this.undyingTickTimer = 0.05;
      soundEngine.playSkill('shield');
      this.spawnGroundEffect(
        'contagion_ring',
        this.player.x,
        this.player.y,
        0,
        0,
        0,
        96,
        0.65,
        '#4ade80',
        '#a3e635'
      );
      this.spawnRingEffect(this.player.x, this.player.y, 98, '#22c55e');
      this.spawnRingEffect(this.player.x, this.player.y, 64, '#bbf7d0');
      this.spawnBurstParticles(this.player.x, this.player.y - 10, '#4ade80', 22, true);
      this.spawnFloatingText(this.player.x, this.player.y - 42, 'UNDYING FLESH!', '#4ade80', true);
    } else if (skillId === 'grave_call') {
      this.player.swordAnim = SwordAnimState.GRAVE_CALL;
      this.swordAnimDuration = 0.38;
      this.swordAnimTimer = 0.38;
      soundEngine.playSkill('spear');
      this.triggerShake(0.16, 4.2);

      const cx = this.player.x + Math.cos(targetAngle) * targetDist;
      const cy = this.player.y + Math.sin(targetAngle) * targetDist;
      this.spawnGroundEffect(
        'grave_portal',
        cx,
        cy,
        0,
        0,
        0,
        def.radiusOrAngle * 0.92,
        2.6,
        '#a855f7',
        '#a3e635'
      );
      this.spawnRingEffect(cx, cy, def.radiusOrAngle, '#a855f7');
      this.spawnBurstParticles(cx, cy, '#a3e635', 16, true);

      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - cx, e.y - cy) <= def.radiusOrAngle + e.radius) {
          const { dmg, isCrit } = this.rollPlayerDamage(mult, 0.05);
          e.slowTimer = Math.max(e.slowTimer, 1.5);
          this.damageEnemy(e, dmg, isCrit, '#a855f7');
        }
      }

      const count = rank >= 4 ? 3 : 2;
      this.summonMinions('zombie', cx, cy, count, 0.4 + (rank - 1) * 0.09, 110 + rank * 25, 12.0, targetAngle);
    } else if (skillId === 'abomination_form') {
      this.player.swordAnim = SwordAnimState.ABOMINATION_CAST;
      this.swordAnimDuration = 0.46;
      this.swordAnimTimer = 0.46;
      this.player.colossusTimer = 9.0;
      const bonusShield = Math.round(this.player.maxHp * 0.45);
      this.player.shield = Math.max(this.player.shield, bonusShield);
      soundEngine.playSkill('ultimate');
      this.triggerShake(0.28, 7.2);

      // Mutagenic shock crater + 360° devastating transformation roar!
      this.spawnGroundEffect(
        'plague_crater',
        this.player.x,
        this.player.y,
        0,
        0,
        0.2,
        def.range,
        1.7,
        '#a3e635',
        '#c084fc'
      );
      this.spawnRingEffect(this.player.x, this.player.y, def.range * 1.1, '#84cc16');
      this.spawnRingEffect(this.player.x, this.player.y, def.range * 0.78, '#c084fc');
      this.spawnBurstParticles(this.player.x, this.player.y - 12, '#a3e635', 28, true);
      this.spawnBurstParticles(this.player.x, this.player.y - 12, '#c084fc', 16, true);
      this.spawnFloatingText(this.player.x, this.player.y - 52, 'ABOMINATION FORM!', '#a3e635', true);

      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= def.range + e.radius) {
          const { dmg, isCrit } = this.rollPlayerDamage(mult, 0.14);
          e.slowTimer = Math.max(e.slowTimer, 2.4);
          this.damageEnemy(e, dmg, isCrit, '#84cc16');
        }
      }
    } else if (skillId === 'kingdom_of_the_dead') {
      this.player.swordAnim = SwordAnimState.GRAVE_CALL;
      this.swordAnimDuration = 0.44;
      this.swordAnimTimer = 0.44;
      soundEngine.playSkill('ultimate');
      this.triggerShake(0.26, 6.5);

      const cx = this.player.x + Math.cos(targetAngle) * targetDist;
      const cy = this.player.y + Math.sin(targetAngle) * targetDist;

      // Colossal rotating Necropolis Hexagram Sigil on the dungeon floor!
      this.spawnGroundEffect(
        'kingdom_sigil',
        cx,
        cy,
        0,
        0,
        0,
        def.radiusOrAngle * 1.12,
        4.4,
        '#4ade80',
        '#c084fc'
      );
      this.spawnRingEffect(cx, cy, def.radiusOrAngle * 1.15, '#4ade80');
      this.spawnRingEffect(cx, cy, def.radiusOrAngle * 0.72, '#c084fc');
      this.spawnBurstParticles(cx, cy, '#4ade80', 24, true);
      this.spawnFloatingText(cx, cy - 42, 'KINGDOM OF THE DEAD!', '#86efac', true);

      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - cx, e.y - cy) <= def.radiusOrAngle * 1.1 + e.radius) {
          const { dmg, isCrit } = this.rollPlayerDamage(mult, 0.1);
          e.slowTimer = Math.max(e.slowTimer, 2.0);
          this.damageEnemy(e, dmg, isCrit, '#4ade80');
        }
      }

      // Flood battlefield with a relentless horde of 6 to 8 undead shamblers!
      const count = 6 + (rank - 1);
      this.summonMinions('zombie', cx, cy, count, 0.38 + (rank - 1) * 0.08, 105 + rank * 25, 14.0, targetAngle);
    } else if (skillId === 'deaths_embrace') {
      this.player.swordAnim = SwordAnimState.DEATHS_EMBRACE;
      this.swordAnimDuration = 0.48;
      this.swordAnimTimer = 0.48;
      soundEngine.playSkill('ultimate');
      this.triggerShake(0.34, 8.8);

      // Massive ground-slam tectonic plague crater + inward life-siphon ring!
      this.spawnGroundEffect(
        'plague_crater',
        this.player.x,
        this.player.y,
        0,
        0,
        Math.random() * Math.PI,
        def.range,
        2.1,
        '#a855f7',
        '#a3e635'
      );
      this.spawnGroundEffect(
        'contagion_ring',
        this.player.x,
        this.player.y,
        0,
        0,
        0,
        def.range * 1.05,
        0.8,
        '#c084fc',
        '#4ade80'
      );
      this.spawnRingEffect(this.player.x, this.player.y, def.range, '#a855f7');
      this.spawnRingEffect(this.player.x, this.player.y, def.range * 0.72, '#84cc16');
      this.spawnBurstParticles(this.player.x, this.player.y - 6, '#c084fc', 30, true);
      this.spawnBurstParticles(this.player.x, this.player.y - 6, '#4ade80', 18, true);

      let totalDrain = 0;
      let hitCount = 0;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= def.range + e.radius) {
          hitCount += 1;
          const { dmg, isCrit } = this.rollPlayerDamage(mult, 0.15);
          e.slowTimer = Math.max(e.slowTimer, 2.8);
          this.damageEnemy(e, dmg, isCrit, '#c084fc');
          totalDrain += dmg * 0.28;
          // Visible sinuous Life-Siphon Tendril + Vitality Orb absorbed from every hit enemy!
          this.spawnSiphonBeam(e.x, e.y - 12, 0.58, '#4ade80');
          this.spawnLifeLeechOrb(e.x, e.y - 10, Math.max(8, Math.round(dmg * 0.14)));
        }
      }

      if (hitCount > 0) {
        const minHeal = Math.round(this.player.maxHp * 0.18);
        this.healPlayer(Math.max(minHeal, Math.round(totalDrain)), true);
      }
    }

    // =========================================================================
    // GHOUL – FERAL STALKER ACTIVE & ULTIMATE SKILLS (SILKY, SMOOTH, EYE-PLEASING VFX)
    // =========================================================================
    else if (skillId === 'rending_claws') {
      this.player.swordAnim = SwordAnimState.RENDING_CLAWS;
      this.swordAnimDuration = 0.44;
      this.swordAnimTimer = 0.44;
      this.targetAttackTwist = 1;
      soundEngine.playSlash(1.26);

      const apexBoost = this.player.colossusTimer > 0 ? 1.32 : 1.0;
      const rendRange = def.range * apexBoost;
      this.attackImpulseVx = Math.cos(targetAngle) * 85;
      this.attackImpulseVy = Math.sin(targetAngle) * 85;

      // Strike 1 of 4: Smooth right-claw crescent sweep
      this.spawnSlashWave(
        'feral_slash',
        this.player.x,
        this.player.y - 8,
        targetAngle,
        rendRange * 0.85,
        def.radiusOrAngle * 0.92,
        1,
        0.22,
        '#fff1f2',
        '#fb7185'
      );
      this.hitEnemiesInCone(targetAngle, rendRange, def.radiusOrAngle, mult * 0.34, 0.12, '#fb7185', 0);
      this.spawnSoftMotes(this.player.x, this.player.y, targetAngle, rendRange * 0.72, '#fda4af', 5);

      // Queue Strikes 2, 3, and the graceful Strike 4 crescent finale!
      this.rendingHitsLeft = 3;
      this.pendingRendingTimer = 0.105;
      this.pendingRendingAngle = targetAngle;
      this.pendingRendingMult = mult;
    } else if (skillId === 'feral_pounce') {
      this.player.swordAnim = SwordAnimState.FERAL_POUNCE;
      this.swordAnimDuration = 0.28;
      this.swordAnimTimer = 0.28;
      soundEngine.playSkill('rush');

      let destX = this.player.x + Math.cos(targetAngle) * Math.max(95, targetDist);
      let destY = this.player.y + Math.sin(targetAngle) * Math.max(95, targetDist);
      if (!isManual) {
        const prey = this.findNearestEnemy(def.range + 65);
        if (prey) {
          const ang = Math.atan2(prey.y - this.player.y, prey.x - this.player.x);
          targetAngle = ang;
          this.player.facing = ang;
          const dist = Math.min(def.range, Math.max(36, Math.hypot(prey.x - this.player.x, prey.y - this.player.y) - 18));
          destX = this.player.x + Math.cos(ang) * dist;
          destY = this.player.y + Math.sin(ang) * dist;
        }
      }
      const clamped = this.findFurthestWalkableAlongRay(this.player.x, this.player.y, destX, destY, 16);

      this.spawnRingEffect(this.player.x, this.player.y, 44, '#fb7185');
      this.pounceStartX = this.player.x;
      this.pounceStartY = this.player.y;
      this.pounceTargetX = clamped.x;
      this.pounceTargetY = clamped.y;
      this.pounceDuration = 0.22;
      this.pounceTimer = 0.22;
      this.pounceMult = mult;
      this.pounceIsPredatorLeap = false;
      this.pounceRadius = def.radiusOrAngle;
    } else if (skillId === 'shadow_stalker') {
      this.player.swordAnim = SwordAnimState.SHADOW_STALKER;
      this.swordAnimDuration = 0.34;
      this.swordAnimTimer = 0.34;
      soundEngine.playSkill('rush');

      // Disappear into shadows at origin with soft dusk mist
      this.spawnGroundEffect(
        'shadow_smoke_ring',
        this.player.x,
        this.player.y,
        0,
        0,
        0,
        64,
        0.48,
        '#4c0519',
        '#fb7185'
      );
      this.spawnSoftMotes(this.player.x, this.player.y, targetAngle, 28, '#fda4af', 6);

      let victim: EnemyEntity | null = null;
      if (!isManual) {
        victim = this.findNearestEnemy(def.range + 85);
      } else {
        // Find enemy closest to aimed direction within range
        let bestScore = 9999;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
          if (d > def.range + 65) continue;
          let diff = Math.atan2(e.y - this.player.y, e.x - this.player.x) - targetAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const score = d + Math.abs(diff) * 140;
          if (score < bestScore) {
            bestScore = score;
            victim = e;
          }
        }
      }

      let destX = this.player.x + Math.cos(targetAngle) * Math.min(def.range, Math.max(110, targetDist));
      let destY = this.player.y + Math.sin(targetAngle) * Math.min(def.range, Math.max(110, targetDist));
      let nextFacing = targetAngle;

      if (victim) {
        const approachAng = Math.atan2(victim.y - this.player.y, victim.x - this.player.x);
        const behindX = victim.x + Math.cos(approachAng) * (victim.radius + 28);
        const behindY = victim.y + Math.sin(approachAng) * (victim.radius + 28);
        if (this.isPointWalkable(behindX, behindY, 16)) {
          destX = behindX;
          destY = behindY;
          nextFacing = approachAng + Math.PI;
        } else {
          const frontX = victim.x - Math.cos(approachAng) * (victim.radius + 26);
          const frontY = victim.y - Math.sin(approachAng) * (victim.radius + 26);
          const fallback = this.findFurthestWalkableAlongRay(this.player.x, this.player.y, frontX, frontY, 16);
          destX = fallback.x;
          destY = fallback.y;
          nextFacing = Math.atan2(victim.y - destY, victim.x - destX);
        }
      } else {
        const clamped = this.findFurthestWalkableAlongRay(this.player.x, this.player.y, destX, destY, 16);
        destX = clamped.x;
        destY = clamped.y;
      }

      // Briefly vanish into shadows (0.16s) before reappearing behind enemy with Ambush Ready!
      this.shadowStepTimer = 0.16;
      this.shadowDestX = destX;
      this.shadowDestY = destY;
      this.shadowTargetFacing = nextFacing;
      this.ambushMult = mult;
      this.player.stealthTimer = 2.8;
      this.player.ambushReady = true;
    } else if (skillId === 'blood_frenzy') {
      this.player.swordAnim = SwordAnimState.BLOOD_FRENZY;
      this.swordAnimDuration = 0.3;
      this.swordAnimTimer = 0.3;
      this.player.bloodFrenzyTimer = 4.2 + (rank - 1) * 0.25;
      this.player.frenzyStacks = Math.max(1, this.player.frenzyStacks);
      this.frenzySlashTimer = 0.05;
      this.frenzySide = 1;
      soundEngine.playSkill('storm');
      this.spawnRingEffect(this.player.x, this.player.y, def.range * 0.85, '#fb7185');
      this.spawnSoftMotes(this.player.x, this.player.y, targetAngle, 36, '#fda4af', 8);
      this.spawnFloatingText(this.player.x, this.player.y - 42, 'BLOOD FRENZY!', '#fb7185', true);
    } else if (skillId === 'predators_leap') {
      this.player.swordAnim = SwordAnimState.PREDATORS_LEAP;
      this.swordAnimDuration = 0.36;
      this.swordAnimTimer = 0.36;
      soundEngine.playSkill('rush');

      const rawX = this.player.x + Math.cos(targetAngle) * Math.max(70, targetDist);
      const rawY = this.player.y + Math.sin(targetAngle) * Math.max(70, targetDist);
      const clamped = this.findFurthestWalkableAlongRay(this.player.x, this.player.y, rawX, rawY, 16);

      this.spawnRingEffect(this.player.x, this.player.y, 52, '#f43f5e');
      this.spawnSoftMotes(this.player.x, this.player.y, targetAngle, 30, '#fda4af', 7);

      this.pounceStartX = this.player.x;
      this.pounceStartY = this.player.y;
      this.pounceTargetX = clamped.x;
      this.pounceTargetY = clamped.y;
      this.pounceDuration = 0.28;
      this.pounceTimer = 0.28;
      this.pounceMult = mult;
      this.pounceIsPredatorLeap = true;
      this.pounceRadius = def.radiusOrAngle;
    } else if (skillId === 'apex_predator') {
      this.player.swordAnim = SwordAnimState.APEX_PREDATOR_CAST;
      this.swordAnimDuration = 0.42;
      this.swordAnimTimer = 0.42;
      this.player.colossusTimer = 8.5 + (rank - 1) * 0.5;
      const bloodBarrier = Math.round(this.player.maxHp * 0.35);
      this.player.shield = Math.max(this.player.shield, bloodBarrier);
      this.player.momentumStacks = 8;
      this.momentumTimer = 5.0;
      soundEngine.playSkill('ultimate');
      this.triggerShake(0.22, 5.5);

      this.spawnGroundEffect(
        'predator_crater',
        this.player.x,
        this.player.y,
        0,
        0,
        0,
        def.range,
        1.55,
        '#f43f5e',
        '#fda4af'
      );
      this.spawnSlashWave(
        'feral_whirl',
        this.player.x,
        this.player.y - 10,
        targetAngle,
        def.range * 0.92,
        Math.PI * 2,
        1,
        0.32,
        '#fff1f2',
        '#e11d48'
      );
      this.spawnRingEffect(this.player.x, this.player.y, def.range * 1.05, '#fb7185');
      this.spawnSoftMotes(this.player.x, this.player.y, targetAngle, def.range * 0.7, '#fda4af', 14);
      this.spawnFloatingText(this.player.x, this.player.y - 52, 'APEX PREDATOR!', '#fda4af', true);

      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= def.range + e.radius) {
          const { dmg, isCrit } = this.rollPlayerDamage(mult, 0.22);
          this.damageEnemy(e, dmg, isCrit, '#fb7185');
        }
      }
    } else if (skillId === 'carnage_unleashed') {
      this.player.swordAnim = SwordAnimState.CARNAGE_UNLEASHED;
      this.swordAnimDuration = 0.5;
      this.swordAnimTimer = 0.5;
      soundEngine.playSkill('ultimate');
      this.triggerShake(0.16, 4.0);

      this.carnageDashesLeft = 6 + (rank - 1);
      this.carnageDashTimer = 0.02;
      this.carnageMult = mult;
      this.carnageLastTargetId = -1;
      this.spawnRingEffect(this.player.x, this.player.y, 110, '#fb7185');
      this.spawnFloatingText(this.player.x, this.player.y - 48, 'CARNAGE UNLEASHED!', '#fb7185', true);
    } else if (skillId === 'king_of_the_hunt') {
      this.player.swordAnim = SwordAnimState.KING_OF_THE_HUNT;
      this.swordAnimDuration = 0.45;
      this.swordAnimTimer = 0.45;
      soundEngine.playSkill('ultimate');
      this.triggerShake(0.18, 4.5);

      const territoryRadius = def.range * 1.38;
      this.spawnRingEffect(this.player.x, this.player.y, territoryRadius, '#e11d48');
      this.spawnGroundEffect(
        'shadow_smoke_ring',
        this.player.x,
        this.player.y,
        0,
        0,
        0,
        118,
        0.65,
        '#4c0519',
        '#fb7185'
      );

      let markedCount = 0;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= territoryRadius + e.radius) {
          e.preyMarkTimer = 7.5;
          markedCount += 1;
          this.spawnSoftMotes(e.x, e.y, 0, 18, '#fda4af', 4);
        }
      }

      this.spawnFloatingText(
        this.player.x,
        this.player.y - 50,
        markedCount > 0 ? `KING OF THE HUNT! (${markedCount} PREY)` : 'KING OF THE HUNT!',
        '#fda4af',
        true
      );

      this.huntStrikesLeft = Math.min(8, Math.max(3, markedCount + 1));
      this.huntChainTimer = 0.1;
      this.huntMult = mult;
    }

    // =========================================================================
    // GHOST – ETHEREAL SPIRIT ACTIVE & ULTIMATE SKILLS (100% UNIQUE SPECTRAL VFX)
    // =========================================================================
    else if (skillId === 'spectral_bolt') {
      this.player.swordAnim = SwordAnimState.SPECTRAL_BOLT;
      this.swordAnimDuration = 0.28;
      this.swordAnimTimer = 0.28;
      soundEngine.playGhostWisp(0.92);

      const { dmg, isCrit } = this.rollPlayerDamage(mult, 0.12);
      const launchX = this.player.x + Math.cos(targetAngle) * 24;
      const launchY = this.player.y - 12 + Math.sin(targetAngle) * 24;

      this.spawnGroundEffect(
        'astral_nova',
        launchX,
        launchY,
        0,
        0,
        targetAngle,
        36,
        0.24,
        '#2dd4bf',
        '#818cf8'
      );
      const extraBolts = this.getBlessingExtraProjectiles('spectral_bolt');
      const boltCount = 1 + extraBolts;
      const spread = 0.2;
      for (let b = 0; b < boltCount; b++) {
        const offAng = boltCount > 1 ? (b - (boltCount - 1) / 2) * spread : 0;
        const ang = targetAngle + offAng;
        this.spawnProjectile({
          fromPlayer: true,
          kind: 'spectral_bolt',
          x: launchX,
          y: launchY,
          vx: Math.cos(ang) * 650,
          vy: Math.sin(ang) * 650,
          angle: ang,
          radius: 22,
          damage: dmg,
          isCrit,
          pierce: true,
          maxLife: def.range / 650 + 0.1,
          color: '#2dd4bf',
        });
      }
      this.spawnSoftMotes(launchX, launchY, targetAngle, 22, '#5eead4', 6);
    } else if (skillId === 'phantom_dash') {
      this.player.swordAnim = SwordAnimState.PHANTOM_DASH;
      this.swordAnimDuration = 0.3;
      this.swordAnimTimer = 0.3;
      soundEngine.playSkill('rush');
      soundEngine.playGhostWisp(1.25);

      const dashDur = 0.27;
      const dashSpd = def.range / dashDur;
      this.player.phantomMistTimer = dashDur + 0.05;
      this.phantomDashTimer = dashDur;
      this.phantomVx = Math.cos(targetAngle) * dashSpd;
      this.phantomVy = Math.sin(targetAngle) * dashSpd;
      this.phantomMistNodeAccum = 0;
      this.phantomMult = mult;
      this.dashHitIds.clear();

      // Drop origin spectral mist pool & gain Restless Spirit!
      this.spawnGroundEffect(
        'spectral_mist_node',
        this.player.x,
        this.player.y,
        0,
        0,
        targetAngle,
        48,
        1.85,
        '#2dd4bf',
        '#818cf8'
      );
      this.grantRestlessSpirit();
    } else if (skillId === 'soul_drain') {
      this.player.swordAnim = SwordAnimState.SOUL_DRAIN;
      this.swordAnimDuration = 0.4;
      this.swordAnimTimer = 0.4;
      soundEngine.playGhostWisp(0.78);

      const drainRange = def.range + (this.player.nightmareTimer > 0 ? 35 : 0);
      this.spawnGroundEffect(
        'astral_nova',
        this.player.x,
        this.player.y,
        0,
        0,
        0,
        drainRange * 0.92,
        0.48,
        '#2dd4bf',
        '#c084fc'
      );

      // Latch ethereal tendrils onto up to 4 nearest living enemies!
      const candidates: Array<{ e: EnemyEntity; d: number }> = [];
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
        if (d <= drainRange + e.radius) {
          candidates.push({ e, d });
        }
      }
      candidates.sort((a, b) => a.d - b.d);

      const totalTicks = 5;
      const totalDmgPerTarget = this.getEffectiveAtk() * mult;
      const dps = totalDmgPerTarget / 2.1;
      const latchCount = Math.min(4, candidates.length);

      for (let i = 0; i < latchCount; i++) {
        const targetE = candidates[i].e;
        this.spawnSoulTether(targetE.id, targetE.x, targetE.y - 10, 2.15, dps);
        // Immediate latch pulse!
        const initDmg = Math.max(3, Math.round(totalDmgPerTarget / totalTicks));
        this.damageEnemy(targetE, initDmg, false, '#2dd4bf');
        this.healPlayer(Math.max(4, Math.round(initDmg * 0.42)), i === 0);
      }
      if (latchCount > 0) {
        this.spawnFloatingText(this.player.x, this.player.y - 42, 'SOUL DRAIN!', '#5eead4', false);
      }
    } else if (skillId === 'wailing_scream') {
      this.player.swordAnim = SwordAnimState.WAILING_SCREAM;
      this.swordAnimDuration = 0.38;
      this.swordAnimTimer = 0.38;
      soundEngine.playWail();
      this.triggerShake(0.2, 5.2);

      const screamRad = def.range * (this.player.nightmareTimer > 0 ? 1.2 : 1.0);
      this.wailingRange = screamRad;
      this.wailingEchoLeft = 2;
      this.wailingEchoTimer = 0.11;

      this.spawnGroundEffect(
        'wailing_wave',
        this.player.x,
        this.player.y - 6,
        0,
        0,
        0,
        screamRad,
        0.52,
        '#c084fc',
        '#5eead4'
      );
      this.spawnSoftMotes(this.player.x, this.player.y, 0, screamRad * 0.65, '#c084fc', 14);
      this.spawnFloatingText(this.player.x, this.player.y - 44, 'WAILING SCREAM!', '#e9d5ff', true);

      const fearDur = 2.3 + (rank - 1) * 0.25;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
        if (d <= screamRad + e.radius) {
          const { dmg, isCrit } = this.rollPlayerDamage(mult, 0.08);
          this.damageEnemy(e, dmg, isCrit, '#c084fc');
          if (e.hp > 0 && e.kind !== EnemyKind.TRAINING_DUMMY) {
            e.fearTimer = Math.max(e.fearTimer, isBossKind(e.kind) ? fearDur * 0.45 : fearDur);
            e.windupTimer = 0; // Interrupt enemy windup in terror!
            if (!isBossKind(e.kind)) {
              const ka = Math.atan2(e.y - this.player.y, e.x - this.player.x);
              this.tryMoveEntity(e.x, e.y, Math.cos(ka) * 36, Math.sin(ka) * 36, e.radius, (nx, ny) => {
                e.x = nx;
                e.y = ny;
              });
            }
          }
        }
      }
    } else if (skillId === 'haunted_possession') {
      this.player.swordAnim = SwordAnimState.HAUNTED_POSSESSION;
      this.swordAnimDuration = 0.34;
      this.swordAnimTimer = 0.34;

      // Find host enemy along aim ray or nearest within range
      let host: EnemyEntity | null = null;
      let bestScore = 99999;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
        if (d > def.range + 75) continue;
        let diff = Math.atan2(e.y - this.player.y, e.x - this.player.x) - targetAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const score = isManual ? d * 0.65 + Math.abs(diff) * 180 : d;
        if (score < bestScore) {
          bestScore = score;
          host = e;
        }
      }

      if (host) {
        soundEngine.playGhostWisp(0.72);
        this.triggerShake(0.16, 4.0);
        // Vanish from origin in an astral burst
        this.spawnGroundEffect(
          'possession_burst',
          this.player.x,
          this.player.y,
          0,
          0,
          0,
          56,
          0.42,
          '#a855f7',
          '#2dd4bf'
        );
        // Enter host body!
        const possessDur = 2.5 + (rank - 1) * 0.2;
        this.possessedEnemyId = host.id;
        host.possessedTimer = possessDur;
        host.windupTimer = 0;
        this.player.possessingTimer = possessDur;
        this.possessionHostAtkAccum = 0.1;
        this.possessionExitMult = mult;
        this.player.x = host.x;
        this.player.y = host.y;
        this.spawnGroundEffect(
          'possession_burst',
          host.x,
          host.y,
          0,
          0,
          0,
          host.radius + 42,
          0.5,
          '#c084fc',
          '#2dd4bf'
        );
        this.spawnFloatingText(host.x, host.y - host.radius - 26, 'POSSESSED!', '#c084fc', true);
        this.grantRestlessSpirit();
      } else {
        // No host in range: fire an astral possession surge forward and refund 65% cooldown!
        soundEngine.playGhostWisp(1.1);
        this.cooldowns[skillId] = def.cooldown * 0.35;
        const surgeX = this.player.x + Math.cos(targetAngle) * Math.min(120, def.range * 0.5);
        const surgeY = this.player.y + Math.sin(targetAngle) * Math.min(120, def.range * 0.5);
        if (this.isPointWalkable(surgeX, surgeY, 15, true)) {
          this.player.x = surgeX;
          this.player.y = surgeY;
        }
        this.spawnGroundEffect(
          'possession_burst',
          this.player.x,
          this.player.y,
          0,
          0,
          0,
          72,
          0.45,
          '#a855f7',
          '#2dd4bf'
        );
      }
    } else if (skillId === 'eternal_nightmare') {
      this.player.swordAnim = SwordAnimState.ETERNAL_NIGHTMARE;
      this.swordAnimDuration = 0.46;
      this.swordAnimTimer = 0.46;
      const nightDur = 8.5 + (rank - 1) * 0.75;
      this.player.nightmareTimer = nightDur;
      const veilShield = Math.round(this.player.maxHp * 0.32);
      this.player.shield = Math.max(this.player.shield, veilShield);
      soundEngine.playSkill('ultimate');
      soundEngine.playWail();
      this.triggerShake(0.28, 6.8);

      this.spawnGroundEffect(
        'wailing_wave',
        this.player.x,
        this.player.y,
        0,
        0,
        0,
        def.range,
        0.68,
        '#818cf8',
        '#c084fc'
      );
      this.spawnGroundEffect(
        'astral_nova',
        this.player.x,
        this.player.y,
        0,
        0,
        0,
        def.range * 0.85,
        0.6,
        '#6366f1',
        '#2dd4bf'
      );
      this.spawnSoftMotes(this.player.x, this.player.y, 0, def.range * 0.75, '#a5b4fc', 18);
      this.spawnFloatingText(this.player.x, this.player.y - 52, 'ETERNAL NIGHTMARE!', '#c7d2fe', true);

      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= def.range + e.radius) {
          const { dmg, isCrit } = this.rollPlayerDamage(mult * 0.72, 0.16);
          this.damageEnemy(e, dmg, isCrit, '#818cf8');
          if (e.hp > 0 && e.kind !== EnemyKind.TRAINING_DUMMY) {
            e.fearTimer = Math.max(e.fearTimer, isBossKind(e.kind) ? 1.0 : 2.2);
            e.windupTimer = 0;
          }
        }
      }

      // Summon 3–5 terrifying Ghost Apparitions that phase, chase, slash & spread fear!
      const appCount = 3 + (rank - 1);
      this.summonMinions(
        'ghost',
        this.player.x,
        this.player.y,
        appCount,
        0.48 + (rank - 1) * 0.1,
        85 + rank * 25,
        nightDur,
        targetAngle
      );
    } else if (skillId === 'spirit_legion') {
      this.player.swordAnim = SwordAnimState.SPIRIT_LEGION;
      this.swordAnimDuration = 0.44;
      this.swordAnimTimer = 0.44;
      soundEngine.playSkill('ultimate');
      soundEngine.playGhostWisp(1.12);
      this.triggerShake(0.2, 4.8);

      this.spawnGroundEffect(
        'astral_nova',
        this.player.x,
        this.player.y,
        0,
        0,
        0,
        118,
        0.52,
        '#2dd4bf',
        '#818cf8'
      );
      this.spawnFloatingText(this.player.x, this.player.y - 48, 'SPIRIT LEGION!', '#5eead4', true);

      const spiritCount = 8 + (rank - 1) * 2;
      const perSpiritDmg = Math.max(10, Math.round((this.getEffectiveAtk() * mult) / 3.4));
      for (let i = 0; i < spiritCount; i++) {
        const ang = (i * Math.PI * 2) / spiritCount;
        this.spawnOrbitingSpirit(ang, 58, 0.24 + i * 0.15, perSpiritDmg);
      }
    } else if (skillId === 'deaths_passage') {
      this.player.swordAnim = SwordAnimState.DEATHS_PASSAGE;
      this.swordAnimDuration = 0.48;
      this.swordAnimTimer = 0.48;
      soundEngine.playSkill('ultimate');
      soundEngine.playWail();
      this.triggerShake(0.24, 5.8);

      let cx = this.player.x + Math.cos(targetAngle) * targetDist;
      let cy = this.player.y + Math.sin(targetAngle) * targetDist;
      if (!this.isSinglePointWalkable(cx, cy)) {
        const clamped = this.findFurthestWalkableAlongRay(this.player.x, this.player.y, cx, cy, 12, true);
        cx = clamped.x;
        cy = clamped.y;
      }

      const explosionDmg = Math.max(25, Math.round(this.getEffectiveAtk() * mult));
      this.spawnSpectralRift(cx, cy, def.radiusOrAngle, 1.5, 2.2, 210, explosionDmg);
      this.spawnFloatingText(cx, cy - 46, "DEATH'S PASSAGE!", '#a5b4fc', true);
    }

    // =========================================================================
    // HUMAN – PIPE BRAWLER ACTIVE & ULTIMATE SKILLS (100% UNIQUE KINETIC VFX)
    // =========================================================================
    else if (skillId === 'pipe_swing') {
      // Normal 1: Powerful horizontal pipe batter striking multiple enemies in front & knocking weaker foes backward!
      this.player.swordAnim = SwordAnimState.PIPE_SWING;
      this.swordAnimDuration = 0.27;
      this.swordAnimTimer = 0.27;
      this.targetAttackTwist = 1.25;
      this.attackImpulseVx = Math.cos(targetAngle) * 85;
      this.attackImpulseVy = Math.sin(targetAngle) * 85;
      soundEngine.playPipeSwing(0.95);
      soundEngine.playPipeClang(0.96, true);
      this.triggerShake(0.14, 4.2);

      this.spawnPipeStrike(
        'pipe_swing_cone',
        this.player.x,
        this.player.y - 8,
        targetAngle,
        def.range * 0.96,
        1,
        0.24,
        '#fb923c',
        '#e2e8f0'
      );

      const half = def.radiusOrAngle * 0.5;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        const dist = Math.hypot(dx, dy);
        if (dist > def.range + e.radius) continue;
        const angToE = Math.atan2(dy, dx);
        let diff = angToE - targetAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) <= half || dist < e.radius + 26) {
          const { dmg, isCrit } = this.rollPlayerDamage(mult, 0.14);
          this.damageEnemy(e, dmg, isCrit, '#fb923c');
          // Knock weaker / non-boss enemies strongly backward!
          if (e.hp > 0 && e.kind !== EnemyKind.TRAINING_DUMMY) {
            const kbDist = isBossKind(e.kind) ? 16 : e.kind === EnemyKind.BRUTE ? 48 : 82;
            const ka = Math.atan2(dy, dx);
            this.tryMoveEntity(e.x, e.y, Math.cos(ka) * kbDist, Math.sin(ka) * kbDist, e.radius * 0.75, (nx, ny) => {
              e.x = nx;
              e.y = ny;
            });
          }
        }
      }
      this.spawnArcBurst(this.player.x, this.player.y, targetAngle, def.range * 0.8, '#fb923c', 16);
    } else if (skillId === 'headcracker') {
      // Normal 2: Raises the pipe high and delivers a heavy overhead strike that staggers & interrupts enemy attacks!
      this.player.swordAnim = SwordAnimState.HEADCRACKER;
      this.swordAnimDuration = 0.32;
      this.swordAnimTimer = 0.32;
      this.targetAttackTwist = 0.6;

      // Short agile step-in toward target enemy/point before slamming overhead!
      let strikeDist = Math.min(def.range, Math.max(58, targetDist));
      const nearestInLine = this.findNearestEnemy(def.range + 30);
      if (!isManual && nearestInLine) {
        strikeDist = Math.min(def.range, Math.hypot(nearestInLine.x - this.player.x, nearestInLine.y - this.player.y));
      }
      const stepDist = Math.max(0, strikeDist - 54);
      if (stepDist > 8) {
        const dest = this.findFurthestWalkableAlongRay(
          this.player.x,
          this.player.y,
          this.player.x + Math.cos(targetAngle) * stepDist,
          this.player.y + Math.sin(targetAngle) * stepDist,
          16
        );
        this.player.x = dest.x;
        this.player.y = dest.y;
      }

      const impactX = this.player.x + Math.cos(targetAngle) * 52;
      const impactY = this.player.y + Math.sin(targetAngle) * 52;

      soundEngine.playPipeClang(0.76, true);
      this.triggerShake(0.22, 6.2);

      this.spawnPipeStrike(
        'headcracker_anvil',
        impactX,
        impactY - 6,
        targetAngle,
        92,
        1,
        0.28,
        '#f97316',
        '#fde047'
      );
      this.spawnGroundEffect(
        'headcracker_dent',
        impactX,
        impactY + 4,
        0,
        0,
        targetAngle,
        def.radiusOrAngle * 1.18,
        1.15,
        '#fb923c',
        '#fde047'
      );
      this.spawnBurstParticles(impactX, impactY - 6, '#fde047', 18, true);

      let interruptedAny = false;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - impactX, e.y - impactY) <= def.radiusOrAngle + e.radius + 12) {
          const wasWindingUp = e.windupTimer > 0;
          e.windupTimer = 0; // Interrupt active enemy attack!
          e.armorCrackTimer = Math.max(e.armorCrackTimer, 3.5);
          if (e.kind !== EnemyKind.TRAINING_DUMMY) {
            e.staggerTimer = Math.max(
              e.staggerTimer,
              isBossKind(e.kind) ? 1.05 : 2.1 + (rank - 1) * 0.2
            );
          }
          if (wasWindingUp) interruptedAny = true;
          const { dmg, isCrit } = this.rollPlayerDamage(mult * (wasWindingUp ? 1.2 : 1.0), 0.24);
          this.damageEnemy(e, dmg, isCrit, '#fde047');
        }
      }
      this.spawnFloatingText(
        impactX,
        impactY - 40,
        interruptedAny ? 'INTERRUPTED!' : 'HEADCRACKER!',
        '#fde047',
        true
      );
    } else if (skillId === 'scrappers_dash') {
      // Normal 3: Quickly dashes in selected direction swinging the pipe around, striking & shoving foes aside!
      this.player.swordAnim = SwordAnimState.SCRAPPERS_DASH;
      this.swordAnimDuration = 0.25;
      this.swordAnimTimer = 0.25;
      soundEngine.playSkill('rush');
      soundEngine.playPipeSwing(1.15);

      const dashDur = 0.21;
      const dashSpd = def.range / dashDur;
      this.dashStartX = this.player.x;
      this.dashStartY = this.player.y;
      this.scrappersDashTimer = dashDur;
      this.scrappersDashVx = Math.cos(targetAngle) * dashSpd;
      this.scrappersDashVy = Math.sin(targetAngle) * dashSpd;
      this.scrappersDashMult = mult;
      this.dashHitIds.clear();

      this.spawnPipeStrike(
        'street_sweep',
        this.player.x + Math.cos(targetAngle) * 20,
        this.player.y - 8 + Math.sin(targetAngle) * 20,
        targetAngle,
        74,
        1,
        0.22,
        '#fb923c',
        '#e2e8f0'
      );
    } else if (skillId === 'improvised_throw') {
      // Normal 4: Throws the old metal pipe spinning through the air, striking enemies along path before bouncing back!
      this.player.swordAnim = SwordAnimState.IMPROVISED_THROW;
      this.swordAnimDuration = 0.22;
      this.swordAnimTimer = 0.22;
      this.player.pipeThrown = true;
      soundEngine.playPipeSwing(1.26);

      const { dmg, isCrit } = this.rollPlayerDamage(mult, 0.16);
      const throwSpeed = 660;
      this.spawnProjectile({
        fromPlayer: true,
        kind: 'thrown_pipe',
        x: this.player.x + Math.cos(targetAngle) * 22,
        y: this.player.y - 10 + Math.sin(targetAngle) * 22,
        vx: Math.cos(targetAngle) * throwSpeed,
        vy: Math.sin(targetAngle) * throwSpeed,
        angle: targetAngle,
        radius: 26,
        damage: dmg,
        isCrit,
        pierce: true,
        maxLife: 1.5,
        color: '#fb923c',
        returning: false,
        spinAngle: targetAngle,
      });
    } else if (skillId === 'street_fighter') {
      // Normal 5: Enters fighting stance & unleashes quick pipe strikes, knee strike, and final 360° sweep!
      this.player.swordAnim = SwordAnimState.STREET_FIGHTER;
      this.swordAnimDuration = 0.44;
      this.swordAnimTimer = 0.44;
      soundEngine.playPipeSwing(1.1);

      this.spawnGroundEffect(
        'brawler_stance_ring',
        this.player.x,
        this.player.y + 4,
        0,
        0,
        targetAngle,
        def.range * 0.76,
        0.52,
        '#f59e0b',
        '#f8fafc'
      );
      this.spawnFloatingText(this.player.x, this.player.y - 42, 'STREET COMBO!', '#fbbf24', false);

      // Beat 1 immediately: snappy right pipe strike; Beats 2 (left hook), 3 (knee strike), 4 (360° sweep) queued!
      this.spawnPipeStrike(
        'basic_jab',
        this.player.x,
        this.player.y - 8,
        targetAngle,
        118,
        1,
        0.18,
        '#fb923c',
        '#f8fafc'
      );
      this.hitEnemiesInCone(targetAngle, 126, Math.PI * 0.9, mult * 0.34, 0.12, '#fb923c', 0);

      this.streetComboBeat = 1;
      this.streetComboTimer = 0.105;
      this.streetComboAngle = targetAngle;
      this.streetComboMult = mult;
    } else if (skillId === 'last_stand') {
      // Ultimate 1: Grips the old pipe with both hands in a desperate fighting state — 3 wide knockback swings + seismic ground strike!
      this.player.swordAnim = SwordAnimState.LAST_STAND_SWING;
      this.swordAnimDuration = 0.82;
      this.swordAnimTimer = 0.82;
      this.player.lastStandTimer = 4.2 + (rank - 1) * 0.6;
      const gritShield = Math.round(this.player.maxHp * (0.38 + (rank - 1) * 0.06));
      this.player.shield = Math.max(this.player.shield, gritShield);
      soundEngine.playSkill('ultimate');
      soundEngine.playPipeClang(0.84, true);
      this.triggerShake(0.24, 6.0);

      this.spawnGroundEffect(
        'brawler_stance_ring',
        this.player.x,
        this.player.y + 4,
        0,
        0,
        0,
        125,
        0.65,
        '#f97316',
        '#fde047'
      );
      this.spawnFloatingText(this.player.x, this.player.y - 50, 'LAST STAND!', '#fde047', true);

      this.lastStandSwingsLeft = 3;
      this.lastStandSwingTimer = 0.03;
      this.lastStandSlamPending = true;
      this.lastStandSlamTimer = 0.68;
      this.lastStandMult = mult;
    } else if (skillId === 'scrapstorm') {
      // Ultimate 2: Tears apart nearby ground debris with powerful pipe swings -> orbits -> chaotic shrapnel barrage!
      this.player.swordAnim = SwordAnimState.SCRAPSTORM_CAST;
      this.swordAnimDuration = 0.46;
      this.swordAnimTimer = 0.46;
      soundEngine.playSkill('ultimate');
      soundEngine.playPipeClang(0.8, true);
      this.triggerShake(0.26, 6.5);

      this.spawnGroundEffect(
        'headcracker_dent',
        this.player.x,
        this.player.y + 4,
        0,
        0,
        targetAngle,
        135,
        0.95,
        '#94a3b8',
        '#fb923c'
      );
      this.spawnPipeStrike(
        'street_sweep',
        this.player.x,
        this.player.y - 8,
        targetAngle,
        142,
        1,
        0.28,
        '#fb923c',
        '#cbd5e1'
      );
      this.spawnFloatingText(this.player.x, this.player.y - 48, 'SCRAPSTORM!', '#fed7aa', true);

      // Initial pipe ground-tear damages adjacent enemies as debris rips upward!
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= 142 + e.radius) {
          const { dmg, isCrit } = this.rollPlayerDamage(mult * 0.48, 0.15);
          this.damageEnemy(e, dmg, isCrit, '#fb923c');
        }
      }

      const shapes: ScrapDebrisPiece['shape'][] = ['gear', 'rebar', 'stone', 'plate', 'bolt'];
      const debrisCount = 10 + (rank - 1) * 2;
      const perPieceDmg = Math.max(11, Math.round((this.getEffectiveAtk() * mult) / 3.1));
      for (let i = 0; i < debrisCount; i++) {
        const ang = (i * Math.PI * 2) / debrisCount;
        const rad = 52 + (i % 2) * 18;
        this.spawnScrapDebris(shapes[i % shapes.length], ang, rad, 0.34 + i * 0.11, perPieceDmg);
      }
    } else if (skillId === 'one_man_army') {
      // Ultimate 3: Extraordinary combat instinct — rapid unpredictable blitzes/evades/counters + massive spinning pipe finisher!
      this.player.swordAnim = SwordAnimState.ONE_MAN_ARMY_BLITZ;
      this.swordAnimDuration = 0.32;
      this.swordAnimTimer = 0.32;
      this.player.oneManArmyTimer = 1.65;
      soundEngine.playSkill('ultimate');
      soundEngine.playPipeClang(1.08, true);
      this.triggerShake(0.22, 5.5);

      this.spawnGroundEffect(
        'brawler_stance_ring',
        this.player.x,
        this.player.y + 4,
        0,
        0,
        0,
        118,
        0.55,
        '#fb923c',
        '#ffffff'
      );
      this.spawnFloatingText(this.player.x, this.player.y - 50, 'ONE MAN ARMY!', '#ffffff', true);

      this.omaBlitzLeft = 6 + (rank - 1);
      this.omaBlitzTimer = 0.04;
      this.omaFinisherPending = true;
      this.omaFinisherTimer = this.omaBlitzLeft * 0.135 + 0.12;
      this.omaMult = mult;
      this.omaLastEnemyId = -1;
    } else if (skillId === 'piercing_volley') {
      // Normal 1: Unleashes powerful spread of sharpened feathers in wide forward direction (piercing)
      this.player.swordAnim = SwordAnimState.PIERCING_VOLLEY;
      this.swordAnimDuration = 0.32;
      this.swordAnimTimer = 0.32;
      this.player.wingFlapTimer = 0.32;
      soundEngine.playWingFlap(1.22);
      soundEngine.playFeatherShoot(1.1);

      const featherCount = 5 + (rank - 1);
      const spreadSpan = 0.55;
      const { dmg, isCrit } = this.rollPlayerDamage(mult / Math.max(1, featherCount * 0.42), 0.12);
      for (let i = 0; i < featherCount; i++) {
        const offsetAng = featherCount > 1 ? (i / (featherCount - 1) - 0.5) * spreadSpan : 0;
        const fAng = targetAngle + offsetAng;
        this.spawnProjectile({
          fromPlayer: true,
          kind: 'piercing_feather',
          x: this.player.x + Math.cos(fAng) * 20,
          y: this.player.y - 10 + Math.sin(fAng) * 20,
          vx: Math.cos(fAng) * 680,
          vy: Math.sin(fAng) * 680,
          angle: fAng,
          radius: 16,
          damage: dmg,
          isCrit,
          pierce: true,
          maxLife: def.range / 680 + 0.1,
          color: '#38bdf8',
        });
      }
      this.spawnArcBurst(this.player.x, this.player.y - 10, targetAngle, def.range * 0.4, '#38bdf8', 14);
    } else if (skillId === 'homing_feathers') {
      // Normal 2: Launches several enchanted feathers into the air tracking nearby enemies
      this.player.swordAnim = SwordAnimState.HOMING_FEATHERS;
      this.swordAnimDuration = 0.34;
      this.swordAnimTimer = 0.34;
      this.player.wingFlapTimer = 0.34;
      soundEngine.playWingFlap(1.15);
      soundEngine.playFeatherShoot(1.25);

      const featherCount = 4 + (rank - 1);
      const { dmg, isCrit } = this.rollPlayerDamage(mult / Math.max(1, featherCount * 0.45), 0.1);
      for (let i = 0; i < featherCount; i++) {
        const launchAng = targetAngle + (Math.random() - 0.5) * 1.6;
        const spd = 420 + Math.random() * 80;
        this.spawnProjectile({
          fromPlayer: true,
          kind: 'homing_feather',
          x: this.player.x + Math.cos(launchAng) * 18,
          y: this.player.y - 12 + Math.sin(launchAng) * 18,
          vx: Math.cos(launchAng) * spd,
          vy: Math.sin(launchAng) * spd,
          angle: launchAng,
          radius: 14,
          damage: dmg,
          isCrit,
          pierce: false,
          maxLife: 1.6,
          color: '#06b6d4',
          targetEnemyId: -1,
        });
      }
      this.spawnRingEffect(this.player.x, this.player.y - 10, 52, '#06b6d4');
    } else if (skillId === 'hunters_mark') {
      // Normal 3: Exceptional eyesight marks target enemy; attacks +35% dmg & projectiles adjust trajectory
      this.player.swordAnim = SwordAnimState.HUNTERS_MARK;
      this.swordAnimDuration = 0.3;
      this.swordAnimTimer = 0.3;
      this.player.wingFlapTimer = 0.3;
      soundEngine.playSkyScreech(1.2);
      soundEngine.playSkill('rush');

      let markTarget = this.findNearestEnemy(def.range + 80);
      if (!isManual && markTarget) {
        // Already nearest
      } else {
        const cx = this.player.x + Math.cos(targetAngle) * targetDist;
        const cy = this.player.y + Math.sin(targetAngle) * targetDist;
        markTarget = this.findNearestEnemyFrom(cx, cy, 140) || markTarget;
      }

      if (markTarget) {
        markTarget.huntersMarkTimer = 7.0;
        this.player.huntersMarkTargetId = markTarget.id;
        const { dmg, isCrit } = this.rollPlayerDamage(mult, 0.25);
        this.damageEnemy(markTarget, dmg, isCrit, '#38bdf8');
        this.spawnFloatingText(markTarget.x, markTarget.y - markTarget.radius - 32, "HUNTER'S MARK!", '#38bdf8', true);
        this.spawnRingEffect(markTarget.x, markTarget.y, 48, '#38bdf8');
        this.spawnBurstParticles(markTarget.x, markTarget.y - 10, '#38bdf8', 16, true);
      }
    } else if (skillId === 'windstep') {
      // Normal 4: Propels rapidly in selected direction while releasing a gust of wind
      this.player.swordAnim = SwordAnimState.WINDSTEP;
      this.swordAnimDuration = 0.24;
      this.swordAnimTimer = 0.24;
      this.player.wingFlapTimer = 0.32;
      soundEngine.playWingFlap(0.9);
      soundEngine.playSkill('rush');

      const dashDur = 0.22;
      const dashSpeed = def.range / dashDur;
      this.windstepDashTimer = dashDur;
      this.windstepDashVx = Math.cos(targetAngle) * dashSpeed;
      this.windstepDashVy = Math.sin(targetAngle) * dashSpeed;
      this.player.facing = targetAngle;
      this.dashHitIds.clear();

      this.spawnRingEffect(this.player.x, this.player.y, 75, '#38bdf8');
      this.spawnSoftMotes(this.player.x, this.player.y, targetAngle + Math.PI, 65, '#e0f2fe', 8);

      // Wind gust damages and pushes back nearby enemies at origin
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= 85 + e.radius) {
          const { dmg, isCrit } = this.rollPlayerDamage(mult * 0.4, 0.1);
          e.slowTimer = Math.max(e.slowTimer, 1.8);
          this.damageEnemy(e, dmg, isCrit, '#38bdf8');
          if (e.kind !== EnemyKind.TRAINING_DUMMY && !isBossKind(e.kind)) {
            const ka = Math.atan2(e.y - this.player.y, e.x - this.player.x);
            this.tryMoveEntity(e.x, e.y, Math.cos(ka) * 44, Math.sin(ka) * 44, e.radius, (nx, ny) => {
              e.x = nx;
              e.y = ny;
            });
          }
        }
      }
    } else if (skillId === 'rain_of_feathers') {
      // Normal 5: Flies briefly above battlefield and releases continuous shower of feathers over area
      this.player.swordAnim = SwordAnimState.RAIN_OF_FEATHERS;
      this.swordAnimDuration = 0.38;
      this.swordAnimTimer = 0.38;
      this.player.wingFlapTimer = 0.45;
      this.player.airborneHeight = 28;
      this.player.rainOfFeathersTimer = 3.0;
      soundEngine.playWingFlap(1.05);
      soundEngine.playSkill('storm');

      const cx = this.player.x + Math.cos(targetAngle) * targetDist;
      const cy = this.player.y + Math.sin(targetAngle) * targetDist;
      this.rainOfFeathersTargetX = cx;
      this.rainOfFeathersTargetY = cy;
      this.rainOfFeathersRadius = def.radiusOrAngle;
      this.rainOfFeathersMult = mult;
      this.rainOfFeathersVolleysLeft = 7 + (rank - 1) * 2;
      this.rainOfFeathersVolleyTimer = 0.04;

      this.spawnRingEffect(cx, cy, def.radiusOrAngle, '#38bdf8');
      this.spawnBurstParticles(cx, cy, '#38bdf8', 18, true);
      this.spawnFloatingText(cx, cy - 35, 'RAIN OF FEATHERS!', '#38bdf8', true);
    } else if (skillId === 'wrath_of_the_sky') {
      // Ultimate 1: Ascends high above battlefield, spreads enormous wings, unleashes huge storm of feathers
      this.player.swordAnim = SwordAnimState.WRATH_OF_THE_SKY;
      this.swordAnimDuration = 0.45;
      this.swordAnimTimer = 0.45;
      this.player.wingFlapTimer = 0.55;
      this.player.airborneHeight = 44;
      this.player.wrathSkyTimer = 4.2;
      soundEngine.playSkyScreech(0.9);
      soundEngine.playSkill('ultimate');
      this.triggerShake(0.28, 6.5);

      const cx = this.player.x + Math.cos(targetAngle) * targetDist;
      const cy = this.player.y + Math.sin(targetAngle) * targetDist;
      this.wrathSkyTargetX = cx;
      this.wrathSkyTargetY = cy;
      this.wrathSkyRadius = def.radiusOrAngle;
      this.wrathSkyMult = mult;
      this.wrathSkyVolleysLeft = 14 + (rank - 1) * 3;
      this.wrathSkyVolleyTimer = 0.04;

      this.spawnRingEffect(cx, cy, def.radiusOrAngle, '#0284c7');
      this.spawnRingEffect(cx, cy, def.radiusOrAngle * 0.65, '#e0f2fe');
      this.spawnBurstParticles(cx, cy, '#38bdf8', 28, true);
      this.spawnFloatingText(this.player.x, this.player.y - 50, 'WRATH OF THE SKY!', '#38bdf8', true);
    } else if (skillId === 'celestial_barrage') {
      // Ultimate 2: Summons enormous spectral wings behind itself that continuously fire magical feathers
      this.player.swordAnim = SwordAnimState.CELESTIAL_BARRAGE;
      this.swordAnimDuration = 0.42;
      this.swordAnimTimer = 0.42;
      this.player.wingFlapTimer = 0.5;
      this.player.celestialBarrageTimer = 8.5;
      this.player.celestialBarrageWings = 4;
      this.celestialBarrageTimer = 8.5;
      this.celestialBarrageTickTimer = 0.22;
      this.celestialBarrageMult = mult;
      soundEngine.playSkyScreech(1.1);
      soundEngine.playSkill('ultimate');
      this.triggerShake(0.22, 5.0);

      this.spawnRingEffect(this.player.x, this.player.y, 110, '#38bdf8');
      this.spawnBurstParticles(this.player.x, this.player.y - 12, '#e0f2fe', 24, true);
      this.spawnFloatingText(this.player.x, this.player.y - 48, 'CELESTIAL BARRAGE!', '#38bdf8', true);
    } else if (skillId === 'final_horizon') {
      // Ultimate 3: Gigantic enchanted feather pierces whole battlefield, then explodes into homing feathers
      this.player.swordAnim = SwordAnimState.FINAL_HORIZON;
      this.swordAnimDuration = 0.46;
      this.swordAnimTimer = 0.46;
      this.player.wingFlapTimer = 0.5;
      soundEngine.playSkyScreech(0.85);
      soundEngine.playSkill('ultimate');
      this.triggerShake(0.32, 8.5);

      const { dmg, isCrit } = this.rollPlayerDamage(mult, 0.28);
      const spawnX = this.player.x + Math.cos(targetAngle) * 24;
      const spawnY = this.player.y - 12 + Math.sin(targetAngle) * 24;

      this.spawnProjectile({
        fromPlayer: true,
        kind: 'final_feather',
        x: spawnX,
        y: spawnY,
        vx: Math.cos(targetAngle) * 720,
        vy: Math.sin(targetAngle) * 720,
        angle: targetAngle,
        radius: 34,
        damage: dmg,
        isCrit,
        pierce: true,
        maxLife: def.range / 720 + 0.12,
        color: '#e0f2fe',
      });

      this.spawnRingEffect(spawnX, spawnY, 68, '#38bdf8');
      this.spawnBurstParticles(spawnX, spawnY, '#e0f2fe', 30, true);
      this.spawnFloatingText(this.player.x, this.player.y - 52, 'FINAL HORIZON!', '#e0f2fe', true);
    } else if (skillId === 'predators_pounce') {
      // Normal 1: Predator's Pounce – Leaps toward a targeted enemy and strikes with both claws upon landing
      this.player.swordAnim = SwordAnimState.PREDATORS_POUNCE;
      this.swordAnimDuration = 0.28;
      this.swordAnimTimer = 0.28;
      soundEngine.playSkill('rush');
      this.pounceTimer = 0.26;
      this.pounceDuration = 0.26;
      this.pounceIsPredatorLeap = false;
      this.pounceIsTigerkin = true;
      this.pounceStartX = this.player.x;
      this.pounceStartY = this.player.y;
      const jumpDist = Math.min(def.range, Math.max(30, targetDist));
      const targetPoint = this.findFurthestWalkableAlongRay(
        this.player.x,
        this.player.y,
        this.player.x + Math.cos(targetAngle) * jumpDist,
        this.player.y + Math.sin(targetAngle) * jumpDist,
        16
      );
      this.pounceTargetX = targetPoint.x;
      this.pounceTargetY = targetPoint.y;
      this.pounceMult = mult;
      this.pounceRadius = def.radiusOrAngle;
      this.spawnRingEffect(this.player.x, this.player.y, 44, '#f59e0b');
    } else if (skillId === 'rending_flurry') {
      // Normal 2: Rending Flurry – Unleashes a rapid series of claw strikes against enemies directly ahead
      this.player.swordAnim = SwordAnimState.RENDING_FLURRY;
      this.swordAnimDuration = 0.35;
      this.swordAnimTimer = 0.35;
      this.rendingFlurryHitsLeft = 5;
      this.rendingFlurryTimer = 0.055;
      this.rendingFlurryAngle = targetAngle;
      this.rendingFlurryMult = mult;
      soundEngine.playFeralClaw(1.22, false);
      this.spawnSlashWave(
        'rending_flurry_slash',
        this.player.x + Math.cos(targetAngle) * 16,
        this.player.y - 8 + Math.sin(targetAngle) * 16,
        targetAngle,
        def.range * 0.95,
        def.radiusOrAngle,
        1,
        0.24,
        '#fef08a',
        '#f59e0b'
      );
      this.hitEnemiesInCone(targetAngle, def.range, def.radiusOrAngle, mult * 0.35, 0.2, '#f59e0b', 0);
    } else if (skillId === 'tigers_roar') {
      // Normal 3: Tiger's Roar – Releases terrifying roar weakening nearby enemies and interrupting attacks
      this.player.swordAnim = SwordAnimState.TIGERS_ROAR;
      this.swordAnimDuration = 0.36;
      this.swordAnimTimer = 0.36;
      this.player.tigerRoarTimer = 4.0;
      soundEngine.playTigerRoar(1.0);
      this.triggerShake(0.2, 5.0);
      // Grants +2 Feral Momentum stacks
      this.player.feralMomentumStacks = Math.min(5, (this.player.feralMomentumStacks || 0) + 2);
      this.player.feralMomentumTimer = 4.0;

      this.spawnGroundEffect('tiger_roar_burst', this.player.x, this.player.y, 0, 0, 0, def.range, 0.65, '#f59e0b', '#fbbf24');
      this.spawnRingEffect(this.player.x, this.player.y, def.range, '#f59e0b');
      this.spawnRingEffect(this.player.x, this.player.y, def.range * 0.6, '#fde047');
      this.spawnBurstParticles(this.player.x, this.player.y - 8, '#fbbf24', 24, true);
      this.spawnFloatingText(this.player.x, this.player.y - 42, "TIGER'S ROAR!", '#fbbf24', true);

      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= def.range + e.radius) {
          e.windupTimer = 0;
          e.slowTimer = Math.max(e.slowTimer, 3.5);
          e.armorCrackTimer = Math.max(e.armorCrackTimer, 4.0);
          if (e.kind !== EnemyKind.TRAINING_DUMMY && !isBossKind(e.kind)) {
            e.staggerTimer = Math.max(e.staggerTimer, 1.2);
          }
          const { dmg, isCrit } = this.rollPlayerDamage(mult, 0.2);
          this.damageEnemy(e, dmg, isCrit, '#fbbf24');
        }
      }
    } else if (skillId === 'savage_pursuit') {
      // Normal 4: Savage Pursuit – Rushes toward nearest enemy, tearing through anything in its path
      this.player.swordAnim = SwordAnimState.SAVAGE_PURSUIT;
      this.swordAnimDuration = 0.24;
      this.swordAnimTimer = 0.24;
      soundEngine.playSkill('rush');
      soundEngine.playFeralClaw(1.3, false);

      const rushDur = 0.22;
      const rushDist = Math.min(def.range, Math.max(40, targetDist));
      const rushSpeed = rushDist / rushDur;
      this.savagePursuitTimer = rushDur;
      this.savagePursuitVx = Math.cos(targetAngle) * rushSpeed;
      this.savagePursuitVy = Math.sin(targetAngle) * rushSpeed;
      this.savagePursuitMult = mult;
      this.savagePursuitHitIds.clear();

      this.spawnGroundEffect(
        'savage_pursuit_track',
        this.player.x,
        this.player.y + 6,
        this.player.x + Math.cos(targetAngle) * rushDist,
        this.player.y + 6 + Math.sin(targetAngle) * rushDist,
        targetAngle,
        90,
        0.45,
        '#f59e0b',
        '#fef08a'
      );
      this.spawnRingEffect(this.player.x, this.player.y, 60, '#f59e0b');
    } else if (skillId === 'crushing_paw') {
      // Normal 5: Crushing Paw – Smashes ground with tremendous force, creating shockwave and knockback
      this.player.swordAnim = SwordAnimState.CRUSHING_PAW;
      this.swordAnimDuration = 0.36;
      this.swordAnimTimer = 0.36;
      soundEngine.playSkill('ultimate');
      soundEngine.playFeralClaw(0.85, true);
      this.triggerShake(0.24, 6.5);

      this.spawnGroundEffect('tiger_crush_crater', this.player.x, this.player.y, 0, 0, targetAngle, def.radiusOrAngle, 1.3, '#f59e0b', '#fef08a');
      this.spawnSlashWave('crushing_paw_shock', this.player.x, this.player.y - 8, targetAngle, def.radiusOrAngle * 1.15, Math.PI * 1.4, 1, 0.28, '#fef08a', '#f59e0b');
      this.spawnRingEffect(this.player.x, this.player.y, def.radiusOrAngle, '#f59e0b');
      this.spawnBurstParticles(this.player.x, this.player.y - 8, '#fde047', 22, true);
      this.spawnFloatingText(this.player.x, this.player.y - 44, 'CRUSHING PAW!', '#fbbf24', true);

      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
        if (d <= def.radiusOrAngle + e.radius) {
          const { dmg, isCrit } = this.rollPlayerDamage(mult, 0.25);
          this.damageEnemy(e, dmg, isCrit, '#f59e0b');
          if (e.hp > 0 && e.kind !== EnemyKind.TRAINING_DUMMY && !isBossKind(e.kind)) {
            const ka = Math.atan2(e.y - this.player.y, e.x - this.player.x);
            this.tryMoveEntity(e.x, e.y, Math.cos(ka) * 85, Math.sin(ka) * 85, e.radius * 0.75, (nx, ny) => {
              e.x = nx;
              e.y = ny;
            });
            e.staggerTimer = Math.max(e.staggerTimer, 1.0);
          }
        }
      }
    } else if (skillId === 'king_of_beasts') {
      // Ultimate 1: King of Beasts – Enters feral state, gaining enhanced claws and relentless melee attacks
      this.player.swordAnim = SwordAnimState.KING_OF_BEASTS;
      this.swordAnimDuration = 0.44;
      this.swordAnimTimer = 0.44;
      this.player.kingOfBeastsTimer = 10.0;
      this.player.feralMomentumStacks = 5;
      this.player.feralMomentumTimer = 10.0;
      const beastShield = Math.round(this.player.maxHp * 0.35);
      this.player.shield = Math.max(this.player.shield, beastShield);
      soundEngine.playTigerRoar(0.9);
      soundEngine.playSkill('ultimate');
      this.triggerShake(0.3, 7.5);

      this.spawnGroundEffect('tiger_roar_burst', this.player.x, this.player.y, 0, 0, 0, def.range, 0.85, '#fbbf24', '#f59e0b');
      this.spawnRingEffect(this.player.x, this.player.y, def.range, '#fbbf24');
      this.spawnRingEffect(this.player.x, this.player.y, def.range * 0.65, '#fde047');
      this.spawnBurstParticles(this.player.x, this.player.y - 10, '#fde047', 32, true);
      this.spawnFloatingText(this.player.x, this.player.y - 52, 'KING OF BEASTS!', '#fbbf24', true);

      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= def.range + e.radius) {
          e.windupTimer = 0;
          e.slowTimer = Math.max(e.slowTimer, 2.5);
          const { dmg, isCrit } = this.rollPlayerDamage(mult * 0.6, 0.3);
          this.damageEnemy(e, dmg, isCrit, '#fbbf24');
        }
      }
    } else if (skillId === 'heavenly_tiger') {
      // Ultimate 2: Heavenly Tiger – Summons spectral image of gigantic tiger charging across battlefield
      this.player.swordAnim = SwordAnimState.HEAVENLY_TIGER;
      this.swordAnimDuration = 0.44;
      this.swordAnimTimer = 0.44;
      soundEngine.playTigerRoar(1.1);
      soundEngine.playSkill('ultimate');
      this.triggerShake(0.3, 7.0);

      const { dmg, isCrit } = this.rollPlayerDamage(mult, 0.3);
      this.spawnProjectile({
        fromPlayer: true,
        kind: 'heavenly_tiger_beast',
        x: this.player.x,
        y: this.player.y - 12,
        vx: Math.cos(targetAngle) * 680,
        vy: Math.sin(targetAngle) * 680,
        angle: targetAngle,
        radius: 75,
        damage: dmg,
        isCrit,
        pierce: true,
        maxLife: def.range / 680 + 0.15,
        color: '#fbbf24',
      });
      this.spawnGroundEffect(
        'heavenly_tiger_run',
        this.player.x,
        this.player.y + 6,
        this.player.x + Math.cos(targetAngle) * def.range,
        this.player.y + 6 + Math.sin(targetAngle) * def.range,
        targetAngle,
        80,
        0.8,
        '#fbbf24',
        '#f59e0b'
      );
      this.spawnRingEffect(this.player.x, this.player.y, 90, '#fbbf24');
      this.spawnFloatingText(this.player.x, this.player.y - 50, 'HEAVENLY TIGER!', '#fbbf24', true);
    } else if (skillId === 'apex_devastation') {
      // Ultimate 3: Apex Devastation – Launches into air before descending with massive claw strike and outward shockwaves
      this.player.swordAnim = SwordAnimState.APEX_DEVASTATION_RISE;
      this.swordAnimDuration = 0.55;
      this.swordAnimTimer = 0.55;
      soundEngine.playTigerRoar(0.85);
      soundEngine.playSkill('ultimate');

      this.apexDevastationState = 'rising';
      this.apexDevastationTimer = 0.28;
      const destX = this.player.x + Math.cos(targetAngle) * targetDist;
      const destY = this.player.y + Math.sin(targetAngle) * targetDist;
      const targetPoint = this.findFurthestWalkableAlongRay(this.player.x, this.player.y, destX, destY, 16);
      this.apexDevastationTargetX = targetPoint.x;
      this.apexDevastationTargetY = targetPoint.y;
      this.apexDevastationMult = mult;

      this.spawnRingEffect(this.player.x, this.player.y, 65, '#fbbf24');
      this.spawnFloatingText(this.player.x, this.player.y - 54, 'APEX DEVASTATION!', '#fde047', true);
    }

    if (this.isMultiplayer && this.player.shield > prevShield) {
      multiplayerClient.sendPlayerHealOrShield(0, this.player.shield - prevShield);
    }

    this.emitHudSnapshot();
  }

  private spawnPipeStrike(
    kind: PipeStrikeEffect['kind'],
    x: number,
    y: number,
    angle: number,
    radius: number,
    direction: 1 | -1,
    maxAge: number,
    primaryColor: string,
    secondaryColor: string
  ) {
    let slot: PipeStrikeEffect | null = null;
    let oldest = this.pipeStrikes[0];
    for (let i = 0; i < this.pipeStrikes.length; i++) {
      const s = this.pipeStrikes[i];
      if (!s.active) {
        slot = s;
        break;
      }
      if (s.age > oldest.age) oldest = s;
    }
    const target = slot || oldest;
    target.active = true;
    target.kind = kind;
    target.x = x;
    target.y = y;
    target.angle = angle;
    target.radius = radius;
    target.direction = direction;
    target.age = 0;
    target.maxAge = maxAge;
    target.primaryColor = primaryColor;
    target.secondaryColor = secondaryColor;
  }

  private spawnScrapDebris(
    shape: ScrapDebrisPiece['shape'],
    orbitAngle: number,
    orbitRadius: number,
    launchDelay: number,
    damage: number
  ) {
    let slot: ScrapDebrisPiece | null = null;
    let oldest = this.scrapDebris[0];
    for (let i = 0; i < this.scrapDebris.length; i++) {
      const d = this.scrapDebris[i];
      if (!d.active) {
        slot = d;
        break;
      }
      if (d.age > oldest.age) oldest = d;
    }
    const target = slot || oldest;
    const sx = this.player.x + Math.cos(orbitAngle) * (orbitRadius * 0.55);
    const sy = this.player.y + 8 + Math.sin(orbitAngle) * (orbitRadius * 0.45);
    target.active = true;
    target.shape = shape;
    target.state = 'rising';
    target.orbitAngle = orbitAngle;
    target.orbitRadius = orbitRadius;
    target.x = sx;
    target.y = sy;
    target.vx = 0;
    target.vy = 0;
    target.spin = Math.random() * Math.PI * 2;
    target.vSpin = (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 8);
    target.targetEnemyId = -1;
    target.launchDelay = launchDelay;
    target.age = 0;
    target.maxAge = 6.5;
    target.damage = damage;
    for (let t = 0; t < target.trail.length; t++) {
      target.trail[t].x = sx;
      target.trail[t].y = sy;
    }
  }

  private grantRestlessSpirit() {
    if (this.heroId !== 'ghost') return;
    this.player.restlessStacks = Math.min(5, this.player.restlessStacks + 1);
    this.restlessTimer = 5.2;
  }

  private spawnSoulTether(enemyId: number, fromX: number, fromY: number, maxAge: number, dps: number) {
    let slot: SoulDrainTether | null = null;
    let oldest = this.soulTethers[0];
    for (let i = 0; i < this.soulTethers.length; i++) {
      const t = this.soulTethers[i];
      if (!t.active || t.enemyId === enemyId) {
        slot = t;
        break;
      }
      if (t.age > oldest.age) oldest = t;
    }
    const target = slot || oldest;
    target.active = true;
    target.enemyId = enemyId;
    target.fromX = fromX;
    target.fromY = fromY;
    target.age = 0;
    target.maxAge = maxAge;
    target.tickAccum = 0;
    target.dps = dps;
  }

  private spawnOrbitingSpirit(orbitAngle: number, orbitRadius: number, chargeDelay: number, damage: number) {
    let slot: OrbitingSpirit | null = null;
    let oldest = this.orbitingSpirits[0];
    for (let i = 0; i < this.orbitingSpirits.length; i++) {
      const s = this.orbitingSpirits[i];
      if (!s.active) {
        slot = s;
        break;
      }
      if (s.age > oldest.age) oldest = s;
    }
    const target = slot || oldest;
    const sx = this.player.x + Math.cos(orbitAngle) * orbitRadius;
    const sy = this.player.y - 12 + Math.sin(orbitAngle) * orbitRadius * 0.78;
    target.active = true;
    target.orbitAngle = orbitAngle;
    target.orbitRadius = orbitRadius;
    target.x = sx;
    target.y = sy;
    target.vx = 0;
    target.vy = 0;
    target.state = 'orbit';
    target.targetEnemyId = -1;
    target.chargeDelay = chargeDelay;
    target.age = 0;
    target.maxAge = 7.0;
    target.damage = damage;
    for (let k = 0; k < target.trail.length; k++) {
      target.trail[k].x = sx;
      target.trail[k].y = sy;
    }
  }

  private spawnSpectralRift(
    x: number,
    y: number,
    radius: number,
    pullDuration: number,
    maxAge: number,
    pullStrength: number,
    explosionDamage: number
  ) {
    let slot: SpectralRiftZone | null = null;
    let oldest = this.spectralRifts[0];
    for (let i = 0; i < this.spectralRifts.length; i++) {
      const r = this.spectralRifts[i];
      if (!r.active) {
        slot = r;
        break;
      }
      if (r.age > oldest.age) oldest = r;
    }
    const target = slot || oldest;
    target.active = true;
    target.x = x;
    target.y = y;
    target.radius = radius;
    target.age = 0;
    target.pullDuration = pullDuration;
    target.maxAge = maxAge;
    target.pullStrength = pullStrength;
    target.explosionDamage = explosionDamage;
    target.detonated = false;
  }

  private summonMinions(
    style: HeroId,
    cx: number,
    cy: number,
    count: number,
    atkMult: number,
    hp: number,
    duration: number,
    facing: number
  ) {
    const minionAtk = Math.max(6, Math.round(this.getEffectiveAtk() * atkMult));
    for (let i = 0; i < count; i++) {
      const ang = (i * Math.PI * 2) / count;
      const ringDist = count > 4 ? 54 : 38;
      let mx = cx + Math.cos(ang) * ringDist;
      let my = cy + Math.sin(ang) * ringDist;
      if (!this.isPointWalkable(mx, my, 12, style === 'ghost')) {
        mx = this.player.x + Math.cos(ang) * 28;
        my = this.player.y + Math.sin(ang) * 28;
      }

      if (style === 'zombie') {
        this.spawnGroundEffect('grave_portal', mx, my + 6, 0, 0, 0, 22, 1.4, '#84cc16', '#a855f7');
      } else if (style === 'ghost') {
        this.spawnGroundEffect('possession_burst', mx, my, 0, 0, 0, 32, 0.45, '#818cf8', '#2dd4bf');
      }

      this.minions.push({
        id: allocEntityId(),
        style,
        x: mx,
        y: my,
        vx: 0,
        vy: 0,
        hp,
        maxHp: hp,
        atk: minionAtk,
        facing,
        walkPhase: i * 1.3,
        lifeTimer: duration,
        maxLife: duration,
        spawnTimer: 0.35,
        attackTimer: 0.15 + (i % 3) * 0.08,
        attackAnimTimer: 0,
        attackAnimDuration: 0.26,
        comboSide: i % 2 === 0 ? 1 : -1,
        weaponSwing: 0,
      });
      this.spawnBurstParticles(
        mx,
        my,
        style === 'ghost' ? '#818cf8' : style === 'zombie' ? '#84cc16' : '#4ade80',
        10,
        true
      );
    }
  }

  private spawnToxicCloud(
    x: number,
    y: number,
    radius: number,
    maxAge: number,
    dps: number,
    fromPlayer = true
  ) {
    let slot: ToxicCloudZone | null = null;
    let oldest = this.toxicClouds[0];
    for (const c of this.toxicClouds) {
      if (!c.active) {
        slot = c;
        break;
      }
      if (c.age > oldest.age) oldest = c;
    }
    const target = slot || oldest;
    target.active = true;
    target.x = x;
    target.y = y;
    target.radius = radius;
    target.age = 0;
    target.maxAge = maxAge;
    target.tickTimer = 0.42;
    target.dps = dps;
    target.fromPlayer = fromPlayer;
  }

  private spawnSlashWave(
    kind: SlashWaveEffect['kind'],
    x: number,
    y: number,
    angle: number,
    radius: number,
    arcSpan: number,
    direction: 1 | -1,
    maxAge: number,
    primaryColor: string,
    secondaryColor: string
  ) {
    let slot: SlashWaveEffect | null = null;
    let oldest = this.slashWaves[0];
    for (let i = 0; i < this.slashWaves.length; i++) {
      const w = this.slashWaves[i];
      if (!w.active) {
        slot = w;
        break;
      }
      if (w.age > oldest.age) oldest = w;
    }
    const target = slot || oldest;
    target.active = true;
    target.kind = kind;
    target.x = x;
    target.y = y;
    target.angle = angle;
    target.radius = radius;
    target.arcSpan = arcSpan;
    target.direction = direction;
    target.age = 0;
    target.maxAge = maxAge;
    target.primaryColor = primaryColor;
    target.secondaryColor = secondaryColor;
  }

  private spawnGroundEffect(
    kind: GroundEffect['kind'],
    x: number,
    y: number,
    x2: number,
    y2: number,
    angle: number,
    radius: number,
    maxAge: number,
    color: string,
    secondaryColor: string
  ) {
    let slot: GroundEffect | null = null;
    let oldest = this.groundEffects[0];
    for (let i = 0; i < this.groundEffects.length; i++) {
      const g = this.groundEffects[i];
      if (!g.active) {
        slot = g;
        break;
      }
      if (g.age > oldest.age) oldest = g;
    }
    const target = slot || oldest;
    target.active = true;
    target.kind = kind;
    target.x = x;
    target.y = y;
    target.x2 = x2;
    target.y2 = y2;
    target.angle = angle;
    target.radius = radius;
    target.age = 0;
    target.maxAge = maxAge;
    target.color = color;
    target.secondaryColor = secondaryColor;
  }

  private spawnSiphonBeam(fromX: number, fromY: number, maxAge: number, color: string) {
    let slot: LifeSiphonBeam | null = null;
    let oldest = this.siphonBeams[0];
    for (let i = 0; i < this.siphonBeams.length; i++) {
      const b = this.siphonBeams[i];
      if (!b.active) {
        slot = b;
        break;
      }
      if (b.age > oldest.age) oldest = b;
    }
    const target = slot || oldest;
    target.active = true;
    target.fromX = fromX;
    target.fromY = fromY;
    target.age = 0;
    target.maxAge = maxAge;
    target.color = color;
  }

  private spawnLifeLeechOrb(fromX: number, fromY: number, healBonus: number) {
    const ang = Math.atan2(this.player.y - fromY, this.player.x - fromX);
    this.spawnProjectile({
      fromPlayer: true,
      kind: 'life_leech_orb',
      x: fromX,
      y: fromY,
      vx: Math.cos(ang) * 340,
      vy: Math.sin(ang) * 340,
      angle: ang,
      radius: 8,
      damage: healBonus,
      isCrit: false,
      pierce: true,
      maxLife: 0.75,
      color: '#4ade80',
    });
  }

  private healPlayer(amount: number, showText = true) {
    if (amount <= 0 || this.runOutcome === 'defeat' || this.localIsDowned) return;
    const prev = this.player.hp;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + amount);
    const actual = Math.round(this.player.hp - prev);
    if (this.isMultiplayer && actual > 0) {
      multiplayerClient.sendPlayerHealOrShield(actual, 0);
    }
    if (showText && (actual > 0 || amount >= 10)) {
      this.spawnFloatingText(
        this.player.x + (Math.random() - 0.5) * 14,
        this.player.y - 34,
        `+${Math.max(1, actual || amount)} HP`,
        '#4ade80',
        false
      );
    }
  }

  private spawnDelayedClawMark(x: number, y: number, angle: number, radius: number, damage: number) {
    let slot: DelayedClawMark | null = null;
    let oldest = this.delayedClawMarks[0];
    for (let i = 0; i < this.delayedClawMarks.length; i++) {
      const m = this.delayedClawMarks[i];
      if (!m.active) {
        slot = m;
        break;
      }
      if (m.age > oldest.age) oldest = m;
    }
    const target = slot || oldest;
    target.active = true;
    target.x = x;
    target.y = y;
    target.angle = angle;
    target.radius = radius;
    target.age = 0;
    target.maxAge = 0.46;
    target.damage = damage;
    target.erupted = false;
  }

  private findFurthestWalkableAlongRay(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    radius: number,
    ignoreProps = false
  ): { x: number; y: number } {
    const steps = 16;
    let bestX = startX;
    let bestY = startY;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const cx = startX + (endX - startX) * t;
      const cy = startY + (endY - startY) * t;
      if (this.isPointWalkable(cx, cy, radius, ignoreProps)) {
        bestX = cx;
        bestY = cy;
      } else {
        break;
      }
    }
    return { x: bestX, y: bestY };
  }

  public triggerBasicAttack() {
    this.currentAttackIsBasic = true;
    try {
      this.executeBasicAttackInternal();
      const eqStats = equipmentManager.getComputedStats(this.heroId);
      if (eqStats.consecutiveAtkSpeedBonus > 0) {
        this.basicCooldown = Math.max(0.1, this.basicCooldown / (1 + eqStats.consecutiveAtkSpeedBonus));
      }
      if (equipmentManager.improvisedTacticsReady) {
        equipmentManager.improvisedTacticsReady = false;
        this.spawnFloatingText(this.player.x, this.player.y - 36, 'IMPROVISED TACTICS!', '#fb923c', true);
        soundEngine.playPipeClang(1.25, true);
        this.spawnRingEffect(this.player.x, this.player.y, 85, '#fb923c');
      }
    } finally {
      this.currentAttackIsBasic = false;
    }
  }

  private executeBasicAttackInternal() {
    if (this.runOutcome === 'defeat' || this.localIsDowned) return;
    if (
      this.basicCooldown > 0 ||
      this.shadowStepTimer > 0 ||
      this.player.possessingTimer > 0 ||
      this.phantomDashTimer > 0 ||
      this.scrappersDashTimer > 0
    ) {
      return;
    }

    if (this.isMultiplayer) {
      const nextStep = (this.comboStep % (this.heroId === 'ghoul' ? 4 : 3)) + 1;
      multiplayerClient.sendAttack({
        comboStep: nextStep,
        facing: this.player.facing,
        x: this.player.x,
        y: this.player.y,
        reach: this.heroId === 'ghost' ? 350 : this.player.colossusTimer > 0 ? 146 : 104,
        isAmbush: Boolean(this.heroId === 'ghoul' && this.player.ambushReady),
      });
    }

    // =========================================================================
    // HUMAN – PIPE BRAWLER BASIC ATTACK (100% UNIQUE KINETIC PIPE & BOOT COMBO)
    // =========================================================================
    if (this.heroId === 'human') {
      const humanReach = 104;
      const nearest = this.findNearestEnemy(humanReach + 82);
      let distToNearest = 999;
      if (nearest) {
        const dx = nearest.x - this.player.x;
        const dy = nearest.y - this.player.y;
        distToNearest = Math.hypot(dx, dy);
        this.player.facing = Math.atan2(dy, dx);
      } else if (Math.hypot(this.joyX, this.joyY) > 0.15) {
        this.player.facing = Math.atan2(this.joyY, this.joyX);
      }

      // If the metal pipe is currently flying mid-air (Improvised Throw), throw a scrappy street knee/kick!
      if (this.player.pipeThrown) {
        this.basicCooldown = 0.24;
        this.player.kneeStrikeTimer = 0.19;
        this.attackImpulseVx = Math.cos(this.player.facing) * 95;
        this.attackImpulseVy = Math.sin(this.player.facing) * 95;
        soundEngine.playPipeSwing(1.3);
        this.spawnPipeStrike(
          'knee_burst',
          this.player.x + Math.cos(this.player.facing) * 10,
          this.player.y - 6 + Math.sin(this.player.facing) * 10,
          this.player.facing,
          82,
          1,
          0.18,
          '#fb923c',
          '#ffffff'
        );
        this.hitEnemiesInCone(this.player.facing, 88, Math.PI * 0.85, 0.96, 0.1, '#fed7aa', 0);
        return;
      }

      this.comboStep = (this.comboStep % 3) + 1;
      this.comboResetTimer = 1.35;

      const empoweredHaste =
        (this.player.lastStandTimer > 0 ? 0.16 : 0) + (this.player.oneManArmyTimer > 0 ? 0.24 : 0);
      const rawCd = this.comboStep === 3 ? 0.3 : 0.215;
      this.basicCooldown = Math.max(0.15, rawCd / (1 + empoweredHaste));

      this.swordCastAngle = this.player.facing;
      this.player.isScytheForm = false;
      this.player.swordGlowColor = this.comboStep === 3 ? '#f97316' : '#fb923c';
      this.player.swordGlowIntensity = this.comboStep === 3 ? 1.05 : 0.68;

      const syncedDur = Math.max(0.15, this.basicCooldown * 1.06);
      this.swordAnimDuration = syncedDur;
      this.swordAnimTimer = syncedDur;

      const swingDir: 1 | -1 = this.comboStep === 2 ? -1 : 1;
      this.targetAttackTwist = this.comboStep === 3 ? 1.3 : swingDir * 0.98;

      if (!nearest || distToNearest > nearest.radius + 32) {
        const glideSpd = (this.comboStep === 3 ? 128 : 92) * (Math.hypot(this.joyX, this.joyY) > 0.2 ? 0.55 : 1.0);
        this.attackImpulseVx = Math.cos(this.player.facing) * glideSpd;
        this.attackImpulseVy = Math.sin(this.player.facing) * glideSpd;
      }

      if (this.comboStep === 1 || this.comboStep === 2) {
        this.player.swordAnim =
          this.comboStep === 1 ? SwordAnimState.BASIC_1 : SwordAnimState.BASIC_2;
        soundEngine.playPipeSwing(this.comboStep === 1 ? 1.06 : 1.18);
        this.spawnPipeStrike(
          'basic_jab',
          this.player.x,
          this.player.y - 8,
          this.player.facing,
          humanReach * 0.94,
          swingDir,
          syncedDur * 0.98,
          '#fb923c',
          '#e2e8f0'
        );
        this.hitEnemiesInCone(
          this.player.facing,
          humanReach,
          Math.PI * 0.84,
          1.06,
          0.05,
          '#fb923c',
          0
        );
      } else {
        // 3rd-Hit Street Batter Finisher: Heavy pipe smash with blunt pressure-cone + metallic clang!
        this.player.swordAnim = SwordAnimState.BASIC_3;
        soundEngine.playPipeClang(1.04, false);
        this.triggerShake(0.08, 2.6);
        this.spawnPipeStrike(
          'basic_batter',
          this.player.x,
          this.player.y - 8,
          this.player.facing,
          humanReach * 1.08,
          1,
          syncedDur * 1.05,
          '#f97316',
          '#f8fafc'
        );
        this.hitEnemiesInCone(
          this.player.facing,
          humanReach + 12,
          Math.PI * 1.08,
          1.52,
          0.16,
          '#fde047',
          0
        );
      }
      return;
    }

    // =========================================================================
    // GHOST RANGED AUTO-HOMING BASIC ATTACK (100% UNIQUE ASTRAL WISPS & SOUL ORBS)
    // =========================================================================
    if (this.heroId === 'ghost') {
      const ghostRange = 350;
      const nearest = this.findNearestEnemy(ghostRange);
      if (nearest) {
        this.player.facing = Math.atan2(nearest.y - this.player.y, nearest.x - this.player.x);
      } else if (Math.hypot(this.joyX, this.joyY) > 0.15) {
        this.player.facing = Math.atan2(this.joyY, this.joyX);
      }

      this.comboStep = (this.comboStep % 3) + 1;
      this.comboResetTimer = 1.4;

      const restRank = Math.max(1, this.skillRanks.restless_spirit || 1);
      const castHaste =
        1 +
        this.player.restlessStacks * (0.045 + (restRank - 1) * 0.01) +
        (this.player.nightmareTimer > 0 ? 0.22 : 0);
      const rawCd = this.comboStep === 3 ? 0.34 : 0.255;
      this.basicCooldown = Math.max(0.16, rawCd / castHaste);

      this.swordCastAngle = this.player.facing;
      this.player.isScytheForm = false;
      this.player.swordGlowColor = this.player.nightmareTimer > 0 ? '#c084fc' : '#2dd4bf';
      this.player.swordGlowIntensity = this.comboStep === 3 ? 1.15 : 0.78;

      const syncedDur = Math.max(0.16, this.basicCooldown * 1.05);
      this.swordAnimDuration = syncedDur;
      this.swordAnimTimer = syncedDur;
      this.player.swordAnim =
        this.comboStep === 1
          ? SwordAnimState.BASIC_1
          : this.comboStep === 2
            ? SwordAnimState.BASIC_2
            : SwordAnimState.BASIC_3;

      const originX = this.player.swordX;
      const originY = this.player.swordY;
      const targetId = nearest ? nearest.id : -1;

      if (this.comboStep === 1 || this.comboStep === 2) {
        // Curved auto-homing Will-o'-Wisp banking gracefully from left/right of the Soul Lantern!
        const bankSide = this.comboStep === 1 ? -0.38 : 0.38;
        const launchAng = this.player.facing + bankSide;
        const { dmg, isCrit } = this.rollPlayerDamage(1.06, 0.04);
        soundEngine.playGhostWisp(this.comboStep === 1 ? 1.04 : 1.18);

        this.spawnProjectile({
          fromPlayer: true,
          kind: 'ghost_wisp',
          x: originX,
          y: originY,
          vx: Math.cos(launchAng) * 440,
          vy: Math.sin(launchAng) * 440,
          angle: launchAng,
          radius: 13,
          damage: dmg,
          isCrit,
          pierce: false,
          maxLife: 1.15,
          color: this.comboStep === 1 ? '#2dd4bf' : '#818cf8',
          targetEnemyId: targetId,
        });
        this.spawnSoftMotes(originX, originY, this.player.facing, 10, '#5eead4', 3);
      } else {
        // 3rd-Hit Spectral Resonance Finisher: Central Homing Astral Soul Orb + Twin Flanking Homing Wisps!
        soundEngine.playGhostWisp(0.86);
        const { dmg: orbDmg, isCrit: orbCrit } = this.rollPlayerDamage(1.22, 0.14);
        this.spawnProjectile({
          fromPlayer: true,
          kind: 'ghost_soul_orb',
          x: originX,
          y: originY,
          vx: Math.cos(this.player.facing) * 395,
          vy: Math.sin(this.player.facing) * 395,
          angle: this.player.facing,
          radius: 18,
          damage: orbDmg,
          isCrit: orbCrit,
          pierce: false,
          maxLife: 1.25,
          color: '#c084fc',
          targetEnemyId: targetId,
        });

        for (const flank of [-0.52, 0.52]) {
          const wAng = this.player.facing + flank;
          const { dmg: wDmg, isCrit: wCrit } = this.rollPlayerDamage(0.52, 0.06);
          this.spawnProjectile({
            fromPlayer: true,
            kind: 'ghost_wisp',
            x: originX,
            y: originY,
            vx: Math.cos(wAng) * 455,
            vy: Math.sin(wAng) * 455,
            angle: wAng,
            radius: 11,
            damage: wDmg,
            isCrit: wCrit,
            pierce: false,
            maxLife: 1.15,
            color: '#2dd4bf',
            targetEnemyId: targetId,
          });
        }
        this.spawnGroundEffect(
          'astral_nova',
          originX,
          originY,
          0,
          0,
          0,
          30,
          0.24,
          '#c084fc',
          '#2dd4bf'
        );
      }
      return;
    }

    // =========================================================================
    // EAGLEKIN – SKY MARKSMAN BASIC ATTACK SEQUENCE (FEATHER SHOT, DOUBLE, EAGLE'S PIERCE)
    // =========================================================================
    if (this.heroId === 'eaglekin') {
      const eagleRange = 450;
      const nearest = this.findNearestEnemy(eagleRange);
      if (nearest) {
        this.player.facing = Math.atan2(nearest.y - this.player.y, nearest.x - this.player.x);
      } else if (Math.hypot(this.joyX, this.joyY) > 0.15) {
        this.player.facing = Math.atan2(this.joyY, this.joyX);
      }

      this.comboStep = (this.comboStep % 3) + 1;
      this.comboResetTimer = 1.4;

      const rawCd = this.comboStep === 3 ? 0.36 : this.comboStep === 2 ? 0.22 : 0.24;
      this.basicCooldown = rawCd;

      const syncedDur = Math.max(0.18, this.basicCooldown * 1.05);
      this.swordAnimDuration = syncedDur;
      this.swordAnimTimer = syncedDur;
      this.player.wingFlapTimer = syncedDur;
      this.player.swordAnim =
        this.comboStep === 1
          ? SwordAnimState.FEATHER_SHOT
          : this.comboStep === 2
            ? SwordAnimState.DOUBLE_FEATHER
            : SwordAnimState.BASIC_3;

      const wingFlapPitch = this.comboStep === 1 ? 1.15 : this.comboStep === 2 ? 1.3 : 0.95;
      soundEngine.playWingFlap(wingFlapPitch);
      soundEngine.playFeatherShoot(this.comboStep === 3 ? 0.88 : 1.05);

      const spawnX = this.player.x + Math.cos(this.player.facing) * 16;
      const spawnY = this.player.y - 10 + Math.sin(this.player.facing) * 16;

      if (this.comboStep === 1) {
        // Normal Basic Attack: Feather Shot – sharp, hardened feather in straight line
        const { dmg, isCrit } = this.rollPlayerDamage(1.1, 0.08);
        this.spawnProjectile({
          fromPlayer: true,
          kind: 'feather_shot',
          x: spawnX,
          y: spawnY,
          vx: Math.cos(this.player.facing) * 640,
          vy: Math.sin(this.player.facing) * 640,
          angle: this.player.facing,
          radius: 14,
          damage: dmg,
          isCrit,
          pierce: false,
          maxLife: eagleRange / 640 + 0.1,
          color: '#38bdf8',
        });
        this.spawnSoftMotes(spawnX, spawnY, this.player.facing, 12, '#38bdf8', 3);
      } else if (this.comboStep === 2) {
        // Enhanced Basic Attack: Double Feather Shot – 2 piercing feathers in rapid succession
        const spreadAng = 0.08;
        for (const sign of [-1, 1]) {
          const fAng = this.player.facing + sign * spreadAng;
          const { dmg, isCrit } = this.rollPlayerDamage(0.72, 0.1);
          this.spawnProjectile({
            fromPlayer: true,
            kind: 'double_feather',
            x: spawnX + Math.cos(fAng + Math.PI / 2) * (sign * 6),
            y: spawnY + Math.sin(fAng + Math.PI / 2) * (sign * 6),
            vx: Math.cos(fAng) * 660,
            vy: Math.sin(fAng) * 660,
            angle: fAng,
            radius: 13,
            damage: dmg,
            isCrit,
            pierce: true,
            maxLife: eagleRange / 660 + 0.1,
            color: '#0284c7',
          });
        }
        this.spawnSoftMotes(spawnX, spawnY, this.player.facing, 16, '#0284c7', 5);
      } else {
        // 3rd Attack: Enhanced Eagle's Pierce – Gathers wind energy around wings, fires enormous reinforced feather!
        soundEngine.playSkyScreech(1.15);
        this.triggerShake(0.12, 3.2);
        const { dmg, isCrit } = this.rollPlayerDamage(1.88, 0.22);
        this.spawnProjectile({
          fromPlayer: true,
          kind: 'piercing_feather',
          x: spawnX,
          y: spawnY,
          vx: Math.cos(this.player.facing) * 780,
          vy: Math.sin(this.player.facing) * 780,
          angle: this.player.facing,
          radius: 22,
          damage: dmg,
          isCrit,
          pierce: true,
          maxLife: eagleRange / 780 + 0.12,
          color: '#e0f2fe',
        });
        this.spawnArcBurst(spawnX, spawnY, this.player.facing, 44, '#38bdf8', 12);
        this.spawnRingEffect(spawnX, spawnY, 32, '#e0f2fe');
      }

      if (this.isMultiplayer) {
        multiplayerClient.sendAttack({
          comboStep: this.comboStep,
          facing: this.player.facing,
          x: this.player.x,
          y: this.player.y,
          reach: eagleRange,
        });
      }
      return;
    }

    // =========================================================================
    // TIGERKIN – FERAL BERSERKER BASIC ATTACK SEQUENCE (SAVAGE CLAW & TIGER'S REND)
    // =========================================================================
    if (this.heroId === 'tigerkin') {
      const tigerReach = 108;
      const nearest = this.findNearestEnemy(tigerReach + 84);
      let distToNearest = 999;
      if (nearest) {
        const dx = nearest.x - this.player.x;
        const dy = nearest.y - this.player.y;
        distToNearest = Math.hypot(dx, dy);
        this.player.facing = Math.atan2(dy, dx);
      } else if (Math.hypot(this.joyX, this.joyY) > 0.15) {
        this.player.facing = Math.atan2(this.joyY, this.joyX);
      }

      this.comboStep = (this.comboStep % 2) + 1;
      this.comboResetTimer = 1.35;

      const momentumHaste =
        (this.player.feralMomentumStacks || 0) * 0.06 +
        ((this.player.kingOfBeastsTimer ?? 0) > 0 ? 0.45 : 0);
      const rawCd = this.comboStep === 2 ? 0.28 : 0.21;
      this.basicCooldown = Math.max(0.14, rawCd / (1 + momentumHaste));

      this.swordCastAngle = this.player.facing;
      this.player.swordGlowColor = (this.player.kingOfBeastsTimer ?? 0) > 0 ? '#fbbf24' : '#f59e0b';
      this.player.swordGlowIntensity = (this.player.kingOfBeastsTimer ?? 0) > 0 ? 1.35 : 0.75;

      const syncedDur = Math.max(0.15, this.basicCooldown * 1.06);
      this.swordAnimDuration = syncedDur;
      this.swordAnimTimer = syncedDur;
      this.player.swordAnim =
        this.comboStep === 1
          ? SwordAnimState.TIGER_SAVAGE_CLAW
          : SwordAnimState.TIGER_REND;

      const swingDir: 1 | -1 = this.comboStep === 2 ? 1 : -1;
      this.targetAttackTwist = this.comboStep === 2 ? 1.35 : swingDir * 1.05;

      if (!nearest || distToNearest > nearest.radius + 30) {
        const glideSpd = (this.comboStep === 2 ? 135 : 105) * (Math.hypot(this.joyX, this.joyY) > 0.2 ? 0.6 : 1.0);
        this.attackImpulseVx = Math.cos(this.player.facing) * glideSpd;
        this.attackImpulseVy = Math.sin(this.player.facing) * glideSpd;
      }

      if (this.comboStep === 1) {
        // Savage Claw: Swift forward slash with claws delivering powerful physical strike
        soundEngine.playFeralClaw(1.18, false);
        this.spawnSlashWave(
          'tiger_savage_slash',
          this.player.x,
          this.player.y - 8,
          this.player.facing,
          tigerReach * 0.94,
          Math.PI * 0.95,
          1,
          syncedDur * 1.05,
          '#fef08a',
          '#f59e0b'
        );
        this.hitEnemiesInCone(
          this.player.facing,
          tigerReach,
          Math.PI * 0.92,
          1.28,
          0.14,
          '#f59e0b',
          0
        );
        this.spawnSoftMotes(this.player.x, this.player.y, this.player.facing, tigerReach * 0.78, '#fbbf24', 6);
      } else {
        // Tiger's Rend (Enhanced): Crosses both claws before unleashing devastating double slash sending crescent shockwave forward!
        soundEngine.playFeralClaw(1.02, true);
        this.triggerShake(0.12, 3.6);
        this.spawnSlashWave(
          'tiger_cross_rend',
          this.player.x,
          this.player.y - 8,
          this.player.facing,
          tigerReach * 1.06,
          Math.PI * 1.15,
          1,
          syncedDur * 1.1,
          '#fef08a',
          '#f59e0b'
        );
        // Crescent shockwave projectile tearing forward
        const { dmg: waveDmg, isCrit: waveCrit } = this.rollPlayerDamage(1.15, 0.2);
        this.spawnProjectile({
          fromPlayer: true,
          kind: 'tiger_rend_wave',
          x: this.player.x + Math.cos(this.player.facing) * 22,
          y: this.player.y - 8 + Math.sin(this.player.facing) * 22,
          vx: Math.cos(this.player.facing) * 600,
          vy: Math.sin(this.player.facing) * 600,
          angle: this.player.facing,
          radius: 26,
          damage: waveDmg,
          isCrit: waveCrit,
          pierce: true,
          maxLife: 0.55,
          color: '#f59e0b',
        });
        this.hitEnemiesInCone(
          this.player.facing,
          tigerReach * 1.08,
          Math.PI * 1.12,
          1.85,
          0.22,
          '#fbbf24',
          0
        );
        this.spawnArcBurst(this.player.x, this.player.y, this.player.facing, tigerReach * 0.85, '#f59e0b', 14);
      }

      if (this.isMultiplayer) {
        multiplayerClient.sendAttack({
          comboStep: this.comboStep,
          facing: this.player.facing,
          x: this.player.x,
          y: this.player.y,
          reach: tigerReach,
        });
      }
      return;
    }

    const isTransformed = this.player.colossusTimer > 0;
    const isZombie = this.heroId === 'zombie';
    const isGhoul = this.heroId === 'ghoul';
    const reach = isTransformed ? (isGhoul ? 146 : 148) : isZombie ? 104 : isGhoul ? 100 : 96;

    const nearest = this.findNearestEnemy(reach + 82);
    let distToNearest = 999;
    if (nearest) {
      const dx = nearest.x - this.player.x;
      const dy = nearest.y - this.player.y;
      distToNearest = Math.hypot(dx, dy);
      this.player.facing = Math.atan2(dy, dx);
    } else if (Math.hypot(this.joyX, this.joyY) > 0.15) {
      this.player.facing = Math.atan2(this.joyY, this.joyX);
    }

    // Ghoul Shadow Stalker Empowered Ambush Strike!
    if (isGhoul && this.player.ambushReady) {
      this.player.ambushReady = false;
      this.player.stealthTimer = 0;
      this.comboStep = 0;
      this.basicCooldown = 0.2;
      this.swordCastAngle = this.player.facing;
      this.player.swordGlowColor = '#e11d48';
      this.player.swordGlowIntensity = 1.3;
      this.player.swordAnim = SwordAnimState.SHADOW_STALKER;
      this.swordAnimDuration = 0.26;
      this.swordAnimTimer = 0.26;
      this.targetAttackTwist = 1.15;
      this.attackImpulseVx = Math.cos(this.player.facing) * 115;
      this.attackImpulseVy = Math.sin(this.player.facing) * 115;
      soundEngine.playSlash(1.32);
      this.triggerShake(0.12, 3.8);

      const ambushReach = reach + 26;
      this.spawnSlashWave(
        'shadow_ambush',
        this.player.x + Math.cos(this.player.facing) * 16,
        this.player.y - 8 + Math.sin(this.player.facing) * 16,
        this.player.facing,
        ambushReach * 0.9,
        Math.PI * 1.15,
        1,
        0.26,
        '#fff1f2',
        '#e11d48'
      );
      this.spawnSoftMotes(this.player.x, this.player.y, this.player.facing, ambushReach * 0.78, '#fda4af', 8);
      this.spawnFloatingText(this.player.x, this.player.y - 42, 'AMBUSH STRIKE!', '#fda4af', true);
      // 1.0 bonusCrit guarantees a lethal Critical Ambush Strike!
      this.hitEnemiesInCone(
        this.player.facing,
        ambushReach,
        Math.PI * 1.15,
        this.ambushMult,
        1.0,
        '#fda4af',
        0
      );
      return;
    }

    const maxSteps = isGhoul ? 4 : 3;
    this.comboStep = (this.comboStep % maxSteps) + 1;
    this.comboResetTimer = 1.3;

    if (isGhoul) {
      const momRank = Math.max(1, this.skillRanks.predators_momentum || 1);
      const speedMult =
        1 +
        this.player.momentumStacks * (0.032 + (momRank - 1) * 0.006) +
        (this.player.bloodFrenzyTimer > 0 ? 0.14 + this.player.frenzyStacks * 0.018 : 0) +
        (isTransformed ? 0.18 : 0);
      const rawCd = this.comboStep === 4 ? 0.27 : 0.195;
      // Floor at 0.14s so every fast/transformed swing finishes its silky figure-8 arc smoothly!
      this.basicCooldown = Math.max(0.14, rawCd / speedMult);
    } else if (isTransformed) {
      // Smooth, responsive transformed cadence (Bone Colossus & Abomination Form) with zero dead freeze gap!
      this.basicCooldown =
        this.comboStep === 3 ? (isZombie ? 0.28 : 0.26) : isZombie ? 0.215 : 0.2;
    } else {
      this.basicCooldown = this.comboStep === 3 ? 0.33 : isZombie ? 0.255 : 0.24;
    }

    this.swordCastAngle = this.player.facing;
    this.player.isScytheForm = false;
    this.player.swordGlowColor = isGhoul
      ? isTransformed
        ? '#f43f5e'
        : '#fb7185'
      : isZombie
        ? isTransformed
          ? '#c084fc'
          : '#a3e635'
        : isTransformed
          ? '#fbbf24'
          : '#67e8f9';
    this.player.swordGlowIntensity = this.comboStep >= 3 || isTransformed ? 0.96 : 0.6;

    // Synchronize swing animation duration seamlessly with basicCooldown so consecutive swings
    // flow like an unbroken martial figure-8 dance without mid-swing snapping or frozen pauses!
    const syncedDur = Math.max(0.15, this.basicCooldown * 1.08);
    this.swordAnimDuration = syncedDur;
    this.swordAnimTimer = syncedDur;

    // Dynamic body twist & smooth forward micro-glide so transformed basic attacks feel weighty and fluid!
    const swingDir = this.comboStep === 2 ? -1 : 1;
    this.targetAttackTwist = this.comboStep >= 3 ? swingDir * 1.25 : swingDir * 0.95;

    if (!nearest || distToNearest > (nearest.radius + 34)) {
      const glideSpd =
        (isTransformed ? 150 : 95) *
        (this.comboStep >= 3 ? 1.25 : 1.0) *
        (Math.hypot(this.joyX, this.joyY) > 0.2 ? 0.55 : 1.0);
      this.attackImpulseVx = Math.cos(this.player.facing) * glideSpd;
      this.attackImpulseVy = Math.sin(this.player.facing) * glideSpd;
    }

    if (this.comboStep === 1) {
      this.player.swordAnim = SwordAnimState.BASIC_1;
      soundEngine.playSlash(isGhoul ? 1.18 : isZombie ? 0.94 : 1.02);
    } else if (this.comboStep === 2) {
      this.player.swordAnim = SwordAnimState.BASIC_2;
      soundEngine.playSlash(isGhoul ? 1.28 : isZombie ? 1.06 : 1.14);
    } else if (this.comboStep === 3) {
      this.player.swordAnim = SwordAnimState.BASIC_3;
      soundEngine.playSlash(isGhoul ? 1.1 : isZombie ? 0.84 : 0.9);
    } else {
      this.player.swordAnim = SwordAnimState.BASIC_4;
      soundEngine.playSlash(0.96);
    }

    // Distinct, cohesive 60fps Crescent Waves per Hero & Combo Step!
    if (isGhoul) {
      const waveSec = isTransformed ? '#f43f5e' : '#fb7185';
      if (this.comboStep === 1 || this.comboStep === 2) {
        this.spawnSlashWave(
          'feral_slash',
          this.player.x,
          this.player.y - 8,
          this.player.facing,
          reach * (isTransformed ? 0.88 : 0.82),
          isTransformed ? Math.PI * 0.96 : Math.PI * 0.84,
          this.comboStep === 1 ? 1 : -1,
          syncedDur * 1.05,
          '#fff1f2',
          waveSec
        );
      } else if (this.comboStep === 3) {
        this.spawnSlashWave(
          'twin_rend',
          this.player.x,
          this.player.y - 8,
          this.player.facing,
          reach * 0.9,
          Math.PI * 1.08,
          1,
          syncedDur * 1.08,
          '#fff1f2',
          waveSec
        );
      } else {
        this.spawnSlashWave(
          'feral_whirl',
          this.player.x,
          this.player.y - 8,
          this.player.facing,
          reach * 0.92,
          Math.PI * 1.9,
          1,
          syncedDur * 1.08,
          '#fff1f2',
          '#e11d48'
        );
        this.spawnSoftMotes(this.player.x, this.player.y, this.player.facing, reach * 0.76, '#fda4af', 6);
      }
    } else if (this.heroId === 'skeleton') {
      const wavePri = '#f8fafc';
      const waveSec = isTransformed ? '#fbbf24' : '#67e8f9';
      if (this.comboStep === 1 || this.comboStep === 2) {
        this.spawnSlashWave(
          'blade_arc',
          this.player.x,
          this.player.y - 8,
          this.player.facing,
          reach * (isTransformed ? 0.92 : 0.86),
          isTransformed ? Math.PI * 1.02 : Math.PI * 0.88,
          this.comboStep === 1 ? 1 : -1,
          syncedDur * 1.05,
          wavePri,
          waveSec
        );
      } else {
        this.spawnSlashWave(
          'blade_arc',
          this.player.x,
          this.player.y - 8,
          this.player.facing,
          reach * (isTransformed ? 1.06 : 0.96),
          isTransformed ? Math.PI * 1.3 : Math.PI * 1.15,
          1,
          syncedDur * 1.1,
          '#ffffff',
          isTransformed ? '#f59e0b' : '#38bdf8'
        );
        this.spawnSoftMotes(this.player.x, this.player.y, this.player.facing, reach * 0.72, waveSec, 5);
      }
    } else if (isZombie) {
      const clawSec = isTransformed ? '#c084fc' : '#a3e635';
      const clawPri = '#ecfccb';
      if (this.comboStep === 1 || this.comboStep === 2) {
        this.spawnSlashWave(
          'triple_claw',
          this.player.x,
          this.player.y - 8,
          this.player.facing,
          reach * (isTransformed ? 0.9 : 0.84),
          Math.PI * 0.86,
          this.comboStep === 1 ? 1 : -1,
          syncedDur * 1.05,
          clawPri,
          clawSec
        );
      } else {
        this.spawnSlashWave(
          'cross_claw',
          this.player.x,
          this.player.y - 8,
          this.player.facing,
          reach * 0.94,
          Math.PI * 1.06,
          1,
          syncedDur * 1.1,
          '#f7fee7',
          isTransformed ? '#e879f9' : '#84cc16'
        );
        this.spawnSoftMotes(this.player.x, this.player.y, this.player.facing, reach * 0.74, clawSec, 5);
      }
    }

    const mult = isGhoul
      ? this.comboStep === 4
        ? 1.65
        : this.comboStep === 3
          ? 1.36
          : 1.06
      : this.comboStep === 3
        ? 1.48
        : 1.04;
    const bonusCrit = isGhoul
      ? this.comboStep >= 3
        ? 0.16
        : 0.05
      : !isZombie && this.comboStep === 3
        ? 0.18
        : 0;
    const coneWidth =
      (isGhoul && this.comboStep === 4) || (isTransformed && this.comboStep === 3)
        ? Math.PI * 1.85
        : this.comboStep >= 3 || isTransformed
          ? Math.PI * 1.18
          : Math.PI * 0.82;
    const sparkColor = isGhoul
      ? '#fda4af'
      : isZombie
        ? '#a3e635'
        : isTransformed
          ? '#fde047'
          : '#e2e8f0';

    this.hitEnemiesInCone(
      this.player.facing,
      reach,
      coneWidth,
      mult,
      bonusCrit,
      sparkColor,
      isZombie && this.comboStep === 3 ? 1.35 : 0
    );
  }

  public interactNearbyProp(): boolean {
    if (this.localIsDowned) return false;
    for (const prop of this.map.props) {
      const cx = prop.x + prop.w / 2;
      const cy = prop.y + prop.h / 2;
      const d = Math.hypot(cx - this.player.x, cy - this.player.y);
      if (d > 88) continue;

      if (prop.kind === 'door_dungeon') {
        this.enterDungeon(1);
        return true;
      }
      if (prop.kind === 'chest' && !prop.opened) {
        if (this.isMultiplayer) {
          multiplayerClient.sendOpenChest(prop.id);
          return true;
        }
        prop.opened = true;
        const rollSp = Math.random() < 0.25;
        if (rollSp) {
          this.skillPoints += 1;
          this.boneShards += 20;
          this.spawnFloatingText(cx, cy - 28, '+1 Skill Point!', '#fde047', true);
        } else {
          this.boneShards += 40;
          this.spawnFloatingText(cx, cy - 28, '+40 Bone Shards', '#93c5fd', true);
        }
        this.healPlayer(Math.round(this.player.maxHp * 0.4), false);
        soundEngine.playSkill('shield');
        this.spawnBurstParticles(cx, cy, '#fde047', 22, true);
        this.emitHudSnapshot();
        return true;
      }
      if (prop.kind === 'blessing_statue' && !prop.opened) {
        if (this.activeBlessings.length >= this.maxBlessings) {
          prop.opened = true;
          this.boneShards += 50;
          this.healPlayer(Math.round(this.player.maxHp * 0.4), false);
          soundEngine.playSkill('shield');
          this.spawnBurstParticles(cx, cy, '#fde047', 24, true);
          this.spawnFloatingText(cx, cy - 28, 'Max Blessings (6/6)! +50 Shards', '#fde047', true);
          this.emitHudSnapshot();
          return true;
        }
        prop.opened = true;
        soundEngine.playSkill('shield');
        this.spawnBurstParticles(cx, cy, '#38bdf8', 28, true);
        this.promptBlessingSelection();
        this.emitHudSnapshot();
        return true;
      }
      if (prop.kind === 'portal_next') {
        this.triggerPortalTransition(prop);
        return true;
      }
      if (prop.kind === 'portal_guild') {
        this.triggerPortalTransition(prop);
        return true;
      }
    }
    return false;
  }

  private triggerPortalTransition(prop: WorldProp) {
    if (this.localIsDowned || this.portalTransitionCooldown > 0) return;
    const isLobby = prop.kind === 'portal_guild';
    const targetKind: 'next' | 'lobby' = isLobby ? 'lobby' : 'next';
    const cx = prop.x + prop.w * 0.5;
    const cy = prop.y + prop.h * 0.5;

    prop.chargeProgress = 0;
    this.portalTransitionCooldown = 1.25;
    this.triggerShake(0.18, 4.2);
    this.spawnBurstParticles(cx, cy, isLobby ? '#fde047' : '#38bdf8', 30, true);
    this.spawnRingEffect(cx, cy, 88, isLobby ? '#f59e0b' : '#38bdf8');

    if (this.isMultiplayer) {
      soundEngine.playPortalWarp(isLobby);
      multiplayerClient.sendEnterPortal(targetKind);
      return;
    }

    soundEngine.playPortalWarp(isLobby);
    this.onPortalWarp?.(targetKind);
    this.pendingPortalAction = { kind: targetKind, timer: 0.18 };
  }

  private updatePortals(dt: number) {
    if (this.portalTransitionCooldown > 0) {
      this.portalTransitionCooldown = Math.max(0, this.portalTransitionCooldown - dt);
    }

    if (this.pendingPortalAction) {
      this.pendingPortalAction.timer -= dt;
      if (this.pendingPortalAction.timer <= 0) {
        const actionKind = this.pendingPortalAction.kind;
        this.pendingPortalAction = null;
        if (actionKind === 'next') {
          this.enterDungeon(this.map.floor + 1);
        } else {
          this.enterGuildHouse();
        }
        return;
      }
    }

    if (this.map.isGuild) return;

    for (let i = 0; i < this.map.props.length; i++) {
      const prop = this.map.props[i];
      if (prop.kind !== 'portal_next' && prop.kind !== 'portal_guild') continue;

      const cx = prop.x + prop.w * 0.5;
      const cy = prop.y + prop.h * 0.5;
      const dist = Math.hypot(cx - this.player.x, cy - this.player.y);
      const portalAge =
        typeof prop.spawnTime === 'number' && prop.spawnTime > 0
          ? Math.max(0, this.elapsedTime - prop.spawnTime)
          : 10;

      // Require 1.05s post-spawn grace so portals appearing near the player never warp prematurely
      if (
        !this.localIsDowned &&
        this.runOutcome === null &&
        this.portalTransitionCooldown <= 0 &&
        !this.pendingPortalAction &&
        portalAge >= 1.05 &&
        dist <= 34
      ) {
        const nextCharge = Math.min(1, (prop.chargeProgress || 0) + dt / 0.65);
        prop.chargeProgress = nextCharge;

        if (Math.random() < 0.45) {
          const isNext = prop.kind === 'portal_next';
          const ang = Math.random() * Math.PI * 2;
          this.spawnParticle({
            x: cx + Math.cos(ang) * 24,
            y: cy + Math.sin(ang) * 16,
            vx: -Math.cos(ang) * 32,
            vy: -42 - Math.random() * 28,
            size: 2.8,
            endSize: 0,
            maxAge: 0.36,
            color: isNext ? '#38bdf8' : '#fde047',
            glow: true,
            shape: 'spark',
            rotation: ang,
            vRot: 4,
          });
        }

        if (nextCharge >= 1) {
          this.triggerPortalTransition(prop);
          return;
        }
      } else if ((prop.chargeProgress || 0) > 0) {
        prop.chargeProgress = Math.max(0, (prop.chargeProgress || 0) - dt * 2.2);
      }
    }
  }

  public stepAndRender(dt: number, ctx: CanvasRenderingContext2D, viewW: number, viewH: number) {
    const clampedDt = Math.min(0.05, Math.max(0.001, dt));
    this.elapsedTime += clampedDt;

    this.updatePlayer(clampedDt);
    equipmentManager.update(clampedDt);
    this.updatePortals(clampedDt);
    this.updateFloatingSwordAndTrail(clampedDt);
    this.updateToxicClouds(clampedDt);
    this.updateDelayedClawMarks(clampedDt);
    this.updateSpectralRifts(clampedDt);
    this.updateOrbitingSpirits(clampedDt);
    this.updateSoulTethers(clampedDt);
    this.updateScrapDebris(clampedDt);
    this.updateMinions(clampedDt);
    this.updateEnemies(clampedDt);
    this.updateProjectiles(clampedDt);
    this.updatePickups(clampedDt);
    this.updateParticlesAndTexts(clampedDt);
    this.updateCamera(clampedDt);

    if (this.aimState.active && !this.aimState.isManual && this.aimState.skillId) {
      const def = HERO_SKILLS[this.aimState.skillId];
      const nearest = this.findNearestEnemy(Math.max(def.range + 95, 360));
      if (nearest) {
        this.aimState.angle = Math.atan2(nearest.y - this.player.y, nearest.x - this.player.x);
      }
    }

    if (this.isMultiplayer) {
      multiplayerClient.sendPlayerState({
        x: this.player.x,
        y: this.player.y,
        vx: this.localIsDowned ? 0 : this.joyX * this.moveSpeed,
        vy: this.localIsDowned ? 0 : this.joyY * this.moveSpeed,
        facing: this.player.facing,
        walkPhase: this.localIsDowned ? 0 : this.player.walkPhase,
        hp: this.player.hp,
        maxHp: this.player.maxHp,
        shield: this.player.shield,
        swordAnim: this.player.swordAnim,
        swordX: this.player.swordX,
        swordY: this.player.swordY,
        swordAngle: this.player.swordAngle,
        offhandX: this.player.offhandX,
        offhandY: this.player.offhandY,
        offhandAngle: this.player.offhandAngle,
        swordScale: this.player.swordScale,
        swordGlowColor: this.player.swordGlowColor,
        swordGlowIntensity: this.player.swordGlowIntensity,
        isScytheForm: this.player.isScytheForm,
        colossusTimer: this.player.colossusTimer,
        boneStormTimer: this.player.boneStormTimer,
        ribShieldTimer: this.player.ribShieldTimer,
        undyingTimer: this.player.undyingTimer,
        stealthTimer: this.player.stealthTimer,
        ambushReady: this.player.ambushReady,
        bloodFrenzyTimer: this.player.bloodFrenzyTimer,
        frenzyStacks: this.player.frenzyStacks,
        phantomMistTimer: this.player.phantomMistTimer,
        possessingTimer: this.player.possessingTimer,
        nightmareTimer: this.player.nightmareTimer,
        pipeThrown: this.player.pipeThrown,
        kneeStrikeTimer: this.player.kneeStrikeTimer,
        lastStandTimer: this.player.lastStandTimer,
        oneManArmyTimer: this.player.oneManArmyTimer,
        airborneHeight: this.player.airborneHeight,
        wingFlapTimer: this.player.wingFlapTimer || 0,
        rainOfFeathersTimer: this.player.rainOfFeathersTimer || 0,
        celestialBarrageTimer: this.player.celestialBarrageTimer || 0,
        celestialBarrageWings: this.player.celestialBarrageWings || 0,
        wrathSkyTimer: this.player.wrathSkyTimer || 0,
        kingOfBeastsTimer: this.player.kingOfBeastsTimer || 0,
        tigerRoarTimer: this.player.tigerRoarTimer || 0,
        isDowned: this.localIsDowned,
      });

      let nearDowned = false;
      if (!this.localIsDowned) {
        for (const rp of this.remotePlayers.values()) {
          if (rp.isDowned && !rp.disconnected) {
            const dist = Math.hypot(rp.x - this.player.x, rp.y - this.player.y);
            if (dist <= 82) {
              nearDowned = true;
              this.currentRevivingPlayerName = rp.name;
              this.currentReviveProgress = rp.reviveProgress;
              if (this.elapsedTime - this.lastMultiplayerReviveSend >= 0.25) {
                this.lastMultiplayerReviveSend = this.elapsedTime;
                multiplayerClient.sendStartRevive(rp.id);
              }
              if (Math.random() < 0.3) {
                this.spawnParticle({
                  x: rp.x + (Math.random() - 0.5) * 28,
                  y: rp.y + (Math.random() - 0.5) * 28,
                  vx: (Math.random() - 0.5) * 20,
                  vy: -35 - Math.random() * 25,
                  size: 3.5,
                  endSize: 0,
                  maxAge: 0.5,
                  color: '#22c55e',
                  glow: true,
                  shape: 'spark',
                  rotation: 0,
                  vRot: 0,
                });
              }
              break;
            }
          }
        }
      }
      if (!nearDowned && this.currentRevivingPlayerName !== null) {
        this.currentRevivingPlayerName = null;
        this.currentReviveProgress = 0;
        multiplayerClient.sendCancelRevive();
      }
    }

    let renderCamX = this.camX;
    let renderCamY = this.camY;
    if (this.shakeTimer > 0) {
      this.shakeTimer -= clampedDt;
      renderCamX += (Math.random() - 0.5) * 2 * this.shakeStrength;
      renderCamY += (Math.random() - 0.5) * 2 * this.shakeStrength;
    }

    renderGameWorld(
      ctx,
      viewW,
      viewH,
      renderCamX,
      renderCamY,
      this.elapsedTime,
      this.map,
      this.player,
      this.enemies,
      this.minions,
      this.toxicClouds,
      this.delayedClawMarks,
      this.groundEffects,
      this.slashWaves,
      this.siphonBeams,
      this.spectralRifts,
      this.orbitingSpirits,
      this.soulTethers,
      this.pipeStrikes,
      this.scrapDebris,
      this.projectiles,
      this.pickups,
      this.swordTrail,
      this.particles,
      this.floatingTexts,
      this.aimState,
      this.getRemotePlayersList()
    );

    this.hudEmitAccum += clampedDt;
    if (this.hudEmitAccum >= 0.15) {
      this.hudEmitAccum = 0;
      this.emitHudSnapshot();
    }
  }

  private updateSpectralRifts(dt: number) {
    for (let i = 0; i < this.spectralRifts.length; i++) {
      const rift = this.spectralRifts[i];
      if (!rift.active) continue;
      const prevAge = rift.age;
      rift.age += dt;

      if (!rift.detonated && rift.age < rift.pullDuration) {
        if (rift.pullStrength > 0) {
          // Gravitational spectral vortex pulling nearby enemies inward!
          const pullRad = rift.radius * 1.32;
          for (const e of this.enemies) {
            if (e.hp <= 0 || e.kind === EnemyKind.TRAINING_DUMMY) continue;
            const dx = rift.x - e.x;
            const dy = rift.y - e.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 14 && dist <= pullRad + e.radius) {
              const bossFactor = isBossKind(e.kind) ? 0.36 : 1.0;
              const pullStep = rift.pullStrength * bossFactor * dt;
              this.tryMoveEntity(
                e.x,
                e.y,
                (dx / dist) * pullStep,
                (dy / dist) * pullStep,
                e.radius * 0.72,
                (nx, ny) => {
                  e.x = nx;
                  e.y = ny;
                }
              );
              e.slowTimer = Math.max(e.slowTimer, 0.5);
            }
          }
        }

        // Periodic abyssal vortex tick damage every 0.45s
        if (rift.explosionDamage > 0 && Math.floor(rift.age / 0.45) > Math.floor(prevAge / 0.45)) {
          const tickDmg = Math.max(4, Math.round(rift.explosionDamage * 0.14));
          for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            if (Math.hypot(e.x - rift.x, e.y - rift.y) <= rift.radius * 1.15 + e.radius) {
              this.damageEnemy(e, tickDmg, false, '#818cf8');
            }
          }
        }
      } else if (!rift.detonated && rift.age >= rift.pullDuration) {
        // Enormous spiritual explosion at the center of Death's Passage!
        rift.detonated = true;
        soundEngine.playSkill('ultimate');
        this.triggerShake(0.34, 9.0);
        this.spawnGroundEffect(
          'astral_nova',
          rift.x,
          rift.y,
          0,
          0,
          0,
          rift.radius * 1.18,
          0.62,
          '#2dd4bf',
          '#818cf8'
        );
        this.spawnGroundEffect(
          'wailing_wave',
          rift.x,
          rift.y,
          0,
          0,
          0,
          rift.radius * 1.25,
          0.56,
          '#c084fc',
          '#5eead4'
        );
        this.spawnSoftMotes(rift.x, rift.y, 0, rift.radius * 0.85, '#5eead4', 22);

        if (rift.explosionDamage > 0) {
          for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            if (Math.hypot(e.x - rift.x, e.y - rift.y) <= rift.radius * 1.18 + e.radius) {
              const isCrit = Math.random() < 0.28;
              const dmg = isCrit ? Math.round(rift.explosionDamage * 1.5) : rift.explosionDamage;
              this.damageEnemy(e, dmg, isCrit, '#5eead4');
            }
          }
        }
      }

      if (rift.age >= rift.maxAge) {
        rift.active = false;
      }
    }
  }

  private updateOrbitingSpirits(dt: number) {
    for (let i = 0; i < this.orbitingSpirits.length; i++) {
      const sp = this.orbitingSpirits[i];
      if (!sp.active) continue;
      sp.age += dt;
      if (sp.age >= sp.maxAge) {
        sp.active = false;
        continue;
      }

      // Shift ribbon trail history smoothly
      for (let t = sp.trail.length - 1; t > 0; t--) {
        sp.trail[t].x = sp.trail[t - 1].x;
        sp.trail[t].y = sp.trail[t - 1].y;
      }
      sp.trail[0].x = sp.x;
      sp.trail[0].y = sp.y;

      if (sp.state === 'orbit') {
        sp.orbitAngle += dt * 3.8;
        const bobR = sp.orbitRadius + Math.sin(this.elapsedTime * 5 + i) * 5;
        const ox = this.player.x + Math.cos(sp.orbitAngle) * bobR;
        const oy = this.player.y - 12 + Math.sin(sp.orbitAngle) * bobR * 0.78;
        const blend = 1 - Math.exp(-18 * dt);
        sp.x += (ox - sp.x) * blend;
        sp.y += (oy - sp.y) * blend;

        if (sp.chargeDelay > 0) {
          sp.chargeDelay -= dt;
        } else {
          // Acquire nearest enemy within Spirit Legion command radius!
          const target = this.findNearestEnemyFrom(this.player.x, this.player.y, 350);
          if (target) {
            sp.state = 'charge';
            sp.targetEnemyId = target.id;
            const ang = Math.atan2(target.y - 10 - sp.y, target.x - sp.x);
            sp.vx = Math.cos(ang) * 520;
            sp.vy = Math.sin(ang) * 520;
            soundEngine.playGhostWisp(1.15 + (i % 4) * 0.06);
          }
        }
      } else {
        // Homing spectral charge toward enemy!
        let target: EnemyEntity | null = null;
        for (const e of this.enemies) {
          if (e.id === sp.targetEnemyId && e.hp > 0) {
            target = e;
            break;
          }
        }
        if (!target) {
          target = this.findNearestEnemyFrom(sp.x, sp.y, 360);
          if (target) sp.targetEnemyId = target.id;
        }

        if (target) {
          const desired = Math.atan2(target.y - 8 - sp.y, target.x - sp.x);
          const curAng = Math.atan2(sp.vy, sp.vx);
          const nextAng = this.blendAngle(curAng, desired, Math.min(1, dt * 13));
          sp.vx = Math.cos(nextAng) * 540;
          sp.vy = Math.sin(nextAng) * 540;
        }

        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;

        // Check spectral spirit impact!
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - sp.x, e.y - 8 - sp.y) <= e.radius + 16) {
            sp.active = false;
            this.spawnGroundEffect(
              'astral_nova',
              sp.x,
              sp.y,
              0,
              0,
              0,
              52,
              0.3,
              '#2dd4bf',
              '#818cf8'
            );
            // AoE spiritual splash overwhelming clustered enemies!
            for (const other of this.enemies) {
              if (other.hp <= 0) continue;
              const d = Math.hypot(other.x - sp.x, other.y - sp.y);
              if (d <= 54 + other.radius) {
                const splashMult = other.id === e.id ? 1.0 : 0.55;
                this.damageEnemy(
                  other,
                  Math.max(4, Math.round(sp.damage * splashMult)),
                  Math.random() < 0.2,
                  '#5eead4'
                );
              }
            }
            break;
          }
        }
      }
    }
  }

  private updateSoulTethers(dt: number) {
    for (let i = 0; i < this.soulTethers.length; i++) {
      const t = this.soulTethers[i];
      if (!t.active) continue;
      t.age += dt;
      if (t.age >= t.maxAge || this.runOutcome === 'defeat') {
        t.active = false;
        continue;
      }

      let host: EnemyEntity | null = null;
      for (const e of this.enemies) {
        if (e.id === t.enemyId && e.hp > 0) {
          host = e;
          break;
        }
      }
      if (!host || Math.hypot(host.x - this.player.x, host.y - this.player.y) > 290) {
        t.active = false;
        continue;
      }

      t.fromX = host.x;
      t.fromY = host.y - 10;
      t.tickAccum += dt;
      if (t.tickAccum >= 0.42) {
        t.tickAccum -= 0.42;
        const tickDmg = Math.max(3, Math.round(t.dps * 0.42));
        host.slowTimer = Math.max(host.slowTimer, 0.7);
        this.damageEnemy(host, tickDmg, false, '#2dd4bf');
        const healAmt = Math.max(3, Math.round(tickDmg * 0.48));
        this.healPlayer(healAmt, false);
        this.spawnSoftMotes(this.player.x, this.player.y - 8, 0, 14, '#5eead4', 2);
      }
    }
  }

  private updateScrapDebris(dt: number) {
    for (let i = 0; i < this.scrapDebris.length; i++) {
      const d = this.scrapDebris[i];
      if (!d.active) continue;
      d.age += dt;
      d.spin += d.vSpin * dt;
      if (d.age >= d.maxAge) {
        d.active = false;
        continue;
      }

      for (let t = d.trail.length - 1; t > 0; t--) {
        d.trail[t].x = d.trail[t - 1].x;
        d.trail[t].y = d.trail[t - 1].y;
      }
      d.trail[0].x = d.x;
      d.trail[0].y = d.y;

      if (d.state === 'rising' || d.state === 'orbit') {
        if (d.age > 0.16) d.state = 'orbit';
        d.orbitAngle += dt * 5.2;
        const rad = d.orbitRadius + Math.sin(this.elapsedTime * 6 + i) * 5;
        const ox = this.player.x + Math.cos(d.orbitAngle) * rad;
        const oy = this.player.y - 12 + Math.sin(d.orbitAngle) * rad * 0.76;
        const blend = 1 - Math.exp(-20 * dt);
        d.x += (ox - d.x) * blend;
        d.y += (oy - d.y) * blend;

        if (d.launchDelay > 0) {
          d.launchDelay -= dt;
        } else {
          const target = this.findNearestEnemyFrom(this.player.x, this.player.y, 360);
          d.state = 'hurl';
          if (target) {
            d.targetEnemyId = target.id;
            const ang = Math.atan2(target.y - 8 - d.y, target.x - d.x);
            d.vx = Math.cos(ang) * 580;
            d.vy = Math.sin(ang) * 580;
          } else {
            // Hurl outward tangentially in a chaotic shrapnel storm even if room was cleared!
            d.vx = Math.cos(d.orbitAngle) * 540;
            d.vy = Math.sin(d.orbitAngle) * 540;
          }
          soundEngine.playPipeSwing(1.22 + (i % 4) * 0.05);
        }
      } else {
        // Chaotic homing shrapnel hurl toward target enemy!
        let target: EnemyEntity | null = null;
        for (const e of this.enemies) {
          if (e.id === d.targetEnemyId && e.hp > 0) {
            target = e;
            break;
          }
        }
        if (!target) {
          target = this.findNearestEnemyFrom(d.x, d.y, 340);
          if (target) d.targetEnemyId = target.id;
        }

        if (target) {
          const desired = Math.atan2(target.y - 8 - d.y, target.x - d.x);
          const curAng = Math.atan2(d.vy, d.vx);
          const nextAng = this.blendAngle(curAng, desired, Math.min(1, dt * 13));
          d.vx = Math.cos(nextAng) * 600;
          d.vy = Math.sin(nextAng) * 600;
        }

        d.x += d.vx * dt;
        d.y += d.vy * dt;

        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - d.x, e.y - 8 - d.y) <= e.radius + 16) {
            d.active = false;
            soundEngine.playPipeClang(1.18 + (i % 3) * 0.08, false);
            this.spawnBurstParticles(d.x, d.y, '#fb923c', 7, true);
            for (const other of this.enemies) {
              if (other.hp <= 0) continue;
              const dist = Math.hypot(other.x - d.x, other.y - d.y);
              if (dist <= 48 + other.radius) {
                const splash = other.id === e.id ? 1.0 : 0.5;
                this.damageEnemy(
                  other,
                  Math.max(4, Math.round(d.damage * splash)),
                  Math.random() < 0.22,
                  '#fb923c'
                );
              }
            }
            break;
          }
        }
      }
    }
  }

  private updateDelayedClawMarks(dt: number) {
    for (let i = 0; i < this.delayedClawMarks.length; i++) {
      const m = this.delayedClawMarks[i];
      if (!m.active) continue;
      m.age += dt;
      if (!m.erupted && m.age >= m.maxAge * 0.78) {
        m.erupted = true;
        soundEngine.playSlash(1.28);
        this.spawnSlashWave(
          'feral_slash',
          m.x,
          m.y - 6,
          m.angle,
          m.radius * 0.98,
          Math.PI * 1.15,
          1,
          0.24,
          '#fff1f2',
          '#f43f5e'
        );
        this.spawnRingEffect(m.x, m.y, m.radius * 1.02, '#fb7185');
        this.spawnSoftMotes(m.x, m.y, m.angle, m.radius * 0.65, '#fda4af', 5);
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - m.x, e.y - m.y) <= m.radius + e.radius) {
            this.damageEnemy(e, m.damage, Math.random() < 0.35, '#fda4af');
          }
        }
      }
      if (m.age >= m.maxAge) {
        m.active = false;
      }
    }
  }

  private updateToxicClouds(dt: number) {
    for (const c of this.toxicClouds) {
      if (!c.active) continue;
      c.age += dt;
      if (c.age >= c.maxAge) {
        c.active = false;
        continue;
      }
      c.tickTimer -= dt;
      if (c.tickTimer <= 0) {
        c.tickTimer = 0.45;
        if (c.dps > 0) {
          const tickDmg = Math.max(2, Math.round(c.dps * 0.45));
          if (c.fromPlayer !== false) {
            for (const e of this.enemies) {
              if (e.hp <= 0) continue;
              if (Math.hypot(e.x - c.x, e.y - c.y) <= c.radius + e.radius) {
                e.slowTimer = Math.max(e.slowTimer, 1.2);
                this.damageEnemy(e, tickDmg, false, '#a3e635');
              }
            }
          } else if (
            !this.isMultiplayer &&
            !this.localIsDowned &&
            this.player.possessingTimer <= 0 &&
            Math.hypot(this.player.x - c.x, this.player.y - c.y) <= c.radius + 16
          ) {
            this.damagePlayer(tickDmg);
          }
        }
      }
    }
  }

  private updatePlayer(dt: number) {
    if (this.doorCooldown > 0) this.doorCooldown -= dt;
    if (this.basicCooldown > 0) this.basicCooldown -= dt;
    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) this.comboStep = 0;
    }
    if (this.player.hitFlash > 0) this.player.hitFlash -= dt;

    for (const key of ALL_ACTIVE_SKILL_IDS) {
      if (this.cooldowns[key] > 0) {
        this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
      }
    }

    if (this.localIsDowned) {
      this.player.walkPhase = 0;
      this.player.colossusTimer = 0;
      this.player.boneStormTimer = 0;
      return;
    }

    // Strike 2 & Strike 3 of Zombie's rapid 3-hit Rotting Claw combo!
    if (this.rottingClawHitsLeft > 0) {
      this.pendingRottingClawTimer -= dt;
      if (this.pendingRottingClawTimer <= 0) {
        const def = HERO_SKILLS.rotting_claw;
        const abomBoost = this.player.colossusTimer > 0 ? 1.38 : 1.0;
        const clawRange = def.range * abomBoost;
        const isFinisher = this.rottingClawHitsLeft === 1;

        soundEngine.playSlash(isFinisher ? 0.82 : 1.18);
        if (isFinisher) {
          this.triggerShake(0.11, 3.2);
          this.spawnSlashWave(
            'cross_claw',
            this.player.x,
            this.player.y - 8,
            this.pendingRottingClawAngle,
            clawRange * 0.95,
            def.radiusOrAngle * 1.1,
            1,
            0.26,
            '#ecfccb',
            '#c084fc'
          );
        } else {
          this.spawnSlashWave(
            'triple_claw',
            this.player.x,
            this.player.y - 8,
            this.pendingRottingClawAngle,
            clawRange * 0.9,
            def.radiusOrAngle,
            -1,
            0.22,
            '#ecfccb',
            '#a3e635'
          );
        }

        this.hitEnemiesInCone(
          this.pendingRottingClawAngle,
          clawRange,
          def.radiusOrAngle,
          this.pendingRottingClawMult * (isFinisher ? 1.25 : 1.0),
          isFinisher ? 0.16 : 0.1,
          isFinisher ? '#c084fc' : '#d9f99d',
          3.2
        );
        this.spawnArcBurst(
          this.player.x,
          this.player.y,
          this.pendingRottingClawAngle,
          clawRange * 0.85,
          isFinisher ? '#c084fc' : '#84cc16',
          14
        );

        this.rottingClawHitsLeft -= 1;
        if (this.rottingClawHitsLeft > 0) {
          this.pendingRottingClawTimer = 0.095;
        }
      }
    }

    if (this.player.colossusTimer > 0) {
      this.player.colossusTimer = Math.max(0, this.player.colossusTimer - dt);
    }
    if (this.player.nightmareTimer > 0) {
      this.player.nightmareTimer = Math.max(0, this.player.nightmareTimer - dt);
    }
    if (this.player.etherealShimmerTimer > 0) {
      this.player.etherealShimmerTimer = Math.max(0, this.player.etherealShimmerTimer - dt);
    }
    if (this.player.phantomMistTimer > 0) {
      this.player.phantomMistTimer = Math.max(0, this.player.phantomMistTimer - dt);
    }
    if (this.restlessTimer > 0) {
      this.restlessTimer = Math.max(0, this.restlessTimer - dt);
      if (this.restlessTimer <= 0) {
        this.player.restlessStacks = 0;
      }
    }

    // =========================================================================
    // HUMAN – PIPE BRAWLER SEQUENCED COMBOS, ULTIMATES & SURVIVOR'S INSTINCT
    // =========================================================================
    if (this.player.kneeStrikeTimer > 0) {
      this.player.kneeStrikeTimer = Math.max(0, this.player.kneeStrikeTimer - dt);
    }
    if (this.player.lastStandTimer > 0) {
      this.player.lastStandTimer = Math.max(0, this.player.lastStandTimer - dt);
    }
    if (this.player.oneManArmyTimer > 0) {
      this.player.oneManArmyTimer = Math.max(0, this.player.oneManArmyTimer - dt);
    }
    if (this.instinctCounterCooldown > 0) {
      this.instinctCounterCooldown = Math.max(0, this.instinctCounterCooldown - dt);
    }

    if (this.heroId === 'human') {
      // Safety sync: ensure pipeThrown clears immediately if no thrown_pipe projectile is active
      if (this.player.pipeThrown) {
        let pipeStillInFlight = false;
        for (let i = 0; i < this.projectiles.length; i++) {
          const pr = this.projectiles[i];
          if (pr.active && pr.kind === 'thrown_pipe') {
            pipeStillInFlight = true;
            break;
          }
        }
        if (!pipeStillInFlight) {
          this.player.pipeThrown = false;
        }
      }

      // Survivor's Instinct Passive: Check if surrounded by 2+ nearby living enemies!
      let nearbyHostiles = 0;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.hp > 0 && Math.hypot(e.x - this.player.x, e.y - this.player.y) <= 215) {
          nearbyHostiles++;
          if (nearbyHostiles >= 2) break;
        }
      }
      this.player.instinctSurrounded = nearbyHostiles >= 2;
    } else {
      this.player.instinctSurrounded = false;
    }

    // Human Normal 5 (Street Fighter): Beats 2 (Left Pipe Hook), 3 (Crushing Knee Strike), 4 (360° Sweep)!
    if (this.streetComboBeat > 0) {
      this.streetComboTimer -= dt;
      if (this.streetComboTimer <= 0) {
        if (this.streetComboBeat === 1) {
          // Beat 2: Snappy Left Pipe Hook
          soundEngine.playPipeSwing(1.22);
          this.targetAttackTwist = -1.1;
          this.spawnPipeStrike(
            'basic_jab',
            this.player.x,
            this.player.y - 8,
            this.streetComboAngle,
            122,
            -1,
            0.18,
            '#fb923c',
            '#f8fafc'
          );
          this.hitEnemiesInCone(
            this.streetComboAngle,
            128,
            Math.PI * 0.95,
            this.streetComboMult * 0.34,
            0.14,
            '#fb923c',
            0
          );
          this.streetComboBeat = 2;
          this.streetComboTimer = 0.105;
        } else if (this.streetComboBeat === 2) {
          // Beat 3: Forward Street Knee Strike (staggers close foes!)
          soundEngine.playPipeClang(1.3, false);
          this.player.kneeStrikeTimer = 0.2;
          this.attackImpulseVx = Math.cos(this.streetComboAngle) * 125;
          this.attackImpulseVy = Math.sin(this.streetComboAngle) * 125;
          this.spawnPipeStrike(
            'knee_burst',
            this.player.x + Math.cos(this.streetComboAngle) * 14,
            this.player.y - 6 + Math.sin(this.streetComboAngle) * 14,
            this.streetComboAngle,
            96,
            1,
            0.2,
            '#f59e0b',
            '#ffffff'
          );
          for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= 105 + e.radius) {
              if (e.kind !== EnemyKind.TRAINING_DUMMY && !isBossKind(e.kind)) {
                e.staggerTimer = Math.max(e.staggerTimer, 0.75);
                e.windupTimer = 0;
              }
              const { dmg, isCrit } = this.rollPlayerDamage(this.streetComboMult * 0.38, 0.2);
              this.damageEnemy(e, dmg, isCrit, '#fde047');
            }
          }
          this.streetComboBeat = 3;
          this.streetComboTimer = 0.125;
        } else {
          // Beat 4: Final 360° Sweeping Pipe Attack (extra effective when surrounded by multiple enemies!)
          const sweepRad = HERO_SKILLS.street_fighter.range;
          soundEngine.playPipeClang(0.88, true);
          this.triggerShake(0.16, 4.8);
          this.spawnPipeStrike(
            'street_sweep',
            this.player.x,
            this.player.y - 8,
            this.streetComboAngle,
            sweepRad,
            1,
            0.28,
            '#f59e0b',
            '#ffffff'
          );

          let surroundedCount = 0;
          for (const e of this.enemies) {
            if (e.hp > 0 && Math.hypot(e.x - this.player.x, e.y - this.player.y) <= sweepRad + e.radius) {
              surroundedCount++;
            }
          }
          const surroundBonus = 1 + Math.min(0.6, Math.max(0, surroundedCount - 1) * 0.18);

          for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
            if (d <= sweepRad + e.radius) {
              const { dmg, isCrit } = this.rollPlayerDamage(
                this.streetComboMult * 0.62 * surroundBonus,
                0.22
              );
              this.damageEnemy(e, dmg, isCrit, '#fde047');
              if (e.hp > 0 && e.kind !== EnemyKind.TRAINING_DUMMY && !isBossKind(e.kind)) {
                const ka = Math.atan2(e.y - this.player.y, e.x - this.player.x);
                this.tryMoveEntity(e.x, e.y, Math.cos(ka) * 48, Math.sin(ka) * 48, e.radius * 0.75, (nx, ny) => {
                  e.x = nx;
                  e.y = ny;
                });
              }
            }
          }
          this.streetComboBeat = 0;
        }
      }
    }

    // Human Ultimate 1 (Last Stand): 3 wide-reaching knockback swings -> devastating seismic ground strike!
    if (this.lastStandSwingsLeft > 0) {
      this.lastStandSwingTimer -= dt;
      if (this.lastStandSwingTimer <= 0) {
        const idx = 3 - this.lastStandSwingsLeft;
        this.lastStandSwingsLeft -= 1;
        this.lastStandSwingTimer = 0.2;

        const nearest = this.findNearestEnemy(260);
        const swingAng = nearest
          ? Math.atan2(nearest.y - this.player.y, nearest.x - this.player.x)
          : this.player.facing;
        this.player.facing = swingAng;
        this.swordCastAngle = swingAng;
        const dir: 1 | -1 = idx % 2 === 0 ? 1 : -1;
        this.targetAttackTwist = dir * 1.35;

        soundEngine.playPipeSwing(0.88 + idx * 0.08);
        soundEngine.playPipeClang(0.9 + idx * 0.06, true);
        this.triggerShake(0.14, 4.4);

        const cleaveRange = 198;
        this.spawnPipeStrike(
          'last_stand_cleave',
          this.player.x,
          this.player.y - 8,
          swingAng,
          cleaveRange,
          dir,
          0.25,
          '#f97316',
          '#fde047'
        );

        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const dx = e.x - this.player.x;
          const dy = e.y - this.player.y;
          const d = Math.hypot(dx, dy);
          if (d <= cleaveRange + e.radius) {
            let diff = Math.atan2(dy, dx) - swingAng;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            if (Math.abs(diff) <= Math.PI * 0.62 || d <= e.radius + 36) {
              const { dmg, isCrit } = this.rollPlayerDamage(this.lastStandMult * 0.34, 0.2);
              this.damageEnemy(e, dmg, isCrit, '#fde047');
              if (e.hp > 0 && e.kind !== EnemyKind.TRAINING_DUMMY) {
                const kb = isBossKind(e.kind) ? 18 : 66;
                const ka = Math.atan2(dy, dx);
                this.tryMoveEntity(e.x, e.y, Math.cos(ka) * kb, Math.sin(ka) * kb, e.radius * 0.75, (nx, ny) => {
                  e.x = nx;
                  e.y = ny;
                });
              }
            }
          }
        }
      }
    }

    if (this.lastStandSlamPending) {
      this.lastStandSlamTimer -= dt;
      if (this.lastStandSlamTimer <= 0) {
        this.lastStandSlamPending = false;
        this.player.swordAnim = SwordAnimState.LAST_STAND_SLAM;
        this.swordAnimDuration = 0.38;
        this.swordAnimTimer = 0.38;

        const slamRad = HERO_SKILLS.last_stand.range * 1.12;
        soundEngine.playSkill('ultimate');
        soundEngine.playPipeClang(0.68, true);
        this.triggerShake(0.34, 8.8);

        this.spawnGroundEffect(
          'seismic_pipe_shockwave',
          this.player.x,
          this.player.y + 4,
          0,
          0,
          this.player.facing,
          slamRad,
          1.25,
          '#f97316',
          '#fde047'
        );
        this.spawnPipeStrike(
          'headcracker_anvil',
          this.player.x + Math.cos(this.player.facing) * 28,
          this.player.y,
          this.player.facing,
          125,
          1,
          0.32,
          '#f97316',
          '#fde047'
        );
        this.spawnBurstParticles(this.player.x, this.player.y - 6, '#fde047', 26, true);

        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
          if (d <= slamRad + e.radius) {
            e.windupTimer = 0;
            if (e.kind !== EnemyKind.TRAINING_DUMMY) {
              e.staggerTimer = Math.max(e.staggerTimer, isBossKind(e.kind) ? 1.1 : 1.9);
            }
            const { dmg, isCrit } = this.rollPlayerDamage(this.lastStandMult * 0.72, 0.28);
            this.damageEnemy(e, dmg, isCrit, '#fde047');
          }
        }
      }
    }

    // Human Ultimate 3 (One Man Army): Rapid unpredictable blitz combos -> massive spinning pipe tornado!
    if (this.omaBlitzLeft > 0) {
      this.omaBlitzTimer -= dt;
      if (this.omaBlitzTimer <= 0) {
        this.omaBlitzLeft -= 1;
        this.omaBlitzTimer = 0.135;

        let chosen: EnemyEntity | null = null;
        let bestScore = 9999;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
          if (d > 330) continue;
          const repeatPenalty = e.id === this.omaLastEnemyId ? 170 : 0;
          if (d + repeatPenalty < bestScore) {
            bestScore = d + repeatPenalty;
            chosen = e;
          }
        }

        const startX = this.player.x;
        const startY = this.player.y;
        const stepSide: 1 | -1 = this.omaBlitzLeft % 2 === 0 ? 1 : -1;
        let dashAng = this.player.facing + stepSide * 0.95;
        let endX = startX;
        let endY = startY;

        if (chosen) {
          this.omaLastEnemyId = chosen.id;
          dashAng = Math.atan2(chosen.y - startY, chosen.x - startX);
          const flankAng = dashAng + stepSide * 0.65;
          const candX = chosen.x + Math.cos(flankAng) * (chosen.radius + 24);
          const candY = chosen.y + Math.sin(flankAng) * (chosen.radius + 20);
          if (this.isPointWalkable(candX, candY, 16)) {
            endX = candX;
            endY = candY;
          } else {
            const clamped = this.findFurthestWalkableAlongRay(startX, startY, chosen.x, chosen.y, 16);
            endX = clamped.x;
            endY = clamped.y;
          }
        } else {
          const clamped = this.findFurthestWalkableAlongRay(
            startX,
            startY,
            startX + Math.cos(dashAng) * 98,
            startY + Math.sin(dashAng) * 98,
            16
          );
          endX = clamped.x;
          endY = clamped.y;
        }

        this.blitzStartX = startX;
        this.blitzStartY = startY;
        this.blitzTargetX = endX;
        this.blitzTargetY = endY;
        this.blitzDuration = 0.115;
        this.blitzTimer = 0.115;

        const strikeAng = chosen ? Math.atan2(chosen.y - endY, chosen.x - endX) : dashAng;
        this.player.facing = strikeAng;
        this.swordCastAngle = strikeAng;
        this.targetAttackTwist = stepSide * 1.2;
        this.player.swordAnim =
          stepSide === 1 ? SwordAnimState.BASIC_1 : SwordAnimState.BASIC_2;
        this.swordAnimDuration = 0.14;
        this.swordAnimTimer = 0.14;
        soundEngine.playPipeClang(1.08 + (this.omaBlitzLeft % 3) * 0.08, false);

        this.spawnGroundEffect(
          'oma_blitz_streak',
          startX,
          startY - 6,
          endX,
          endY - 6,
          strikeAng,
          80,
          0.28,
          '#fb923c',
          '#fde047'
        );
        this.spawnPipeStrike(
          this.omaBlitzLeft % 3 === 0 ? 'basic_batter' : 'basic_jab',
          endX,
          endY - 8,
          strikeAng,
          96,
          stepSide,
          0.18,
          '#fb923c',
          '#ffffff'
        );

        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - endX, e.y - endY) <= 92 + e.radius) {
            const { dmg, isCrit } = this.rollPlayerDamage(this.omaMult * 0.24, 0.25);
            this.damageEnemy(e, dmg, isCrit, '#fde047');
          }
        }
      }
    }

    if (this.omaFinisherPending) {
      this.omaFinisherTimer -= dt;
      if (this.omaFinisherTimer <= 0) {
        this.omaFinisherPending = false;
        this.player.swordAnim = SwordAnimState.ONE_MAN_ARMY_SPIN;
        this.swordAnimDuration = 0.42;
        this.swordAnimTimer = 0.42;

        const spinRad = 210;
        soundEngine.playSkill('ultimate');
        soundEngine.playPipeClang(0.74, true);
        this.triggerShake(0.28, 7.6);

        this.spawnPipeStrike(
          'oma_tornado',
          this.player.x,
          this.player.y - 8,
          this.player.facing,
          spinRad,
          1,
          0.36,
          '#fb923c',
          '#ffffff'
        );
        this.spawnGroundEffect(
          'brawler_stance_ring',
          this.player.x,
          this.player.y + 4,
          0,
          0,
          0,
          spinRad * 0.95,
          0.58,
          '#fb923c',
          '#fde047'
        );
        this.spawnBurstParticles(this.player.x, this.player.y - 8, '#ffffff', 22, true);

        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const dx = e.x - this.player.x;
          const dy = e.y - this.player.y;
          const d = Math.hypot(dx, dy);
          if (d <= spinRad + e.radius) {
            const { dmg, isCrit } = this.rollPlayerDamage(this.omaMult * 0.72, 0.32);
            this.damageEnemy(e, dmg, isCrit, '#ffffff');
            // Send surrounding enemies flying outward!
            if (e.hp > 0 && e.kind !== EnemyKind.TRAINING_DUMMY) {
              const flyDist = isBossKind(e.kind) ? 24 : 96;
              const ka = Math.atan2(dy, dx);
              this.tryMoveEntity(e.x, e.y, Math.cos(ka) * flyDist, Math.sin(ka) * flyDist, e.radius * 0.75, (nx, ny) => {
                e.x = nx;
                e.y = ny;
              });
            }
          }
        }
      }
    }
    if (this.wailingEchoLeft > 0) {
      this.wailingEchoTimer -= dt;
      if (this.wailingEchoTimer <= 0) {
        this.wailingEchoLeft -= 1;
        this.wailingEchoTimer = 0.11;
        this.spawnGroundEffect(
          'wailing_wave',
          this.player.x,
          this.player.y - 6,
          0,
          0,
          0,
          this.wailingRange * (this.wailingEchoLeft === 1 ? 0.88 : 1.04),
          0.44,
          '#5eead4',
          '#818cf8'
        );
      }
    }

    // Tick damaging spectral mist nodes left behind by Ghost's Phantom Dash!
    this.phantomMistDamageTick -= dt;
    if (this.phantomMistDamageTick <= 0) {
      this.phantomMistDamageTick = 0.42;
      let hasMist = false;
      for (let i = 0; i < this.groundEffects.length; i++) {
        const ge = this.groundEffects[i];
        if (ge.active && ge.kind === 'spectral_mist_node') {
          hasMist = true;
          break;
        }
      }
      if (hasMist) {
        const mistDmg = Math.max(3, Math.round(this.getEffectiveAtk() * 0.36));
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          for (let i = 0; i < this.groundEffects.length; i++) {
            const ge = this.groundEffects[i];
            if (!ge.active || ge.kind !== 'spectral_mist_node') continue;
            if (Math.hypot(e.x - ge.x, e.y - ge.y) <= ge.radius + e.radius) {
              e.slowTimer = Math.max(e.slowTimer, 1.0);
              this.damageEnemy(e, mistDmg, false, '#2dd4bf');
              break; // Hit once per tick even if overlapping multiple mist nodes
            }
          }
        }
      }
    }

    // =========================================================================
    // EAGLEKIN – SKY MARKSMAN PERIODIC UPDATES & ABILITIES
    // =========================================================================
    if (this.player.wingFlapTimer && this.player.wingFlapTimer > 0) {
      this.player.wingFlapTimer = Math.max(0, this.player.wingFlapTimer - dt);
    }
    if (this.player.rainOfFeathersTimer && this.player.rainOfFeathersTimer > 0) {
      this.player.rainOfFeathersTimer = Math.max(0, this.player.rainOfFeathersTimer - dt);
      if (this.player.rainOfFeathersTimer <= 0 && (!this.player.wrathSkyTimer || this.player.wrathSkyTimer <= 0)) {
        this.player.airborneHeight = 0;
      }
    }
    if (this.player.wrathSkyTimer && this.player.wrathSkyTimer > 0) {
      this.player.wrathSkyTimer = Math.max(0, this.player.wrathSkyTimer - dt);
      if (this.player.wrathSkyTimer <= 0 && (!this.player.rainOfFeathersTimer || this.player.rainOfFeathersTimer <= 0)) {
        this.player.airborneHeight = 0;
      }
    }

    // Eaglekin Normal 5 (Rain of Feathers): Continuous shower of sky feathers over target area
    if (this.rainOfFeathersVolleysLeft > 0) {
      this.rainOfFeathersVolleyTimer -= dt;
      if (this.rainOfFeathersVolleyTimer <= 0) {
        this.rainOfFeathersVolleysLeft -= 1;
        this.rainOfFeathersVolleyTimer = 0.12;
        soundEngine.playFeatherShoot(1.2);
        this.player.wingFlapTimer = 0.18;

        for (let f = 0; f < 3; f++) {
          const offDist = Math.random() * this.rainOfFeathersRadius;
          const offAng = Math.random() * Math.PI * 2;
          const fx = this.rainOfFeathersTargetX + Math.cos(offAng) * offDist;
          const fy = this.rainOfFeathersTargetY + Math.sin(offAng) * offDist;
          this.spawnBurstParticles(fx, fy, '#38bdf8', 4, true);

          for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            if (Math.hypot(e.x - fx, e.y - fy) <= 36 + e.radius) {
              const { dmg, isCrit } = this.rollPlayerDamage(this.rainOfFeathersMult * 0.28, 0.12);
              this.damageEnemy(e, dmg, isCrit, '#38bdf8');
            }
          }
        }
      }
    }

    // Eaglekin Ultimate 1 (Wrath of the Sky): Raining storm of sharpened celestial feathers across wide area
    if (this.wrathSkyVolleysLeft > 0) {
      this.wrathSkyVolleyTimer -= dt;
      if (this.wrathSkyVolleyTimer <= 0) {
        this.wrathSkyVolleysLeft -= 1;
        this.wrathSkyVolleyTimer = 0.09;
        soundEngine.playFeatherShoot(0.95);
        this.player.wingFlapTimer = 0.2;

        for (let f = 0; f < 4; f++) {
          const offDist = Math.random() * this.wrathSkyRadius;
          const offAng = Math.random() * Math.PI * 2;
          const fx = this.wrathSkyTargetX + Math.cos(offAng) * offDist;
          const fy = this.wrathSkyTargetY + Math.sin(offAng) * offDist;
          this.spawnBurstParticles(fx, fy, '#e0f2fe', 6, true);
          this.spawnRingEffect(fx, fy, 28, '#0284c7');

          for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            if (Math.hypot(e.x - fx, e.y - fy) <= 42 + e.radius) {
              const { dmg, isCrit } = this.rollPlayerDamage(this.wrathSkyMult * 0.22, 0.18);
              this.damageEnemy(e, dmg, isCrit, '#0284c7');
            }
          }
        }
      }
    }

    // Eaglekin Ultimate 2 (Celestial Barrage): 4 spectral wings continuously fire magical feathers
    if (this.celestialBarrageTimer > 0) {
      this.celestialBarrageTimer = Math.max(0, this.celestialBarrageTimer - dt);
      this.player.celestialBarrageTimer = this.celestialBarrageTimer;
      this.celestialBarrageTickTimer -= dt;
      if (this.celestialBarrageTickTimer <= 0) {
        this.celestialBarrageTickTimer = 0.22;
        soundEngine.playFeatherShoot(1.3);
        this.player.wingFlapTimer = 0.16;

        const target = this.findNearestEnemy(460);
        const ang = target
          ? Math.atan2(target.y - this.player.y, target.x - this.player.x)
          : this.player.facing;
        for (const wingOffset of [-0.25, 0.25]) {
          const wAng = ang + wingOffset;
          const { dmg, isCrit } = this.rollPlayerDamage(this.celestialBarrageMult * 0.42, 0.14);
          this.spawnProjectile({
            fromPlayer: true,
            kind: 'celestial_feather',
            x: this.player.x + Math.cos(wAng + Math.PI / 2) * (wingOffset * 60),
            y: this.player.y - 18 + Math.sin(wAng + Math.PI / 2) * (wingOffset * 60),
            vx: Math.cos(wAng) * 620,
            vy: Math.sin(wAng) * 620,
            angle: wAng,
            radius: 14,
            damage: dmg,
            isCrit,
            pierce: false,
            maxLife: 1.4,
            color: '#38bdf8',
            targetEnemyId: target ? target.id : -1,
          });
        }
      }
      if (this.celestialBarrageTimer <= 0) {
        this.player.celestialBarrageWings = 0;
      }
    }

    // Tick Hunter's Mark on enemies
    for (const e of this.enemies) {
      if (e.huntersMarkTimer && e.huntersMarkTimer > 0) {
        e.huntersMarkTimer = Math.max(0, e.huntersMarkTimer - dt);
        if (e.huntersMarkTimer <= 0 && this.player.huntersMarkTargetId === e.id) {
          this.player.huntersMarkTargetId = null;
        }
      }
    }

    // =========================================================================
    // TIGERKIN – FERAL BERSERKER PERIODIC UPDATES & SKILLS
    // =========================================================================
    if (this.player.kingOfBeastsTimer && this.player.kingOfBeastsTimer > 0) {
      this.player.kingOfBeastsTimer = Math.max(0, this.player.kingOfBeastsTimer - dt);
    }
    if (this.player.tigerRoarTimer && this.player.tigerRoarTimer > 0) {
      this.player.tigerRoarTimer = Math.max(0, this.player.tigerRoarTimer - dt);
    }
    if (this.player.feralMomentumTimer && this.player.feralMomentumTimer > 0) {
      this.player.feralMomentumTimer = Math.max(0, this.player.feralMomentumTimer - dt);
      if (this.player.feralMomentumTimer <= 0) {
        this.player.feralMomentumStacks = 0;
      }
    }

    // Tigerkin Normal 2 (Rending Flurry): Rapid series of 5 claw strikes against enemies directly ahead
    if (this.rendingFlurryHitsLeft > 0) {
      this.rendingFlurryTimer -= dt;
      if (this.rendingFlurryTimer <= 0) {
        this.rendingFlurryHitsLeft -= 1;
        this.rendingFlurryTimer = 0.055;
        const hitIdx = 5 - this.rendingFlurryHitsLeft;
        const dir: 1 | -1 = hitIdx % 2 === 0 ? 1 : -1;
        this.targetAttackTwist = dir * 1.15;
        soundEngine.playFeralClaw(1.18 + hitIdx * 0.05, false);

        this.spawnSlashWave(
          'rending_flurry_slash',
          this.player.x + Math.cos(this.rendingFlurryAngle) * 16,
          this.player.y - 8 + Math.sin(this.rendingFlurryAngle) * 16,
          this.rendingFlurryAngle,
          105,
          Math.PI * 0.95,
          dir,
          0.2,
          '#fef08a',
          '#f59e0b'
        );
        this.hitEnemiesInCone(
          this.rendingFlurryAngle,
          108,
          Math.PI * 0.95,
          this.rendingFlurryMult * 0.28,
          0.22,
          '#f59e0b',
          0
        );
        this.player.feralMomentumStacks = Math.min(5, (this.player.feralMomentumStacks || 0) + 1);
        this.player.feralMomentumTimer = 4.0;
      }
    }

    // Tigerkin Normal 4 (Savage Pursuit): Rush tearing through anything in its path
    if (this.savagePursuitTimer > 0) {
      this.savagePursuitTimer = Math.max(0, this.savagePursuitTimer - dt);
      const steps = 3;
      const stepDx = (this.savagePursuitVx * dt) / steps;
      const stepDy = (this.savagePursuitVy * dt) / steps;
      for (let s = 0; s < steps; s++) {
        this.tryMoveEntity(this.player.x, this.player.y, stepDx, stepDy, 16, (nx, ny) => {
          this.player.x = nx;
          this.player.y = ny;
        });
      }

      this.ghostSampleAccum += dt;
      if (this.ghostSampleAccum >= 0.04) {
        this.ghostSampleAccum = 0;
        for (const g of this.player.dashGhostTrail) {
          if (g.alpha <= 0.05) {
            g.x = this.player.x;
            g.y = this.player.y;
            g.alpha = 0.88;
            break;
          }
        }
        const backAng = Math.atan2(-this.savagePursuitVy, -this.savagePursuitVx);
        this.spawnSoftMotes(this.player.x, this.player.y, backAng, 30, '#f59e0b', 3);
      }

      const rushAng = Math.atan2(this.savagePursuitVy, this.savagePursuitVx);
      for (const e of this.enemies) {
        if (e.hp <= 0 || this.savagePursuitHitIds.has(e.id)) continue;
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= 48 + e.radius) {
          this.savagePursuitHitIds.add(e.id);
          const { dmg, isCrit } = this.rollPlayerDamage(this.savagePursuitMult * 0.65, 0.22);
          this.damageEnemy(e, dmg, isCrit, '#f59e0b');
          if (e.hp > 0 && e.kind !== EnemyKind.TRAINING_DUMMY && !isBossKind(e.kind)) {
            const ka = Math.atan2(e.y - this.player.y, e.x - this.player.x);
            this.tryMoveEntity(e.x, e.y, Math.cos(ka) * 44, Math.sin(ka) * 44, e.radius, (nx, ny) => {
              e.x = nx;
              e.y = ny;
            });
            e.staggerTimer = Math.max(e.staggerTimer, 0.85);
          }
          this.spawnSlashWave(
            'tiger_savage_slash',
            e.x,
            e.y - 8,
            rushAng,
            42,
            Math.PI * 0.9,
            1,
            0.18,
            '#fef08a',
            '#f59e0b'
          );
        }
      }

      if (this.savagePursuitTimer <= 0) {
        soundEngine.playFeralClaw(1.25, true);
        this.triggerShake(0.14, 4.2);
        this.spawnSlashWave(
          'tiger_cross_rend',
          this.player.x + Math.cos(rushAng) * 16,
          this.player.y - 8 + Math.sin(rushAng) * 16,
          rushAng,
          88,
          Math.PI * 1.2,
          1,
          0.26,
          '#fef08a',
          '#f59e0b'
        );
        this.hitEnemiesInCone(rushAng, 92, Math.PI * 1.2, this.savagePursuitMult * 0.45, 0.25, '#fbbf24', 0);
      }
    }

    // Tigerkin Ultimate 3 (Apex Devastation): Parabolic launch into air followed by crushing descent
    if (this.apexDevastationState === 'rising') {
      this.apexDevastationTimer -= dt;
      const riseRatio = Math.min(1, Math.max(0, 1 - this.apexDevastationTimer / 0.28));
      this.player.airborneHeight = riseRatio * 65;

      const spring = 1 - Math.exp(-12 * dt);
      this.player.x += (this.apexDevastationTargetX - this.player.x) * spring;
      this.player.y += (this.apexDevastationTargetY - this.player.y) * spring;

      this.ghostSampleAccum += dt;
      if (this.ghostSampleAccum >= 0.04) {
        this.ghostSampleAccum = 0;
        for (const g of this.player.dashGhostTrail) {
          if (g.alpha <= 0.05) {
            g.x = this.player.x;
            g.y = this.player.y - this.player.airborneHeight * 0.45;
            g.alpha = 0.75;
            break;
          }
        }
      }

      if (this.apexDevastationTimer <= 0) {
        this.apexDevastationState = 'slamming';
        this.apexDevastationTimer = 0.12;
        this.player.swordAnim = SwordAnimState.APEX_DEVASTATION_SLAM;
      }
    } else if (this.apexDevastationState === 'slamming') {
      this.apexDevastationTimer -= dt;
      const dropRatio = Math.max(0, this.apexDevastationTimer / 0.12);
      this.player.airborneHeight = dropRatio * 65;

      if (this.apexDevastationTimer <= 0) {
        this.player.airborneHeight = 0;
        this.apexDevastationState = 'none';

        soundEngine.playFeralClaw(0.82, true);
        soundEngine.playTigerRoar(1.15);
        this.triggerShake(0.32, 9.2);

        const slamRadius = 145;
        this.spawnGroundEffect(
          'tiger_crush_crater',
          this.player.x,
          this.player.y,
          0,
          0,
          this.player.facing,
          slamRadius,
          1.5,
          '#f59e0b',
          '#fef08a'
        );
        this.spawnRingEffect(this.player.x, this.player.y, slamRadius, '#fbbf24');
        this.spawnRingEffect(this.player.x, this.player.y, slamRadius * 0.65, '#fde047');
        this.spawnBurstParticles(this.player.x, this.player.y - 8, '#fde047', 36, true);

        for (let w = 0; w < 4; w++) {
          const wAng = (w * Math.PI) / 2 + this.player.facing;
          this.spawnSlashWave(
            'crushing_paw_shock',
            this.player.x,
            this.player.y - 8,
            wAng,
            slamRadius * 1.1,
            Math.PI * 0.85,
            1,
            0.32,
            '#fef08a',
            '#f59e0b'
          );
        }

        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= slamRadius + e.radius) {
            const { dmg, isCrit } = this.rollPlayerDamage(this.apexDevastationMult, 0.35);
            this.damageEnemy(e, dmg, isCrit, '#fbbf24');
            if (e.hp > 0 && e.kind !== EnemyKind.TRAINING_DUMMY && !isBossKind(e.kind)) {
              const ka = Math.atan2(e.y - this.player.y, e.x - this.player.x);
              this.tryMoveEntity(e.x, e.y, Math.cos(ka) * 95, Math.sin(ka) * 95, e.radius * 0.75, (nx, ny) => {
                e.x = nx;
                e.y = ny;
              });
              e.staggerTimer = Math.max(e.staggerTimer, 1.4);
            }
          }
        }
      }
    }

    // Ghost Haunted Possession active state: ride inside possessed enemy & erupt when finished!
    if (this.player.possessingTimer > 0) {
      this.player.possessingTimer = Math.max(0, this.player.possessingTimer - dt);
      let host: EnemyEntity | null = null;
      for (const e of this.enemies) {
        if (e.id === this.possessedEnemyId && e.hp > 0) {
          host = e;
          break;
        }
      }

      if (host && this.player.possessingTimer > 0) {
        this.player.x = host.x;
        this.player.y = host.y;
        this.possessionHostAtkAccum -= dt;
        if (this.possessionHostAtkAccum <= 0) {
          this.possessionHostAtkAccum = 0.48;
          // Force host to unleash spiritual shockwaves against nearby enemies (and rupture internally)!
          soundEngine.playGhostWisp(0.95);
          this.spawnGroundEffect(
            'astral_nova',
            host.x,
            host.y,
            0,
            0,
            host.facing,
            host.radius + 78,
            0.32,
            '#c084fc',
            '#2dd4bf'
          );
          let hitOther = false;
          for (const other of this.enemies) {
            if (other.id === host.id || other.hp <= 0) continue;
            if (Math.hypot(other.x - host.x, other.y - host.y) <= host.radius + 82 + other.radius) {
              hitOther = true;
              const { dmg, isCrit } = this.rollPlayerDamage(0.65, 0.1);
              this.damageEnemy(other, dmg, isCrit, '#c084fc');
            }
          }
          // Internal spiritual torment on the host itself (stronger if isolated!)
          const internalMult = hitOther ? 0.28 : 0.55;
          const { dmg: selfDmg } = this.rollPlayerDamage(internalMult, 0.05);
          this.damageEnemy(host, selfDmg, false, '#a855f7');
        }
      } else {
        // Erupt out of possessed enemy body with a spectral burst!
        this.player.possessingTimer = 0;
        if (host) {
          host.possessedTimer = 0;
          if (host.kind !== EnemyKind.TRAINING_DUMMY) {
            host.fearTimer = Math.max(host.fearTimer, 1.2);
          }
        }
        const exitAng =
          Math.hypot(this.joyX, this.joyY) > 0.15
            ? Math.atan2(this.joyY, this.joyX)
            : this.player.facing + Math.PI;
        const burstX = this.player.x;
        const burstY = this.player.y;
        const stepOutX = burstX + Math.cos(exitAng) * 44;
        const stepOutY = burstY + Math.sin(exitAng) * 44;
        const safeExit = this.findFurthestWalkableAlongRay(burstX, burstY, stepOutX, stepOutY, 15, true);
        this.player.x = safeExit.x;
        this.player.y = safeExit.y;
        this.player.facing = exitAng;
        this.player.etherealShimmerTimer = 0.45;
        this.grantRestlessSpirit();

        soundEngine.playSkill('rush');
        soundEngine.playGhostWisp(1.2);
        this.triggerShake(0.2, 5.4);
        this.spawnGroundEffect(
          'possession_burst',
          burstX,
          burstY,
          0,
          0,
          0,
          104,
          0.52,
          '#c084fc',
          '#2dd4bf'
        );
        this.spawnSoftMotes(burstX, burstY, 0, 72, '#5eead4', 14);

        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - burstX, e.y - burstY) <= 104 + e.radius) {
            const { dmg, isCrit } = this.rollPlayerDamage(this.possessionExitMult * 0.78, 0.2);
            this.damageEnemy(e, dmg, isCrit, '#5eead4');
          }
        }
        this.possessedEnemyId = -1;
      }
    }

    if (this.player.stealthTimer > 0) {
      this.player.stealthTimer = Math.max(0, this.player.stealthTimer - dt);
      if (this.player.stealthTimer <= 0) {
        this.player.ambushReady = false;
      }
    }
    if (this.momentumTimer > 0) {
      this.momentumTimer = Math.max(0, this.momentumTimer - dt);
      if (this.momentumTimer <= 0) {
        this.player.momentumStacks = 0;
      }
    }

    // Ghoul Rending Claws Strikes 2, 3, and Strike 4 Smooth Crescent Finale!
    if (this.rendingHitsLeft > 0) {
      this.pendingRendingTimer -= dt;
      if (this.pendingRendingTimer <= 0) {
        const def = HERO_SKILLS.rending_claws;
        const apexBoost = this.player.colossusTimer > 0 ? 1.32 : 1.0;
        const rendRange = def.range * apexBoost;
        const isFinale = this.rendingHitsLeft === 1;
        const dir: 1 | -1 = this.rendingHitsLeft % 2 === 0 ? -1 : 1;
        this.targetAttackTwist = dir;

        soundEngine.playSlash(isFinale ? 0.92 : 1.28);
        if (isFinale) {
          this.triggerShake(0.11, 3.0);
          this.attackImpulseVx = Math.cos(this.pendingRendingAngle) * 110;
          this.attackImpulseVy = Math.sin(this.pendingRendingAngle) * 110;
          this.spawnSlashWave(
            'rending_finale',
            this.player.x + Math.cos(this.pendingRendingAngle) * 14,
            this.player.y - 8 + Math.sin(this.pendingRendingAngle) * 14,
            this.pendingRendingAngle,
            rendRange * 1.06,
            def.radiusOrAngle * 1.15,
            1,
            0.28,
            '#fff1f2',
            '#e11d48'
          );
          this.hitEnemiesInCone(
            this.pendingRendingAngle,
            rendRange * 1.12,
            def.radiusOrAngle * 1.18,
            this.pendingRendingMult * 0.76,
            0.25,
            '#fda4af',
            0
          );
          // Tear through targets with a smooth crimson crescent wave!
          const { dmg, isCrit } = this.rollPlayerDamage(this.pendingRendingMult * 0.48, 0.2);
          this.spawnProjectile({
            fromPlayer: true,
            kind: 'crimson_rend_wave',
            x: this.player.x + Math.cos(this.pendingRendingAngle) * 28,
            y: this.player.y - 8 + Math.sin(this.pendingRendingAngle) * 28,
            vx: Math.cos(this.pendingRendingAngle) * 540,
            vy: Math.sin(this.pendingRendingAngle) * 540,
            angle: this.pendingRendingAngle,
            radius: 34,
            damage: dmg,
            isCrit,
            pierce: true,
            maxLife: 0.42,
            color: '#f43f5e',
          });
          this.spawnSoftMotes(
            this.player.x,
            this.player.y,
            this.pendingRendingAngle,
            rendRange * 0.85,
            '#fda4af',
            8
          );
        } else {
          this.attackImpulseVx = Math.cos(this.pendingRendingAngle) * 65;
          this.attackImpulseVy = Math.sin(this.pendingRendingAngle) * 65;
          this.spawnSlashWave(
            'feral_slash',
            this.player.x,
            this.player.y - 8,
            this.pendingRendingAngle,
            rendRange * 0.88,
            def.radiusOrAngle * 0.92,
            dir,
            0.22,
            '#fff1f2',
            '#fb7185'
          );
          this.hitEnemiesInCone(
            this.pendingRendingAngle,
            rendRange,
            def.radiusOrAngle,
            this.pendingRendingMult * 0.34,
            0.12,
            '#fda4af',
            0
          );
        }

        this.rendingHitsLeft -= 1;
        if (this.rendingHitsLeft > 0) {
          this.pendingRendingTimer = this.rendingHitsLeft === 1 ? 0.125 : 0.105;
        }
      }
    }

    // Ghoul Shadow Stalker shadow-vanish & clean reappear behind prey!
    if (this.shadowStepTimer > 0) {
      this.shadowStepTimer -= dt;
      this.player.airborneHeight = 0;
      if (this.shadowStepTimer <= 0) {
        this.breakWeaponTrail();
        this.player.x = this.shadowDestX;
        this.player.y = this.shadowDestY;
        this.player.facing = this.shadowTargetFacing;
        this.swordCastAngle = this.shadowTargetFacing;
        this.player.swordX = this.player.x + Math.cos(this.shadowTargetFacing - 0.9) * 26;
        this.player.swordY = this.player.y - 10 + Math.sin(this.shadowTargetFacing - 0.9) * 16;
        this.player.offhandX = this.player.x + Math.cos(this.shadowTargetFacing + 0.9) * 26;
        this.player.offhandY = this.player.y - 10 + Math.sin(this.shadowTargetFacing + 0.9) * 16;
        this.basicCooldown = 0;
        this.spawnGroundEffect(
          'shadow_smoke_ring',
          this.player.x,
          this.player.y,
          0,
          0,
          0,
          68,
          0.5,
          '#4c0519',
          '#fb7185'
        );
        this.spawnSoftMotes(this.player.x, this.player.y, this.shadowTargetFacing, 28, '#fda4af', 7);
        this.spawnFloatingText(this.player.x, this.player.y - 38, 'SHADOW AMBUSH READY!', '#fda4af', false);
      }
    }

    // Ghoul Predator's Leap immediate follow-up 360° sweeping claw attack!
    if (this.pendingLeapSweepTimer > 0) {
      this.pendingLeapSweepTimer -= dt;
      if (this.pendingLeapSweepTimer <= 0) {
        const sweepRad = HERO_SKILLS.predators_leap.radiusOrAngle * (this.player.colossusTimer > 0 ? 1.25 : 1.12);
        soundEngine.playSlash(0.96);
        this.player.swordAnim = SwordAnimState.BASIC_4;
        this.swordAnimDuration = 0.28;
        this.swordAnimTimer = 0.28;
        this.spawnSlashWave(
          'feral_whirl',
          this.player.x,
          this.player.y - 8,
          this.player.facing,
          sweepRad * 0.96,
          Math.PI * 2,
          1,
          0.28,
          '#fff1f2',
          '#e11d48'
        );
        this.spawnRingEffect(this.player.x, this.player.y, sweepRad, '#fb7185');
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= sweepRad + e.radius) {
            const { dmg, isCrit } = this.rollPlayerDamage(this.pendingLeapSweepMult, 0.2);
            this.damageEnemy(e, dmg, isCrit, '#fda4af');
          }
        }
      }
    }

    // Ghoul Blood Frenzy: Rhythmic, silky figure-8 alternating crescent slashes (zero camera/juke jitter!)
    if (this.player.bloodFrenzyTimer > 0) {
      this.player.bloodFrenzyTimer = Math.max(0, this.player.bloodFrenzyTimer - dt);
      if (this.player.bloodFrenzyTimer <= 0) {
        this.player.frenzyStacks = 0;
      } else {
        this.frenzySlashTimer -= dt;
        if (this.frenzySlashTimer <= 0) {
          const rank = Math.max(1, this.skillRanks.blood_frenzy || 1);
          const def = HERO_SKILLS.blood_frenzy;
          const mult = (def.baseMultiplier + (rank - 1) * def.rankMultiplier) * 1.32;
          const frenzyRad = def.range * (this.player.colossusTimer > 0 ? 1.25 : 1.0);
          const interval = Math.max(0.165, 0.245 - this.player.frenzyStacks * 0.009);
          this.frenzySlashTimer = interval;
          this.frenzySide = this.frenzySide === 1 ? -1 : 1;

          const target = this.findNearestEnemy(frenzyRad + 42);
          const baseAng = target
            ? Math.atan2(target.y - this.player.y, target.x - this.player.x)
            : this.player.facing;
          const slashAng = baseAng + this.frenzySide * 0.12;

          if (this.swordAnimTimer <= 0.06) {
            this.swordCastAngle = baseAng;
            this.player.swordAnim =
              this.frenzySide === 1 ? SwordAnimState.BASIC_1 : SwordAnimState.BASIC_2;
            this.swordAnimDuration = interval * 1.02;
            this.swordAnimTimer = interval * 1.02;
            this.targetAttackTwist = this.frenzySide * 0.85;
          }

          soundEngine.playSlash(1.16 + this.player.frenzyStacks * 0.02);
          this.spawnSlashWave(
            'feral_slash',
            this.player.x,
            this.player.y - 8,
            slashAng,
            frenzyRad * 0.86,
            Math.PI * 0.88,
            this.frenzySide,
            interval * 1.05,
            '#fff1f2',
            '#fb7185'
          );

          let hitAny = false;
          for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= frenzyRad + e.radius) {
              hitAny = true;
              const { dmg, isCrit } = this.rollPlayerDamage(mult, 0.1 + this.player.frenzyStacks * 0.02);
              this.damageEnemy(e, dmg, isCrit, '#fda4af');
            }
          }

          if (hitAny) {
            this.player.frenzyStacks = Math.min(10, this.player.frenzyStacks + 1);
          }
        }
      }
    }

    // Ghoul Carnage Unleashed Ultimate: Smoothly glides between enemies, planting soft crescent marks!
    if (this.carnageDashesLeft > 0) {
      this.carnageDashTimer -= dt;
      if (this.carnageDashTimer <= 0) {
        this.carnageDashesLeft -= 1;
        this.carnageDashTimer = 0.155;

        let chosen: EnemyEntity | null = null;
        let bestDist = 330;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
          const penalty = e.id === this.carnageLastTargetId ? 160 : 0;
          if (d <= 330 && d + penalty < bestDist + 160) {
            if (!chosen || d + penalty < bestDist) {
              bestDist = d + penalty;
              chosen = e;
            }
          }
        }

        const startX = this.player.x;
        const startY = this.player.y;
        let endX = startX;
        let endY = startY;
        const stepSide = this.carnageDashesLeft % 2 === 0 ? 1 : -1;
        let dashAng = this.player.facing + stepSide * 0.85;

        if (chosen) {
          this.carnageLastTargetId = chosen.id;
          dashAng = Math.atan2(chosen.y - startY, chosen.x - startX);
          const offsetAng = dashAng + stepSide * 0.55;
          const candX = chosen.x + Math.cos(offsetAng) * (chosen.radius + 24);
          const candY = chosen.y + Math.sin(offsetAng) * (chosen.radius + 24);
          if (this.isPointWalkable(candX, candY, 16)) {
            endX = candX;
            endY = candY;
          } else {
            const clamped = this.findFurthestWalkableAlongRay(startX, startY, chosen.x, chosen.y, 16);
            endX = clamped.x;
            endY = clamped.y;
          }
        } else {
          const candX = startX + Math.cos(dashAng) * 110;
          const candY = startY + Math.sin(dashAng) * 110;
          const clamped = this.findFurthestWalkableAlongRay(startX, startY, candX, candY, 16);
          endX = clamped.x;
          endY = clamped.y;
        }

        // Smooth 60fps interpolated blitz-glide instead of jarring 1-frame snap teleport!
        this.blitzStartX = startX;
        this.blitzStartY = startY;
        this.blitzTargetX = endX;
        this.blitzTargetY = endY;
        this.blitzDuration = 0.125;
        this.blitzTimer = 0.125;

        this.player.facing = dashAng;
        this.swordCastAngle = dashAng;
        this.targetAttackTwist = stepSide;
        this.player.swordAnim =
          stepSide === 1 ? SwordAnimState.BASIC_1 : SwordAnimState.BASIC_2;
        this.swordAnimDuration = 0.15;
        this.swordAnimTimer = 0.15;
        soundEngine.playSlash(1.2 + (this.carnageDashesLeft % 3) * 0.06);

        this.spawnGroundEffect(
          'carnage_dash_line',
          startX,
          startY - 4,
          endX,
          endY - 4,
          dashAng,
          90,
          0.3,
          '#fb7185',
          '#fff1f2'
        );
        this.spawnSlashWave(
          'feral_slash',
          endX,
          endY - 8,
          dashAng,
          80,
          Math.PI * 0.95,
          stepSide,
          0.22,
          '#fff1f2',
          '#f43f5e'
        );

        const markCenterX = chosen ? chosen.x : endX;
        const markCenterY = chosen ? chosen.y : endY;
        const { dmg: eruptDmg } = this.rollPlayerDamage(this.carnageMult * 0.56, 0.2);
        this.spawnDelayedClawMark(markCenterX, markCenterY, dashAng, 72, eruptDmg);

        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - endX, e.y - endY) <= 86 + e.radius) {
            const { dmg, isCrit } = this.rollPlayerDamage(this.carnageMult * 0.48, 0.22);
            this.damageEnemy(e, dmg, isCrit, '#fda4af');
          }
        }
      }
    }

    // Ghoul King of the Hunt Ultimate: Smooth shadow-glide pursuit from marked prey to marked prey!
    if (this.huntStrikesLeft > 0) {
      this.huntChainTimer -= dt;
      if (this.huntChainTimer <= 0) {
        let prey: EnemyEntity | null = null;
        let bestScore = 99999;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
          if (d > 480) continue;
          const hpRatio = e.hp / Math.max(1, e.maxHp);
          const markedBonus = e.preyMarkTimer > 0 ? -400 : 0;
          const score = markedBonus + hpRatio * 260 + d * 0.35;
          if (score < bestScore) {
            bestScore = score;
            prey = e;
          }
        }

        if (!prey) {
          this.huntStrikesLeft = 0;
        } else {
          this.huntStrikesLeft -= 1;
          this.huntChainTimer = 0.185;
          prey.preyMarkTimer = Math.max(prey.preyMarkTimer, 3.0);

          const startX = this.player.x;
          const startY = this.player.y;
          this.spawnGroundEffect(
            'shadow_smoke_ring',
            startX,
            startY,
            0,
            0,
            0,
            52,
            0.36,
            '#4c0519',
            '#fb7185'
          );

          const sideAng = this.huntStrikesLeft % 2 === 0 ? 0.32 : Math.PI - 0.32;
          const candX = prey.x + Math.cos(sideAng) * (prey.radius + 26);
          const candY = prey.y + Math.sin(sideAng) * (prey.radius + 20);
          let destX = startX;
          let destY = startY;
          if (this.isPointWalkable(candX, candY, 16)) {
            destX = candX;
            destY = candY;
          } else {
            const clamped = this.findFurthestWalkableAlongRay(startX, startY, prey.x, prey.y, 16);
            destX = clamped.x;
            destY = clamped.y;
          }

          this.blitzStartX = startX;
          this.blitzStartY = startY;
          this.blitzTargetX = destX;
          this.blitzTargetY = destY;
          this.blitzDuration = 0.135;
          this.blitzTimer = 0.135;

          const strikeAng = Math.atan2(prey.y - destY, prey.x - destX);
          this.player.facing = strikeAng;
          this.swordCastAngle = strikeAng;
          this.targetAttackTwist = this.huntStrikesLeft % 2 === 0 ? 1 : -1;
          this.player.swordAnim = SwordAnimState.KING_OF_THE_HUNT;
          this.swordAnimDuration = 0.18;
          this.swordAnimTimer = 0.18;
          soundEngine.playSlash(1.3);

          this.spawnSlashWave(
            'shadow_ambush',
            prey.x,
            prey.y - 8,
            strikeAng,
            76,
            Math.PI * 1.15,
            1,
            0.25,
            '#fff1f2',
            '#e11d48'
          );

          const executeBoost = prey.hp / Math.max(1, prey.maxHp) <= 0.45 ? 0.92 : 0.72;
          const { dmg, isCrit } = this.rollPlayerDamage(this.huntMult * executeBoost, 0.45);
          this.damageEnemy(prey, dmg, isCrit, '#fda4af');
        }
      }
    }

    if (this.player.ribShieldTimer > 0) {
      this.player.ribShieldTimer = Math.max(0, this.player.ribShieldTimer - dt);
      if (this.player.ribShieldTimer <= 0) {
        this.player.shield = 0;
      }
    }
    if (this.player.undyingTimer > 0) {
      this.player.undyingTimer = Math.max(0, this.player.undyingTimer - dt);
      this.undyingTickTimer -= dt;
      if (this.undyingTickTimer <= 0) {
        this.undyingTickTimer = 1.0;
        const rank = Math.max(1, this.skillRanks.undying_flesh || 1);
        const def = HERO_SKILLS.undying_flesh;
        const pct = def.baseMultiplier + (rank - 1) * def.rankMultiplier;
        this.healPlayer(Math.max(8, Math.round(this.player.maxHp * pct)), true);
        this.spawnRingEffect(this.player.x, this.player.y, 68, '#4ade80');
        this.spawnBurstParticles(this.player.x, this.player.y - 10, '#4ade80', 8, true);
      }
    }
    if (this.player.boneStormTimer > 0) {
      this.player.boneStormTimer = Math.max(0, this.player.boneStormTimer - dt);
      this.stormTickTimer -= dt;
      if (this.stormTickTimer <= 0) {
        this.stormTickTimer = 0.36;
        const rank = Math.max(1, this.skillRanks.bone_storm || 1);
        const def = HERO_SKILLS.bone_storm;
        const mult = def.baseMultiplier + (rank - 1) * def.rankMultiplier;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= def.range + e.radius) {
            const { dmg, isCrit } = this.rollPlayerDamage(mult, 0.05);
            this.damageEnemy(e, dmg, isCrit, '#67e8f9');
          }
        }
      }
    }

    for (const g of this.player.dashGhostTrail) {
      if (g.alpha > 0) g.alpha = Math.max(0, g.alpha - dt * 4.2);
    }

    if (this.runOutcome === 'defeat') return;

    // Smooth 60fps body lunge, twist & squash-and-stretch dynamics!
    if (this.swordAnimTimer > 0) {
      const sp = 1 - this.swordAnimTimer / Math.max(0.01, this.swordAnimDuration);
      const bell = Math.sin(sp * Math.PI);
      const desiredLunge = bell * (this.player.colossusTimer > 0 ? 1.15 : 0.85);
      const desiredTwist = Math.sin((sp - 0.3) * Math.PI) * this.targetAttackTwist;
      const desiredSquash = Math.sin(sp * Math.PI * 2) * (this.player.colossusTimer > 0 ? 0.085 : 0.055);
      const bodySpring = 1 - Math.exp(-28 * dt);
      this.player.attackLunge += (desiredLunge - this.player.attackLunge) * bodySpring;
      this.player.attackTwist += (desiredTwist - this.player.attackTwist) * bodySpring;
      this.player.attackSquash += (desiredSquash - this.player.attackSquash) * bodySpring;
    } else {
      const relax = 1 - Math.exp(-16 * dt);
      this.player.attackLunge += (0 - this.player.attackLunge) * relax;
      this.player.attackTwist += (0 - this.player.attackTwist) * relax;
      this.player.attackSquash += (0 - this.player.attackSquash) * relax;
    }

    // Apply decaying forward attack micro-stride smoothly at 60fps
    if (
      (Math.abs(this.attackImpulseVx) > 2 || Math.abs(this.attackImpulseVy) > 2) &&
      this.pounceTimer <= 0 &&
      this.dashTimer <= 0 &&
      this.blitzTimer <= 0 &&
      this.shadowStepTimer <= 0
    ) {
      this.tryMoveEntity(
        this.player.x,
        this.player.y,
        this.attackImpulseVx * dt,
        this.attackImpulseVy * dt,
        16,
        (nx, ny) => {
          this.player.x = nx;
          this.player.y = ny;
        }
      );
      const damp = Math.exp(-14 * dt);
      this.attackImpulseVx *= damp;
      this.attackImpulseVy *= damp;
    } else {
      this.attackImpulseVx = 0;
      this.attackImpulseVy = 0;
    }

    if (
      this.basicAttackHeld &&
      this.basicCooldown <= 0 &&
      this.pounceTimer <= 0 &&
      this.blitzTimer <= 0 &&
      this.player.possessingTimer <= 0 &&
      this.phantomDashTimer <= 0
    ) {
      this.triggerBasicAttack();
    }

    // Ghost Haunted Possession locks movement to host until eruption
    if (this.player.possessingTimer > 0) {
      this.player.walkPhase = 0;
    } else if (this.phantomDashTimer > 0) {
      // Ghost Phantom Dash: Fleeting mist glide phasing through obstacles & enemies while leaving spectral mist trail!
      this.phantomDashTimer = Math.max(0, this.phantomDashTimer - dt);
      const steps = 3;
      const stepDx = (this.phantomVx * dt) / steps;
      const stepDy = (this.phantomVy * dt) / steps;
      for (let s = 0; s < steps; s++) {
        this.tryMoveEntity(
          this.player.x,
          this.player.y,
          stepDx,
          stepDy,
          15,
          (nx, ny) => {
            this.player.x = nx;
            this.player.y = ny;
          },
          true // Ethereal mist phases cleanly through interior props!
        );
      }

      this.phantomMistNodeAccum += dt;
      if (this.phantomMistNodeAccum >= 0.055) {
        this.phantomMistNodeAccum = 0;
        this.spawnGroundEffect(
          'spectral_mist_node',
          this.player.x,
          this.player.y + 4,
          0,
          0,
          this.player.facing,
          44,
          1.85,
          '#2dd4bf',
          '#818cf8'
        );
      }

      for (const e of this.enemies) {
        if (e.hp <= 0 || this.dashHitIds.has(e.id)) continue;
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= 52 + e.radius) {
          this.dashHitIds.add(e.id);
          e.slowTimer = Math.max(e.slowTimer, 1.8);
          const { dmg, isCrit } = this.rollPlayerDamage(this.phantomMult, 0.14);
          this.damageEnemy(e, dmg, isCrit, '#5eead4');
          this.grantRestlessSpirit();
        }
      }
    } else if (this.blitzTimer > 0) {
      // Smooth 60fps Blitz-Glide (Carnage Unleashed & King of the Hunt)
      this.blitzTimer = Math.max(0, this.blitzTimer - dt);
      const t = 1 - this.blitzTimer / Math.max(0.01, this.blitzDuration);
      const smoothT = t * t * (3 - 2 * t);
      const nx = this.blitzStartX + (this.blitzTargetX - this.blitzStartX) * smoothT;
      const ny = this.blitzStartY + (this.blitzTargetY - this.blitzStartY) * smoothT;
      if (this.isPointWalkable(nx, ny, 15)) {
        this.player.x = nx;
        this.player.y = ny;
      }
      this.ghostSampleAccum += dt;
      if (this.ghostSampleAccum >= 0.04) {
        this.ghostSampleAccum = 0;
        for (const g of this.player.dashGhostTrail) {
          if (g.alpha <= 0.05) {
            g.x = this.player.x;
            g.y = this.player.y;
            g.alpha = 0.65;
            break;
          }
        }
      }
    } else if (this.pounceTimer > 0) {
      // Airborne Parabolic Leap (Ghoul Feral Pounce & Predator's Leap)
      this.pounceTimer = Math.max(0, this.pounceTimer - dt);
      const t = 1 - this.pounceTimer / Math.max(0.01, this.pounceDuration);
      const smoothT = 1 - Math.pow(1 - t, 1.65);
      const nx = this.pounceStartX + (this.pounceTargetX - this.pounceStartX) * smoothT;
      const ny = this.pounceStartY + (this.pounceTargetY - this.pounceStartY) * smoothT;
      if (this.isPointWalkable(nx, ny, 15)) {
        this.player.x = nx;
        this.player.y = ny;
      }
      const peakHeight = this.pounceIsPredatorLeap ? 76 : 40;
      this.player.airborneHeight = Math.sin(t * Math.PI) * peakHeight;

      this.ghostSampleAccum += dt;
      if (this.ghostSampleAccum >= 0.045) {
        this.ghostSampleAccum = 0;
        for (const g of this.player.dashGhostTrail) {
          if (g.alpha <= 0.05) {
            g.x = this.player.x;
            g.y = this.player.y - this.player.airborneHeight * 0.45;
            g.alpha = 0.72;
            break;
          }
        }
      }

      if (this.pounceTimer <= 0) {
        this.player.airborneHeight = 0;
        if (this.pounceIsTigerkin) {
          // Predator's Pounce: dual-claw crash impact upon landing!
          soundEngine.playFeralClaw(1.15, true);
          this.triggerShake(0.18, 5.0);
          this.spawnSlashWave(
            'crushing_paw_shock',
            this.player.x,
            this.player.y - 8,
            this.player.facing,
            this.pounceRadius * 1.25,
            Math.PI * 1.4,
            1,
            0.28,
            '#fef08a',
            '#f59e0b'
          );
          this.spawnGroundEffect(
            'tiger_crush_crater',
            this.player.x,
            this.player.y,
            0,
            0,
            this.player.facing,
            this.pounceRadius,
            1.2,
            '#f59e0b',
            '#fef08a'
          );
          this.spawnRingEffect(this.player.x, this.player.y, this.pounceRadius * 1.15, '#f59e0b');
          this.spawnBurstParticles(this.player.x, this.player.y - 8, '#fde047', 22, true);

          for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= this.pounceRadius + e.radius) {
              const { dmg, isCrit } = this.rollPlayerDamage(this.pounceMult, 0.25);
              this.damageEnemy(e, dmg, isCrit, '#f59e0b');
              if (e.hp > 0 && e.kind !== EnemyKind.TRAINING_DUMMY && !isBossKind(e.kind)) {
                e.staggerTimer = Math.max(e.staggerTimer, 1.1);
              }
            }
          }
          this.pounceIsTigerkin = false;
        } else if (this.pounceIsPredatorLeap) {
          // Predator's Leap crash-down shockwave + queued sweeping claw follow-up!
          soundEngine.playSkill('ultimate');
          this.triggerShake(0.22, 6.2);
          this.spawnGroundEffect(
            'predator_crater',
            this.player.x,
            this.player.y,
            0,
            0,
            this.player.facing,
            this.pounceRadius,
            1.45,
            '#f43f5e',
            '#fda4af'
          );
          this.spawnRingEffect(this.player.x, this.player.y, this.pounceRadius * 1.05, '#fb7185');
          this.spawnBurstParticles(this.player.x, this.player.y - 6, '#fda4af', 22, true);

          for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= this.pounceRadius + e.radius) {
              e.slowTimer = Math.max(e.slowTimer, 1.8);
              const { dmg, isCrit } = this.rollPlayerDamage(this.pounceMult * 0.62, 0.16);
              this.damageEnemy(e, dmg, isCrit, '#fb7185');
            }
          }
          // Immediate sweeping claw follow-up!
          this.pendingLeapSweepTimer = 0.12;
          this.pendingLeapSweepMult = this.pounceMult * 0.58;
        } else {
          // Feral Pounce impact: twin claw rend + knockback + pounce kill-reset mark!
          soundEngine.playSlash(1.18);
          this.triggerShake(0.14, 4.2);
          this.spawnSlashWave(
            'twin_rend',
            this.player.x + Math.cos(this.player.facing) * 14,
            this.player.y - 8 + Math.sin(this.player.facing) * 14,
            this.player.facing,
            this.pounceRadius * 1.25,
            Math.PI * 1.15,
            1,
            0.24,
            '#fff1f2',
            '#fb7185'
          );
          this.spawnRingEffect(this.player.x, this.player.y, this.pounceRadius * 1.15, '#fb7185');

          for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
            if (d <= this.pounceRadius + e.radius + 14) {
              // Mark enemy so if this pounce or follow-up strike defeats it, Feral Pounce immediately resets!
              e.pounceMarkTimer = 1.6;
              if (e.kind !== EnemyKind.TRAINING_DUMMY && !isBossKind(e.kind)) {
                const ka = Math.atan2(e.y - this.player.y, e.x - this.player.x);
                this.tryMoveEntity(e.x, e.y, Math.cos(ka) * 52, Math.sin(ka) * 52, e.radius, (knx, kny) => {
                  e.x = knx;
                  e.y = kny;
                });
              }
              const { dmg, isCrit } = this.rollPlayerDamage(this.pounceMult, 0.2);
              this.damageEnemy(e, dmg, isCrit, '#fda4af');
            }
          }
        }
      }
    } else if (this.dashTimer > 0) {
      // Dash movement (Skeletal Rush or Zombie Flesh Ripper)
      const prevX = this.player.x;
      const prevY = this.player.y;
      this.dashTimer -= dt;
      const steps = 3;
      const stepDx = (this.dashVx * dt) / steps;
      const stepDy = (this.dashVy * dt) / steps;
      for (let s = 0; s < steps; s++) {
        this.tryMoveEntity(this.player.x, this.player.y, stepDx, stepDy, 16, (nx, ny) => {
          this.player.x = nx;
          this.player.y = ny;
        });
      }

      const isRipper = this.dashSkillKind === 'flesh_ripper';
      if (isRipper && this.dashTimer <= 0) {
        this.spawnGroundEffect(
          'flesh_tear_track',
          this.dashStartX,
          this.dashStartY + 8,
          this.player.x,
          this.player.y + 8,
          this.player.facing,
          120,
          1.45,
          '#bef264',
          '#fb7185'
        );
      } else if (isRipper && Math.hypot(this.player.x - prevX, this.player.y - prevY) > 2) {
        if (Math.random() < 0.7) {
          this.spawnParticle({
            x: this.player.x + (Math.random() - 0.5) * 16,
            y: this.player.y + (Math.random() - 0.5) * 12,
            vx: (Math.random() - 0.5) * 65,
            vy: (Math.random() - 0.5) * 65,
            size: 4,
            endSize: 0,
            maxAge: 0.3,
            color: Math.random() < 0.5 ? '#fb7185' : '#a3e635',
            glow: true,
            shape: 'spark',
            rotation: this.player.facing,
            vRot: 4,
          });
        }
      }

      this.ghostSampleAccum += dt;
      if (this.ghostSampleAccum >= 0.045) {
        this.ghostSampleAccum = 0;
        for (const g of this.player.dashGhostTrail) {
          if (g.alpha <= 0.05) {
            g.x = this.player.x;
            g.y = this.player.y;
            g.alpha = 0.9;
            break;
          }
        }
      }

      const dashDef = HERO_SKILLS[this.dashSkillKind];
      const dashRank = Math.max(1, this.skillRanks[this.dashSkillKind] || 1);
      const dashMult = dashDef.baseMultiplier + (dashRank - 1) * dashDef.rankMultiplier;

      for (const e of this.enemies) {
        if (e.hp <= 0 || this.dashHitIds.has(e.id)) continue;
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= dashDef.radiusOrAngle + e.radius) {
          this.dashHitIds.add(e.id);
          const { dmg, isCrit } = this.rollPlayerDamage(dashMult, isRipper ? 0.12 : 0.25);
          if (isRipper) {
            e.slowTimer = Math.max(e.slowTimer, 2.0);
            this.spawnSlashWave(
              'triple_claw',
              e.x - Math.cos(this.player.facing) * 14,
              e.y - 8 - Math.sin(this.player.facing) * 14,
              this.player.facing,
              46,
              1.35,
              1,
              0.22,
              '#ecfccb',
              '#fb7185'
            );
            this.spawnSiphonBeam(e.x, e.y - 10, 0.38, '#4ade80');
            this.healPlayer(Math.max(5, Math.round(this.player.maxHp * 0.045)), false);
          }
          this.damageEnemy(e, dmg, isCrit, isRipper ? '#fb7185' : dashDef.glowColor);
        }
      }
    } else if (this.scrappersDashTimer > 0) {
      // Human Normal 3 (Scrapper's Dash): Quick dash swinging the pipe around & pushing caught enemies aside!
      this.scrappersDashTimer = Math.max(0, this.scrappersDashTimer - dt);
      const steps = 3;
      const stepDx = (this.scrappersDashVx * dt) / steps;
      const stepDy = (this.scrappersDashVy * dt) / steps;
      for (let s = 0; s < steps; s++) {
        this.tryMoveEntity(this.player.x, this.player.y, stepDx, stepDy, 16, (nx, ny) => {
          this.player.x = nx;
          this.player.y = ny;
        });
      }

      this.ghostSampleAccum += dt;
      if (this.ghostSampleAccum >= 0.045) {
        this.ghostSampleAccum = 0;
        for (const g of this.player.dashGhostTrail) {
          if (g.alpha <= 0.05) {
            g.x = this.player.x;
            g.y = this.player.y;
            g.alpha = 0.85;
            break;
          }
        }
      }

      const dashAng = Math.atan2(this.scrappersDashVy, this.scrappersDashVx);
      const dashDef = HERO_SKILLS.scrappers_dash;
      for (const e of this.enemies) {
        if (e.hp <= 0 || this.dashHitIds.has(e.id)) continue;
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= dashDef.radiusOrAngle + e.radius) {
          this.dashHitIds.add(e.id);
          soundEngine.playPipeClang(1.12, false);
          const { dmg, isCrit } = this.rollPlayerDamage(this.scrappersDashMult, 0.18);
          this.damageEnemy(e, dmg, isCrit, '#fb923c');

          // Shove caught enemies aside laterally perpendicular to the dash path!
          if (e.hp > 0 && e.kind !== EnemyKind.TRAINING_DUMMY) {
            const relX = e.x - this.player.x;
            const relY = e.y - this.player.y;
            const cross = Math.cos(dashAng) * relY - Math.sin(dashAng) * relX;
            const sideSign = cross >= 0 ? 1 : -1;
            const perpAng = dashAng + sideSign * (Math.PI * 0.45);
            const shove = isBossKind(e.kind) ? 16 : 62;
            this.tryMoveEntity(
              e.x,
              e.y,
              Math.cos(perpAng) * shove,
              Math.sin(perpAng) * shove,
              e.radius * 0.75,
              (nx, ny) => {
                e.x = nx;
                e.y = ny;
              }
            );
          }
        }
      }

      if (this.scrappersDashTimer <= 0) {
        this.spawnGroundEffect(
          'scrapper_skid_track',
          this.dashStartX,
          this.dashStartY + 8,
          this.player.x,
          this.player.y + 8,
          dashAng,
          96,
          1.2,
          '#fb923c',
          '#e2e8f0'
        );
      }
    } else if (this.windstepDashTimer > 0) {
      // Eaglekin Normal 4 (Windstep): Wing propulsion dash gliding rapidly with wind gust slipstream
      this.windstepDashTimer = Math.max(0, this.windstepDashTimer - dt);
      const steps = 3;
      const stepDx = (this.windstepDashVx * dt) / steps;
      const stepDy = (this.windstepDashVy * dt) / steps;
      for (let s = 0; s < steps; s++) {
        this.tryMoveEntity(this.player.x, this.player.y, stepDx, stepDy, 16, (nx, ny) => {
          this.player.x = nx;
          this.player.y = ny;
        });
      }

      this.ghostSampleAccum += dt;
      if (this.ghostSampleAccum >= 0.04) {
        this.ghostSampleAccum = 0;
        for (const g of this.player.dashGhostTrail) {
          if (g.alpha <= 0.05) {
            g.x = this.player.x;
            g.y = this.player.y;
            g.alpha = 0.85;
            break;
          }
        }
        const backAng = Math.atan2(-this.windstepDashVy, -this.windstepDashVx);
        this.spawnSoftMotes(this.player.x, this.player.y, backAng, 35, '#bae6fd', 3);
      }
    } else if (this.shadowStepTimer <= 0) {
      const mag = Math.hypot(this.joyX, this.joyY);
      if (mag > 0.06) {
        let speedMult = 1.0;
        if (this.heroId === 'human') {
          if (this.player.instinctSurrounded) {
            const survRank = Math.max(1, this.skillRanks.survivors_instinct || 1);
            speedMult += 0.16 + (survRank - 1) * 0.03;
          }
          if (this.player.oneManArmyTimer > 0) speedMult += 0.25;
        } else if (this.heroId === 'ghoul') {
          if (this.player.colossusTimer > 0) speedMult += 0.38;
          if (this.player.bloodFrenzyTimer > 0) speedMult += 0.12 + this.player.frenzyStacks * 0.03;
          if (this.player.momentumStacks > 0) {
            const momRank = Math.max(1, this.skillRanks.predators_momentum || 1);
            speedMult += this.player.momentumStacks * (0.032 + (momRank - 1) * 0.007);
          }
          if (this.hasNearbyVulnerablePrey(340)) {
            const instRank = Math.max(1, this.skillRanks.feral_instinct || 1);
            speedMult += 0.2 + (instRank - 1) * 0.04;
          }
        } else if (this.heroId === 'ghost') {
          if (this.player.nightmareTimer > 0) speedMult += 0.24;
          if (this.player.restlessStacks > 0) {
            const restRank = Math.max(1, this.skillRanks.restless_spirit || 1);
            speedMult += this.player.restlessStacks * (0.06 + (restRank - 1) * 0.015);
          }
        } else if (this.heroId === 'tigerkin') {
          if ((this.player.kingOfBeastsTimer || 0) > 0) speedMult += 0.32;
          if ((this.player.feralMomentumStacks || 0) > 0) {
            speedMult += (this.player.feralMomentumStacks || 0) * 0.04;
          }
          let hasPrey = false;
          for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            if (e.hp > 0 && e.kind !== EnemyKind.TRAINING_DUMMY && e.hp / Math.max(1, e.maxHp) <= 0.5) {
              if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= 340) {
                hasPrey = true;
                break;
              }
            }
          }
          if (hasPrey) {
            const preyRank = Math.max(1, this.skillRanks.predators_instinct || 1);
            speedMult += 0.22 + (preyRank - 1) * 0.04;
          }
        }
        const eqStats = equipmentManager.getComputedStats(this.heroId);
        const speed = this.moveSpeed * speedMult * eqStats.speedMultiplier * Math.min(1, mag);
        const dx = (this.joyX / mag) * speed * dt;
        const dy = (this.joyY / mag) * speed * dt;
        // Ghost's Ethereal Body allows phasing smoothly through interior obstacles (ignoreProps = true)!
        this.tryMoveEntity(
          this.player.x,
          this.player.y,
          dx,
          dy,
          16,
          (nx, ny) => {
            this.player.x = nx;
            this.player.y = ny;
          },
          this.heroId === 'ghost'
        );
        this.player.walkPhase += dt * (this.heroId === 'ghoul' || this.heroId === 'tigerkin' ? 13.5 : 11) * Math.min(1, mag);
        if (this.swordAnimTimer <= 0) {
          this.player.facing = Math.atan2(this.joyY, this.joyX);
        }
      } else {
        this.player.walkPhase = 0;
      }
    }

    if (this.map.isGuild && this.doorCooldown <= 0) {
      for (const prop of this.map.props) {
        if (prop.kind === 'door_dungeon') {
          if (
            this.player.x >= prop.x - 10 &&
            this.player.x <= prop.x + prop.w + 10 &&
            this.player.y <= prop.y + prop.h + 18
          ) {
            this.enterDungeon(1);
            return;
          }
        }
      }
    }
  }

  /**
   * Smooth S-curve swing easing with brief organic windup coil & cushioned follow-through
   */
  private smoothSwingCurve(p: number): number {
    if (p < 0.1) {
      return -0.06 * Math.sin((p / 0.1) * Math.PI * 0.5);
    }
    const u = (p - 0.1) / 0.9;
    const s = u * u * (3 - 2 * u);
    const whip = 1 - Math.pow(1 - u, 2.5);
    return -0.06 + 1.06 * (s * 0.35 + whip * 0.65);
  }

  private blendAngle(current: number, target: number, factor: number): number {
    const rawDiff = target - current;
    const diff = Number.isFinite(rawDiff) ? Math.atan2(Math.sin(rawDiff), Math.cos(rawDiff)) : 0;
    return current + diff * factor;
  }

  /**
   * 60fps Floating Hero Weapon choreography (Bone Sword, Rotting Claws, & Dual Feral Claws) + Independent Silk Ribbons
   */
  private updateFloatingSwordAndTrail(dt: number) {
    const isTransformed = this.player.colossusTimer > 0;
    const isZombie = this.heroId === 'zombie';
    const isGhoul = this.heroId === 'ghoul';
    const isGhost = this.heroId === 'ghost';
    const isTigerkin = this.heroId === 'tigerkin';
    const hasOffhandClaw = isGhoul || isTigerkin;
    // Eaglekin Sky Marksman has integrated feathered wings attached to its body (no floating weapon)
    if (this.heroId === 'eaglekin') {
      this.breakWeaponTrail();
      if (this.swordAnimTimer > 0) {
        this.swordAnimTimer = Math.max(0, this.swordAnimTimer - dt);
      }
      return;
    }

    // Bespoke Floating Astral Soul Lantern choreography for Ghost (pendulum hover & cast pulse, zero melee blade trail!)
    if (isGhost) {
      const hoverFloat = Math.sin(this.elapsedTime * 3.6) * 4.5;
      const sideAng = this.player.facing - 0.88;
      let lTargetX = this.player.x + Math.cos(sideAng) * 29;
      let lTargetY = this.player.y - 16 + Math.sin(sideAng) * 14 + hoverFloat;
      let lTargetScale = this.player.nightmareTimer > 0 ? 1.18 : 1.0;
      let lTargetAngle = Math.sin(this.elapsedTime * 3.2) * 0.14;

      if (this.swordAnimTimer > 0) {
        this.swordAnimTimer = Math.max(0, this.swordAnimTimer - dt);
        const p = 1 - this.swordAnimTimer / Math.max(0.01, this.swordAnimDuration);
        const bell = Math.sin(p * Math.PI);
        const castAng = this.swordCastAngle;
        if (
          this.player.swordAnim === SwordAnimState.SOUL_DRAIN ||
          this.player.swordAnim === SwordAnimState.WAILING_SCREAM ||
          this.player.swordAnim === SwordAnimState.ETERNAL_NIGHTMARE ||
          this.player.swordAnim === SwordAnimState.SPIRIT_LEGION
        ) {
          // Rise luminously above/around Ghost while channeling astral power
          const orbit = castAng + p * Math.PI * 2;
          lTargetX = this.player.x + Math.cos(orbit) * 32;
          lTargetY = this.player.y - 22 + Math.sin(orbit) * 18;
          lTargetScale = 1.28 + bell * 0.14;
          lTargetAngle = Math.sin(p * Math.PI * 2) * 0.25;
        } else {
          // Thrust lantern forward smoothly toward target to channel homing wisps or Spectral Bolt!
          const reach = 26 + bell * 16;
          lTargetX = this.player.x + Math.cos(castAng - 0.22) * reach;
          lTargetY = this.player.y - 15 + Math.sin(castAng - 0.22) * reach * 0.78;
          lTargetScale = 1.14 + bell * 0.14;
          lTargetAngle = Math.cos(castAng) * 0.22 * bell;
        }
        if (this.swordAnimTimer <= 0) {
          this.player.swordAnim = SwordAnimState.IDLE;
        }
      } else {
        this.player.swordGlowColor = this.player.nightmareTimer > 0 ? '#c084fc' : '#818cf8';
        this.player.swordGlowIntensity =
          this.player.nightmareTimer > 0 ? 1.05 : 0.42 + this.player.restlessStacks * 0.1;
      }

      const lanternSpring = 1 - Math.exp(-20 * dt);
      this.player.swordX += (lTargetX - this.player.swordX) * lanternSpring;
      this.player.swordY += (lTargetY - this.player.swordY) * lanternSpring;
      this.player.swordScale += (lTargetScale - this.player.swordScale) * lanternSpring;
      this.player.swordAngle = this.blendAngle(this.player.swordAngle, lTargetAngle, lanternSpring);
      return;
    }

    const baseScale = isTransformed ? (isGhoul ? 1.62 : 1.68) : isTigerkin && (this.player.kingOfBeastsTimer || 0) > 0 ? 1.28 : 1.0;
    const liftY = this.player.airborneHeight || 0;

    let targetX = this.player.x;
    let targetY = this.player.y - liftY - 10 * baseScale;
    let targetAngle = this.player.facing;
    let targetScale = baseScale;

    let offTargetX = this.player.x - 24 * baseScale;
    let offTargetY = this.player.y - liftY - 10 * baseScale;
    let offTargetAngle = this.player.facing;
    let emitOffhandTrail = false;

    let isEmittingTrail = false;
    let isSkillTrail = false;

    if (this.swordAnimTimer > 0) {
      this.swordAnimTimer = Math.max(0, this.swordAnimTimer - dt);
      const p = 1 - this.swordAnimTimer / Math.max(0.01, this.swordAnimDuration);
      const ease = this.smoothSwingCurve(p);
      const reachBell = Math.sin(p * Math.PI);
      const ang = this.swordCastAngle;
      // 2.5D perspective ellipse ratio so wide transformed swings look natural and organic
      const perspY = 0.82;
      isEmittingTrail = true;

      if (this.player.swordAnim === SwordAnimState.BASIC_1) {
        const arcSpan = isTransformed ? 3.15 : 2.85;
        const swing = -arcSpan * 0.5 + ease * arcSpan;
        const orbit = ang + swing;
        const r = (36 + reachBell * (isTransformed ? 14 : 8)) * baseScale;
        targetX = this.player.x + Math.cos(orbit) * r;
        targetY = this.player.y - liftY - 10 * baseScale + Math.sin(orbit) * r * perspY;
        targetAngle = orbit + 0.36;
        // Offhand claw coils smoothly on left flank ready for seamless BASIC_2 entry!
        const backAng = ang + 1.35 + ease * 0.22;
        offTargetX = this.player.x + Math.cos(backAng) * (26 * baseScale);
        offTargetY = this.player.y - liftY - 11 * baseScale + Math.sin(backAng) * (18 * baseScale);
        offTargetAngle = backAng - 0.35;
        targetScale = baseScale * (1.08 + reachBell * 0.1);
      } else if (this.player.swordAnim === SwordAnimState.BASIC_2) {
        const arcSpan = isTransformed ? 3.15 : 2.85;
        if (isGhoul) {
          // Ghoul BASIC_2 sweeps smoothly with LEFT offhand claw while right claw flows back!
          const recoilAng = ang + 1.25 - ease * 2.55;
          targetX = this.player.x + Math.cos(recoilAng) * (25 * baseScale);
          targetY = this.player.y - liftY - 11 * baseScale + Math.sin(recoilAng) * (18 * baseScale);
          targetAngle = recoilAng + 0.25;

          const swing = arcSpan * 0.5 - ease * arcSpan;
          const orbit = ang + swing;
          const r = (37 + reachBell * (isTransformed ? 14 : 8)) * baseScale;
          offTargetX = this.player.x + Math.cos(orbit) * r;
          offTargetY = this.player.y - liftY - 10 * baseScale + Math.sin(orbit) * r * perspY;
          offTargetAngle = orbit - 0.36;
          isEmittingTrail = false;
          emitOffhandTrail = true;
          targetScale = baseScale * (1.1 + reachBell * 0.1);
        } else {
          const swing = arcSpan * 0.5 - ease * arcSpan;
          const orbit = ang + swing;
          const r = (36 + reachBell * (isTransformed ? 14 : 8)) * baseScale;
          targetX = this.player.x + Math.cos(orbit) * r;
          targetY = this.player.y - liftY - 10 * baseScale + Math.sin(orbit) * r * perspY;
          targetAngle = orbit - 0.36;
          targetScale = baseScale * (1.08 + reachBell * 0.1);
        }
      } else if (this.player.swordAnim === SwordAnimState.BASIC_3) {
        if (isGhoul) {
          // Smooth converging twin-crescent sweep with both claws
          const r = (39 + reachBell * 15) * baseScale;
          const orbitR = ang - 1.38 + ease * 2.76;
          const orbitL = ang + 1.38 - ease * 2.76;
          targetX = this.player.x + Math.cos(orbitR) * r;
          targetY = this.player.y - liftY - 10 * baseScale + Math.sin(orbitR) * r * perspY;
          targetAngle = orbitR + 0.3;
          offTargetX = this.player.x + Math.cos(orbitL) * r;
          offTargetY = this.player.y - liftY - 10 * baseScale + Math.sin(orbitL) * r * perspY;
          offTargetAngle = orbitL - 0.3;
          emitOffhandTrail = true;
          isSkillTrail = true;
          targetScale = baseScale * (1.18 + reachBell * 0.1);
        } else {
          const orbit = ang - Math.PI * 0.92 + ease * Math.PI * 2.1;
          const r = (42 + reachBell * 16) * baseScale;
          targetX = this.player.x + Math.cos(orbit) * r;
          targetY = this.player.y - liftY - 10 * baseScale + Math.sin(orbit) * r * perspY;
          targetAngle = orbit + 0.32;
          targetScale = baseScale * (1.2 + reachBell * 0.12);
          isSkillTrail = true;
        }
      } else if (this.player.swordAnim === SwordAnimState.BASIC_4) {
        // 360° Silk Whirl with dual opposite claws gliding smoothly around body
        const spin = ang - Math.PI * 0.9 + ease * Math.PI * 2.15;
        const r = (44 + reachBell * 15) * baseScale;
        targetX = this.player.x + Math.cos(spin) * r;
        targetY = this.player.y - liftY - 10 * baseScale + Math.sin(spin) * r * perspY;
        targetAngle = spin + 0.45;
        offTargetX = this.player.x + Math.cos(spin + Math.PI) * r;
        offTargetY = this.player.y - liftY - 10 * baseScale + Math.sin(spin + Math.PI) * r * perspY;
        offTargetAngle = spin + Math.PI + 0.45;
        emitOffhandTrail = true;
        isSkillTrail = true;
        targetScale = baseScale * (1.24 + reachBell * 0.1);
      } else if (
        this.player.swordAnim === SwordAnimState.RENDING_CLAWS ||
        this.player.swordAnim === SwordAnimState.BLOOD_FRENZY ||
        this.player.swordAnim === SwordAnimState.CARNAGE_UNLEASHED
      ) {
        // Smooth, rhythmic alternating figure-8 claw flow (no high-frequency jitter!)
        const flurry = p * Math.PI * 2.2;
        const r = (44 + reachBell * 8) * baseScale;
        const orbitR = ang + Math.sin(flurry) * 1.32;
        const orbitL = ang + Math.sin(flurry + Math.PI) * 1.32;
        targetX = this.player.x + Math.cos(orbitR) * r;
        targetY = this.player.y - liftY - 10 * baseScale + Math.sin(orbitR) * r * perspY;
        targetAngle = orbitR + 0.28;
        offTargetX = this.player.x + Math.cos(orbitL) * r;
        offTargetY = this.player.y - liftY - 10 * baseScale + Math.sin(orbitL) * r * perspY;
        offTargetAngle = orbitL - 0.28;
        emitOffhandTrail = true;
        isSkillTrail = true;
        targetScale = baseScale * 1.28;
      } else if (
        this.player.swordAnim === SwordAnimState.FERAL_POUNCE ||
        this.player.swordAnim === SwordAnimState.PREDATORS_LEAP ||
        this.player.swordAnim === SwordAnimState.SHADOW_STALKER ||
        this.player.swordAnim === SwordAnimState.KING_OF_THE_HUNT
      ) {
        // Smooth converging predator crescent strike
        const snap = -1.05 + ease * 1.75;
        const r = (44 + reachBell * 8) * baseScale;
        const orbitR = ang + snap;
        const orbitL = ang - snap;
        targetX = this.player.x + Math.cos(orbitR) * r;
        targetY = this.player.y - liftY - 10 * baseScale + Math.sin(orbitR) * r * perspY;
        targetAngle = orbitR + 0.22;
        offTargetX = this.player.x + Math.cos(orbitL) * r;
        offTargetY = this.player.y - liftY - 10 * baseScale + Math.sin(orbitL) * r * perspY;
        offTargetAngle = orbitL - 0.22;
        emitOffhandTrail = true;
        isSkillTrail = true;
        targetScale = baseScale * 1.34;
      } else if (this.player.swordAnim === SwordAnimState.BONE_SLASH) {
        const swing = -1.7 + ease * 3.4;
        const orbit = ang + swing;
        const r = 50 * baseScale;
        targetX = this.player.x + Math.cos(orbit) * r;
        targetY = this.player.y - liftY - 10 * baseScale + Math.sin(orbit) * r * perspY;
        targetAngle = orbit + 0.3;
        targetScale = baseScale * 1.36;
        isSkillTrail = true;
      } else if (this.player.swordAnim === SwordAnimState.ROTTING_CLAW) {
        let swing = 0;
        let dir = 1;
        if (p < 0.34) {
          const sub = this.smoothSwingCurve(p / 0.34);
          swing = -1.55 + sub * 3.1;
          dir = 1;
        } else if (p < 0.68) {
          const sub = this.smoothSwingCurve((p - 0.34) / 0.34);
          swing = 1.55 - sub * 3.1;
          dir = -1;
        } else {
          const sub = this.smoothSwingCurve((p - 0.68) / 0.32);
          swing = -Math.PI + sub * Math.PI * 2.05;
          dir = 1;
        }
        const orbit = ang + swing;
        const r = 48 * baseScale;
        targetX = this.player.x + Math.cos(orbit) * r;
        targetY = this.player.y - liftY - 10 * baseScale + Math.sin(orbit) * r * perspY;
        targetAngle = orbit + 0.24 * dir;
        targetScale = baseScale * 1.38;
        isSkillTrail = true;
      } else if (this.player.swordAnim === SwordAnimState.BONE_SPEAR) {
        const thrust = p < 0.4 ? -10 * (p / 0.4) : -10 + ((p - 0.4) / 0.6) * 58;
        targetX = this.player.x + Math.cos(ang) * (26 + thrust);
        targetY = this.player.y - liftY - 10 * baseScale + Math.sin(ang) * (26 + thrust);
        targetAngle = p < 0.4 ? ang + (p / 0.4) * Math.PI * 2 : ang;
        targetScale = baseScale * 1.24;
        isSkillTrail = true;
      } else if (
        this.player.swordAnim === SwordAnimState.SKELETAL_RUSH ||
        this.player.swordAnim === SwordAnimState.FLESH_RIPPER
      ) {
        targetX = this.player.x + Math.cos(ang) * 40;
        targetY = this.player.y - liftY - 8 * baseScale + Math.sin(ang) * 40;
        targetAngle = ang;
        targetScale = baseScale * 1.32;
        isSkillTrail = true;
      } else if (this.player.swordAnim === SwordAnimState.REAPERS_JUDGMENT) {
        const swing = -1.9 + ease * 3.8;
        const orbit = ang + swing;
        const r = 62 * baseScale;
        targetX = this.player.x + Math.cos(orbit) * r;
        targetY = this.player.y - liftY - 12 * baseScale + Math.sin(orbit) * r * perspY;
        targetAngle = orbit + 0.45;
        targetScale = baseScale * 1.6;
        isSkillTrail = true;
      } else if (this.player.swordAnim === SwordAnimState.DEATHS_EMBRACE) {
        const orbit = ang - Math.PI * 0.8 + ease * Math.PI * 2.6;
        const r = (36 + reachBell * 30) * baseScale;
        targetX = this.player.x + Math.cos(orbit) * r;
        targetY = this.player.y - liftY - 14 * baseScale + Math.sin(orbit) * r * perspY;
        targetAngle = orbit + 0.4;
        targetScale = baseScale * 1.48;
        isSkillTrail = true;
      } else if (this.player.swordAnim === SwordAnimState.PIPE_SWING) {
        const swing = -1.65 + ease * 3.3;
        const orbit = ang + swing;
        const r = 48 * baseScale;
        targetX = this.player.x + Math.cos(orbit) * r;
        targetY = this.player.y - liftY - 10 * baseScale + Math.sin(orbit) * r * perspY;
        targetAngle = orbit + 0.35;
        targetScale = baseScale * 1.28;
      } else if (this.player.swordAnim === SwordAnimState.HEADCRACKER || this.player.swordAnim === SwordAnimState.LAST_STAND_SLAM) {
        // Hoist old pipe high overhead during windup, then slam violently downward!
        if (p < 0.38) {
          const up = p / 0.38;
          targetX = this.player.x - Math.cos(ang) * 8;
          targetY = this.player.y - (32 + up * 16) * baseScale;
          targetAngle = -Math.PI * 0.65 - up * 0.25;
          targetScale = baseScale * (1.15 + up * 0.22);
        } else {
          const slam = this.smoothSwingCurve((p - 0.38) / 0.62);
          targetX = this.player.x + Math.cos(ang) * (10 + slam * 38);
          targetY = this.player.y + (-42 + slam * 44) * baseScale + Math.sin(ang) * (slam * 26);
          targetAngle = ang + (-1.1 + slam * 1.3);
          targetScale = baseScale * 1.38;
        }
      } else if (
        this.player.swordAnim === SwordAnimState.SCRAPPERS_DASH ||
        this.player.swordAnim === SwordAnimState.ONE_MAN_ARMY_SPIN
      ) {
        const spin = ang + p * Math.PI * (this.player.swordAnim === SwordAnimState.ONE_MAN_ARMY_SPIN ? 6 : 3);
        const r = 46 * baseScale;
        targetX = this.player.x + Math.cos(spin) * r;
        targetY = this.player.y - liftY - 10 * baseScale + Math.sin(spin) * r * perspY;
        targetAngle = spin + Math.PI * 0.45;
        targetScale = baseScale * 1.32;
      } else if (this.player.swordAnim === SwordAnimState.TIGER_SAVAGE_CLAW) {
        // Savage Claw: swift forward slash with right claw, offhand claw coils ready
        const arcSpan = 2.9;
        const swing = -arcSpan * 0.5 + ease * arcSpan;
        const orbit = ang + swing;
        const r = (38 + reachBell * 10) * baseScale;
        targetX = this.player.x + Math.cos(orbit) * r;
        targetY = this.player.y - liftY - 10 * baseScale + Math.sin(orbit) * r * perspY;
        targetAngle = orbit + 0.38;
        const backAng = ang + 1.28 + ease * 0.25;
        offTargetX = this.player.x + Math.cos(backAng) * (26 * baseScale);
        offTargetY = this.player.y - liftY - 11 * baseScale + Math.sin(backAng) * (18 * baseScale);
        offTargetAngle = backAng - 0.32;
        targetScale = baseScale * (1.12 + reachBell * 0.12);
        isEmittingTrail = true;
      } else if (this.player.swordAnim === SwordAnimState.TIGER_REND) {
        // Tiger's Rend: devastating cross-slash with both claws converging
        const r = (42 + reachBell * 14) * baseScale;
        const orbitR = ang - 1.4 + ease * 2.8;
        const orbitL = ang + 1.4 - ease * 2.8;
        targetX = this.player.x + Math.cos(orbitR) * r;
        targetY = this.player.y - liftY - 10 * baseScale + Math.sin(orbitR) * r * perspY;
        targetAngle = orbitR + 0.32;
        offTargetX = this.player.x + Math.cos(orbitL) * r;
        offTargetY = this.player.y - liftY - 10 * baseScale + Math.sin(orbitL) * r * perspY;
        offTargetAngle = orbitL - 0.32;
        emitOffhandTrail = true;
        isEmittingTrail = true;
        isSkillTrail = true;
        targetScale = baseScale * (1.2 + reachBell * 0.12);
      } else if (this.player.swordAnim === SwordAnimState.RENDING_FLURRY) {
        // Rending Flurry: rapid alternating 5 strikes
        const flurry = p * Math.PI * 3.5;
        const r = (44 + reachBell * 8) * baseScale;
        const orbitR = ang + Math.sin(flurry) * 1.35;
        const orbitL = ang + Math.sin(flurry + Math.PI) * 1.35;
        targetX = this.player.x + Math.cos(orbitR) * r;
        targetY = this.player.y - liftY - 10 * baseScale + Math.sin(orbitR) * r * perspY;
        targetAngle = orbitR + 0.28;
        offTargetX = this.player.x + Math.cos(orbitL) * r;
        offTargetY = this.player.y - liftY - 10 * baseScale + Math.sin(orbitL) * r * perspY;
        offTargetAngle = orbitL - 0.28;
        emitOffhandTrail = true;
        isEmittingTrail = true;
        isSkillTrail = true;
        targetScale = baseScale * 1.25;
      } else if (this.player.swordAnim === SwordAnimState.TIGERS_ROAR) {
        // Tiger's Roar: both claws spread wide in terrifying roar stance
        const spread = 1.35 + Math.sin(p * Math.PI) * 0.4;
        const r = (40 + Math.sin(p * Math.PI) * 12) * baseScale;
        targetX = this.player.x + Math.cos(ang - spread) * r;
        targetY = this.player.y - liftY - 12 * baseScale + Math.sin(ang - spread) * r * perspY;
        targetAngle = ang - spread * 0.8;
        offTargetX = this.player.x + Math.cos(ang + spread) * r;
        offTargetY = this.player.y - liftY - 12 * baseScale + Math.sin(ang + spread) * r * perspY;
        offTargetAngle = ang + spread * 0.8;
        emitOffhandTrail = true;
        isEmittingTrail = true;
        isSkillTrail = true;
        targetScale = baseScale * (1.18 + Math.sin(p * Math.PI) * 0.2);
      } else if (this.player.swordAnim === SwordAnimState.SAVAGE_PURSUIT) {
        // Savage Pursuit: both claws forward ripping through path
        targetX = this.player.x + Math.cos(ang - 0.38) * (36 * baseScale);
        targetY = this.player.y - liftY - 10 * baseScale + Math.sin(ang - 0.38) * (28 * baseScale);
        targetAngle = ang + 0.15;
        offTargetX = this.player.x + Math.cos(ang + 0.38) * (36 * baseScale);
        offTargetY = this.player.y - liftY - 10 * baseScale + Math.sin(ang + 0.38) * (28 * baseScale);
        offTargetAngle = ang - 0.15;
        emitOffhandTrail = true;
        isEmittingTrail = true;
        isSkillTrail = true;
        targetScale = baseScale * 1.3;
      } else if (this.player.swordAnim === SwordAnimState.CRUSHING_PAW) {
        // Crushing Paw: right claw raised high and slamming into the ground
        if (p < 0.4) {
          const up = p / 0.4;
          targetX = this.player.x + Math.cos(ang - 0.4) * (24 * baseScale);
          targetY = this.player.y - (28 + up * 18) * baseScale;
          targetAngle = -Math.PI * 0.5 - up * 0.3;
          offTargetX = this.player.x + Math.cos(ang + 0.9) * (24 * baseScale);
          offTargetY = this.player.y - liftY - 8 * baseScale + Math.sin(ang + 0.9) * 16;
          offTargetAngle = ang + 0.5;
        } else {
          const slam = this.smoothSwingCurve((p - 0.4) / 0.6);
          targetX = this.player.x + Math.cos(ang) * (20 + slam * 24);
          targetY = this.player.y + (-38 + slam * 46) * baseScale;
          targetAngle = ang + 0.6;
          offTargetX = this.player.x + Math.cos(ang + 0.8) * (26 * baseScale);
          offTargetY = this.player.y - liftY - 6 * baseScale + Math.sin(ang + 0.8) * 16;
          offTargetAngle = ang + 0.4;
        }
        targetScale = baseScale * 1.35;
        isEmittingTrail = true;
        isSkillTrail = true;
      } else if (this.player.swordAnim === SwordAnimState.KING_OF_BEASTS) {
        // King of Beasts: feral roar stance, claws glowing fiery amber/solar
        const pulse = Math.sin(p * Math.PI * 2);
        targetX = this.player.x + Math.cos(ang - 1.1) * (34 + pulse * 6);
        targetY = this.player.y - liftY - 16 * baseScale + Math.sin(ang - 1.1) * 20;
        targetAngle = ang - 0.8;
        offTargetX = this.player.x + Math.cos(ang + 1.1) * (34 + pulse * 6);
        offTargetY = this.player.y - liftY - 16 * baseScale + Math.sin(ang + 1.1) * 20;
        offTargetAngle = ang + 0.8;
        emitOffhandTrail = true;
        isEmittingTrail = true;
        isSkillTrail = true;
        targetScale = baseScale * (1.25 + Math.sin(p * Math.PI) * 0.25);
      } else if (this.player.swordAnim === SwordAnimState.HEAVENLY_TIGER) {
        // Heavenly Tiger: claws thrust forward summoning the great spectral tiger
        const thrust = Math.sin(p * Math.PI) * 32;
        targetX = this.player.x + Math.cos(ang - 0.32) * (28 + thrust);
        targetY = this.player.y - liftY - 10 * baseScale + Math.sin(ang - 0.32) * (28 + thrust);
        targetAngle = ang;
        offTargetX = this.player.x + Math.cos(ang + 0.32) * (28 + thrust);
        offTargetY = this.player.y - liftY - 10 * baseScale + Math.sin(ang + 0.32) * (28 + thrust);
        offTargetAngle = ang;
        emitOffhandTrail = true;
        isEmittingTrail = true;
        isSkillTrail = true;
        targetScale = baseScale * 1.35;
      } else if (this.player.swordAnim === SwordAnimState.APEX_DEVASTATION_RISE) {
        // Apex Devastation: claws raised high overhead while airborne
        targetX = this.player.x - 12;
        targetY = this.player.y - liftY - 28 * baseScale;
        targetAngle = -Math.PI * 0.65;
        offTargetX = this.player.x + 12;
        offTargetY = this.player.y - liftY - 28 * baseScale;
        offTargetAngle = -Math.PI * 0.35;
        emitOffhandTrail = true;
        isEmittingTrail = true;
        isSkillTrail = true;
        targetScale = baseScale * 1.35;
      } else if (this.player.swordAnim === SwordAnimState.APEX_DEVASTATION_SLAM) {
        // Apex Devastation: massive dive claw strike
        const slamR = 38 * baseScale;
        targetX = this.player.x + Math.cos(ang - 0.25) * slamR;
        targetY = this.player.y - liftY + Math.sin(ang - 0.25) * slamR;
        targetAngle = ang + 0.4;
        offTargetX = this.player.x + Math.cos(ang + 0.25) * slamR;
        offTargetY = this.player.y - liftY + Math.sin(ang + 0.25) * slamR;
        offTargetAngle = ang - 0.4;
        emitOffhandTrail = true;
        isEmittingTrail = true;
        isSkillTrail = true;
        targetScale = baseScale * 1.45;
      } else {
        const orbit = ang + ease * Math.PI * 2.0;
        targetX = this.player.x + Math.cos(orbit) * 42 * baseScale;
        targetY = this.player.y - liftY - 12 * baseScale + Math.sin(orbit) * 32 * baseScale;
        targetAngle = orbit + Math.PI * 0.4;
        offTargetX = this.player.x + Math.cos(orbit + Math.PI) * 42 * baseScale;
        offTargetY = this.player.y - liftY - 12 * baseScale + Math.sin(orbit + Math.PI) * 32 * baseScale;
        offTargetAngle = orbit + Math.PI * 1.4;
        if (hasOffhandClaw) emitOffhandTrail = true;
        targetScale = baseScale * 1.28;
        isSkillTrail = true;
      }

      // Human emits a smooth metallic amber kinetic trail during weapon swings!
      if (this.heroId === 'human') {
        this.player.swordGlowColor = this.comboStep === 3 ? '#f97316' : '#fb923c';
      }

      // High-responsiveness 60fps spring blend eliminates ALL 1-frame snapping between swings & idle!
      const activeSpring = 1 - Math.exp(-34 * dt);
      this.player.swordX += (targetX - this.player.swordX) * activeSpring;
      this.player.swordY += (targetY - this.player.swordY) * activeSpring;
      this.player.swordAngle = this.blendAngle(this.player.swordAngle, targetAngle, activeSpring);
      this.player.swordScale += (targetScale - this.player.swordScale) * activeSpring;

      if (hasOffhandClaw) {
        this.player.offhandX += (offTargetX - this.player.offhandX) * activeSpring;
        this.player.offhandY += (offTargetY - this.player.offhandY) * activeSpring;
        this.player.offhandAngle = this.blendAngle(this.player.offhandAngle, offTargetAngle, activeSpring);
      }

      if (this.swordAnimTimer <= 0) {
        this.player.isScytheForm = false;
        this.player.swordAnim = SwordAnimState.IDLE;
      }
    } else if (this.player.boneStormTimer > 0) {
      const orbit = this.elapsedTime * 8.5;
      const stormX = this.player.x + Math.cos(orbit) * 58;
      const stormY = this.player.y - 10 + Math.sin(orbit) * 58;
      const spring = 1 - Math.exp(-26 * dt);
      this.player.swordX += (stormX - this.player.swordX) * spring;
      this.player.swordY += (stormY - this.player.swordY) * spring;
      this.player.swordAngle = this.blendAngle(this.player.swordAngle, orbit + Math.PI * 0.55, spring);
      this.player.swordScale += (baseScale * 1.22 - this.player.swordScale) * spring;
      this.player.swordGlowColor = '#67e8f9';
      this.player.swordGlowIntensity = 1.1;
      isEmittingTrail = true;
      isSkillTrail = true;
    } else {
      // Independent floating hover beside armless chibi body!
      const sideAng = this.player.facing - (hasOffhandClaw ? 1.05 : 0.85);
      const hoverY = Math.sin(this.elapsedTime * 3.8) * 3.8;
      targetX = this.player.x + Math.cos(sideAng) * (27 * baseScale);
      targetY = this.player.y - liftY - 11 * baseScale + Math.sin(sideAng) * (15 * baseScale) + hoverY;
      targetAngle = hasOffhandClaw
        ? this.player.facing - 0.18 + Math.sin(this.elapsedTime * 4.2) * 0.1
        : isZombie
          ? this.player.facing * 0.15 - Math.PI * 0.18 + Math.sin(this.elapsedTime * 3.1) * 0.1
          : -Math.PI * 0.32 + Math.sin(this.elapsedTime * 2.6) * 0.08;

      const spring = 1 - Math.exp(-16 * dt);
      this.player.swordX += (targetX - this.player.swordX) * spring;
      this.player.swordY += (targetY - this.player.swordY) * spring;
      this.player.swordAngle = this.blendAngle(this.player.swordAngle, targetAngle, spring);
      this.player.swordScale += (baseScale - this.player.swordScale) * spring;

      if (hasOffhandClaw) {
        const leftAng = this.player.facing + 1.05;
        const hoverY2 = Math.cos(this.elapsedTime * 3.8) * 3.8;
        const ox = this.player.x + Math.cos(leftAng) * (27 * baseScale);
        const oy = this.player.y - liftY - 11 * baseScale + Math.sin(leftAng) * (15 * baseScale) + hoverY2;
        const oAng = this.player.facing + 0.18 - Math.sin(this.elapsedTime * 4.2) * 0.1;

        this.player.offhandX += (ox - this.player.offhandX) * spring;
        this.player.offhandY += (oy - this.player.offhandY) * spring;
        this.player.offhandAngle = this.blendAngle(this.player.offhandAngle, oAng, spring);
      }

      this.player.swordGlowIntensity =
        isTransformed || this.player.ambushReady || this.player.lastStandTimer > 0 || this.player.oneManArmyTimer > 0 || (isTigerkin && (this.player.kingOfBeastsTimer || 0) > 0)
          ? 1.0
          : isTigerkin
            ? 0.38 + (this.player.feralMomentumStacks || 0) * 0.12
            : 0.32;
      this.player.swordGlowColor =
        this.heroId === 'human'
          ? this.player.lastStandTimer > 0
            ? '#fde047'
            : '#fb923c'
          : isTigerkin
            ? (this.player.kingOfBeastsTimer || 0) > 0
              ? '#fbbf24'
              : '#f59e0b'
          : isGhoul
            ? this.player.ambushReady
              ? '#e11d48'
              : isTransformed
                ? '#f43f5e'
                : '#fb7185'
            : isZombie
              ? isTransformed
                ? '#c084fc'
                : '#a3e635'
              : isTransformed
                ? '#fbbf24'
                : '#67e8f9';

      if (isTransformed && Math.hypot(this.joyX, this.joyY) > 0.25) {
        isEmittingTrail = true;
        if (hasOffhandClaw) emitOffhandTrail = true;
      }
    }

    if (isEmittingTrail || emitOffhandTrail) {
      this.trailSampleAccum += dt;
      if (this.trailSampleAccum >= 0.012) {
        this.trailSampleAccum = 0;
        const tipLen =
          (this.player.isScytheForm
            ? 50
            : isZombie || isGhoul || isTigerkin
              ? 32
              : this.heroId === 'human'
                ? 44
                : 40) * this.player.swordScale;
        const baseLen = 7 * this.player.swordScale;
        const coreColor =
          isTigerkin
            ? '#fef08a'
            : isGhoul
              ? '#fff1f2'
              : isZombie
                ? '#ecfccb'
                : this.heroId === 'human'
                  ? '#fef3c7'
                  : '#ffffff';

        if (isEmittingTrail) {
          const cos = Math.cos(this.player.swordAngle);
          const sin = Math.sin(this.player.swordAngle);
          const tipX = this.player.swordX + cos * tipLen;
          const tipY = this.player.swordY + sin * tipLen;
          const baseX = this.player.swordX + cos * baseLen;
          const baseY = this.player.swordY + sin * baseLen;
          this.pushSwordTrailPoint(
            tipX,
            tipY,
            baseX,
            baseY,
            coreColor,
            this.player.swordGlowColor,
            isSkillTrail,
            0
          );
          if (isSkillTrail && Math.random() < (isGhoul || isTigerkin ? 0.35 : 0.65)) {
            this.spawnParticle({
              x: tipX + (Math.random() - 0.5) * 6,
              y: tipY + (Math.random() - 0.5) * 6,
              vx: (Math.random() - 0.5) * 32,
              vy: (Math.random() - 0.5) * 32 - 10,
              size: 2.8 + Math.random() * 2.0,
              endSize: 0,
              maxAge: 0.28 + Math.random() * 0.14,
              color: Math.random() < 0.3 ? '#ffffff' : this.player.swordGlowColor,
              glow: true,
              shape: isGhoul || isZombie || isTigerkin ? 'circle' : 'spark',
              rotation: Math.random() * Math.PI,
              vRot: (Math.random() - 0.5) * 4,
            });
          }
        }

        if (emitOffhandTrail && hasOffhandClaw) {
          const cos2 = Math.cos(this.player.offhandAngle);
          const sin2 = Math.sin(this.player.offhandAngle);
          const tipX2 = this.player.offhandX + cos2 * tipLen;
          const tipY2 = this.player.offhandY + sin2 * tipLen;
          const baseX2 = this.player.offhandX + cos2 * baseLen;
          const baseY2 = this.player.offhandY + sin2 * baseLen;
          this.pushSwordTrailPoint(
            tipX2,
            tipY2,
            baseX2,
            baseY2,
            isTigerkin ? '#fef08a' : '#fff1f2',
            this.player.swordGlowColor,
            isSkillTrail,
            1
          );
        }
      }
    }

    for (let i = 0; i < this.swordTrail.length; i++) {
      const pt = this.swordTrail[i];
      if (!pt.active) continue;
      pt.age += dt;
      if (pt.age >= pt.maxAge) {
        pt.active = false;
      }
    }
  }

  private updateMinions(dt: number) {
    for (let i = this.minions.length - 1; i >= 0; i--) {
      const m = this.minions[i];
      m.lifeTimer -= dt;
      if (m.lifeTimer <= 0 || m.hp <= 0) {
        this.spawnBurstParticles(
          m.x,
          m.y,
          m.style === 'ghost' ? '#818cf8' : m.style === 'zombie' ? '#84cc16' : '#4ade80',
          8,
          true
        );
        this.minions.splice(i, 1);
        continue;
      }

      if (m.spawnTimer > 0) {
        m.spawnTimer = Math.max(0, m.spawnTimer - dt);
        continue;
      }

      if (m.attackAnimTimer > 0) {
        m.attackAnimTimer = Math.max(0, m.attackAnimTimer - dt);
      }

      if (m.weaponSwing !== 0) {
        m.weaponSwing *= Math.pow(0.02, dt);
        if (Math.abs(m.weaponSwing) < 0.03) m.weaponSwing = 0;
      }

      let target: EnemyEntity | null = null;
      let bestDist = 480;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - m.x, e.y - m.y);
        if (d < bestDist) {
          bestDist = d;
          target = e;
        }
      }

      if (target) {
        const ang = Math.atan2(target.y - m.y, target.x - m.x);
        m.facing = ang;
        if (bestDist > target.radius + 28) {
          const spd = (m.style === 'ghost' ? 202 : m.style === 'zombie' ? 168 : 174) * dt;
          // Slight separation between allied summons so hordes fan out cleanly around enemies!
          let sepX = 0;
          let sepY = 0;
          for (let j = 0; j < this.minions.length; j++) {
            if (i === j) continue;
            const o = this.minions[j];
            const od = Math.hypot(m.x - o.x, m.y - o.y);
            if (od > 0.1 && od < 22) {
              sepX += ((m.x - o.x) / od) * 0.65;
              sepY += ((m.y - o.y) / od) * 0.65;
            }
          }
          const dirX = Math.cos(ang) + sepX;
          const dirY = Math.sin(ang) + sepY;
          const norm = Math.hypot(dirX, dirY) || 1;
          this.tryMoveEntity(
            m.x,
            m.y,
            (dirX / norm) * spd,
            (dirY / norm) * spd,
            12,
            (nx, ny) => {
              m.x = nx;
              m.y = ny;
            },
            m.style === 'ghost'
          );
          m.walkPhase += dt * 13.5;
        } else {
          m.attackTimer -= dt;
          if (m.attackTimer <= 0) {
            m.attackTimer = m.style === 'ghost' ? 0.52 : m.style === 'zombie' ? 0.56 : 0.6;
            m.attackAnimDuration = 0.26;
            m.attackAnimTimer = 0.26;
            m.comboSide = m.comboSide === 1 ? -1 : 1;
            m.weaponSwing = 1.45 * m.comboSide;

            if (m.style === 'ghost') {
              // Eternal Nightmare Apparition VFX: Astral burst + continuous fear spread!
              this.spawnGroundEffect(
                'astral_nova',
                target.x,
                target.y - 6,
                0,
                0,
                ang,
                38,
                0.26,
                '#818cf8',
                '#2dd4bf'
              );
              if (target.kind !== EnemyKind.TRAINING_DUMMY && !isBossKind(target.kind)) {
                target.fearTimer = Math.max(target.fearTimer, 1.05);
              }
            } else if (m.style === 'zombie') {
              // Zombie Summon Attack VFX: Twin venomous claw slash wave + toxic acid splatter!
              target.slowTimer = Math.max(target.slowTimer, 1.3);
              this.spawnSlashWave(
                'minion_claw',
                m.x + Math.cos(ang) * 10,
                m.y - 8 + Math.sin(ang) * 10,
                ang,
                34,
                1.45,
                m.comboSide,
                0.22,
                '#ecfccb',
                '#84cc16'
              );
              this.spawnArcBurst(target.x, target.y, ang, 22, '#a3e635', 5);
            } else {
              // Skeleton Minion Attack VFX: Crisp spectral emerald blade arc!
              this.spawnSlashWave(
                'blade_arc',
                m.x + Math.cos(ang) * 8,
                m.y - 8 + Math.sin(ang) * 8,
                ang,
                32,
                1.35,
                m.comboSide,
                0.2,
                '#ecfdf5',
                '#4ade80'
              );
            }

            this.damageEnemy(
              target,
              m.atk,
              false,
              m.style === 'ghost' ? '#a5b4fc' : m.style === 'zombie' ? '#a3e635' : '#86efac'
            );
          }
        }
      } else {
        const distToHero = Math.hypot(this.player.x - m.x, this.player.y - m.y);
        if (distToHero > 64) {
          const ang = Math.atan2(this.player.y - m.y, this.player.x - m.x);
          m.facing = ang;
          const spd = (m.style === 'ghost' ? 190 : 160) * dt;
          this.tryMoveEntity(
            m.x,
            m.y,
            Math.cos(ang) * spd,
            Math.sin(ang) * spd,
            12,
            (nx, ny) => {
              m.x = nx;
              m.y = ny;
            },
            m.style === 'ghost'
          );
          m.walkPhase += dt * 11;
        } else {
          m.walkPhase = 0;
        }
      }
    }
  }

  private updateEnemies(dt: number) {
    let bossAlive = false;

    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.armorCrackTimer > 0) e.armorCrackTimer = Math.max(0, e.armorCrackTimer - dt);
      if (e.slowTimer > 0) e.slowTimer = Math.max(0, e.slowTimer - dt);
      if (e.attackAnimTimer > 0) e.attackAnimTimer = Math.max(0, e.attackAnimTimer - dt);
      if (e.preyMarkTimer > 0) e.preyMarkTimer = Math.max(0, e.preyMarkTimer - dt);
      if (e.pounceMarkTimer > 0) e.pounceMarkTimer = Math.max(0, e.pounceMarkTimer - dt);
      if (e.fearTimer > 0) e.fearTimer = Math.max(0, e.fearTimer - dt);
      if (e.possessedTimer > 0) e.possessedTimer = Math.max(0, e.possessedTimer - dt);
      if (e.staggerTimer > 0) e.staggerTimer = Math.max(0, e.staggerTimer - dt);
      if (e.bossTransformTimer && e.bossTransformTimer > 0) e.bossTransformTimer = Math.max(0, e.bossTransformTimer - dt);
      if (e.bossBuffTimer && e.bossBuffTimer > 0) e.bossBuffTimer = Math.max(0, e.bossBuffTimer - dt);
      if (e.bossStealthTimer && e.bossStealthTimer > 0) e.bossStealthTimer = Math.max(0, e.bossStealthTimer - dt);
      if (e.bossScytheTimer && e.bossScytheTimer > 0) e.bossScytheTimer = Math.max(0, e.bossScytheTimer - dt);
      if (e.activeAuraTimer && e.activeAuraTimer > 0) e.activeAuraTimer = Math.max(0, e.activeAuraTimer - dt);

      // Tick lingering poison
      if (e.poisonTimer > 0) {
        e.poisonTimer = Math.max(0, e.poisonTimer - dt);
        e.poisonTickAccum += dt;
        if (e.poisonTickAccum >= 0.5) {
          e.poisonTickAccum -= 0.5;
          const pDmg = Math.max(1, Math.round(e.poisonDps * 0.5));
          this.damageEnemyFromPoisonTick(e, pDmg);
          if (e.hp <= 0) continue;
        }

        // Plaguebound 4-pc: Plague Incarnate (periodic toxic burst every 2s)
        if (equipmentManager.hasFourPieceBonus(this.heroId, 'plaguebound')) {
          e.plagueBurstAccum = (e.plagueBurstAccum || 0) + dt;
          if (e.plagueBurstAccum >= 2.0) {
            e.plagueBurstAccum -= 2.0;
            this.spawnToxicBurst(e.x, e.y, Math.round(this.getEffectiveAtk() * 0.4));
          }
        }
      }

      if (e.weaponSwing !== 0) {
        e.weaponSwing *= Math.pow(0.03, dt);
        if (Math.abs(e.weaponSwing) < 0.03) e.weaponSwing = 0;
      }

      if (e.kind === EnemyKind.TRAINING_DUMMY) {
        if (e.hp < e.maxHp * 0.5) e.hp = e.maxHp;
        continue;
      }

      if (isBossKind(e.kind)) {
        bossAlive = true;
      }

      if (this.isMultiplayer) {
        // Server authoritatively steps enemy movement, targeting, windups, and attacks
        const moveSpd = Math.hypot(e.vx, e.vy);
        if (moveSpd > 6) {
          e.walkPhase += dt * 9.5;
        } else {
          e.walkPhase = 0;
        }
        continue;
      }

      // Haunted Possession AI: Possessed enemy aggressively chases & strikes its own nearby allies!
      if (e.possessedTimer > 0) {
        e.windupTimer = 0;
        let allyTarget: EnemyEntity | null = null;
        let bestAllyDist = 420;
        for (const other of this.enemies) {
          if (other.id === e.id || other.hp <= 0) continue;
          const od = Math.hypot(other.x - e.x, other.y - e.y);
          if (od < bestAllyDist) {
            bestAllyDist = od;
            allyTarget = other;
          }
        }
        if (allyTarget) {
          const angToAlly = Math.atan2(allyTarget.y - e.y, allyTarget.x - e.x);
          e.facing = angToAlly;
          if (bestAllyDist > e.radius + allyTarget.radius + 14) {
            const pStep = e.speed * 1.45 * dt;
            this.tryMoveEntity(
              e.x,
              e.y,
              Math.cos(angToAlly) * pStep,
              Math.sin(angToAlly) * pStep,
              e.radius * 0.75,
              (nx, ny) => {
                e.x = nx;
                e.y = ny;
              }
            );
            e.walkPhase += dt * 13;
          } else {
            e.attackCooldown = Math.max(0, e.attackCooldown - dt);
            if (e.attackCooldown <= 0) {
              e.attackCooldown = 0.55;
              e.weaponSwing = 1.65;
              e.attackAnimDuration = 0.25;
              e.attackAnimTimer = 0.25;
              this.damageEnemy(allyTarget, Math.max(8, Math.round(e.atk * 1.6)), false, '#c084fc');
            }
          }
        } else {
          // Erratically stagger around in spiritual disruption if isolated
          const wobbleAng = this.elapsedTime * 5.2 + e.id;
          const pStep = e.speed * 0.85 * dt;
          e.facing = wobbleAng;
          this.tryMoveEntity(
            e.x,
            e.y,
            Math.cos(wobbleAng) * pStep,
            Math.sin(wobbleAng) * pStep,
            e.radius * 0.75,
            (nx, ny) => {
              e.x = nx;
              e.y = ny;
            }
          );
          e.walkPhase += dt * 10;
        }
        continue;
      }

      // Wailing Scream / Eternal Nightmare Fear AI: Frightened enemy flees away from Ghost!
      if (e.fearTimer > 0) {
        e.windupTimer = 0;
        const fleeAng = Math.atan2(e.y - this.player.y, e.x - this.player.x);
        e.facing = fleeAng;
        const fleeMult = isBossKind(e.kind) ? 0.55 : 1.08;
        const fStep = e.speed * fleeMult * dt;
        this.tryMoveEntity(
          e.x,
          e.y,
          Math.cos(fleeAng) * fStep,
          Math.sin(fleeAng) * fStep,
          e.radius * 0.75,
          (nx, ny) => {
            e.x = nx;
            e.y = ny;
          }
        );
        e.walkPhase += dt * 12;
        continue;
      }

      // Staggered enemies (from Human's Headcracker, Last Stand, or Improvised Fighter) reel in place with interrupted attacks!
      if (e.staggerTimer > 0) {
        e.windupTimer = 0;
        e.walkPhase = 0;
        continue;
      }

      // When Ghost is inside a possessed host, non-possessed enemies pause windups against the hidden Ghost
      if (this.player.possessingTimer > 0) {
        e.walkPhase = 0;
        continue;
      }

      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 560) {
        e.walkPhase = 0;
        continue;
      }

      const angToPlayer = Math.atan2(dy, dx);
      // Infectious Touch weakens enemy outgoing attacks by 15%
      const enemyAtk = e.poisonTimer > 0 ? Math.max(1, Math.round(e.atk * 0.85)) : e.atk;

      if (e.windupTimer > 0) {
        // Track player smoothly during early Marrow Archer aim, lock during final release
        if (e.kind === EnemyKind.ARCHER && e.windupTimer > e.windupDuration * 0.35) {
          e.windupAngle = angToPlayer;
        }
        e.windupTimer -= dt;
        if (e.windupTimer <= 0) {
          e.weaponSwing = 1.65;
          const isBoss = isBossKind(e.kind);

          if (e.windupType === 'slash') {
            e.attackAnimDuration = 0.25;
            e.attackAnimTimer = 0.25;
            e.comboCount = ((e.comboCount || 0) % 3) + 1;
            const comboDir: 1 | -1 = e.comboCount === 2 ? -1 : 1;

            if (e.isLegionBoss && e.legionHeroId === 'skeleton') {
              // Corrupted Skeleton Basic Attack: Authentic Floating Bone Sword slash!
              soundEngine.playSlash(1.18);
              const arcRadius = e.radius + (e.bossTransformTimer && e.bossTransformTimer > 0 ? 86 : 68);
              this.spawnSlashWave('blade_arc', e.x, e.y - 8, e.windupAngle, arcRadius, 1.5, comboDir, 0.24, '#ffffff', '#67e8f9');
              this.spawnArcBurst(e.x, e.y, e.windupAngle, arcRadius - 8, '#67e8f9', 9);
              let diff = angToPlayer - e.windupAngle;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              if (dist <= arcRadius + 8 && (Math.abs(diff) <= 0.85 || dist <= e.radius + 24)) {
                const masteryCrit = e.comboCount === 3 ? 1.25 : 1.0; // Bone Mastery 3rd-hit empowerment
                this.damagePlayer(Math.round(enemyAtk * masteryCrit));
              }
            } else if (e.isLegionBoss && e.legionHeroId === 'zombie') {
              // Corrupted Zombie Basic Attack: Authentic Rotting Claws + Carrion Hunger & Infectious Touch!
              soundEngine.playSlash(0.95);
              const arcRadius = e.radius + (e.bossTransformTimer && e.bossTransformTimer > 0 ? 84 : 66);
              this.spawnSlashWave(
                e.comboCount === 3 ? 'cross_claw' : 'triple_claw',
                e.x,
                e.y - 8,
                e.windupAngle,
                arcRadius,
                1.5,
                comboDir,
                0.24,
                '#ecfccb',
                e.bossTransformTimer && e.bossTransformTimer > 0 ? '#c084fc' : '#a3e635'
              );
              let diff = angToPlayer - e.windupAngle;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              if (dist <= arcRadius + 8 && (Math.abs(diff) <= 0.85 || dist <= e.radius + 24)) {
                this.damagePlayer(enemyAtk);
                // Carrion Hunger Passive: restores vitality on claw hit
                e.hp = Math.min(e.maxHp, e.hp + Math.round(enemyAtk * 0.45));
              }
            } else if (e.isLegionBoss && e.legionHeroId === 'ghoul') {
              // Corrupted Ghoul Basic Attack: Authentic Dual Feral Claws + Feral Instinct!
              soundEngine.playSlash(1.25);
              const arcRadius = e.radius + (e.bossTransformTimer && e.bossTransformTimer > 0 ? 82 : 66);
              this.spawnSlashWave(
                e.comboCount === 3 ? 'twin_rend' : 'feral_slash',
                e.x,
                e.y - 8,
                e.windupAngle,
                arcRadius,
                1.5,
                comboDir,
                0.22,
                '#fff1f2',
                '#fb7185'
              );
              let diff = angToPlayer - e.windupAngle;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              if (dist <= arcRadius + 8 && (Math.abs(diff) <= 0.85 || dist <= e.radius + 24)) {
                const feralBoost = this.player.hp / Math.max(1, this.player.maxHp) <= 0.45 ? 1.2 : 1.0;
                this.damagePlayer(Math.round(enemyAtk * feralBoost));
              }
            } else {
              soundEngine.playSlash(1.28);
              const arcRadius = isBoss ? e.radius + 68 : e.radius + 44;
              this.spawnSlashWave(
                isBoss ? 'boss_cleave' : 'enemy_slash',
                e.x,
                e.y - 8,
                e.windupAngle,
                arcRadius,
                1.45,
                1,
                0.22,
                '#ffe4e6',
                isBoss ? '#f43f5e' : '#fb7185'
              );
              this.spawnArcBurst(e.x, e.y, e.windupAngle, arcRadius - 8, isBoss ? '#f43f5e' : '#fb7185', 8);

              let diff = angToPlayer - e.windupAngle;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              if (dist <= arcRadius + 8 && (Math.abs(diff) <= 0.85 || dist <= e.radius + 24)) {
                this.damagePlayer(enemyAtk);
              } else if (this.heroId === 'ghost' && dist <= arcRadius + 60) {
                this.grantRestlessSpirit();
              }
            }
          } else if (e.windupType === 'whirlwind') {
            // 360° Whirlwind attack
            const whirlRad = isBoss ? 130 : e.radius + 56;
            e.attackAnimDuration = 0.32;
            e.attackAnimTimer = 0.32;
            soundEngine.playSlash(1.1);
            this.triggerShake(isBoss ? 0.18 : 0.08, isBoss ? 4.5 : 2.5);
            this.spawnSlashWave(
              'feral_whirl',
              e.x,
              e.y - 8,
              e.windupAngle,
              whirlRad,
              Math.PI * 1.95,
              1,
              0.26,
              '#ffe4e6',
              isBoss ? '#f43f5e' : '#fb7185'
            );
            this.spawnRingEffect(e.x, e.y, whirlRad, isBoss ? '#f43f5e' : '#fb7185');
            if (dist <= whirlRad + 12) {
              this.damagePlayer(Math.round(enemyAtk * 1.2));
            }
          } else if (e.windupType === 'thrust') {
            // High-speed piercing thrust
            e.attackAnimDuration = 0.28;
            e.attackAnimTimer = 0.28;
            soundEngine.playSlash(1.4);
            const reach = isBoss ? 160 : 110;
            const tx = e.x + Math.cos(e.windupAngle) * reach;
            const ty = e.y + Math.sin(e.windupAngle) * reach;
            this.tryMoveEntity(e.x, e.y, Math.cos(e.windupAngle) * (reach * 0.4), Math.sin(e.windupAngle) * (reach * 0.4), e.radius, (nx, ny) => {
              e.x = nx;
              e.y = ny;
            });
            this.spawnSlashWave('twin_rend', e.x, e.y - 8, e.windupAngle, reach * 0.7, 0.8, 1, 0.2, '#ffffff', '#fb7185');
            let diff = angToPlayer - e.windupAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff -= Math.PI * 2;
            if (dist <= reach && Math.abs(diff) <= 0.42) {
              this.damagePlayer(Math.round(enemyAtk * 1.25));
            }
          } else if (e.windupType === 'slam') {
            const slamRad = isBoss ? 135 : 78;
            e.attackAnimDuration = 0.34;
            e.attackAnimTimer = 0.34;
            this.triggerShake(isBoss ? 0.24 : 0.14, isBoss ? 6.5 : 3.8);

            const hitX = e.x + (isBoss ? 0 : Math.cos(e.windupAngle) * 18);
            const hitY = e.y + (isBoss ? 0 : Math.sin(e.windupAngle) * 14);
            this.spawnGroundEffect(
              'enemy_slam_crack',
              hitX,
              hitY,
              0,
              0,
              e.windupAngle,
              slamRad * 0.92,
              1.35,
              isBoss ? '#fb7185' : '#f97316',
              '#fde047'
            );
            if (isBoss) {
              this.spawnSlashWave(
                'boss_cleave',
                e.x,
                e.y - 10,
                e.windupAngle,
                slamRad * 0.9,
                Math.PI * 1.4,
                1,
                0.28,
                '#fef2f2',
                '#f43f5e'
              );
            }
            this.spawnRingEffect(e.x, e.y, slamRad, isBoss ? '#f43f5e' : '#f97316');
            this.spawnBurstParticles(hitX, hitY, isBoss ? '#fb7185' : '#fdba74', 16, true);

            if (dist <= slamRad + 14) {
              this.damagePlayer(Math.round(enemyAtk * 1.25));
            } else if (this.heroId === 'ghost' && dist <= slamRad + 85) {
              this.grantRestlessSpirit();
            }
          } else if (e.windupType === 'shockwave_line') {
            // Earth Shaker travelling ground crack line
            e.attackAnimDuration = 0.36;
            e.attackAnimTimer = 0.36;
            this.triggerShake(0.18, 4.8);
            const lineLen = isBoss ? 280 : 220;
            const endX = e.x + Math.cos(e.windupAngle) * lineLen;
            const endY = e.y + Math.sin(e.windupAngle) * lineLen;
            this.spawnGroundEffect(
              'enemy_slam_crack',
              e.x,
              e.y,
              endX,
              endY,
              e.windupAngle,
              lineLen,
              1.4,
              '#f97316',
              '#fde047'
            );
            this.spawnBurstParticles(endX, endY, '#f97316', 12, true);
            let diff = angToPlayer - e.windupAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff -= Math.PI * 2;
            if (dist <= lineLen && Math.abs(diff) <= 0.38) {
              this.damagePlayer(Math.round(enemyAtk * 1.3));
            }
          } else if (e.windupType === 'nova') {
            e.attackAnimDuration = 0.38;
            e.attackAnimTimer = 0.38;
            this.triggerShake(0.2, 5.2);
            this.spawnSlashWave(
              'boss_cleave',
              e.x,
              e.y - 10,
              e.windupAngle,
              86,
              Math.PI * 1.95,
              1,
              0.3,
              '#fef2f2',
              '#fb7185'
            );
            const count = isBoss ? 10 : 6;
            for (let k = 0; k < count; k++) {
              const sa = e.windupAngle + (k * Math.PI * 2) / count;
              this.spawnProjectile({
                fromPlayer: false,
                kind: 'boss_shard',
                x: e.x + Math.cos(sa) * 24,
                y: e.y + Math.sin(sa) * 24,
                vx: Math.cos(sa) * 265,
                vy: Math.sin(sa) * 265,
                angle: sa,
                radius: 10,
                damage: enemyAtk,
                isCrit: false,
                pierce: false,
                maxLife: 1.9,
                color: '#fb7185',
              });
            }
          } else if (e.windupType === 'shoot') {
            e.attackAnimDuration = 0.22;
            e.attackAnimTimer = 0.22;
            const bowX = e.x + Math.cos(e.windupAngle) * 22;
            const bowY = e.y - 6 + Math.sin(e.windupAngle) * 22;
            this.spawnBurstParticles(bowX, bowY, '#bef264', 6, true);
            this.spawnProjectile({
              fromPlayer: false,
              kind: e.kind === EnemyKind.MINI_GHOST || e.kind === EnemyKind.BOSS_LEGION_GHOST ? 'spectral_bolt' : 'enemy_arrow',
              x: bowX,
              y: bowY,
              vx: Math.cos(e.windupAngle) * 320,
              vy: Math.sin(e.windupAngle) * 320,
              angle: e.windupAngle,
              radius: 8,
              damage: enemyAtk,
              isCrit: false,
              pierce: false,
              maxLife: 1.6,
              color: e.kind === EnemyKind.MINI_GHOST || e.kind === EnemyKind.BOSS_LEGION_GHOST ? '#38bdf8' : '#bef264',
            });
          } else if (e.windupType === 'volley') {
            // Triple Arrow Volley
            e.attackAnimDuration = 0.24;
            e.attackAnimTimer = 0.24;
            const bowX = e.x + Math.cos(e.windupAngle) * 22;
            const bowY = e.y - 6 + Math.sin(e.windupAngle) * 22;
            this.spawnBurstParticles(bowX, bowY, '#bef264', 8, true);
            for (const offset of [-0.28, 0, 0.28]) {
              const va = e.windupAngle + offset;
              this.spawnProjectile({
                fromPlayer: false,
                kind: 'enemy_arrow',
                x: bowX,
                y: bowY,
                vx: Math.cos(va) * 300,
                vy: Math.sin(va) * 300,
                angle: va,
                radius: 7,
                damage: Math.round(enemyAtk * 0.85),
                isCrit: false,
                pierce: false,
                maxLife: 1.6,
                color: '#bef264',
              });
            }
          } else if (e.windupType === 'poison_lob') {
            // Lobbed mortar acid cyst that creates poison zone
            e.attackAnimDuration = 0.3;
            e.attackAnimTimer = 0.3;
            const targetX = e.x + Math.cos(e.windupAngle) * Math.min(dist, 160);
            const targetY = e.y + Math.sin(e.windupAngle) * Math.min(dist, 160);
            this.spawnGroundEffect('plague_crater', targetX, targetY, 0, 0, 0, 52, 1.4, '#84cc16', '#bef264');
            this.spawnToxicCloud(targetX, targetY, 55, 3.8, Math.round(enemyAtk * 0.45), false);
            this.spawnBurstParticles(targetX, targetY, '#a3e635', 12, true);
            if (Math.hypot(this.player.x - targetX, this.player.y - targetY) <= 55) {
              this.damagePlayer(Math.round(enemyAtk * 0.9));
            }
          } else if (e.windupType === 'cross_slash') {
            // Twin X-Rend Cleave + Piercing Crescent Shockwave
            e.attackAnimDuration = 0.3;
            e.attackAnimTimer = 0.3;
            soundEngine.playSlash(1.32);
            this.triggerShake(0.14, 3.8);
            const crossRad = isBoss ? 115 : 78;
            this.spawnSlashWave(
              'twin_rend',
              e.x,
              e.y - 8,
              e.windupAngle - 0.3,
              crossRad,
              1.45,
              1,
              0.24,
              '#ffe4e6',
              '#e11d48'
            );
            this.spawnSlashWave(
              'twin_rend',
              e.x,
              e.y - 8,
              e.windupAngle + 0.3,
              crossRad,
              1.45,
              -1,
              0.24,
              '#fef2f2',
              '#fb7185'
            );
            this.spawnProjectile({
              fromPlayer: false,
              kind: 'boss_shard',
              x: e.x + Math.cos(e.windupAngle) * 24,
              y: e.y + Math.sin(e.windupAngle) * 24,
              vx: Math.cos(e.windupAngle) * 320,
              vy: Math.sin(e.windupAngle) * 320,
              angle: e.windupAngle,
              radius: 10,
              damage: Math.round(enemyAtk * 0.95),
              isCrit: false,
              pierce: false,
              maxLife: 1.4,
              color: '#f43f5e',
            });
            let diff = angToPlayer - e.windupAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            if (dist <= crossRad + 12 && (Math.abs(diff) <= 0.92 || dist <= e.radius + 26)) {
              this.damagePlayer(Math.round(enemyAtk * 1.25));
            } else if (this.heroId === 'ghost' && dist <= crossRad + 70) {
              this.grantRestlessSpirit();
            }
          } else if (e.windupType === 'frost_nova') {
            // Chilling Graveyard Frost Ring + Radial Ice Bolts
            const frostRad = isBoss ? 140 : 96;
            e.attackAnimDuration = 0.36;
            e.attackAnimTimer = 0.36;
            soundEngine.playSkill('shield');
            this.triggerShake(0.16, 4.2);
            this.spawnGroundEffect('astral_nova', e.x, e.y, 0, 0, 0, frostRad, 1.35, '#38bdf8', '#818cf8');
            this.spawnRingEffect(e.x, e.y, frostRad, '#38bdf8');
            this.spawnBurstParticles(e.x, e.y, '#bae6fd', 18, true);
            const count = isBoss ? 10 : 6;
            for (let k = 0; k < count; k++) {
              const sa = e.windupAngle + (k * Math.PI * 2) / count;
              this.spawnProjectile({
                fromPlayer: false,
                kind: 'spectral_bolt',
                x: e.x + Math.cos(sa) * 22,
                y: e.y + Math.sin(sa) * 22,
                vx: Math.cos(sa) * 235,
                vy: Math.sin(sa) * 235,
                angle: sa,
                radius: 8,
                damage: Math.round(enemyAtk * 0.85),
                isCrit: false,
                pierce: false,
                maxLife: 1.7,
                color: '#38bdf8',
              });
            }
            if (dist <= frostRad + 10) {
              this.damagePlayer(Math.round(enemyAtk * 1.15));
            }
          } else if (e.windupType === 'dash' || e.windupType === 'charge') {
            e.attackAnimDuration = 0.3;
            e.attackAnimTimer = 0.3;
            const startX = e.x;
            const startY = e.y;
            const step = e.windupType === 'charge' ? 160 : 190;
            this.placeEnemySafely(
              e,
              e.x + Math.cos(e.windupAngle) * step,
              e.y + Math.sin(e.windupAngle) * step
            );
            this.spawnGroundEffect(
              'flesh_tear_track',
              startX,
              startY + 10,
              e.x,
              e.y + 10,
              e.windupAngle,
              120,
              0.9,
              '#fb7185',
              '#fde68a'
            );
            this.spawnSlashWave(
              'boss_cleave',
              e.x,
              e.y - 10,
              e.windupAngle,
              76,
              1.5,
              1,
              0.26,
              '#fef2f2',
              '#f43f5e'
            );
            if (Math.hypot(this.player.x - e.x, this.player.y - e.y) <= e.radius + 48) {
              this.damagePlayer(Math.round(enemyAtk * 1.15));
            }
          } else if (e.windupType === 'pounce') {
            // Feral pounce leap
            e.attackAnimDuration = 0.32;
            e.attackAnimTimer = 0.32;
            const px = e.x + Math.cos(e.windupAngle) * Math.min(dist, 140);
            const py = e.y + Math.sin(e.windupAngle) * Math.min(dist, 140);
            this.placeEnemySafely(e, px, py);
            this.triggerShake(0.15, 4.0);
            this.spawnGroundEffect('predator_crater', e.x, e.y, 0, 0, 0, 50, 1.2, '#f43f5e', '#fb7185');
            this.spawnSlashWave('twin_rend', e.x, e.y - 6, e.windupAngle, 60, 1.4, 1, 0.22, '#ffffff', '#e11d48');
            if (Math.hypot(this.player.x - e.x, this.player.y - e.y) <= 58) {
              this.damagePlayer(Math.round(enemyAtk * 1.25));
            }
          } else if (e.windupType === 'spell') {
            e.attackAnimDuration = 0.32;
            e.attackAnimTimer = 0.32;
            if (e.isLegionBoss && e.legionHeroId === 'ghost') {
              // Corrupted Ghost Basic Attack: Authentic Ranged Homing Will-o'-Wisps & 3rd-Hit Astral Soul Orb!
              e.comboCount = ((e.comboCount || 0) % 3) + 1;
              const lanternX = e.x + Math.cos(e.windupAngle + 0.55) * 28;
              const lanternY = e.y - 14 + Math.sin(e.windupAngle + 0.55) * 18;
              const restlessBoost = e.bossBuffTimer && e.bossBuffTimer > 0 ? 1.15 : 1.0;
              if (e.comboCount < 3) {
                const bank = e.comboCount === 1 ? -0.32 : 0.32;
                const wAng = e.windupAngle + bank;
                soundEngine.playGhostWisp(1.08);
                this.spawnProjectile({
                  fromPlayer: false,
                  kind: 'ghost_wisp',
                  x: lanternX,
                  y: lanternY,
                  vx: Math.cos(wAng) * 285,
                  vy: Math.sin(wAng) * 285,
                  angle: wAng,
                  radius: 11,
                  damage: Math.round(enemyAtk * 0.95 * restlessBoost),
                  isCrit: false,
                  pierce: false,
                  maxLife: 1.75,
                  color: e.comboCount === 1 ? '#2dd4bf' : '#818cf8',
                });
              } else {
                soundEngine.playGhostWisp(0.88);
                this.spawnProjectile({
                  fromPlayer: false,
                  kind: 'ghost_soul_orb',
                  x: lanternX,
                  y: lanternY,
                  vx: Math.cos(e.windupAngle) * 260,
                  vy: Math.sin(e.windupAngle) * 260,
                  angle: e.windupAngle,
                  radius: 15,
                  damage: Math.round(enemyAtk * 1.15 * restlessBoost),
                  isCrit: false,
                  pierce: false,
                  maxLife: 1.85,
                  color: '#c084fc',
                });
                for (const flank of [-0.48, 0.48]) {
                  const fAng = e.windupAngle + flank;
                  this.spawnProjectile({
                    fromPlayer: false,
                    kind: 'ghost_wisp',
                    x: lanternX,
                    y: lanternY,
                    vx: Math.cos(fAng) * 290,
                    vy: Math.sin(fAng) * 290,
                    angle: fAng,
                    radius: 9,
                    damage: Math.round(enemyAtk * 0.75 * restlessBoost),
                    isCrit: false,
                    pierce: false,
                    maxLife: 1.65,
                    color: '#2dd4bf',
                  });
                }
              }
            } else {
              // Arcane spell cast
              this.spawnGroundEffect('astral_nova', e.x, e.y, 0, 0, 0, 75, 1.4, '#38bdf8', '#c084fc');
              for (let s = 0; s < 3; s++) {
                const sa = e.windupAngle + (s - 1) * 0.45;
                this.spawnProjectile({
                  fromPlayer: false,
                  kind: 'spectral_bolt',
                  x: e.x + Math.cos(sa) * 22,
                  y: e.y + Math.sin(sa) * 22,
                  vx: Math.cos(sa) * 240,
                  vy: Math.sin(sa) * 240,
                  angle: sa,
                  radius: 8,
                  damage: Math.round(enemyAtk * 0.95),
                  isCrit: false,
                  pierce: false,
                  maxLife: 2.0,
                  color: '#38bdf8',
                });
              }
            }
          }

          e.attackCooldown = isBoss ? 1.32 : 1.05 + Math.random() * 0.35;
        }
        continue;
      }

      // Hold movement briefly during active weapon follow-through so strikes read crisply!
      if (e.attackAnimTimer > 0.08) {
        e.walkPhase = 0;
        continue;
      }

      e.facing = angToPlayer;
      e.attackCooldown = Math.max(0, e.attackCooldown - dt);

      // Undead Legion Member Boss AI: intelligent rotation of 5 skills and 3 ultimates!
      if (e.isLegionBoss) {
        this.stepUndeadLegionBoss(e, dt, dist, angToPlayer, enemyAtk);
      } else if (e.kind === EnemyKind.NECROMANCER) {
        if (dist > 220) {
          this.moveEnemyWithSeparation(e, Math.cos(angToPlayer), Math.sin(angToPlayer), dt);
        } else if (dist < 115) {
          this.moveEnemyWithSeparation(e, -Math.cos(angToPlayer), -Math.sin(angToPlayer), dt);
        } else {
          e.walkPhase = 0;
        }
        if (dist <= 290 && e.attackCooldown <= 0) {
          const r = Math.random();
          e.windupType = dist <= 135 && r < 0.5 ? 'frost_nova' : r < 0.7 ? 'spell' : 'nova';
          e.windupDuration = 0.58;
          e.windupTimer = 0.58;
          e.windupAngle = angToPlayer;
        }
      } else if (e.kind === EnemyKind.GRAVE_KNIGHT) {
        if (dist > 56) {
          this.moveEnemyWithSeparation(e, Math.cos(angToPlayer), Math.sin(angToPlayer), dt);
        }
        if (e.attackCooldown <= 0 && dist <= 185) {
          const r = Math.random();
          if (dist > 95 && r < 0.55) {
            e.windupType = 'charge';
            e.windupDuration = 0.56;
            e.windupTimer = 0.56;
            e.windupAngle = angToPlayer;
          } else if (r < 0.65) {
            e.windupType = 'cross_slash';
            e.windupDuration = 0.48;
            e.windupTimer = 0.48;
            e.windupAngle = angToPlayer;
          } else {
            e.windupType = 'whirlwind';
            e.windupDuration = 0.52;
            e.windupTimer = 0.52;
            e.windupAngle = angToPlayer;
          }
        }
      } else if (e.kind === EnemyKind.PLAGUE_STALKER) {
        if (dist > 54) {
          this.moveEnemyWithSeparation(e, Math.cos(angToPlayer), Math.sin(angToPlayer), dt);
        }
        if (e.attackCooldown <= 0 && dist <= 170) {
          const r = Math.random();
          if (dist > 85 && r < 0.6) {
            e.windupType = r < 0.35 ? 'pounce' : 'poison_lob';
            e.windupDuration = 0.38;
            e.windupTimer = 0.38;
            e.windupAngle = angToPlayer;
          } else {
            e.windupType = r < 0.55 ? 'cross_slash' : 'pounce';
            e.windupDuration = 0.34;
            e.windupTimer = 0.34;
            e.windupAngle = angToPlayer;
          }
        }
      } else if (e.kind === EnemyKind.ARCHER) {
        if (dist > 235) {
          this.moveEnemyWithSeparation(e, Math.cos(angToPlayer), Math.sin(angToPlayer), dt);
        } else if (dist < 130) {
          this.moveEnemyWithSeparation(e, -Math.cos(angToPlayer), -Math.sin(angToPlayer), dt);
        } else {
          e.walkPhase = 0;
        }
        if (dist <= 290 && e.attackCooldown <= 0) {
          const r = Math.random();
          e.windupType = r < 0.45 ? 'shoot' : r < 0.75 ? 'volley' : 'poison_lob';
          e.windupDuration = 0.54;
          e.windupTimer = 0.54;
          e.windupAngle = angToPlayer;
        }
      } else if (e.kind === EnemyKind.BRUTE) {
        if (dist > 68) {
          this.moveEnemyWithSeparation(e, Math.cos(angToPlayer), Math.sin(angToPlayer), dt);
        }
        if (e.attackCooldown <= 0) {
          const r = Math.random();
          if (dist > 110 && r < 0.5) {
            e.windupType = 'charge';
            e.windupDuration = 0.6;
            e.windupTimer = 0.6;
            e.windupAngle = angToPlayer;
          } else if (dist > 90 && r < 0.8) {
            e.windupType = 'shockwave_line';
            e.windupDuration = 0.68;
            e.windupTimer = 0.68;
            e.windupAngle = angToPlayer;
          } else {
            e.windupType = 'slam';
            e.windupDuration = 0.66;
            e.windupTimer = 0.66;
            e.windupAngle = angToPlayer;
          }
        }
      } else if (e.kind === EnemyKind.MINI_SKELETON) {
        if (dist > 44) {
          this.moveEnemyWithSeparation(e, Math.cos(angToPlayer), Math.sin(angToPlayer), dt);
        }
        if (e.attackCooldown <= 0 && dist <= 180) {
          const r = Math.random();
          e.windupType = dist > 80 ? 'shoot' : r < 0.42 ? 'slash' : r < 0.72 ? 'whirlwind' : 'thrust';
          e.windupDuration = 0.34;
          e.windupTimer = 0.34;
          e.windupAngle = angToPlayer;
        }
      } else if (e.kind === EnemyKind.MINI_ZOMBIE) {
        if (dist > 46) {
          this.moveEnemyWithSeparation(e, Math.cos(angToPlayer), Math.sin(angToPlayer), dt);
        }
        if (e.attackCooldown <= 0 && dist <= 170) {
          const r = Math.random();
          e.windupType = dist > 75 ? 'poison_lob' : r < 0.45 ? 'slash' : r < 0.75 ? 'slam' : 'poison_lob';
          e.windupDuration = 0.38;
          e.windupTimer = 0.38;
          e.windupAngle = angToPlayer;
        }
      } else if (e.kind === EnemyKind.MINI_GHOUL) {
        if (dist > 50) {
          this.moveEnemyWithSeparation(e, Math.cos(angToPlayer), Math.sin(angToPlayer), dt);
        }
        if (e.attackCooldown <= 0 && dist <= 165) {
          const r = Math.random();
          e.windupType = dist > 75 ? 'pounce' : r < 0.45 ? 'cross_slash' : r < 0.78 ? 'slash' : 'pounce';
          e.windupDuration = 0.3;
          e.windupTimer = 0.3;
          e.windupAngle = angToPlayer;
        }
      } else if (e.kind === EnemyKind.MINI_GHOST) {
        if (dist > 95) {
          this.moveEnemyWithSeparation(e, Math.cos(angToPlayer), Math.sin(angToPlayer), dt);
        } else if (dist < 58) {
          this.moveEnemyWithSeparation(e, -Math.cos(angToPlayer), -Math.sin(angToPlayer), dt);
        }
        if (e.attackCooldown <= 0 && dist <= 230) {
          const r = Math.random();
          e.windupType = dist <= 105 && r < 0.45 ? 'frost_nova' : r < 0.58 ? 'shoot' : 'spell';
          e.windupDuration = 0.36;
          e.windupTimer = 0.36;
          e.windupAngle = angToPlayer;
        }
      } else if (e.kind === EnemyKind.BOSS_WARDEN) {
        if (dist > 105 && e.attackCooldown > 0.3) {
          this.moveEnemyWithSeparation(e, Math.cos(angToPlayer), Math.sin(angToPlayer), dt);
        }
        if (e.attackCooldown <= 0) {
          const roll = Math.random();
          if (dist <= 125 && roll < 0.34) {
            e.windupType = 'slam';
            e.windupDuration = 0.8;
            e.windupTimer = 0.8;
            e.windupAngle = angToPlayer;
          } else if (roll < 0.56) {
            e.windupType = 'nova';
            e.windupDuration = 0.74;
            e.windupTimer = 0.74;
            e.windupAngle = angToPlayer;
          } else if (roll < 0.74) {
            e.windupType = 'cross_slash';
            e.windupDuration = 0.64;
            e.windupTimer = 0.64;
            e.windupAngle = angToPlayer;
          } else if (roll < 0.88) {
            e.windupType = 'shockwave_line';
            e.windupDuration = 0.68;
            e.windupTimer = 0.68;
            e.windupAngle = angToPlayer;
          } else {
            e.windupType = 'dash';
            e.windupDuration = 0.66;
            e.windupTimer = 0.66;
            e.windupAngle = angToPlayer;
          }
        }
      } else {
        // RATTLER: choices between slash, whirlwind, and thrust!
        if (dist > 46) {
          this.moveEnemyWithSeparation(e, Math.cos(angToPlayer), Math.sin(angToPlayer), dt);
        } else if (e.attackCooldown <= 0) {
          const r = Math.random();
          e.windupType = r < 0.45 ? 'slash' : r < 0.75 ? 'whirlwind' : 'thrust';
          e.windupDuration = 0.36;
          e.windupTimer = 0.36;
          e.windupAngle = angToPlayer;
        }
      }
    }

    // Update room cleared state dynamically for live Minimap room color-coding!
    if (!this.map.isGuild) {
      for (const rm of this.map.rooms) {
        if (rm.cleared || rm.kind === 'boss') continue;
        let hasLivingMob = false;
        for (const e of this.enemies) {
          if (e.hp > 0 && e.roomId === rm.id) {
            hasLivingMob = true;
            break;
          }
        }
        if (!hasLivingMob) {
          rm.cleared = true;
        }
      }
    }

    if (!this.isMultiplayer && !this.map.isGuild && !bossAlive && !this.bossSpawnedPortals) {
      this.bossSpawnedPortals = true;
      this.skillPoints += 1;
      this.boneShards += 60;
      soundEngine.playPortalSpawn();
      this.triggerShake(0.24, 5.5);

      this.spawnFloatingText(
        this.player.x,
        this.player.y - 54,
        'PORTALS AWAKENED! +1 SP · +60 SHARDS',
        '#fde047',
        true
      );

      const bossRoom =
        this.map.rooms.find((r) => r.kind === 'boss') || this.map.rooms[this.map.rooms.length - 1];
      if (bossRoom) {
        bossRoom.cleared = true;
        const portalY = Math.round(bossRoom.y + bossRoom.h * 0.5 - 38 - 34);
        const guildPortalX = Math.round(bossRoom.x + bossRoom.w * 0.5 - 120 - 34);
        const nextPortalX = Math.round(bossRoom.x + bossRoom.w * 0.5 + 120 - 34);

        this.map.props.push(
          {
            id: `portal_guild_${this.map.floor}`,
            kind: 'portal_guild',
            x: guildPortalX,
            y: portalY,
            w: 68,
            h: 68,
            solid: false,
            label: 'Return to Lobby',
            spawnTime: this.elapsedTime,
            chargeProgress: 0,
          },
          {
            id: `portal_next_${this.map.floor}`,
            kind: 'portal_next',
            x: nextPortalX,
            y: portalY,
            w: 68,
            h: 68,
            solid: false,
            label: `Next Dungeon · Floor ${this.map.floor + 1}`,
            spawnTime: this.elapsedTime,
            chargeProgress: 0,
          }
        );

        this.spawnRingEffect(guildPortalX + 34, portalY + 34, 92, '#f59e0b');
        this.spawnBurstParticles(guildPortalX + 34, portalY + 34, '#fde047', 26, true);
        this.spawnRingEffect(nextPortalX + 34, portalY + 34, 92, '#38bdf8');
        this.spawnBurstParticles(nextPortalX + 34, portalY + 34, '#38bdf8', 28, true);
      }
      this.emitHudSnapshot();
    }
  }

  private moveEnemyWithSeparation(e: EnemyEntity, dirX: number, dirY: number, dt: number) {
    let sx = dirX;
    let sy = dirY;
    for (const other of this.enemies) {
      if (other.id === e.id || other.hp <= 0) continue;
      const odx = e.x - other.x;
      const ody = e.y - other.y;
      const d = Math.hypot(odx, ody);
      const minSep = e.radius + other.radius + 8;
      if (d > 0.1 && d < minSep) {
        sx += (odx / d) * 0.9;
        sy += (ody / d) * 0.9;
      }
    }
    const len = Math.hypot(sx, sy) || 1;
    const slowMult = e.slowTimer > 0 ? 0.6 : 1.0;
    const buffSpeedMult =
      e.isLegionBoss && ((e.bossBuffTimer || 0) > 0 || (e.bossTransformTimer || 0) > 0)
        ? e.legionHeroId === 'ghoul'
          ? 1.28
          : e.legionHeroId === 'ghost'
            ? 1.22
            : 1.12
        : 1.0;
    const step = e.speed * slowMult * buffSpeedMult * dt;
    // Ethereal Body Passive: Ghost & Corrupted Ghost naturally phase through interior physical obstacles!
    const ignoreProps = e.kind === EnemyKind.MINI_GHOST || e.kind === EnemyKind.BOSS_LEGION_GHOST;
    this.tryMoveEntity(
      e.x,
      e.y,
      (sx / len) * step,
      (sy / len) * step,
      e.radius * 0.75,
      (nx, ny) => {
        e.x = nx;
        e.y = ny;
      },
      ignoreProps
    );
    e.walkPhase += dt * 9 * slowMult * buffSpeedMult;
  }

  private stepUndeadLegionBoss(
    e: EnemyEntity,
    dt: number,
    dist: number,
    angToPlayer: number,
    enemyAtk: number
  ) {
    if (!e.specialCooldowns) {
      e.specialCooldowns = {
        skill1: 1.5,
        skill2: 3.5,
        skill3: 5.5,
        skill4: 7.0,
        skill5: 9.0,
        ult1: 12.0,
        ult2: 22.0,
        ult3: 32.0,
        auraTick: 0.4,
      };
    }
    const cd = e.specialCooldowns;
    for (const k of Object.keys(cd)) {
      cd[k] = Math.max(0, cd[k] - dt);
    }

    const hero: 'skeleton' | 'zombie' | 'ghoul' | 'ghost' =
      (e.legionHeroId === 'zombie' || e.legionHeroId === 'ghoul' || e.legionHeroId === 'ghost')
        ? e.legionHeroId
        : 'skeleton';
    const hpRatio = e.hp / Math.max(1, e.maxHp);
    const empoweredMult = e.bossTransformTimer && e.bossTransformTimer > 0 ? 1.2 : 1.0;
    const effectiveAtk = Math.round(enemyAtk * empoweredMult);

    // Tick active sustained hero skills (Bone Storm, Undying Flesh, Blood Frenzy)
    if ((e.bossBuffTimer || 0) > 0 && (cd.auraTick ?? 0) <= 0) {
      if (hero === 'skeleton' && e.activeAuraType === 'bone_storm' && (e.activeAuraTimer || 0) > 0) {
        cd.auraTick = 0.45;
        this.spawnSlashWave('feral_whirl', e.x, e.y - 8, this.elapsedTime * 6, 115, Math.PI * 1.9, 1, 0.24, '#ffffff', '#67e8f9');
        if (dist <= 120) this.damagePlayer(Math.round(effectiveAtk * 0.45));
      } else if (hero === 'zombie') {
        cd.auraTick = 1.0;
        const healAmt = Math.max(25, Math.round(e.maxHp * 0.018));
        e.hp = Math.min(e.maxHp, e.hp + healAmt);
        this.spawnRingEffect(e.x, e.y, 68, '#4ade80');
      } else if (hero === 'ghoul') {
        cd.auraTick = 0.34;
        const side: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
        this.spawnSlashWave('feral_slash', e.x, e.y - 8, angToPlayer + side * 0.14, 96, Math.PI * 0.9, side, 0.22, '#fff1f2', '#fb7185');
        if (dist <= 104) this.damagePlayer(Math.round(effectiveAtk * 0.48));
      }
    }

    // Dynamic phase transitions: Enrage at 60% and 30% HP
    if (hpRatio <= 0.3 && (e.bossPhase ?? 1) < 3) {
      e.bossPhase = 3;
      this.triggerShake(0.3, 8);
      soundEngine.playSkill('ultimate');
      this.spawnFloatingText(e.x, e.y - 50, `${e.name.toUpperCase()} UNLEASHED!`, '#ef4444', true);
      this.spawnRingEffect(e.x, e.y, 140, '#ef4444');
      e.speed = Math.round(e.speed * 1.2);
    } else if (hpRatio <= 0.6 && (e.bossPhase ?? 1) < 2) {
      e.bossPhase = 2;
      this.triggerShake(0.2, 5.5);
      soundEngine.playSkill('shield');
      this.spawnFloatingText(e.x, e.y - 45, `${e.name.toUpperCase()} AWAKENED!`, '#c084fc', true);
      this.spawnRingEffect(e.x, e.y, 110, '#c084fc');
    }

    // --- ULTIMATE SKILLS ROTATION (All 3 Original Hero Ultimates) ---
    if (cd.ult1 <= 0) {
      cd.ult1 = 26;
      this.executeLegionBossUltimate(e, hero, 1, dist, angToPlayer, effectiveAtk);
      return;
    }
    if (cd.ult2 <= 0) {
      cd.ult2 = 34;
      this.executeLegionBossUltimate(e, hero, 2, dist, angToPlayer, effectiveAtk);
      return;
    }
    if (cd.ult3 <= 0) {
      cd.ult3 = 42;
      this.executeLegionBossUltimate(e, hero, 3, dist, angToPlayer, effectiveAtk);
      return;
    }

    // --- ALL 5 NORMAL SKILLS ROTATION ---
    if (cd.skill4 <= 0 && (dist > 90 || hero === 'zombie' || hero === 'ghoul' || (hero === 'ghost' && dist <= 135))) {
      cd.skill4 = hero === 'ghoul' ? 12 : hero === 'zombie' ? 14 : 9;
      this.executeLegionBossSkill(e, hero, 4, dist, angToPlayer, effectiveAtk);
      return;
    }

    if (cd.skill3 <= 0 && (dist <= 175 || hero === 'ghoul')) {
      cd.skill3 = hero === 'skeleton' ? 11 : 9;
      this.executeLegionBossSkill(e, hero, 3, dist, angToPlayer, effectiveAtk);
      return;
    }

    if (cd.skill5 <= 0 && (dist <= 165 || hero === 'zombie' || hero === 'ghost')) {
      cd.skill5 = hero === 'skeleton' ? 12 : 11;
      this.executeLegionBossSkill(e, hero, 5, dist, angToPlayer, effectiveAtk);
      return;
    }

    if (cd.skill2 <= 0) {
      cd.skill2 = hero === 'skeleton' ? 5.5 : 6.5;
      this.executeLegionBossSkill(e, hero, 2, dist, angToPlayer, effectiveAtk);
      return;
    }

    if (cd.skill1 <= 0 && (dist <= 125 || hero === 'ghost')) {
      cd.skill1 = 3.5;
      this.executeLegionBossSkill(e, hero, 1, dist, angToPlayer, effectiveAtk);
      return;
    }

    // Default positioning & authentic melee / ranged hero spacing
    const preferredDist = hero === 'ghost' ? 165 : 68;
    if (dist > preferredDist) {
      this.moveEnemyWithSeparation(e, Math.cos(angToPlayer), Math.sin(angToPlayer), dt);
    } else if (hero === 'ghost' && dist < 95) {
      this.moveEnemyWithSeparation(e, -Math.cos(angToPlayer), -Math.sin(angToPlayer), dt);
    } else {
      e.walkPhase = 0;
    }

    if (e.attackCooldown <= 0 && dist <= (hero === 'ghost' ? 280 : preferredDist + 35)) {
      e.windupType = hero === 'ghost' ? 'spell' : 'slash';
      e.windupDuration = hero === 'ghoul' && (e.bossBuffTimer || 0) > 0 ? 0.28 : 0.4;
      e.windupTimer = e.windupDuration;
      e.windupAngle = angToPlayer;
    }
  }

  private placeEnemySafely(e: EnemyEntity, destX: number, destY: number, ignoreProps = false) {
    const checkRad = e.radius * 0.75;
    if (this.isPointWalkable(destX, destY, checkRad, ignoreProps)) {
      e.x = destX;
      e.y = destY;
      return;
    }
    const steps = 10;
    for (let s = steps - 1; s >= 1; s--) {
      const t = s / steps;
      const tx = e.x + (destX - e.x) * t;
      const ty = e.y + (destY - e.y) * t;
      if (this.isPointWalkable(tx, ty, checkRad, ignoreProps)) {
        e.x = tx;
        e.y = ty;
        return;
      }
    }
  }

  private executeLegionBossUltimate(
    e: EnemyEntity,
    hero: 'skeleton' | 'zombie' | 'ghoul' | 'ghost',
    ultIndex: 1 | 2 | 3,
    dist: number,
    angToPlayer: number,
    enemyAtk: number
  ) {
    this.triggerShake(0.25, 7.5);
    soundEngine.playSkill('ultimate');
    e.attackAnimDuration = 0.4;
    e.attackAnimTimer = 0.4;

    if (hero === 'skeleton') {
      if (ultIndex === 1) {
        // Ultimate 1: Reaper's Judgment – Spectral Scythe Cleave + Dark Wave Crescent!
        e.bossScytheTimer = 1.5;
        this.spawnFloatingText(e.x, e.y - 52, "[ULT] REAPER'S JUDGMENT!", '#c084fc', true);
        this.placeEnemySafely(
          e,
          this.player.x - Math.cos(angToPlayer) * 42,
          this.player.y - Math.sin(angToPlayer) * 42
        );
        e.facing = angToPlayer;
        this.spawnSlashWave('boss_cleave', e.x, e.y - 10, angToPlayer, 140, Math.PI * 1.6, 1, 0.35, '#f8fafc', '#c084fc');
        this.spawnArcBurst(e.x, e.y, angToPlayer, 120, '#c084fc', 22);
        this.spawnProjectile({
          fromPlayer: false,
          kind: 'dark_wave',
          x: e.x + Math.cos(angToPlayer) * 30,
          y: e.y - 8 + Math.sin(angToPlayer) * 30,
          vx: Math.cos(angToPlayer) * 390,
          vy: Math.sin(angToPlayer) * 390,
          angle: angToPlayer,
          radius: 36,
          damage: Math.round(enemyAtk * 1.25),
          isCrit: false,
          pierce: true,
          maxLife: 0.95,
          color: '#c084fc',
        });
        if (Math.hypot(this.player.x - e.x, this.player.y - e.y) <= 138) {
          this.damagePlayer(Math.round(enemyAtk * 1.75));
        }
      } else if (ultIndex === 2) {
        // Ultimate 2: Army of Bones – Emerald Grave Portal + 3 Skeletal Warriors!
        this.spawnFloatingText(e.x, e.y - 52, '[ULT] ARMY OF BONES!', '#4ade80', true);
        this.spawnGroundEffect('grave_portal', e.x, e.y, 0, 0, 0, 105, 2.2, '#4ade80', '#86efac');
        this.spawnRingEffect(e.x, e.y, 115, '#4ade80');
        this.spawnBurstParticles(e.x, e.y, '#86efac', 24, true);
        for (let i = 0; i < 3; i++) {
          const sa = angToPlayer + ((i - 1) * Math.PI) / 3;
          this.spawnLegionBossMinion(
            EnemyKind.MINI_SKELETON,
            e.x + Math.cos(sa) * 65,
            e.y + Math.sin(sa) * 65,
            e.roomId,
            e.x,
            e.y
          );
        }
      } else {
        // Ultimate 3: Bone Colossus – Giant Crowned Colossus Transformation + Shield + Radial Bone Spears!
        e.bossTransformTimer = 8.5;
        e.bossBuffTimer = Math.max(e.bossBuffTimer || 0, 8.5);
        this.spawnFloatingText(e.x, e.y - 54, '[ULT] BONE COLOSSUS!', '#fde047', true);
        e.shieldHp = (e.shieldHp || 0) + 420;
        e.maxShieldHp = Math.max(e.maxShieldHp || 0, e.shieldHp);
        this.spawnGroundEffect('enemy_slam_crack', e.x, e.y, 0, 0, 0, 135, 1.5, '#fde047', '#f59e0b');
        this.spawnRingEffect(e.x, e.y, 160, '#fbbf24');
        this.spawnBurstParticles(e.x, e.y, '#fde047', 30, true);
        const count = 10;
        for (let k = 0; k < count; k++) {
          const sa = (k * Math.PI * 2) / count;
          this.spawnProjectile({
            fromPlayer: false,
            kind: 'bone_spear',
            x: e.x + Math.cos(sa) * 28,
            y: e.y + Math.sin(sa) * 28,
            vx: Math.cos(sa) * 290,
            vy: Math.sin(sa) * 290,
            angle: sa,
            radius: 11,
            damage: Math.round(enemyAtk * 1.05),
            isCrit: false,
            pierce: false,
            maxLife: 2.0,
            color: '#fde047',
          });
        }
      }
    } else if (hero === 'zombie') {
      if (ultIndex === 1) {
        // Ultimate 1: Death's Embrace – Plague Crater + Inward Life-Siphon Pull!
        this.spawnFloatingText(e.x, e.y - 52, "[ULT] DEATH'S EMBRACE!", '#c084fc', true);
        this.spawnGroundEffect('plague_crater', e.x, e.y, 0, 0, 0, 165, 2.0, '#a855f7', '#a3e635');
        this.spawnGroundEffect('contagion_ring', e.x, e.y, 0, 0, 0, 170, 0.85, '#c084fc', '#4ade80');
        this.spawnRingEffect(e.x, e.y, 165, '#a855f7');
        if (dist <= 178) {
          const pullX = (e.x - this.player.x) * 0.45;
          const pullY = (e.y - this.player.y) * 0.45;
          this.tryMoveEntity(this.player.x, this.player.y, pullX, pullY, 16, (nx, ny) => {
            this.player.x = nx;
            this.player.y = ny;
          });
          const drain = Math.round(enemyAtk * 1.4);
          this.damagePlayer(drain);
          e.hp = Math.min(e.maxHp, e.hp + drain * 3);
          this.spawnSiphonBeam(this.player.x, this.player.y - 10, 0.55, '#4ade80');
        }
      } else if (ultIndex === 2) {
        // Ultimate 2: Kingdom of the Dead – Rotating Necropolis Sigil + Plague Clouds + Zombie Horde!
        this.spawnFloatingText(e.x, e.y - 52, '[ULT] KINGDOM OF THE DEAD!', '#86efac', true);
        this.spawnGroundEffect('kingdom_sigil', e.x, e.y, 0, 0, 0, 148, 4.2, '#4ade80', '#c084fc');
        this.spawnRingEffect(e.x, e.y, 150, '#4ade80');
        for (let i = 0; i < 3; i++) {
          const ca = (i * Math.PI * 2) / 3 + 0.4;
          const cx = e.x + Math.cos(ca) * 78;
          const cy = e.y + Math.sin(ca) * 78;
          this.spawnToxicCloud(cx, cy, 56, 4.2, Math.round(enemyAtk * 0.45), false);
          this.spawnLegionBossMinion(EnemyKind.MINI_ZOMBIE, cx, cy, e.roomId, e.x, e.y);
        }
      } else {
        // Ultimate 3: Abomination Form – Mutates into Horned Abomination Hulk!
        e.bossTransformTimer = 9.0;
        this.spawnFloatingText(e.x, e.y - 54, '[ULT] ABOMINATION FORM!', '#a3e635', true);
        e.hp = Math.min(e.maxHp, e.hp + 340);
        e.shieldHp = (e.shieldHp || 0) + 420;
        e.maxShieldHp = Math.max(e.maxShieldHp || 0, e.shieldHp);
        this.spawnGroundEffect('plague_crater', e.x, e.y, 0, 0, 0.2, 145, 1.7, '#a3e635', '#c084fc');
        this.spawnRingEffect(e.x, e.y, 155, '#84cc16');
        this.spawnToxicCloud(e.x, e.y, 92, 5.0, Math.round(enemyAtk * 0.5), false);
        this.spawnBurstParticles(e.x, e.y, '#a3e635', 28, true);
      }
    } else if (hero === 'ghoul') {
      if (ultIndex === 1) {
        // Ultimate 1: King of the Hunt – Shadow Smoke Territory + Marked Ambush Pursuit!
        this.spawnFloatingText(e.x, e.y - 52, '[ULT] KING OF THE HUNT!', '#fda4af', true);
        this.spawnGroundEffect('shadow_smoke_ring', e.x, e.y, 0, 0, 0, 118, 0.65, '#4c0519', '#fb7185');
        this.placeEnemySafely(
          e,
          this.player.x - Math.cos(angToPlayer) * 36,
          this.player.y - Math.sin(angToPlayer) * 36
        );
        this.spawnSlashWave('shadow_ambush', e.x, e.y - 8, angToPlayer, 92, Math.PI * 1.35, 1, 0.28, '#fff1f2', '#e11d48');
        this.spawnRingEffect(e.x, e.y, 95, '#e11d48');
        if (Math.hypot(this.player.x - e.x, this.player.y - e.y) <= 98) {
          this.damagePlayer(Math.round(enemyAtk * 1.7));
        }
      } else if (ultIndex === 2) {
        // Ultimate 2: Carnage Unleashed – Blitz Dash Line + 360° Crimson Rend Barrage!
        const startX = e.x;
        const startY = e.y;
        this.spawnFloatingText(e.x, e.y - 52, '[ULT] CARNAGE UNLEASHED!', '#fb7185', true);
        this.placeEnemySafely(
          e,
          this.player.x + Math.cos(angToPlayer + 0.6) * 52,
          this.player.y + Math.sin(angToPlayer + 0.6) * 52
        );
        this.spawnGroundEffect('carnage_dash_line', startX, startY - 4, e.x, e.y - 4, angToPlayer, 92, 0.4, '#fb7185', '#fff1f2');
        this.spawnSlashWave('feral_whirl', e.x, e.y - 8, angToPlayer, 130, Math.PI * 1.95, 1, 0.32, '#fff1f2', '#f43f5e');
        this.spawnRingEffect(e.x, e.y, 135, '#e11d48');
        for (let k = 0; k < 12; k++) {
          const sa = (k * Math.PI * 2) / 12;
          this.spawnProjectile({
            fromPlayer: false,
            kind: 'crimson_rend_wave',
            x: e.x + Math.cos(sa) * 26,
            y: e.y + Math.sin(sa) * 26,
            vx: Math.cos(sa) * 320,
            vy: Math.sin(sa) * 320,
            angle: sa,
            radius: 13,
            damage: Math.round(enemyAtk * 0.9),
            isCrit: false,
            pierce: false,
            maxLife: 1.6,
            color: '#f43f5e',
          });
        }
      } else {
        // Ultimate 3: Apex Predator – Dorsal-Spined Apex Transformation + Blood Barrier + Feral Pack!
        e.bossTransformTimer = 8.5;
        e.shieldHp = (e.shieldHp || 0) + 340;
        e.maxShieldHp = Math.max(e.maxShieldHp || 0, e.shieldHp);
        this.spawnFloatingText(e.x, e.y - 54, '[ULT] APEX PREDATOR!', '#fda4af', true);
        this.spawnGroundEffect('predator_crater', e.x, e.y, 0, 0, 0, 120, 1.5, '#f43f5e', '#fda4af');
        this.spawnSlashWave('feral_whirl', e.x, e.y - 10, angToPlayer, 120, Math.PI * 2, 1, 0.32, '#fff1f2', '#e11d48');
        this.spawnRingEffect(e.x, e.y, 128, '#fb7185');
        this.spawnLegionBossMinion(EnemyKind.MINI_GHOUL, e.x - 40, e.y + 35, e.roomId, e.x, e.y);
        this.spawnLegionBossMinion(EnemyKind.MINI_GHOUL, e.x + 40, e.y - 35, e.roomId, e.x, e.y);
      }
    } else {
      // Corrupted Ghost Ultimates
      if (ultIndex === 1) {
        // Ultimate 1: Eternal Nightmare – Abyssal Nightmare Transformation + Darkness Wave + Spectral Apparitions!
        e.bossTransformTimer = 8.5;
        this.spawnFloatingText(e.x, e.y - 52, '[ULT] ETERNAL NIGHTMARE!', '#c084fc', true);
        this.spawnGroundEffect('wailing_wave', e.x, e.y, 0, 0, 0, 155, 0.7, '#818cf8', '#c084fc');
        this.spawnGroundEffect('astral_nova', this.player.x, this.player.y, 0, 0, 0, 125, 1.6, '#818cf8', '#2dd4bf');
        this.spawnRingEffect(this.player.x, this.player.y, 125, '#818cf8');
        this.spawnLegionBossMinion(EnemyKind.MINI_GHOST, e.x - 48, e.y + 30, e.roomId, e.x, e.y);
        this.spawnLegionBossMinion(EnemyKind.MINI_GHOST, e.x + 48, e.y - 30, e.roomId, e.x, e.y);
        if (dist <= 135) {
          this.damagePlayer(Math.round(enemyAtk * 1.45));
        }
      } else if (ultIndex === 2) {
        // Ultimate 2: Spirit Legion – Legion of Homing Wandering Spirits!
        this.spawnFloatingText(e.x, e.y - 52, '[ULT] SPIRIT LEGION!', '#5eead4', true);
        this.spawnGroundEffect('astral_nova', e.x, e.y, 0, 0, 0, 130, 0.65, '#2dd4bf', '#818cf8');
        this.spawnRingEffect(e.x, e.y, 135, '#2dd4bf');
        for (let k = 0; k < 12; k++) {
          const sa = (k * Math.PI * 2) / 12;
          this.spawnProjectile({
            fromPlayer: false,
            kind: 'ghost_wisp',
            x: e.x + Math.cos(sa) * 28,
            y: e.y - 10 + Math.sin(sa) * 28,
            vx: Math.cos(sa) * 245,
            vy: Math.sin(sa) * 245,
            angle: sa,
            radius: 10,
            damage: Math.round(enemyAtk * 0.8),
            isCrit: false,
            pierce: false,
            maxLife: 2.1,
            color: k % 2 === 0 ? '#2dd4bf' : '#c084fc',
          });
        }
      } else {
        // Ultimate 3: Death's Passage – Massive Spectral Rift Pull & Detonation!
        this.spawnFloatingText(e.x, e.y - 52, "[ULT] DEATH'S PASSAGE!", '#c084fc', true);
        const riftX = this.player.x;
        const riftY = this.player.y;
        this.spawnGroundEffect('astral_nova', riftX, riftY, 0, 0, 0, 145, 1.65, '#c084fc', '#5eead4');
        this.spawnRingEffect(riftX, riftY, 145, '#c084fc');
        const pullAng = Math.atan2(riftY - this.player.y, riftX - this.player.x);
        this.placeEnemySafely(
          e,
          riftX + Math.cos(angToPlayer + Math.PI) * 95,
          riftY + Math.sin(angToPlayer + Math.PI) * 95,
          true
        );
        if (Math.hypot(this.player.x - riftX, this.player.y - riftY) <= 145) {
          this.tryMoveEntity(this.player.x, this.player.y, Math.cos(pullAng) * 32, Math.sin(pullAng) * 32, 16, (nx, ny) => {
            this.player.x = nx;
            this.player.y = ny;
          });
          this.damagePlayer(Math.round(enemyAtk * 1.55));
        }
      }
    }
  }

  private executeLegionBossSkill(
    e: EnemyEntity,
    hero: 'skeleton' | 'zombie' | 'ghoul' | 'ghost',
    skillIndex: 1 | 2 | 3 | 4 | 5,
    dist: number,
    angToPlayer: number,
    enemyAtk: number
  ) {
    e.attackAnimDuration = 0.28;
    e.attackAnimTimer = 0.28;
    if (hero === 'skeleton') {
      if (skillIndex === 1) {
        // Skill 1: Bone Slash
        this.spawnFloatingText(e.x, e.y - 44, 'BONE SLASH!', '#67e8f9', false);
        this.spawnSlashWave('blade_arc', e.x, e.y - 8, angToPlayer, 112, 1.6, 1, 0.24, '#ffffff', '#67e8f9');
        this.spawnArcBurst(e.x, e.y, angToPlayer, 92, '#67e8f9', 14);
        soundEngine.playSlash(1.22);
        if (dist <= 112) this.damagePlayer(Math.round(enemyAtk * 1.25));
      } else if (skillIndex === 2) {
        // Skill 2: Bone Spear
        this.spawnFloatingText(e.x, e.y - 44, 'BONE SPEAR!', '#67e8f9', false);
        soundEngine.playSkill('spear');
        this.spawnProjectile({
          fromPlayer: false,
          kind: 'bone_spear',
          x: e.x + Math.cos(angToPlayer) * 26,
          y: e.y - 8 + Math.sin(angToPlayer) * 26,
          vx: Math.cos(angToPlayer) * 410,
          vy: Math.sin(angToPlayer) * 410,
          angle: angToPlayer,
          radius: 13,
          damage: Math.round(enemyAtk * 1.35),
          isCrit: false,
          pierce: true,
          maxLife: 1.6,
          color: '#67e8f9',
        });
      } else if (skillIndex === 3) {
        // Skill 3: Ribcage Shield
        soundEngine.playSkill('shield');
        e.bossBuffTimer = 6.0;
        e.shieldHp = (e.shieldHp || 0) + 280;
        e.maxShieldHp = Math.max(e.maxShieldHp || 0, e.shieldHp);
        this.spawnRingEffect(e.x, e.y, 92, '#fde68a');
        this.spawnFloatingText(e.x, e.y - 40, 'RIBCAGE SHIELD!', '#fde68a', false);
        if (dist <= 95) {
          this.damagePlayer(Math.round(enemyAtk * 0.85));
          this.tryMoveEntity(this.player.x, this.player.y, Math.cos(angToPlayer) * 34, Math.sin(angToPlayer) * 34, 16, (nx, ny) => {
            this.player.x = nx;
            this.player.y = ny;
          });
        }
      } else if (skillIndex === 4) {
        // Skill 4: Skeletal Rush
        this.spawnFloatingText(e.x, e.y - 44, 'SKELETAL RUSH!', '#67e8f9', false);
        soundEngine.playSkill('rush');
        const startX = e.x;
        const startY = e.y;
        const step = Math.min(dist, 175);
        this.placeEnemySafely(
          e,
          e.x + Math.cos(angToPlayer) * step,
          e.y + Math.sin(angToPlayer) * step
        );
        this.spawnGroundEffect('flesh_tear_track', startX, startY + 8, e.x, e.y + 8, angToPlayer, 84, 0.8, '#67e8f9', '#f8fafc');
        this.spawnSlashWave('blade_arc', e.x, e.y - 8, angToPlayer, 88, 1.45, 1, 0.22, '#ffffff', '#67e8f9');
        if (Math.hypot(this.player.x - e.x, this.player.y - e.y) <= 88) this.damagePlayer(Math.round(enemyAtk * 1.2));
      } else {
        // Skill 5: Bone Storm
        e.bossBuffTimer = 4.5;
        e.activeAuraType = 'bone_storm';
        e.activeAuraTimer = 4.5;
        this.spawnFloatingText(e.x, e.y - 44, 'BONE STORM!', '#67e8f9', false);
        soundEngine.playSkill('storm');
        this.spawnSlashWave('feral_whirl', e.x, e.y - 8, angToPlayer, 118, Math.PI * 1.95, 1, 0.28, '#ffffff', '#67e8f9');
        this.spawnRingEffect(e.x, e.y, 118, '#67e8f9');
        if (dist <= 120) this.damagePlayer(Math.round(enemyAtk * 1.2));
      }
    } else if (hero === 'zombie') {
      if (skillIndex === 1) {
        // Skill 1: Rotting Claw
        this.spawnFloatingText(e.x, e.y - 44, 'ROTTING CLAW!', '#a3e635', false);
        soundEngine.playSlash(0.95);
        this.spawnSlashWave('triple_claw', e.x, e.y - 8, angToPlayer, 96, 1.45, 1, 0.24, '#ecfccb', '#84cc16');
        this.spawnSlashWave('cross_claw', e.x, e.y - 8, angToPlayer, 102, 1.5, -1, 0.3, '#ecfccb', '#c084fc');
        if (dist <= 104) this.damagePlayer(Math.round(enemyAtk * 1.2));
      } else if (skillIndex === 2) {
        // Skill 2: Plague Burst
        this.spawnFloatingText(e.x, e.y - 44, 'PLAGUE BURST!', '#a3e635', false);
        soundEngine.playSkill('storm');
        const px = dist <= 115 ? e.x : e.x + Math.cos(angToPlayer) * Math.min(dist, 150);
        const py = dist <= 115 ? e.y : e.y + Math.sin(angToPlayer) * Math.min(dist, 150);
        this.spawnGroundEffect('contagion_ring', px, py, 0, 0, 0, 96, 0.75, '#a3e635', '#a855f7');
        this.spawnToxicCloud(px, py, 82, 4.2, Math.round(enemyAtk * 0.45), false);
        this.spawnRingEffect(px, py, 88, '#a3e635');
        if (Math.hypot(this.player.x - px, this.player.y - py) <= 86) this.damagePlayer(Math.round(enemyAtk * 1.1));
      } else if (skillIndex === 3) {
        // Skill 3: Flesh Ripper
        this.spawnFloatingText(e.x, e.y - 44, 'FLESH RIPPER!', '#fb7185', false);
        soundEngine.playSkill('rush');
        const startX = e.x;
        const startY = e.y;
        const step = Math.min(dist, 150);
        this.placeEnemySafely(
          e,
          e.x + Math.cos(angToPlayer) * step,
          e.y + Math.sin(angToPlayer) * step
        );
        this.spawnSlashWave('cross_claw', e.x, e.y - 8, angToPlayer, 84, 1.4, 1, 0.25, '#ecfccb', '#fb7185');
        this.spawnGroundEffect('flesh_tear_track', startX, startY, e.x, e.y, angToPlayer, 95, 0.9, '#a3e635', '#fb7185');
        e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * 0.06));
        this.spawnSiphonBeam(e.x, e.y - 12, 0.35, '#4ade80');
        if (Math.hypot(this.player.x - e.x, this.player.y - e.y) <= 88) this.damagePlayer(Math.round(enemyAtk * 1.25));
      } else if (skillIndex === 4) {
        // Skill 4: Undying Flesh
        soundEngine.playSkill('shield');
        e.bossBuffTimer = 5.5;
        e.hp = Math.min(e.maxHp, e.hp + 200);
        this.spawnGroundEffect('contagion_ring', e.x, e.y, 0, 0, 0, 96, 0.65, '#4ade80', '#a3e635');
        this.spawnRingEffect(e.x, e.y, 92, '#22c55e');
        this.spawnFloatingText(e.x, e.y - 40, 'UNDYING FLESH!', '#4ade80', false);
      } else {
        // Skill 5: Grave Call
        this.spawnFloatingText(e.x, e.y - 44, 'GRAVE CALL!', '#a855f7', false);
        soundEngine.playSkill('spear');
        this.spawnGroundEffect('grave_portal', e.x, e.y, 0, 0, 0, 92, 2.4, '#a855f7', '#a3e635');
        this.spawnRingEffect(e.x, e.y, 92, '#a855f7');
        this.spawnLegionBossMinion(EnemyKind.MINI_ZOMBIE, e.x + 38, e.y + 22, e.roomId, e.x, e.y);
        this.spawnLegionBossMinion(EnemyKind.MINI_ZOMBIE, e.x - 38, e.y - 22, e.roomId, e.x, e.y);
      }
    } else if (hero === 'ghoul') {
      if (skillIndex === 1) {
        // Skill 1: Rending Claws + Crimson Crescent Finale!
        this.spawnFloatingText(e.x, e.y - 44, 'RENDING CLAWS!', '#fb7185', false);
        soundEngine.playSlash(1.26);
        this.spawnSlashWave('feral_slash', e.x, e.y - 8, angToPlayer, 96, 1.45, 1, 0.22, '#fff1f2', '#fb7185');
        this.spawnSlashWave('rending_finale', e.x, e.y - 8, angToPlayer, 106, 1.6, -1, 0.28, '#fff1f2', '#e11d48');
        this.spawnProjectile({
          fromPlayer: false,
          kind: 'crimson_rend_wave',
          x: e.x + Math.cos(angToPlayer) * 26,
          y: e.y - 8 + Math.sin(angToPlayer) * 26,
          vx: Math.cos(angToPlayer) * 410,
          vy: Math.sin(angToPlayer) * 410,
          angle: angToPlayer,
          radius: 26,
          damage: Math.round(enemyAtk * 0.9),
          isCrit: false,
          pierce: true,
          maxLife: 0.55,
          color: '#f43f5e',
        });
        if (dist <= 104) this.damagePlayer(Math.round(enemyAtk * 1.25));
      } else if (skillIndex === 2) {
        // Skill 2: Feral Pounce
        this.spawnFloatingText(e.x, e.y - 44, 'FERAL POUNCE!', '#f43f5e', false);
        soundEngine.playSkill('rush');
        this.placeEnemySafely(
          e,
          this.player.x - Math.cos(angToPlayer) * 28,
          this.player.y - Math.sin(angToPlayer) * 28
        );
        this.triggerShake(0.18, 5.0);
        this.spawnGroundEffect('predator_crater', e.x, e.y, 0, 0, 0, 72, 1.2, '#f43f5e', '#fb7185');
        this.spawnSlashWave('twin_rend', e.x, e.y - 6, angToPlayer, 80, 1.4, 1, 0.24, '#fff1f2', '#e11d48');
        if (Math.hypot(this.player.x - e.x, this.player.y - e.y) <= 86) {
          this.damagePlayer(Math.round(enemyAtk * 1.4));
        }
      } else if (skillIndex === 3) {
        // Skill 3: Shadow Stalker (Shadow Vanish Shroud + Ambush Behind Player)
        e.bossStealthTimer = 1.8;
        this.spawnGroundEffect('shadow_smoke_ring', e.x, e.y, 0, 0, 0, 64, 0.5, '#4c0519', '#fb7185');
        soundEngine.playSkill('rush');
        this.placeEnemySafely(
          e,
          this.player.x + Math.cos(this.player.facing + Math.PI) * 44,
          this.player.y + Math.sin(this.player.facing + Math.PI) * 44
        );
        this.spawnFloatingText(e.x, e.y - 44, 'SHADOW STALKER!', '#fda4af', false);
        this.spawnGroundEffect('shadow_smoke_ring', e.x, e.y, 0, 0, 0, 68, 0.5, '#4c0519', '#fb7185');
        const stabAng = Math.atan2(this.player.y - e.y, this.player.x - e.x);
        e.facing = stabAng;
        this.spawnSlashWave('shadow_ambush', e.x, e.y - 8, stabAng, 84, Math.PI * 1.15, 1, 0.25, '#fff1f2', '#e11d48');
        if (Math.hypot(this.player.x - e.x, this.player.y - e.y) <= 86) {
          this.damagePlayer(Math.round(enemyAtk * 1.45));
        }
      } else if (skillIndex === 4) {
        // Skill 4: Blood Frenzy
        e.bossBuffTimer = 5.0;
        soundEngine.playSkill('storm');
        this.spawnFloatingText(e.x, e.y - 40, 'BLOOD FRENZY!', '#fb7185', true);
        this.spawnRingEffect(e.x, e.y, 90, '#fb7185');
        e.attackCooldown = 0.15;
      } else {
        // Skill 5: Predator's Leap + 360° Feral Whirl
        this.spawnFloatingText(e.x, e.y - 44, "PREDATOR'S LEAP!", '#fb7185', false);
        soundEngine.playSkill('rush');
        const lx = this.player.x + (Math.random() - 0.5) * 35;
        const ly = this.player.y + (Math.random() - 0.5) * 35;
        this.placeEnemySafely(e, lx, ly);
        this.triggerShake(0.2, 5.5);
        this.spawnGroundEffect('predator_crater', e.x, e.y, 0, 0, 0, 84, 1.3, '#f43f5e', '#fda4af');
        this.spawnSlashWave('feral_whirl', e.x, e.y - 8, angToPlayer, 98, Math.PI * 1.95, 1, 0.28, '#fff1f2', '#e11d48');
        if (Math.hypot(this.player.x - e.x, this.player.y - e.y) <= 95) this.damagePlayer(Math.round(enemyAtk * 1.35));
      }
    } else {
      // Corrupted Ghost Skills
      if (skillIndex === 1) {
        // Skill 1: Spectral Bolt (Piercing Spiritual Energy Lance)
        this.spawnFloatingText(e.x, e.y - 44, 'SPECTRAL BOLT!', '#2dd4bf', false);
        soundEngine.playGhostWisp(0.92);
        const launchX = e.x + Math.cos(angToPlayer) * 24;
        const launchY = e.y - 12 + Math.sin(angToPlayer) * 24;
        this.spawnGroundEffect('astral_nova', launchX, launchY, 0, 0, angToPlayer, 36, 0.26, '#2dd4bf', '#818cf8');
        for (let s = 0; s < 3; s++) {
          const sa = angToPlayer + (s - 1) * 0.28;
          this.spawnProjectile({
            fromPlayer: false,
            kind: 'spectral_bolt',
            x: launchX,
            y: launchY,
            vx: Math.cos(sa) * 320,
            vy: Math.sin(sa) * 320,
            angle: sa,
            radius: 12,
            damage: Math.round(enemyAtk * 1.05),
            isCrit: false,
            pierce: true,
            maxLife: 1.75,
            color: '#2dd4bf',
          });
        }
      } else if (skillIndex === 2) {
        // Skill 2: Phantom Dash (Transforms into billowing spectral mist & leaves spectral mist nodes!)
        e.bossStealthTimer = 0.65;
        e.bossBuffTimer = Math.max(e.bossBuffTimer || 0, 4.5);
        this.spawnFloatingText(e.x, e.y - 44, 'PHANTOM DASH!', '#5eead4', false);
        soundEngine.playGhostWisp(1.22);
        const startX = e.x;
        const startY = e.y;
        const blinkDist = 145;
        const blinkAng = angToPlayer + Math.PI * (Math.random() < 0.5 ? 0.55 : -0.55);
        this.placeEnemySafely(
          e,
          e.x + Math.cos(blinkAng) * blinkDist,
          e.y + Math.sin(blinkAng) * blinkDist,
          true
        );
        this.spawnGroundEffect('spectral_mist_node', startX, startY, 0, 0, blinkAng, 52, 1.6, '#2dd4bf', '#818cf8');
        this.spawnGroundEffect('spectral_mist_node', (startX + e.x) * 0.5, (startY + e.y) * 0.5, 0, 0, blinkAng, 46, 1.6, '#818cf8', '#2dd4bf');
        this.spawnGroundEffect('spectral_mist_node', e.x, e.y, 0, 0, blinkAng, 56, 1.6, '#2dd4bf', '#818cf8');
      } else if (skillIndex === 3) {
        // Skill 3: Soul Drain (Ethereal life-draining tendrils!)
        soundEngine.playGhostWisp(0.86);
        this.spawnGroundEffect('astral_nova', e.x, e.y, 0, 0, 0, 95, 0.55, '#2dd4bf', '#818cf8');
        this.spawnSiphonBeam(this.player.x, this.player.y - 10, 0.5, '#5eead4');
        e.hp = Math.min(e.maxHp, e.hp + 165);
        this.spawnFloatingText(e.x, e.y - 40, 'SOUL DRAIN +165', '#5eead4', false);
        if (dist <= 190) this.damagePlayer(Math.round(enemyAtk * 1.15));
      } else if (skillIndex === 4) {
        // Skill 4: Wailing Scream (Supernatural terror wave pushing player back!)
        this.spawnFloatingText(e.x, e.y - 44, 'WAILING SCREAM!', '#5eead4', false);
        soundEngine.playWail();
        this.triggerShake(0.18, 4.5);
        this.spawnGroundEffect('wailing_wave', e.x, e.y - 6, 0, 0, 0, 125, 0.55, '#5eead4', '#818cf8');
        this.spawnRingEffect(e.x, e.y, 125, '#c084fc');
        if (dist <= 130) {
          this.damagePlayer(Math.round(enemyAtk * 1.15));
          const pushX = Math.cos(angToPlayer) * 65;
          const pushY = Math.sin(angToPlayer) * 65;
          this.tryMoveEntity(this.player.x, this.player.y, pushX, pushY, 16, (nx, ny) => {
            this.player.x = nx;
            this.player.y = ny;
          });
        }
      } else {
        // Skill 5: Haunted Possession (Disrupts player movement & detonates spiritual burst!)
        this.spawnFloatingText(e.x, e.y - 44, 'HAUNTED POSSESSION!', '#c084fc', false);
        soundEngine.playGhostWisp(1.1);
        this.spawnGroundEffect('possession_burst', this.player.x, this.player.y, 0, 0, 0, 74, 0.55, '#c084fc', '#2dd4bf');
        this.spawnBurstParticles(this.player.x, this.player.y, '#c084fc', 14, true);
        if (dist <= 225) {
          const joltAng = this.elapsedTime * 7;
          this.tryMoveEntity(this.player.x, this.player.y, Math.cos(joltAng) * 38, Math.sin(joltAng) * 38, 16, (nx, ny) => {
            this.player.x = nx;
            this.player.y = ny;
          });
          this.damagePlayer(Math.round(enemyAtk * 1.25));
        }
      }
    }
  }

  private spawnLegionBossMinion(
    kind: EnemyKind,
    x: number,
    y: number,
    roomId: number,
    fallbackX = x,
    fallbackY = y
  ) {
    let activeMinionsInRoom = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const existing = this.enemies[i];
      if (existing.hp > 0 && existing.roomId === roomId && !isBossKind(existing.kind)) {
        activeMinionsInRoom++;
      }
    }
    if (activeMinionsInRoom >= 6) return;

    const isSkeleton = kind === EnemyKind.MINI_SKELETON;
    const isZombie = kind === EnemyKind.MINI_ZOMBIE;
    const isGhoul = kind === EnemyKind.MINI_GHOUL;
    const rad = isSkeleton ? 16 : isZombie ? 18 : 15;
    let spawnX = x;
    let spawnY = y;
    if (!this.isPointWalkable(spawnX, spawnY, rad * 0.75, true)) {
      spawnX = fallbackX;
      spawnY = fallbackY;
    }
    this.enemies.push({
      id: allocEntityId(),
      kind,
      name: isSkeleton
        ? 'Legion Boneblade'
        : isZombie
          ? 'Legion Plaguebearer'
          : isGhoul
            ? 'Legion Shadow Stalker'
            : 'Legion Nether Spirit',
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      radius: rad,
      hp: 160,
      maxHp: 160,
      atk: 18,
      speed: 120,
      facing: Math.random() * Math.PI * 2,
      walkPhase: 0,
      attackCooldown: 0.8,
      windupTimer: 0,
      windupDuration: 0.35,
      windupType: isSkeleton ? 'slash' : isZombie ? 'poison_lob' : isGhoul ? 'pounce' : 'spell',
      windupAngle: 0,
      attackAnimTimer: 0,
      attackAnimDuration: 0.25,
      hitFlash: 0,
      roomId,
      weaponAngle: 0,
      weaponSwing: 0,
      armorCrackTimer: 0,
      poisonTimer: 0,
      poisonDps: 0,
      poisonTickAccum: 0,
      slowTimer: 0,
      preyMarkTimer: 0,
      pounceMarkTimer: 0,
      fearTimer: 0,
      possessedTimer: 0,
      staggerTimer: 0,
    });
  }

  private triggerFinalHorizonExplosion(x: number, y: number, damage: number) {
    soundEngine.playSkyScreech(1.1);
    this.triggerShake(0.2, 5.5);
    this.spawnRingEffect(x, y, 95, '#38bdf8');
    this.spawnBurstParticles(x, y, '#e0f2fe', 24, true);
    const subCount = 8;
    for (let k = 0; k < subCount; k++) {
      const sa = (k * Math.PI * 2) / subCount + (Math.random() - 0.5) * 0.3;
      const spd = 460 + Math.random() * 80;
      this.spawnProjectile({
        fromPlayer: true,
        kind: 'homing_feather',
        x,
        y,
        vx: Math.cos(sa) * spd,
        vy: Math.sin(sa) * spd,
        angle: sa,
        radius: 14,
        damage: Math.max(8, Math.round(damage * 0.42)),
        isCrit: false,
        pierce: false,
        maxLife: 1.5,
        color: '#38bdf8',
        targetEnemyId: -1,
      });
    }
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        if (p.kind === 'final_feather' && !p.visualOnly) {
          this.triggerFinalHorizonExplosion(p.x, p.y, p.damage);
        }
        continue;
      }

      if (p.kind === 'thrown_pipe') {
        // Human Normal 4 (Improvised Throw): Spins through air -> ricochets back toward Human to catch!
        p.spinAngle = (p.spinAngle ?? 0) + dt * 26;
        const maxOutTime = HERO_SKILLS.improvised_throw.range / 660;
        if (!p.returning && (p.life >= maxOutTime || !this.isPointWalkable(p.x + p.vx * dt, p.y + p.vy * dt, 6))) {
          p.returning = true;
          p.hitIds.clear(); // Allow bouncing pipe to clip enemies again on the return flight!
          soundEngine.playPipeClang(1.22, false);
          this.spawnBurstParticles(p.x, p.y, '#fb923c', 8, true);
        }

        if (p.returning) {
          const dx = this.player.x - p.x;
          const dy = this.player.y - 10 - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist <= 30 || p.visualOnly) {
            if (p.visualOnly && p.life < 0.75) {
              p.x += p.vx * dt;
              p.y += p.vy * dt;
              continue;
            }
            p.active = false;
            if (!p.visualOnly) {
              this.player.pipeThrown = false;
              this.player.swordX = this.player.x + Math.cos(this.player.facing - 0.8) * 26;
              this.player.swordY = this.player.y - 10 + Math.sin(this.player.facing - 0.8) * 16;
              soundEngine.playPickup();
              this.spawnBurstParticles(this.player.swordX, this.player.swordY, '#e2e8f0', 5, true);
            }
            continue;
          }
          const ang = Math.atan2(dy, dx);
          p.angle = ang;
          p.vx = Math.cos(ang) * 760;
          p.vy = Math.sin(ang) * 760;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (!p.visualOnly) {
          for (const e of this.enemies) {
            if (e.hp <= 0 || p.hitIds.has(e.id)) continue;
            if (Math.hypot(e.x - p.x, e.y - 8 - p.y) <= e.radius + p.radius) {
              p.hitIds.add(e.id);
              soundEngine.playPipeClang(p.returning ? 1.28 : 1.08, false);
              const hitDmg = p.returning ? Math.max(4, Math.round(p.damage * 0.72)) : p.damage;
              this.damageEnemy(e, hitDmg, p.isCrit, '#fb923c');
            }
          }
        }
        continue;
      }

      if (p.kind === 'life_leech_orb') {
        const dx = this.player.x - p.x;
        const dy = this.player.y - 10 - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= 22) {
          p.active = false;
          this.spawnBurstParticles(this.player.x, this.player.y - 12, '#4ade80', 4, true);
          continue;
        }
        const ang = Math.atan2(dy, dx);
        p.angle = ang;
        p.vx = Math.cos(ang) * 420;
        p.vy = Math.sin(ang) * 420;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        continue;
      }

      if (
        p.kind === 'homing_splinter' ||
        p.kind === 'ghost_wisp' ||
        p.kind === 'ghost_soul_orb' ||
        p.kind === 'homing_feather' ||
        p.kind === 'celestial_feather'
      ) {
        if (!p.fromPlayer) {
          // Corrupted Ghost Ranged Homing Basic Attacks & Spirit Legion wisps smoothly curve toward player!
          if (!this.localIsDowned && this.player.possessingTimer <= 0) {
            const desired = Math.atan2(this.player.y - 8 - p.y, this.player.x - p.x);
            let diff = desired - p.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            p.angle += diff * Math.min(1, dt * 3.2);
            const spd = Math.hypot(p.vx, p.vy);
            p.vx = Math.cos(p.angle) * spd;
            p.vy = Math.sin(p.angle) * spd;
          }
        } else {
          let target: EnemyEntity | null = null;
          if (p.targetEnemyId !== undefined && p.targetEnemyId >= 0) {
            for (const e of this.enemies) {
              if (e.id === p.targetEnemyId && e.hp > 0) {
                target = e;
                break;
              }
            }
          }
          if (!target) {
            if (this.player.huntersMarkTargetId) {
              for (const e of this.enemies) {
                if (e.id === this.player.huntersMarkTargetId && e.hp > 0) {
                  target = e;
                  p.targetEnemyId = target.id;
                  break;
                }
              }
            }
          }
          if (!target) {
            target = this.findNearestEnemyFrom(p.x, p.y, 440);
            if (target) p.targetEnemyId = target.id;
          }
          if (target) {
            const desired = Math.atan2(target.y - 8 - p.y, target.x - p.x);
            let diff = desired - p.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const turnRate =
              p.kind === 'homing_feather' || p.kind === 'celestial_feather'
                ? 13.5
                : p.kind === 'homing_splinter'
                  ? 9
                  : 11.8;
            p.angle += diff * Math.min(1, dt * turnRate);
            const spd = Math.hypot(p.vx, p.vy);
            p.vx = Math.cos(p.angle) * spd;
            p.vy = Math.sin(p.angle) * spd;
          }
        }
      }

      // Hunter's Mark projectile tracking: straight feather shots adjust trajectory to follow marked target!
      if (
        this.player.huntersMarkTargetId &&
        (p.kind === 'feather_shot' || p.kind === 'double_feather' || p.kind === 'piercing_feather')
      ) {
        for (const e of this.enemies) {
          if (e.id === this.player.huntersMarkTargetId && e.hp > 0) {
            const desired = Math.atan2(e.y - 8 - p.y, e.x - p.x);
            let diff = desired - p.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            if (Math.abs(diff) < Math.PI * 0.45) {
              p.angle += diff * Math.min(1, dt * 4.5);
              const spd = Math.hypot(p.vx, p.vy);
              p.vx = Math.cos(p.angle) * spd;
              p.vy = Math.sin(p.angle) * spd;
            }
            break;
          }
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const isGhostProj =
        p.kind === 'ghost_wisp' || p.kind === 'ghost_soul_orb' || p.kind === 'spectral_bolt';

      if (p.fromPlayer && Math.random() < (isGhostProj ? 0.45 : 0.65)) {
        this.spawnParticle({
          x: p.x + (Math.random() - 0.5) * 6,
          y: p.y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 24,
          vy: (Math.random() - 0.5) * 24 - (isGhostProj ? 10 : 0),
          size: p.kind === 'dark_wave' ? 5 : isGhostProj ? 3.4 : 3.2,
          endSize: 0,
          maxAge: 0.25,
          color: p.color,
          glow: true,
          shape: isGhostProj ? 'circle' : 'spark',
          rotation: p.angle,
          vRot: 0,
        });
      }

      // Spectral projectiles phase effortlessly through interior props while stopping at outer dungeon walls!
      if (!p.pierce && !this.isPointWalkable(p.x, p.y, 4, isGhostProj)) {
        p.active = false;
        this.spawnBurstParticles(p.x, p.y, p.color, 5, true);
        continue;
      }

      if (p.fromPlayer) {
        for (const e of this.enemies) {
          if (e.hp <= 0 || p.hitIds.has(e.id)) continue;
          if (Math.hypot(e.x - p.x, e.y - 8 - p.y) <= e.radius + p.radius) {
            p.hitIds.add(e.id);
            if (!p.visualOnly && p.kind === 'bone_spear') {
              e.armorCrackTimer = 4.5;
            } else if (p.kind === 'spectral_bolt') {
              if (!p.visualOnly) e.slowTimer = Math.max(e.slowTimer, 1.4);
              this.spawnSoftMotes(e.x, e.y, p.angle, 16, '#5eead4', 4);
            } else if (p.kind === 'ghost_soul_orb') {
              // 3rd-hit Astral Soul Orb triggers a resonant spiritual nova on impact!
              this.spawnGroundEffect(
                'astral_nova',
                p.x,
                p.y,
                0,
                0,
                0,
                74,
                0.32,
                '#c084fc',
                '#2dd4bf'
              );
              if (!p.visualOnly) {
                for (const other of this.enemies) {
                  if (other.id === e.id || other.hp <= 0) continue;
                  if (Math.hypot(other.x - p.x, other.y - p.y) <= 74 + other.radius) {
                    this.damageEnemy(
                      other,
                      Math.max(4, Math.round(p.damage * 0.55)),
                      false,
                      '#c084fc'
                    );
                  }
                }
              }
            } else if (p.kind === 'piercing_feather') {
              this.spawnArcBurst(p.x, p.y, p.angle, 38, '#38bdf8', 8);
              this.spawnSoftMotes(p.x, p.y, p.angle, 20, '#e0f2fe', 4);
            } else if (p.kind === 'tiger_rend_wave') {
              this.spawnArcBurst(p.x, p.y, p.angle, 34, '#f59e0b', 6);
              this.spawnSoftMotes(p.x, p.y, p.angle, 22, '#fef08a', 4);
            } else if (p.kind === 'heavenly_tiger_beast') {
              this.spawnArcBurst(p.x, p.y, p.angle, 60, '#fbbf24', 10);
              this.triggerShake(0.08, 2.5);
              if (!p.visualOnly && e.kind !== EnemyKind.TRAINING_DUMMY) {
                e.staggerTimer = Math.max(e.staggerTimer, 0.6);
                e.slowTimer = Math.max(e.slowTimer, 1.8);
              }
            }
            if (!p.visualOnly) {
              this.damageEnemy(e, p.damage, p.isCrit, p.color);
            } else {
              this.spawnBurstParticles(p.x, p.y, p.color, 4, true);
            }
            if (!p.pierce) {
              p.active = false;
              break;
            }
          }
        }
      } else {
        if (
          this.player.possessingTimer <= 0 &&
          !this.localIsDowned &&
          Math.hypot(this.player.x - p.x, this.player.y - p.y) <= 16 + p.radius
        ) {
          p.active = false;
          if (!this.isMultiplayer && !p.visualOnly) {
            this.damagePlayer(p.damage);
          } else {
            this.spawnBurstParticles(p.x, p.y, p.color, 5, true);
          }
        }
      }
    }
  }

  private updatePickups(dt: number) {
    if (this.localIsDowned) return;
    for (const orb of this.pickups) {
      if (!orb.active) continue;
      orb.age += dt;
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      orb.vx *= Math.pow(0.08, dt);
      orb.vy *= Math.pow(0.08, dt);

      const dx = this.player.x - orb.x;
      const dy = this.player.y - orb.y;
      const d = Math.hypot(dx, dy);
      if (d < 135) {
        const pull = 360 * dt;
        orb.x += (dx / Math.max(1, d)) * pull;
        orb.y += (dy / Math.max(1, d)) * pull;
      }
      if (d < 22) {
        orb.active = false;
        if (this.isMultiplayer && orb.id !== undefined) {
          multiplayerClient.sendLootPickup(orb.id);
          continue;
        }
        const eqStats = equipmentManager.getComputedStats(this.heroId);
        const resourceMult = eqStats.resourceMultiplier;
        if (orb.kind === 'xp') {
          soundEngine.playPickup();
          this.gainXp(Math.round(orb.value * resourceMult));
        } else if (orb.kind === 'heal') {
          soundEngine.playPickup();
          this.healPlayer(orb.value, true);
        } else if (orb.kind === 'boss_essence') {
          soundEngine.playSkill('ultimate');
          this.spawnRingEffect(this.player.x, this.player.y, 140, '#fbbf24');
          this.spawnBurstParticles(this.player.x, this.player.y - 12, '#fde047', 32, true);
          this.spawnFloatingText(this.player.x, this.player.y - 44, 'BOSS ESSENCE CLAIMED!', '#fbbf24', true);
          if (this.activeBlessings.length < this.maxBlessings) {
            setTimeout(() => {
              this.promptBlessingSelection();
            }, 300);
          }
        } else {
          soundEngine.playPickup();
          this.boneShards += Math.round(orb.value * resourceMult);
        }
      }
    }
  }

  private gainXp(amount: number) {
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      this.xpToNext = Math.round(this.xpToNext * 1.28);
      // Lessen chance to gain skill points: 30% chance on level up
      const rollSp = Math.random() < 0.30;
      if (rollSp) {
        this.skillPoints += 1;
        this.spawnFloatingText(this.player.x, this.player.y - 44, `LEVEL UP! +1 SP`, '#fde047', true);
      } else {
        this.spawnFloatingText(this.player.x, this.player.y - 44, `LEVEL UP! HP & ATK UP`, '#38bdf8', true);
      }
      this.recalcStats(true);
      soundEngine.playSkill('shield');
      this.spawnRingEffect(this.player.x, this.player.y, 110, '#fde047');
    }
  }

  private updateParticlesAndTexts(dt: number) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vRot * dt;
    }

    for (let i = 0; i < this.slashWaves.length; i++) {
      const sw = this.slashWaves[i];
      if (!sw.active) continue;
      sw.age += dt;
      if (sw.age >= sw.maxAge) {
        sw.active = false;
      }
    }

    for (let i = 0; i < this.pipeStrikes.length; i++) {
      const ps = this.pipeStrikes[i];
      if (!ps.active) continue;
      ps.age += dt;
      if (ps.age >= ps.maxAge) {
        ps.active = false;
      }
    }

    for (let i = 0; i < this.groundEffects.length; i++) {
      const ge = this.groundEffects[i];
      if (!ge.active) continue;
      ge.age += dt;
      if (ge.age >= ge.maxAge) {
        ge.active = false;
      }
    }

    for (let i = 0; i < this.siphonBeams.length; i++) {
      const sb = this.siphonBeams[i];
      if (!sb.active) continue;
      sb.age += dt;
      if (sb.age >= sb.maxAge) {
        sb.active = false;
      }
    }

    for (let i = 0; i < this.floatingTexts.length; i++) {
      const ft = this.floatingTexts[i];
      if (!ft.active) continue;
      ft.age += dt;
      if (ft.age >= ft.maxAge) {
        ft.active = false;
        continue;
      }
      ft.y += ft.vy * dt;
    }
  }

  private updateCamera(dt: number) {
    const smooth = 1 - Math.exp(-8.5 * dt);
    this.camX += (this.player.x - this.camX) * smooth;
    this.camY += (this.player.y - this.camY) * smooth;
  }

  private getEffectiveAtk(): number {
    let atk = this.baseAtk + (this.level - 1) * (this.heroId === 'ghost' ? 7 : 6);
    if (this.heroId === 'human') {
      if (this.player.lastStandTimer > 0) atk *= 1.32;
      if (this.player.oneManArmyTimer > 0) atk *= 1.25;
    } else if (this.heroId === 'ghost') {
      if (this.player.restlessStacks > 0) {
        const restRank = Math.max(1, this.skillRanks.restless_spirit || 1);
        atk *= 1 + this.player.restlessStacks * (0.08 + (restRank - 1) * 0.02);
      }
      if (this.player.nightmareTimer > 0) {
        const nightRank = Math.max(1, this.skillRanks.eternal_nightmare || 1);
        atk *= 1.38 + (nightRank - 1) * 0.12;
      }
    } else if (this.heroId === 'tigerkin') {
      if ((this.player.kingOfBeastsTimer ?? 0) > 0) atk *= 1.45;
      if (this.player.feralMomentumStacks && this.player.feralMomentumStacks > 0) {
        const momRank = Math.max(1, this.skillRanks.feral_momentum || 1);
        atk *= 1 + this.player.feralMomentumStacks * (0.05 + (momRank - 1) * 0.01);
      }
    } else if (this.player.colossusTimer > 0) {
      if (this.heroId === 'ghoul') {
        const apexRank = Math.max(1, this.skillRanks.apex_predator || 1);
        atk *= 1.6 + (apexRank - 1) * 0.15;
      } else if (this.heroId === 'zombie') {
        const abomRank = Math.max(1, this.skillRanks.abomination_form || 1);
        atk *= 1.6 + (abomRank - 1) * 0.15;
      } else {
        const colRank = Math.max(1, this.skillRanks.bone_colossus || 1);
        atk *= 1.55 + (colRank - 1) * 0.15;
      }
    }
    const eqStats = equipmentManager.getComputedStats(this.heroId);
    return atk * eqStats.atkMultiplier;
  }

  private rollPlayerDamage(multiplier: number, bonusCritChance: number): { dmg: number; isCrit: boolean } {
    let critChance = 0.1 + bonusCritChance;
    let critMult = 1.55;
    if (this.heroId === 'human') {
      const impRank = Math.max(1, this.skillRanks.improvised_fighter || 1);
      critChance = 0.18 + 0.08 + (impRank - 1) * 0.03 + bonusCritChance;
      critMult = 1.64 + (impRank - 1) * 0.08;
    } else if (this.heroId === 'skeleton') {
      const masteryRank = this.skillRanks.bone_mastery || 1;
      critChance = 0.15 + masteryRank * 0.05 + bonusCritChance;
      critMult = 1.6 + masteryRank * 0.12;
    } else if (this.heroId === 'ghoul') {
      const instRank = this.skillRanks.feral_instinct || 1;
      critChance = 0.25 + (instRank - 1) * 0.03 + bonusCritChance;
      critMult = 1.68 + (instRank - 1) * 0.08;
    } else if (this.heroId === 'ghost') {
      const restRank = this.skillRanks.restless_spirit || 1;
      critChance = 0.18 + this.player.restlessStacks * 0.02 + (restRank - 1) * 0.02 + bonusCritChance;
      critMult = 1.62 + (restRank - 1) * 0.06;
    } else if (this.heroId === 'eaglekin') {
      const eagleRank = Math.max(1, this.skillRanks.eagle_eyes || 1);
      critChance = 0.22 + 0.12 + (eagleRank - 1) * 0.03 + bonusCritChance;
      critMult = 1.75 + (eagleRank - 1) * 0.08;
    } else if (this.heroId === 'tigerkin') {
      const instRank = Math.max(1, this.skillRanks.predators_instinct || 1);
      critChance = 0.28 + (instRank - 1) * 0.04 + bonusCritChance;
      if ((this.player.kingOfBeastsTimer ?? 0) > 0) critChance += 0.25;
      critMult = 1.8 + (instRank - 1) * 0.08;
    }
    let blessingCrit = 0;
    for (const b of this.activeBlessings) {
      if (b.modifiers.critChanceBonus) {
        blessingCrit += b.modifiers.critChanceBonus;
      }
    }
    critChance += blessingCrit;

    const eqStats = equipmentManager.getComputedStats(this.heroId);
    critChance += eqStats.critChanceBonus;
    critMult *= eqStats.critDamageMultiplier;

    const isCrit = Math.random() < critChance;
    if (isCrit) {
      equipmentManager.onCriticalStrike(
        this.heroId,
        (amt) => this.healPlayer(amt, true),
        this.player.maxHp
      );
    }

    const raw = this.getEffectiveAtk() * multiplier * (0.93 + Math.random() * 0.14);
    const dmg = Math.max(1, Math.round(isCrit ? raw * critMult : raw));
    return { dmg, isCrit };
  }

  private hitEnemiesInCone(
    angle: number,
    range: number,
    coneWidth: number,
    multiplier: number,
    bonusCrit: number,
    sparkColor: string,
    slowDuration: number
  ) {
    const half = coneWidth / 2;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > range + e.radius) continue;

      const angToE = Math.atan2(dy, dx);
      let diff = angToE - angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      if (Math.abs(diff) <= half || dist < e.radius + 26) {
        if (slowDuration > 0) {
          e.slowTimer = Math.max(e.slowTimer, slowDuration);
        }
        const { dmg, isCrit } = this.rollPlayerDamage(multiplier, bonusCrit);
        this.damageEnemy(e, dmg, isCrit, sparkColor);
      }
    }
  }

  private applyZombieInfection(e: EnemyEntity) {
    if (this.heroId !== 'zombie') return;
    const rank = Math.max(1, this.skillRanks.infectious_touch || 1);
    const def = HERO_SKILLS.infectious_touch;
    const dpsMult = def.baseMultiplier + (rank - 1) * def.rankMultiplier;
    e.poisonTimer = 4.5;
    e.poisonDps = Math.max(e.poisonDps, this.getEffectiveAtk() * dpsMult);
  }

  private damageEnemyFromPoisonTick(e: EnemyEntity, dmg: number) {
    let remaining = dmg;
    if ((e.shieldHp || 0) > 0) {
      const absorbed = Math.min(e.shieldHp || 0, remaining);
      e.shieldHp = Math.max(0, (e.shieldHp || 0) - absorbed);
      remaining -= absorbed;
    }
    if (this.isMultiplayer) {
      e.hp = Math.max(1, e.hp - remaining);
      multiplayerClient.sendEnemyDamage(e.id, dmg, false, '#a3e635', e.slowTimer, e.staggerTimer);
    } else {
      e.hp = Math.max(0, e.hp - remaining);
    }
    this.spawnFloatingText(
      e.x + (Math.random() - 0.5) * 14,
      e.y - e.radius - 10,
      `${dmg}`,
      '#a3e635',
      false
    );
    if (!this.isMultiplayer && e.hp <= 0 && e.kind !== EnemyKind.TRAINING_DUMMY) {
      this.handleEnemyDefeated(e);
    }
  }

  private damageEnemy(e: EnemyEntity, rawDmg: number, isCrit: boolean, sparkColor: string) {
    let adjustedDmg = e.armorCrackTimer > 0 ? Math.round(rawDmg * 1.2) : rawDmg;

    // Human Passive 1 (Improvised Fighter): Unconventional swings catch enemies OFF GUARD every 4th hit!
    if (this.heroId === 'human' && !this.applyingOffGuardProc) {
      this.improvisedHitCounter += 1;
      if (this.improvisedHitCounter >= 4) {
        this.improvisedHitCounter = 0;
        const impRank = Math.max(1, this.skillRanks.improvised_fighter || 1);
        const bonusMult = 1 + 0.35 + (impRank - 1) * 0.08;
        adjustedDmg = Math.round(adjustedDmg * bonusMult);
        e.armorCrackTimer = Math.max(e.armorCrackTimer, 3.0);
        if (e.kind !== EnemyKind.TRAINING_DUMMY && !isBossKind(e.kind)) {
          e.staggerTimer = Math.max(e.staggerTimer, 0.52);
        }
        soundEngine.playPipeClang(1.35, false);
        this.spawnFloatingText(e.x, e.y - e.radius - 28, 'OFF GUARD!', '#fb923c', true);
      }
    }

    // Ghoul Passives on hit: Predator's Momentum stack ramp + Feral Instinct execution bonus vs weakened foes!
    if (this.heroId === 'ghoul') {
      this.player.momentumStacks = Math.min(8, this.player.momentumStacks + 1);
      this.momentumTimer = 3.6;

      const hpRatioBefore = e.hp / Math.max(1, e.maxHp);
      if (hpRatioBefore <= 0.45 || e.preyMarkTimer > 0) {
        const instRank = Math.max(1, this.skillRanks.feral_instinct || 1);
        const execMult = 1.22 + (instRank - 1) * 0.06;
        adjustedDmg = Math.round(adjustedDmg * execMult);
      }
    }

    // Eaglekin Passives & Marks on hit:
    if (this.heroId === 'eaglekin') {
      // Hunter's Mark: +35% damage bonus against marked enemies
      if (e.huntersMarkTimer && e.huntersMarkTimer > 0) {
        adjustedDmg = Math.round(adjustedDmg * 1.35);
      }
      // Passive 2: Predator's Precision (subsequent attacks become increasingly precise against same target, up to 5x)
      const precRank = Math.max(1, this.skillRanks.predators_precision || 1);
      const stacks = Math.min(5, (e.precisionHits || 0) + 1);
      e.precisionHits = stacks;
      const stackBonus = 1 + (stacks - 1) * (0.08 + (precRank - 1) * 0.02);
      adjustedDmg = Math.round(adjustedDmg * stackBonus);
      if (stacks > 1 && Math.random() < 0.35) {
        this.spawnFloatingText(e.x, e.y - e.radius - 28, `PRECISION x${stacks}!`, '#38bdf8', false);
      }
    }

    // Tigerkin Passives on hit: Feral Momentum stack building + Predator's Instinct execution bonus!
    if (this.heroId === 'tigerkin') {
      this.player.feralMomentumStacks = Math.min(5, (this.player.feralMomentumStacks || 0) + 1);
      this.player.feralMomentumTimer = 4.0;

      const hpRatioBefore = e.hp / Math.max(1, e.maxHp);
      if (hpRatioBefore <= 0.5) {
        const instRank = Math.max(1, this.skillRanks.predators_instinct || 1);
        const execMult = 1.25 + (instRank - 1) * 0.06;
        adjustedDmg = Math.round(adjustedDmg * execMult);
        if (Math.random() < 0.28) {
          this.spawnFloatingText(e.x, e.y - e.radius - 28, 'PREDATOR INSTINCT!', '#fbbf24', false);
        }
      }
    }

    // Corrupted Undead Legion Boss Passives:
    // - Corrupted Ghost: Ethereal Body + Restless Spirit (chance to phase-resist physical blows & intensify spirit motes!)
    // - Corrupted Skeleton: Eternal Framework (reinforced skeletal resilience while shielded!)
    if (e.isLegionBoss) {
      if (e.legionHeroId === 'ghost' && Math.random() < 0.16) {
        adjustedDmg = Math.max(1, Math.round(adjustedDmg * 0.45));
        e.bossBuffTimer = Math.max(e.bossBuffTimer || 0, 4.5);
        this.spawnFloatingText(e.x, e.y - e.radius - 26, 'ETHEREAL PHASE!', '#5eead4', false);
      } else if (e.legionHeroId === 'skeleton' && (e.shieldHp || 0) > 0) {
        adjustedDmg = Math.max(1, Math.round(adjustedDmg * 0.88));
      }
    }

    const finalDmg = adjustedDmg;
    e.hitFlash = 0.11;
    soundEngine.playHit(isCrit);

    let hpDmg = finalDmg;
    if ((e.shieldHp || 0) > 0) {
      const absorbed = Math.min(e.shieldHp || 0, hpDmg);
      e.shieldHp = Math.max(0, (e.shieldHp || 0) - absorbed);
      hpDmg -= absorbed;
    }

    if (this.isMultiplayer) {
      // Keep local HP >= 1 until server confirms s:enemy_died so death & loot never fire twice
      e.hp = Math.max(1, e.hp - hpDmg);
      multiplayerClient.sendEnemyDamage(
        e.id,
        finalDmg,
        isCrit,
        sparkColor,
        e.slowTimer,
        e.staggerTimer
      );
    } else {
      e.hp = Math.max(0, e.hp - hpDmg);
    }

    if (this.heroId === 'zombie') {
      this.applyZombieInfection(e);
      if (e.kind === EnemyKind.TRAINING_DUMMY || isBossKind(e.kind)) {
        this.carrionStrikeCounter += 1;
        if (this.carrionStrikeCounter >= 6) {
          this.carrionStrikeCounter = 0;
          this.triggerCarrionHunger(e.x, e.y, 0.5);
        }
      }
    }

    this.spawnFloatingText(
      e.x + (Math.random() - 0.5) * 18,
      e.y - e.radius - 14,
      isCrit ? `${finalDmg}!` : `${finalDmg}`,
      isCrit ? '#fde047' : '#f8fafc',
      isCrit
    );
    if (this.heroId === 'ghoul' || this.heroId === 'ghost') {
      this.spawnSoftMotes(e.x, e.y, this.player.facing, 12, sparkColor, isCrit ? 6 : 3);
    } else {
      this.spawnBurstParticles(e.x, e.y - 8, sparkColor, isCrit ? 10 : 5, true);
    }

    // Equipment on-hit combat hooks & poison chance
    const eqStats = equipmentManager.getComputedStats(this.heroId);
    if (eqStats.poisonChance > 0 && Math.random() < eqStats.poisonChance) {
      e.poisonTimer = Math.max(e.poisonTimer, 4.0);
      e.poisonDps = Math.max(e.poisonDps, Math.round(this.getEffectiveAtk() * 0.35));
    }
    if (this.currentAttackIsBasic) {
      equipmentManager.onBasicAttackHit(this.heroId, e.x, e.y, this.player.facing);
    } else {
      equipmentManager.onSkillHitEnemy(this.heroId, e.x, e.y);
    }

    // Skeleton Bone Mastery Passive: Critical Strikes spawn homing bone splinters
    if (this.heroId === 'skeleton') {
      const masteryRank = this.skillRanks.bone_mastery || 1;
      if (isCrit && masteryRank > 0 && Math.random() < 0.65) {
        const sa = Math.random() * Math.PI * 2;
        this.spawnProjectile({
          fromPlayer: true,
          kind: 'homing_splinter',
          x: this.player.x,
          y: this.player.y - 10,
          vx: Math.cos(sa) * 340,
          vy: Math.sin(sa) * 340,
          angle: sa,
          radius: 10,
          damage: Math.max(6, Math.round(this.getEffectiveAtk() * 0.45)),
          isCrit: false,
          pierce: false,
          maxLife: 0.9,
          color: '#f472b6',
        });
      }
    }

    // --- Active Blessing Combat Modifiers ---
    const blessingLifesteal = this.getBlessingLifesteal();
    if (blessingLifesteal > 0 && finalDmg > 0) {
      const healAmt = Math.max(1, Math.round(finalDmg * blessingLifesteal));
      this.healPlayer(healAmt, false);
      if (Math.random() < 0.35) {
        this.spawnFloatingText(this.player.x + (Math.random() - 0.5) * 16, this.player.y - 32, `+${healAmt}`, '#4ade80', false);
      }
    }

    let blessingBurn = 0;
    let blessingBurnDur = 3.0;
    let blessingSlow = 0;
    let blessingStagger = 0;
    let blessingChain = false;

    for (const b of this.activeBlessings) {
      if (b.modifiers.burnDpsPct) {
        blessingBurn = Math.max(blessingBurn, b.modifiers.burnDpsPct);
        blessingBurnDur = Math.max(blessingBurnDur, b.modifiers.durationBonus || 3.0);
      }
      if (b.modifiers.slowPct) blessingSlow = Math.max(blessingSlow, b.modifiers.slowPct);
      if (b.modifiers.staggerBonus) blessingStagger = Math.max(blessingStagger, b.modifiers.staggerBonus);
      if (b.modifiers.chainHits) blessingChain = true;
    }

    if (blessingBurn > 0) {
      e.poisonTimer = Math.max(e.poisonTimer, blessingBurnDur);
      e.poisonDps = Math.max(e.poisonDps, Math.round(this.getEffectiveAtk() * blessingBurn));
    }
    if (blessingSlow > 0) {
      e.slowTimer = Math.max(e.slowTimer, 2.5);
    }
    if (blessingStagger > 0 && Math.random() < 0.65) {
      e.staggerTimer = Math.max(e.staggerTimer, blessingStagger);
    }

    if (blessingChain && Math.random() < 0.6) {
      for (const other of this.enemies) {
        if (other.id === e.id || other.hp <= 0 || other.kind === EnemyKind.TRAINING_DUMMY) continue;
        if (Math.hypot(other.x - e.x, other.y - e.y) <= 190 + other.radius) {
          const sa = Math.atan2(other.y - e.y, other.x - e.x);
          this.spawnProjectile({
            fromPlayer: true,
            kind: this.heroId === 'ghost' ? 'ghost_wisp' : 'homing_splinter',
            x: e.x,
            y: e.y,
            vx: Math.cos(sa) * 420,
            vy: Math.sin(sa) * 420,
            angle: sa,
            radius: 12,
            damage: Math.max(6, Math.round(finalDmg * 0.35)),
            isCrit: false,
            pierce: false,
            maxLife: 0.85,
            color: this.heroId === 'ghost' ? '#818cf8' : '#f59e0b',
          });
          break;
        }
      }
    }

    if (!this.isMultiplayer && e.hp <= 0 && e.kind !== EnemyKind.TRAINING_DUMMY) {
      this.handleEnemyDefeated(e);
    }
  }

  private triggerCarrionHunger(fromX: number, fromY: number, scale = 1.0) {
    const rank = Math.max(1, this.skillRanks.carrion_hunger || 1);
    const def = HERO_SKILLS.carrion_hunger;
    const healPct = (def.baseMultiplier + (rank - 1) * def.rankMultiplier) * scale;
    const healAmt = Math.max(5, Math.round(this.player.maxHp * healPct));
    this.spawnSiphonBeam(fromX, fromY - 10, 0.45, '#4ade80');
    this.spawnLifeLeechOrb(fromX, fromY - 8, healAmt);
    this.healPlayer(healAmt, true);
  }

  private triggerLocalKillPassives(e: EnemyEntity) {
    // Zombie Passives on kill: Carrion Hunger vitality feast + Infectious Touch contagion spread!
    if (this.heroId === 'zombie') {
      this.triggerCarrionHunger(e.x, e.y, 1.0);
      if (e.poisonTimer > 0) {
        this.spawnGroundEffect('contagion_ring', e.x, e.y, 0, 0, 0, 135, 0.65, '#a3e635', '#c084fc');
        this.spawnRingEffect(e.x, e.y, 130, '#a3e635');
        for (const other of this.enemies) {
          if (other.id === e.id || other.hp <= 0) continue;
          if (Math.hypot(other.x - e.x, other.y - e.y) <= 135 + other.radius) {
            this.applyZombieInfection(other);
            this.spawnBurstParticles(other.x, other.y - 10, '#a3e635', 7, true);
          }
        }
      }
    } else if (this.heroId === 'ghoul') {
      if (e.pounceMarkTimer > 0) {
        this.cooldowns.feral_pounce = 0;
        this.spawnRingEffect(this.player.x, this.player.y, 65, '#fda4af');
        this.spawnFloatingText(this.player.x, this.player.y - 44, 'POUNCE RESET!', '#fda4af', true);
      }
      if (e.preyMarkTimer > 0 || this.huntStrikesLeft > 0) {
        this.huntStrikesLeft = Math.min(12, this.huntStrikesLeft + 1);
        this.huntChainTimer = Math.min(this.huntChainTimer > 0 ? this.huntChainTimer : 0.08, 0.08);
        for (const other of this.enemies) {
          if (other.id !== e.id && other.hp > 0 && Math.hypot(other.x - e.x, other.y - e.y) <= 360) {
            other.preyMarkTimer = Math.max(other.preyMarkTimer, 5.0);
          }
        }
      }
      this.healPlayer(Math.max(6, Math.round(this.player.maxHp * 0.045)), false);
    }
  }

  private handleEnemyDefeated(e: EnemyEntity) {
    this.spawnBurstParticles(e.x, e.y, '#f5f0e6', 16, false);
    this.triggerLocalKillPassives(e);

    equipmentManager.onEnemyDefeated(
      this.heroId,
      e.x,
      e.y,
      Boolean(e.poisonTimer && e.poisonTimer > 0),
      (amt) => this.healPlayer(amt, true),
      this.player.maxHp
    );

    const isBoss = isBossKind(e.kind);
    const orbCount = isBoss ? 10 : e.kind === EnemyKind.BRUTE ? 4 : 2;
    for (let i = 0; i < orbCount; i++) {
      this.spawnPickup(e.x, e.y, 'xp', isBoss ? 25 : 18);
    }
    this.spawnPickup(e.x, e.y, 'shard', isBoss ? 15 : 4);
    if (Math.random() < 0.28 || isBoss) {
      this.spawnPickup(e.x, e.y, 'heal', 32);
    }

    if (isBoss) {
      soundEngine.playSkill('ultimate');
      this.spawnBurstParticles(e.x, e.y, '#fde047', 48, true);
      this.spawnFloatingText(e.x, e.y - 48, 'BOSS VANQUISHED! ESSENCE DROPPED!', '#fbbf24', true);
      // Spawn Boss Essence! Only upon collecting this essence will the blessings show up!
      this.spawnPickup(e.x, e.y, 'boss_essence', 1);

      // Roll Corrupted Hero equipment drop
      let bossHeroId: HeroId = 'skeleton';
      if (e.legionHeroId) {
        bossHeroId = e.legionHeroId;
      } else if (e.kind === EnemyKind.BOSS_LEGION_SKELETON) {
        bossHeroId = 'skeleton';
      } else if (e.kind === EnemyKind.BOSS_LEGION_GHOST) {
        bossHeroId = 'ghost';
      } else if (e.kind === EnemyKind.BOSS_LEGION_ZOMBIE) {
        bossHeroId = 'zombie';
      } else if (e.kind === EnemyKind.BOSS_LEGION_GHOUL) {
        bossHeroId = 'ghoul';
      } else if (e.kind === EnemyKind.BOSS_LEGION_HUMAN) {
        bossHeroId = 'human';
      } else if (e.kind === EnemyKind.BOSS_LEGION_EAGLEKIN) {
        bossHeroId = 'eaglekin';
      } else if (e.kind === EnemyKind.BOSS_LEGION_TIGERKIN) {
        bossHeroId = 'tigerkin';
      }

      const dropPayload = equipmentManager.rollBossDrop(bossHeroId);
      this.spawnFloatingText(
        e.x,
        e.y - 74,
        `RELIC DROPPED: ${dropPayload.item.name.toUpperCase()}!`,
        dropPayload.collection.themeColor,
        true
      );
      soundEngine.playPickup();
      this.onEquipmentDrop?.(dropPayload);
    }
  }

  private damagePlayer(rawDmg: number) {
    if (this.isMultiplayer) return;
    if (
      this.runOutcome !== null ||
      this.dashTimer > 0 ||
      this.windstepDashTimer > 0 ||
      this.scrappersDashTimer > 0 ||
      this.player.oneManArmyTimer > 0 ||
      this.omaBlitzLeft > 0 ||
      this.phantomDashTimer > 0 ||
      this.player.possessingTimer > 0 ||
      this.pounceTimer > 0 ||
      this.blitzTimer > 0 ||
      this.shadowStepTimer > 0 ||
      this.carnageDashesLeft > 0 ||
      this.huntStrikesLeft > 0
    ) {
      return;
    }

    // Human Passive 2 (Survivor's Instinct): Instinctively evades & unleashes a pipe counterattack!
    if (this.heroId === 'human' && this.instinctCounterCooldown <= 0) {
      const survRank = Math.max(1, this.skillRanks.survivors_instinct || 1);
      const evadeChance =
        0.28 + (survRank - 1) * 0.04 + (this.player.instinctSurrounded ? 0.1 : 0);
      if (Math.random() < evadeChance) {
        this.instinctCounterCooldown = 1.1;
        soundEngine.playPipeClang(1.18, true);
        this.spawnPipeStrike(
          'street_sweep',
          this.player.x,
          this.player.y - 8,
          this.player.facing,
          122,
          1,
          0.24,
          '#38bdf8',
          '#fb923c'
        );
        this.spawnGroundEffect(
          'brawler_stance_ring',
          this.player.x,
          this.player.y + 4,
          0,
          0,
          0,
          96,
          0.42,
          '#38bdf8',
          '#fb923c'
        );
        this.spawnFloatingText(this.player.x, this.player.y - 38, 'EVADE & COUNTER!', '#38bdf8', true);

        this.applyingOffGuardProc = true;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
          if (d <= 128 + e.radius) {
            const { dmg, isCrit } = this.rollPlayerDamage(1.35 + (survRank - 1) * 0.18, 0.25);
            this.damageEnemy(e, dmg, isCrit, '#38bdf8');
            if (e.hp > 0 && e.kind !== EnemyKind.TRAINING_DUMMY && !isBossKind(e.kind)) {
              const ka = Math.atan2(e.y - this.player.y, e.x - this.player.x);
              this.tryMoveEntity(e.x, e.y, Math.cos(ka) * 44, Math.sin(ka) * 44, e.radius * 0.75, (nx, ny) => {
                e.x = nx;
                e.y = ny;
              });
            }
          }
        }
        this.applyingOffGuardProc = false;
        return;
      }
    }

    // Ghost Ethereal Body Passive: Incorporeal phase-evasion + Restless Spirit empowerment!
    if (this.heroId === 'ghost') {
      const ethRank = Math.max(1, this.skillRanks.ethereal_body || 1);
      const evadeChance = 0.24 + (ethRank - 1) * 0.04 + (this.player.nightmareTimer > 0 ? 0.12 : 0);
      if (Math.random() < evadeChance) {
        this.player.etherealShimmerTimer = 0.48;
        this.grantRestlessSpirit();
        soundEngine.playGhostWisp(1.32);
        this.spawnSoftMotes(this.player.x, this.player.y - 10, 0, 22, '#5eead4', 6);
        this.spawnFloatingText(this.player.x, this.player.y - 36, 'PHASED!', '#5eead4', false);
        return;
      }
    }

    let passiveRed = 0;
    if (this.heroId === 'human') {
      const survRank = Math.max(1, this.skillRanks.survivors_instinct || 1);
      passiveRed =
        (this.player.instinctSurrounded ? 0.15 + (survRank - 1) * 0.03 : 0.08) +
        (this.player.lastStandTimer > 0 ? 0.28 : 0);
    } else if (this.heroId === 'skeleton') {
      const eternalRank = this.skillRanks.eternal_framework || 1;
      passiveRed = 0.1 + (eternalRank - 1) * 0.05;
    } else if (this.heroId === 'ghoul') {
      passiveRed = this.player.momentumStacks * 0.025 + (this.player.colossusTimer > 0 ? 0.25 : 0);
    } else if (this.heroId === 'ghost') {
      const ethRank = Math.max(1, this.skillRanks.ethereal_body || 1);
      passiveRed = 0.12 + (ethRank - 1) * 0.03 + (this.player.nightmareTimer > 0 ? 0.18 : 0);
    } else if (this.player.colossusTimer > 0) {
      passiveRed = 0.35;
    }

    const stormRed = this.player.boneStormTimer > 0 ? 0.3 : 0;
    const undyingRed = this.player.undyingTimer > 0 ? 0.35 : 0;
    const eqStats = equipmentManager.getComputedStats(this.heroId);
    const defReduction = eqStats.defenseReduction;
    const totalMult = Math.max(0.15, (1 - passiveRed - defReduction) * (1 - stormRed) * (1 - undyingRed));

    let dmg = Math.max(1, Math.round(rawDmg * totalMult));

    if (this.player.shield > 0) {
      const absorbed = Math.min(this.player.shield, dmg);
      this.player.shield -= absorbed;
      dmg -= absorbed;
      if (this.player.shield <= 0) {
        this.player.ribShieldTimer = 0;
      }
      this.spawnBurstParticles(this.player.x, this.player.y - 10, '#fde68a', 7, true);
    }

    if (dmg > 0) {
      this.player.hp = Math.max(0, this.player.hp - dmg);
      this.player.hitFlash = 0.14;
      this.triggerShake(0.12, 4);
      soundEngine.playHit(false);
      this.spawnFloatingText(this.player.x, this.player.y - 32, `-${dmg}`, '#fb7185', false);

      equipmentManager.onTakeDamage(
        this.heroId,
        this.player.hp,
        this.player.maxHp,
        (shieldHp) => {
          this.player.shield = Math.max(this.player.shield, shieldHp);
          soundEngine.playSkill('shield');
          this.spawnRingEffect(this.player.x, this.player.y, 85, '#5eead4');
        }
      );
    } else {
      this.spawnFloatingText(this.player.x, this.player.y - 32, 'BLOCKED', '#fde68a', false);
    }

    if (this.player.hp <= 0) {
      this.runOutcome = 'defeat';
      this.emitHudSnapshot();
    }
  }

  private hasNearbyVulnerablePrey(maxDist: number): boolean {
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.kind === EnemyKind.TRAINING_DUMMY) continue;
      if ((e.hp / Math.max(1, e.maxHp) <= 0.45 || e.preyMarkTimer > 0) &&
          Math.hypot(e.x - this.player.x, e.y - this.player.y) <= maxDist) {
        return true;
      }
    }
    return false;
  }

  private findNearestEnemyFrom(fromX: number, fromY: number, maxDist: number): EnemyEntity | null {
    let best: EnemyEntity | null = null;
    let bestDist = maxDist;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - fromX, e.y - fromY);
      if (d <= bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  private findNearestEnemy(maxDist: number): EnemyEntity | null {
    let best: EnemyEntity | null = null;
    let bestScore = maxDist;
    const isGhoul = this.heroId === 'ghoul';
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d > maxDist) continue;
      // Ghoul Feral Instinct: instinctively prioritizes weakened targets close to defeat!
      const score =
        isGhoul && (e.hp / Math.max(1, e.maxHp) <= 0.45 || e.preyMarkTimer > 0)
          ? d * 0.58
          : d;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  private isSinglePointWalkable(px: number, py: number): boolean {
    for (let i = 0; i < this.map.walkableRects.length; i++) {
      const r = this.map.walkableRects[i];
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
        return true;
      }
    }
    return false;
  }

  private isPointWalkable(x: number, y: number, radius: number, ignoreProps = false): boolean {
    const diag = radius * 0.7071;
    if (
      !this.isSinglePointWalkable(x, y) ||
      !this.isSinglePointWalkable(x + radius, y) ||
      !this.isSinglePointWalkable(x - radius, y) ||
      !this.isSinglePointWalkable(x, y + radius) ||
      !this.isSinglePointWalkable(x, y - radius) ||
      !this.isSinglePointWalkable(x + diag, y + diag) ||
      !this.isSinglePointWalkable(x - diag, y + diag) ||
      !this.isSinglePointWalkable(x + diag, y - diag) ||
      !this.isSinglePointWalkable(x - diag, y - diag)
    ) {
      return false;
    }

    if (!ignoreProps) {
      for (const prop of this.map.props) {
        if (!prop.solid) continue;
        if (
          x + radius > prop.x &&
          x - radius < prop.x + prop.w &&
          y + radius > prop.y &&
          y - radius < prop.y + prop.h
        ) {
          return false;
        }
      }
    }
    return true;
  }

  private tryMoveEntity(
    x: number,
    y: number,
    dx: number,
    dy: number,
    radius: number,
    apply: (nx: number, ny: number) => void,
    ignoreProps = false
  ) {
    let nx = x;
    let ny = y;
    if (this.isPointWalkable(x + dx, y, radius, ignoreProps)) {
      nx = x + dx;
    }
    if (this.isPointWalkable(nx, y + dy, radius, ignoreProps)) {
      ny = y + dy;
    }
    apply(nx, ny);
  }

  private pushSwordTrailPoint(
    tipX: number,
    tipY: number,
    baseX: number,
    baseY: number,
    color: string,
    glowColor: string,
    isSkillTrail: boolean,
    hand: 0 | 1 = 0
  ) {
    let slot: SwordTrailPoint | null = null;
    let oldest: SwordTrailPoint = this.swordTrail[0];
    for (let i = 0; i < this.swordTrail.length; i++) {
      const pt = this.swordTrail[i];
      if (!pt.active) {
        slot = pt;
        break;
      }
      if (pt.age > oldest.age) oldest = pt;
    }
    const target = slot || oldest;
    target.active = true;
    target.hand = hand;
    target.tipX = tipX;
    target.tipY = tipY;
    target.baseX = baseX;
    target.baseY = baseY;
    target.age = 0;
    target.maxAge = isSkillTrail ? 0.19 : 0.135;
    target.color = color;
    target.glowColor = glowColor;
    target.isSkillTrail = isSkillTrail;
  }

  private spawnParticle(cfg: Omit<Particle, 'active' | 'age'>) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.age = 0;
        p.x = cfg.x;
        p.y = cfg.y;
        p.vx = cfg.vx;
        p.vy = cfg.vy;
        p.size = cfg.size;
        p.endSize = cfg.endSize;
        p.maxAge = cfg.maxAge;
        p.color = cfg.color;
        p.glow = cfg.glow;
        p.shape = cfg.shape;
        p.rotation = cfg.rotation;
        p.vRot = cfg.vRot;
        return;
      }
    }
  }

  private spawnBurstParticles(x: number, y: number, color: string, count: number, glow: boolean) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 45 + Math.random() * 115;
      this.spawnParticle({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 3.5 + Math.random() * 3,
        endSize: 0,
        maxAge: 0.28 + Math.random() * 0.22,
        color,
        glow,
        shape: glow ? 'spark' : 'bone',
        rotation: a,
        vRot: (Math.random() - 0.5) * 9,
      });
    }
  }

  private spawnArcBurst(x: number, y: number, angle: number, radius: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * 1.6;
      const r = radius * (0.45 + Math.random() * 0.55);
      this.spawnParticle({
        x: x + Math.cos(a) * r,
        y: y - 8 + Math.sin(a) * r,
        vx: Math.cos(a) * (40 + Math.random() * 70),
        vy: Math.sin(a) * (40 + Math.random() * 70),
        size: 4.2 + Math.random() * 3,
        endSize: 0,
        maxAge: 0.32 + Math.random() * 0.16,
        color,
        glow: true,
        shape: 'spark',
        rotation: a,
        vRot: 0,
      });
    }
  }

  /**
   * Soft, glowing dusk-rose / emerald circle motes (pleasing to the eye, zero harsh spiky line clutter)
   */
  private spawnSoftMotes(x: number, y: number, angle: number, radius: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const a = radius > 16 ? angle + (Math.random() - 0.5) * 1.4 : Math.random() * Math.PI * 2;
      const r = radius * (0.35 + Math.random() * 0.65);
      const spd = 24 + Math.random() * 48;
      this.spawnParticle({
        x: x + Math.cos(a) * r,
        y: y - 8 + Math.sin(a) * r,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 14,
        size: 3.0 + Math.random() * 2.2,
        endSize: 0,
        maxAge: 0.28 + Math.random() * 0.16,
        color: i % 3 === 0 ? '#fff1f2' : color,
        glow: true,
        shape: 'circle',
        rotation: 0,
        vRot: 0,
      });
    }
  }

  private spawnRingEffect(x: number, y: number, endRadius: number, color: string) {
    this.spawnParticle({
      x,
      y,
      vx: 0,
      vy: 0,
      size: 16,
      endSize: endRadius,
      maxAge: 0.34,
      color,
      glow: true,
      shape: 'ring',
      rotation: 0,
      vRot: 0,
    });
  }

  private spawnProjectile(cfg: Omit<Projectile, 'active' | 'life' | 'hitIds'>) {
    for (const pr of this.projectiles) {
      if (!pr.active) {
        pr.active = true;
        pr.fromPlayer = cfg.fromPlayer;
        pr.visualOnly = Boolean(cfg.visualOnly);
        pr.kind = cfg.kind;
        pr.x = cfg.x;
        pr.y = cfg.y;
        pr.vx = cfg.vx;
        pr.vy = cfg.vy;
        pr.angle = cfg.angle;
        pr.radius = cfg.radius;
        pr.damage = cfg.damage;
        pr.isCrit = cfg.isCrit;
        const eqStats = equipmentManager.getComputedStats(this.heroId);
        pr.pierce = (cfg.fromPlayer && eqStats.projectilePierce) ? true : cfg.pierce;
        pr.isBasicAttack = cfg.isBasicAttack !== undefined ? cfg.isBasicAttack : this.currentAttackIsBasic;
        pr.hitIds.clear();
        pr.life = 0;
        pr.maxLife = cfg.maxLife;
        pr.color = cfg.color;
        pr.targetEnemyId = cfg.targetEnemyId;
        pr.returning = cfg.returning;
        pr.spinAngle = cfg.spinAngle;
        return;
      }
    }
  }

  private spawnPickup(
    x: number,
    y: number,
    kind: 'xp' | 'heal' | 'shard' | 'boss_essence',
    value: number,
    id?: number,
    exactPosition = false
  ) {
    for (const orb of this.pickups) {
      if (!orb.active) {
        const a = Math.random() * Math.PI * 2;
        const spd = exactPosition ? 18 : 60 + Math.random() * 90;
        orb.active = true;
        orb.id = id;
        orb.kind = kind;
        orb.x = x;
        orb.y = y;
        orb.vx = Math.cos(a) * spd;
        orb.vy = Math.sin(a) * spd;
        orb.value = value;
        orb.age = 0;
        return;
      }
    }
  }

  private spawnFloatingText(x: number, y: number, text: string, color: string, isCrit: boolean) {
    for (const ft of this.floatingTexts) {
      if (!ft.active) {
        ft.active = true;
        ft.x = x;
        ft.y = y;
        ft.vy = isCrit ? -52 : -36;
        ft.text = text;
        ft.color = color;
        ft.isCrit = isCrit;
        ft.age = 0;
        ft.maxAge = isCrit ? 0.85 : 0.65;
        return;
      }
    }
  }

  private triggerShake(duration: number, strength: number) {
    this.shakeTimer = Math.max(this.shakeTimer, duration);
    this.shakeStrength = Math.max(this.shakeStrength, strength);
  }

  public emitHudSnapshot() {
    let nearInteraction: HudSnapshot['nearInteraction'] = null;
    for (const prop of this.map.props) {
      const cx = prop.x + prop.w / 2;
      const cy = prop.y + prop.h / 2;
      if (Math.hypot(cx - this.player.x, cy - this.player.y) <= 92) {
        if (prop.kind === 'door_dungeon') nearInteraction = 'door_dungeon';
        else if (prop.kind === 'skill_shrine') nearInteraction = 'skill_shrine';
        else if (prop.kind === 'chest' && !prop.opened) nearInteraction = 'chest';
        else if (prop.kind === 'blessing_statue' && !prop.opened) nearInteraction = 'blessing_statue';
        else if (prop.kind === 'portal_next') nearInteraction = 'portal_next';
        else if (prop.kind === 'portal_guild') nearInteraction = 'portal_guild';
      }
    }

    let enemiesRemaining = 0;
    let bossInfo: HudSnapshot['bossInfo'] = null;
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.kind === EnemyKind.TRAINING_DUMMY) continue;
      enemiesRemaining += 1;
      if (isBossKind(e.kind)) {
        const dist = Math.hypot(e.x - this.player.x, e.y - this.player.y);
        if (dist < 850) {
          bossInfo = {
            name: e.name,
            hp: e.hp,
            maxHp: e.maxHp,
            shield: Math.round(e.shieldHp || 0),
            isLegionBoss: e.isLegionBoss,
            title: e.isLegionBoss ? 'UNDEAD LEGION BOSS' : 'GRAVEYARD WARDEN',
          };
        }
      }
    }

    const maxCooldowns = STATIC_MAX_COOLDOWNS;

    let minimap: HudSnapshot['minimap'] = null;
    if (!this.map.isGuild) {
      const enemyDots: MinimapEnemyDot[] = [];
      for (const e of this.enemies) {
        if (e.hp <= 0 || e.kind === EnemyKind.TRAINING_DUMMY) continue;
        enemyDots.push({
          x: e.x,
          y: e.y,
          isBoss: isBossKind(e.kind),
          isVulnerable: e.hp / Math.max(1, e.maxHp) <= 0.45 || e.preyMarkTimer > 0,
        });
      }

      const markers: MinimapMarker[] = [];
      for (const prop of this.map.props) {
        if (prop.kind === 'chest' && !prop.opened) {
          markers.push({ x: prop.x + prop.w / 2, y: prop.y + prop.h / 2, kind: 'chest' });
        } else if (prop.kind === 'blessing_statue' && !prop.opened) {
          markers.push({ x: prop.x + prop.w / 2, y: prop.y + prop.h / 2, kind: 'blessing_statue' });
        } else if (prop.kind === 'portal_next') {
          markers.push({ x: prop.x + prop.w / 2, y: prop.y + prop.h / 2, kind: 'portal_next' });
        } else if (prop.kind === 'portal_guild') {
          markers.push({ x: prop.x + prop.w / 2, y: prop.y + prop.h / 2, kind: 'portal_guild' });
        }
      }

      const teammates: MinimapTeammateDot[] = [];
      if (this.isMultiplayer) {
        for (const rp of this.remotePlayers.values()) {
          if (rp.disconnected) continue;
          teammates.push({
            id: rp.id,
            name: rp.name,
            heroId: rp.heroId,
            x: rp.x,
            y: rp.y,
            isDowned: rp.isDowned,
          });
        }
      }

      minimap = {
        width: this.map.width,
        height: this.map.height,
        playerX: this.player.x,
        playerY: this.player.y,
        playerFacing: this.player.facing,
        walkableRects: this.map.walkableRects,
        rooms: this.map.rooms,
        enemies: enemyDots,
        markers,
        teammates,
      };
    }

    this.onHudUpdate({
      heroId: this.heroId,
      hp: Math.round(this.player.hp),
      maxHp: Math.round(this.player.maxHp),
      shield: Math.round(this.player.shield),
      level: this.level,
      xp: this.xp,
      xpToNext: this.xpToNext,
      boneShards: this.boneShards,
      skillPoints: this.skillPoints,
      floor: this.map.floor,
      enemiesRemaining,
      cooldowns: { ...this.cooldowns },
      maxCooldowns,
      nearInteraction: this.localIsDowned ? null : nearInteraction,
      bossInfo,
      runOutcome: this.runOutcome,
      minimap,
      isDowned: this.localIsDowned,
      reviveProgress: this.localReviveProgress,
      portalWaiting: this.portalWaitingState,
      activeBlessings: [...this.activeBlessings],
      maxBlessings: this.maxBlessings,
    });
  }
}
