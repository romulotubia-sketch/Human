import {
  ALL_EQUIPMENT_ITEMS,
  EQUIPMENT_BY_ID,
  EQUIPMENT_COLLECTIONS,
  getEnhancementCost,
  getEnhancementSuccessRate,
  getEquipmentForCollection,
  getNextMilestone,
  getUpgradedItemInfo,
  HERO_TO_COLLECTION,
} from '../data/equipmentData';
import {
  ALL_EQUIPMENT_SLOTS,
  EquipmentCollectionId,
  EquipmentDropPayload,
  EquipmentItemDef,
  EquipmentSlot,
  EquipmentStateSnapshot,
  HeroEquipmentLoadout,
} from '../types/equipment';
import { HeroId } from '../types/game';

const INVENTORY_STORAGE_KEY = 'bonehearth_equipment_inventory_v2';
const LEGACY_INVENTORY_KEY = 'bonehearth_equipment_inventory_v1';
const EQUIPPED_STORAGE_KEY = 'bonehearth_hero_equipped_v2';
const LEGACY_EQUIPPED_KEY = 'bonehearth_hero_equipped_v1';
const ENHANCEMENT_STORAGE_KEY = 'bonehearth_equipment_enhancements_v1';

const ALL_HERO_IDS: HeroId[] = [
  'human',
  'skeleton',
  'zombie',
  'ghoul',
  'ghost',
  'eaglekin',
  'tigerkin',
  'batkin',
];

function createDefaultLoadout(): HeroEquipmentLoadout {
  return {
    weapon: null,
    armor: null,
    spirit: null,
    ancient: null,
    accessory: null,
    core: null,
  };
}

const EMPTY_STATS = Object.freeze({
  atkMultiplier: 1.0,
  flatMaxHpBonus: 0,
  defenseReduction: 0,
  critChanceBonus: 0,
  critDamageMultiplier: 1.0,
  speedMultiplier: 1.0,
  cooldownReduction: 0,
  resourceMultiplier: 1.0,
  onKillHealPercent: 0,
  onKillAtkBoostPercent: 0,
  poisonChance: 0,
  consecutiveAtkSpeedBonus: 0,
  basicAttackDamageMultiplier: 1.0,
  projectileAtkMultiplier: 1.0,
  projectilePierce: false,
  spectralBarrierOnHit: false,
  seekingSpiritOnSkill: false,
  explosiveOnPoisonDefeat: false,
  explosiveSkillProc: false,
  // 6-slot additions
  critBoneFragmentChance: 0,
  spectralEchoOnSkill: false,
  healingEssenceOnPoisonKill: false,
  consecutiveHealChance: 0,
  hunterMarkOnHit: false,
  energyBurstProc: false,
  windBladeOnHit: false,
  projectileRangeMultiplier: 1.0,
  meleeProximityMultiplier: 1.0,
  shockwaveOnConsecutive: false,
  // Nocturne Regalia
  secondarySonicChance: 0,
  movementPulseOnMove: false,
  secondaryVibrationOnSkill: false,
  criticalSoundWaveChance: 0,
  frequencyStackProc: false,
  resonanceBarrierOnDamage: false,
});

export class EquipmentManager {
  private ownedEquipmentIds: Set<string> = new Set();
  private enhancementLevels: Record<string, number> = {};
  private equippedByHero: Record<HeroId, HeroEquipmentLoadout> = {
    human: createDefaultLoadout(),
    skeleton: createDefaultLoadout(),
    zombie: createDefaultLoadout(),
    ghoul: createDefaultLoadout(),
    ghost: createDefaultLoadout(),
    eaglekin: createDefaultLoadout(),
    tigerkin: createDefaultLoadout(),
    batkin: createDefaultLoadout(),
  };

  private _isDungeonActive = false;
  private setCountsCache: Partial<Record<HeroId, Record<EquipmentCollectionId, number>>> = {};

  private invalidateCache() {
    this.setCountsCache = {};
  }

  // Runtime combat triggers & state counters
  public boneEnergyStacks = 0; // Skeleton 4-pc: 0-5
  public ghostwalkSkillCounter = 0; // Ghost 4-pc: 0-3
  public spectralFlowTimer = 0; // Ghost 2-pc: movement speed boost timer
  public etherealMaskCooldown = 0; // Ghost Ancient: 8s cooldown
  public huntingMomentumStacks = 0; // Ghoul 2-pc/4-pc: 0-5
  public huntingMomentumTimer = 0;
  public beastsTrophyStacks = 0; // Ghoul Ancient: 0-3
  public beastsTrophyTimer = 0;
  public improvisedTacticsReady = false; // Human 2-pc: next basic attack empowered
  public lastSurvivorCooldown = 0; // Human 4-pc: 30s recovery period
  public adaptationEnergy = 0; // Human 6-pc: 0-3
  public lastSkillUsedId: string | null = null;
  public windCharges = 0; // Eaglekin 4-pc / 6-pc: 0-5
  public feralDominanceStacks = 0; // Tigerkin 2-pc/4-pc/6-pc: 0-5
  public feralDominanceTimer = 0;
  public consecutiveHitCount = 0; // Savage Claw / Savage Bracers
  public consecutiveHitTimer = 0;
  public targetHitCounts: Map<number, number> = new Map(); // Hunter's Markstone tracking
  public plagueIncarnateTick = 2.0; // Zombie 4-pc: periodic toxic bursts
  // Nocturne Regalia (Batkin) combat triggers & state
  public resonantOverloadStacks = 0; // Nocturne 4-pc: 0-5
  public echoEnergyStacks = 0; // Staff of the First Echo +12: 0-4
  public frequencyStacks = 0; // Ring of Endless Frequencies: 0-5
  public silentWingsMoveTimer = 0; // Mantle of Silent Wings: pulses while moving
  public silentWingsShieldTimer = 0; // Mantle +15: moving 3s creates shield
  public heartOfNocturneCooldown = 0; // Heart of Nocturne sound burst cd

  // Callbacks for visual & combat procs into engine
  public onTriggerBoneShockwave?: () => void;
  public onTriggerGhostwalkEcho?: () => void;
  public onTriggerApexClawWave?: () => void;
  public onTriggerLastSurvivorProc?: () => void;
  public onTriggerTempestWingsHurricane?: () => void;
  public onTriggerRoarOfApex?: () => void;
  public onTriggerSeekingSpirit?: (x: number, y: number) => void;
  public onTriggerShrapnelExplosion?: (x: number, y: number) => void;
  public onTriggerToxicBurst?: (x: number, y: number) => void;
  public onTriggerWindBlade?: (x: number, y: number, angle: number) => void;
  // 6-Piece Set Callbacks
  public onTriggerSpectralWarrior?: () => void; // Skeleton 6-pc
  public onTriggerEternalApparition?: () => void; // Ghost 6-pc
  public onTriggerWalkingPlague?: (x: number, y: number) => void; // Zombie 6-pc
  public onTriggerEndlessPursuit?: () => void; // Ghoul 6-pc
  public onTriggerResourcefulGenius?: () => void; // Human 6-pc
  public onTriggerSovereignBarrage?: () => void; // Eaglekin 6-pc
  public onTriggerPrimalOverlord?: () => void; // Tigerkin 6-pc
  public onTriggerLordOfEternalEcho?: () => void; // Nocturne 6-pc bat swarm
  // Core/Accessory Procs
  public onTriggerBoneFragments?: (x: number, y: number) => void;
  public onTriggerSpectralEcho?: (x: number, y: number, angle: number) => void;
  public onTriggerEnergyBurst?: (x: number, y: number) => void;
  public onTriggerConsecutiveShockwave?: (x: number, y: number) => void;
  public onTriggerResonantOverload?: (x: number, y: number) => void;
  public onTriggerEchoDelayed?: (x: number, y: number, damage: number) => void;
  public onTriggerSoundPulse?: (x: number, y: number, dmg: number) => void;
  public onTriggerResonanceVibration?: (x: number, y: number, dmg: number) => void;
  public onTriggerSecondarySonic?: (x: number, y: number, angle: number) => void;
  public onTriggerDefensiveSoundBurst?: (x: number, y: number) => void;

  constructor() {
    this.loadFromStorage();
  }

  public loadFromStorage() {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }
      // 1. Clean starter equipment purge before entering the dungeon.
      // Equipment drops exclusively from Corrupted Hero bosses inside dungeons.
      const CLEAN_START_V6_KEY = 'bonehearth_clean_start_v6';
      if (localStorage.getItem(CLEAN_START_V6_KEY) !== 'true') {
        localStorage.removeItem(INVENTORY_STORAGE_KEY);
        localStorage.removeItem(LEGACY_INVENTORY_KEY);
        localStorage.removeItem(EQUIPPED_STORAGE_KEY);
        localStorage.removeItem(LEGACY_EQUIPPED_KEY);
        localStorage.removeItem(ENHANCEMENT_STORAGE_KEY);
        this.ownedEquipmentIds.clear();
        for (const h of ALL_HERO_IDS) {
          this.equippedByHero[h] = createDefaultLoadout();
        }
        this.enhancementLevels = {};
        localStorage.setItem(CLEAN_START_V6_KEY, 'true');
        this.saveToStorage();
        return;
      }

      // 2. Inventory loading with backward compatibility
      let invRaw = localStorage.getItem(INVENTORY_STORAGE_KEY);
      if (!invRaw) {
        invRaw = localStorage.getItem(LEGACY_INVENTORY_KEY);
      }
      if (invRaw) {
        const parsed = JSON.parse(invRaw);
        if (Array.isArray(parsed)) {
          this.ownedEquipmentIds = new Set(parsed.filter((id) => EQUIPMENT_BY_ID[id]));
        }
      }

      // 2. Enhancement levels loading
      const enhRaw = localStorage.getItem(ENHANCEMENT_STORAGE_KEY);
      if (enhRaw) {
        const parsed = JSON.parse(enhRaw);
        if (parsed && typeof parsed === 'object') {
          for (const [id, lvl] of Object.entries(parsed)) {
            if (EQUIPMENT_BY_ID[id] && typeof lvl === 'number' && lvl >= 0) {
              this.enhancementLevels[id] = Math.floor(lvl);
            }
          }
        }
      }

      // 3. Equipped loadouts loading with 6-slot migration
      let eqRaw = localStorage.getItem(EQUIPPED_STORAGE_KEY);
      if (!eqRaw) {
        eqRaw = localStorage.getItem(LEGACY_EQUIPPED_KEY);
      }
      if (eqRaw) {
        const parsed = JSON.parse(eqRaw);
        for (const h of ALL_HERO_IDS) {
          if (parsed[h]) {
            const hLoadout = parsed[h];
            this.equippedByHero[h] = {
              weapon: hLoadout.weapon && EQUIPMENT_BY_ID[hLoadout.weapon] ? hLoadout.weapon : null,
              armor: hLoadout.armor && EQUIPMENT_BY_ID[hLoadout.armor] ? hLoadout.armor : null,
              spirit: hLoadout.spirit && EQUIPMENT_BY_ID[hLoadout.spirit] ? hLoadout.spirit : null,
              ancient: hLoadout.ancient && EQUIPMENT_BY_ID[hLoadout.ancient] ? hLoadout.ancient : null,
              accessory: hLoadout.accessory && EQUIPMENT_BY_ID[hLoadout.accessory] ? hLoadout.accessory : null,
              core: hLoadout.core && EQUIPMENT_BY_ID[hLoadout.core] ? hLoadout.core : null,
            };
          }
        }

        // Validate that equipped items are actually owned
        for (const h of ALL_HERO_IDS) {
          const ld = this.equippedByHero[h];
          if (ld) {
            for (const s of ALL_EQUIPMENT_SLOTS) {
              if (ld[s] && !this.ownedEquipmentIds.has(ld[s]!)) {
                ld[s] = null;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load equipment data from storage:', e);
    }
  }

  public saveToStorage() {
    this.invalidateCache();
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify([...this.ownedEquipmentIds]));
      localStorage.setItem(EQUIPPED_STORAGE_KEY, JSON.stringify(this.equippedByHero));
      localStorage.setItem(ENHANCEMENT_STORAGE_KEY, JSON.stringify(this.enhancementLevels));
    } catch (e) {
      console.warn('Failed to save equipment data to storage:', e);
    }
  }

  public setDungeonActive(active: boolean) {
    this._isDungeonActive = active;
    this.invalidateCache();
    if (!active) {
      // Reset runtime transient buff states when exiting dungeon
      this.boneEnergyStacks = 0;
      this.ghostwalkSkillCounter = 0;
      this.spectralFlowTimer = 0;
      this.huntingMomentumStacks = 0;
      this.huntingMomentumTimer = 0;
      this.beastsTrophyStacks = 0;
      this.beastsTrophyTimer = 0;
      this.improvisedTacticsReady = false;
      this.adaptationEnergy = 0;
      this.lastSkillUsedId = null;
      this.windCharges = 0;
      this.feralDominanceStacks = 0;
      this.feralDominanceTimer = 0;
      this.consecutiveHitCount = 0;
      this.consecutiveHitTimer = 0;
      this.targetHitCounts.clear();
    }
  }

  public getIsDungeonActive(): boolean {
    return this._isDungeonActive;
  }

  public get isDungeonActive(): boolean {
    return this._isDungeonActive;
  }

  public getEnhancementLevel(itemId: string): number {
    return this.enhancementLevels[itemId] || 0;
  }

  public enhanceItem(
    itemId: string,
    availableShards: number
  ): {
    success: boolean;
    newLevel: number;
    cost: number;
    milestoneUnlocked?: string;
    error?: string;
  } {
    const item = EQUIPMENT_BY_ID[itemId];
    if (!item) {
      return { success: false, newLevel: 0, cost: 0, error: 'Item not found' };
    }
    const currentLvl = this.getEnhancementLevel(itemId);
    const cost = getEnhancementCost(currentLvl);

    if (availableShards < cost) {
      return { success: false, newLevel: currentLvl, cost, error: 'Insufficient Boneshards' };
    }

    const successRate = getEnhancementSuccessRate(currentLvl);
    const roll = Math.random();
    const success = roll <= successRate;

    if (success) {
      const nextLvl = currentLvl + 1;
      this.enhancementLevels[itemId] = nextLvl;
      this.saveToStorage();

      // Check if a milestone was unlocked at this level
      const milestone = item.milestones.find((m) => m.level === nextLvl);
      return {
        success: true,
        newLevel: nextLvl,
        cost,
        milestoneUnlocked: milestone ? `${milestone.title}: ${milestone.description}` : undefined,
      };
    } else {
      // Failure rules: Consume cost, but do NOT destroy equipment, reduce level, or strip stats
      return {
        success: false,
        newLevel: currentLvl,
        cost,
      };
    }
  }

  public getEquippedCountForHero(heroId: HeroId): number {
    const loadout = this.equippedByHero[heroId];
    if (!loadout) return 0;
    return Object.values(loadout).filter(Boolean).length;
  }

  public isOwned(itemId: string): boolean {
    return this.ownedEquipmentIds.has(itemId);
  }

  public getOwnedItemIds(): string[] {
    return [...this.ownedEquipmentIds];
  }

  public getEquippedForHero(heroId: HeroId): HeroEquipmentLoadout {
    return this.equippedByHero[heroId] || createDefaultLoadout();
  }

  public isItemEquippedOnHero(heroId: HeroId, itemId: string): boolean {
    const loadout = this.equippedByHero[heroId];
    if (!loadout) return false;
    return Object.values(loadout).includes(itemId);
  }

  public isItemEquippedAnywhere(itemId: string): { heroId: HeroId; slot: EquipmentSlot } | null {
    for (const h of ALL_HERO_IDS) {
      const loadout = this.equippedByHero[h];
      for (const slot of ALL_EQUIPMENT_SLOTS) {
        if (loadout[slot] === itemId) {
          return { heroId: h, slot };
        }
      }
    }
    return null;
  }

  public equipItem(heroId: HeroId, itemId: string): boolean {
    const item = EQUIPMENT_BY_ID[itemId];
    if (!item) return false;
    // Equipment must be owned (dropped from dungeon bosses) to be equipped
    if (!this.ownedEquipmentIds.has(itemId)) {
      return false;
    }

    if (!this.equippedByHero[heroId]) {
      this.equippedByHero[heroId] = createDefaultLoadout();
    }

    // Players cannot equip the same unique item in multiple slots simultaneously
    const currentLoadout = this.equippedByHero[heroId];
    for (const s of ALL_EQUIPMENT_SLOTS) {
      if (currentLoadout[s] === itemId) {
        currentLoadout[s] = null;
      }
    }

    currentLoadout[item.slot] = itemId;
    this.saveToStorage();
    return true;
  }

  public unequipItem(heroId: HeroId, slot: EquipmentSlot): boolean {
    if (!this.equippedByHero[heroId]) return false;
    this.equippedByHero[heroId][slot] = null;
    this.saveToStorage();
    return true;
  }

  public unequipItemById(heroId: HeroId, itemId: string): boolean {
    if (!this.equippedByHero[heroId]) return false;
    const loadout = this.equippedByHero[heroId];
    for (const slot of ALL_EQUIPMENT_SLOTS) {
      if (loadout[slot] === itemId) {
        loadout[slot] = null;
        this.saveToStorage();
        return true;
      }
    }
    return false;
  }

  /**
   * Count how many pieces of each collection are equipped by this hero
   */
  public getSetCountsForHero(heroId: HeroId): Record<EquipmentCollectionId, number> {
    if (this.setCountsCache[heroId]) {
      return this.setCountsCache[heroId]!;
    }
    const counts: Record<EquipmentCollectionId, number> = {
      eternal_bone: 0,
      phantom_regalia: 0,
      plaguebound: 0,
      feral_hunter: 0,
      survivors_arsenal: 0,
      sky_sovereign: 0,
      king_of_beasts: 0,
      nocturne_regalia: 0,
    };
    const loadout = this.equippedByHero[heroId];
    if (loadout) {
      for (const slot of ALL_EQUIPMENT_SLOTS) {
        const itemId = loadout[slot];
        if (itemId && EQUIPMENT_BY_ID[itemId]) {
          const item = EQUIPMENT_BY_ID[itemId];
          counts[item.collection] += 1;
        }
      }
    }
    this.setCountsCache[heroId] = counts;
    return counts;
  }

  public hasTwoPieceBonus(heroId: HeroId, collectionId: EquipmentCollectionId): boolean {
    if (!this.isDungeonActive) return false;
    const counts = this.getSetCountsForHero(heroId);
    return counts[collectionId] >= 2;
  }

  public hasFourPieceBonus(heroId: HeroId, collectionId: EquipmentCollectionId): boolean {
    if (!this.isDungeonActive) return false;
    const counts = this.getSetCountsForHero(heroId);
    return counts[collectionId] >= 4;
  }

  public hasSixPieceBonus(heroId: HeroId, collectionId: EquipmentCollectionId): boolean {
    if (!this.isDungeonActive) return false;
    const counts = this.getSetCountsForHero(heroId);
    return counts[collectionId] >= 6;
  }

  /**
   * Returns list of currently equipped item definitions for a hero
   */
  public getEquippedItemDefs(heroId: HeroId): EquipmentItemDef[] {
    const loadout = this.equippedByHero[heroId];
    if (!loadout) return [];
    const items: EquipmentItemDef[] = [];
    for (const slot of ALL_EQUIPMENT_SLOTS) {
      const id = loadout[slot];
      if (id && EQUIPMENT_BY_ID[id]) {
        items.push(EQUIPMENT_BY_ID[id]);
      }
    }
    return items;
  }

  /**
   * Retrieves full dynamic upgraded information for an item (stats, description, effects).
   */
  public getItemUpgradedInfo(itemOrId: EquipmentItemDef | string) {
    const item = typeof itemOrId === 'string' ? EQUIPMENT_BY_ID[itemOrId] : itemOrId;
    if (!item) return null;
    const level = this.getEnhancementLevel(item.id);
    return getUpgradedItemInfo(item, level);
  }

  /**
   * Calculates total stat modifiers for a hero.
   * STRICT RULE: Returns completely flat/zero bonuses outside dungeons.
   * Scales base stats and incorporates milestone perk upgrades based on enhancement level.
   */
  public getComputedStats(heroId: HeroId) {
    if (!this.isDungeonActive) {
      return EMPTY_STATS;
    }

    const items = this.getEquippedItemDefs(heroId);
    let atkPercent = 0;
    let flatHp = 0;
    let defense = 0;
    let critChance = 0;
    let critDmgPercent = 0;
    let speedPercent = 0;
    let cdr = 0;
    let resourcePercent = 0;
    let onKillHeal = 0;
    let onKillAtk = 0;
    let poisonChance = 0;
    let consecutiveAtkSpeed = 0;
    let basicAtkPercent = 0;
    let projAtkPercent = 0;
    let projPierce = false;
    let spectralBarrier = false;
    let seekingSpirit = false;
    let expPoison = false;
    let expSkill = false;
    let critBoneFragments = 0;
    let spectralEcho = false;
    let healingEssence = false;
    let consecutiveHeal = 0;
    let hunterMark = false;
    let energyBurst = false;
    let windBlade = false;
    let projRange = 1.0;
    let meleeProximity = 1.0;
    let shockwaveConsecutive = false;
    let secSonicChance = 0;
    let movePulse = false;
    let secVibration = false;
    let critSoundWaveChance = 0;
    let freqProc = false;
    let resBarrier = false;

    for (const item of items) {
      const level = this.getEnhancementLevel(item.id);
      // Enhancement scaling: original stats gain +8% per level
      const statScale = 1 + level * 0.08;

      const s = item.stats;
      if (s.atkBonusPercent) atkPercent += s.atkBonusPercent * statScale;
      if (s.maxHpBonus) flatHp += Math.round(s.maxHpBonus * statScale);
      if (s.defensePercent) defense += s.defensePercent * statScale;
      if (s.critChancePercent) critChance += s.critChancePercent * statScale;
      if (s.critDamagePercent) critDmgPercent += s.critDamagePercent * statScale;
      if (s.moveSpeedPercent) speedPercent += s.moveSpeedPercent * statScale;
      if (s.cooldownReductionPercent) cdr += s.cooldownReductionPercent * statScale;
      if (s.resourceBonusPercent) resourcePercent += s.resourceBonusPercent * statScale;
      if (s.onKillHealPercent) onKillHeal += s.onKillHealPercent * statScale;
      if (s.onKillAtkBoostPercent) onKillAtk += s.onKillAtkBoostPercent * statScale;
      if (s.poisonChancePercent) poisonChance += s.poisonChancePercent * statScale;
      if (s.consecutiveAttackSpeed) consecutiveAtkSpeed += s.consecutiveAttackSpeed * statScale;
      if (s.basicAttackDamagePercent) basicAtkPercent += s.basicAttackDamagePercent * statScale;
      if (s.projectileAtkBonusPercent) projAtkPercent += s.projectileAtkBonusPercent * statScale;
      if (s.projectilePierceBonus) projPierce = true;
      if (s.spectralBarrierOnHit) spectralBarrier = true;
      if (s.seekingSpiritOnSkill) seekingSpirit = true;
      if (s.explosiveOnPoisonDefeat) expPoison = true;
      if (s.explosiveSkillProc) expSkill = true;
      if (s.critBoneFragmentChance) critBoneFragments += s.critBoneFragmentChance * (1 + level * 0.04);
      if (s.spectralEchoOnSkill) spectralEcho = true;
      if (s.healingEssenceOnPoisonKill) healingEssence = true;
      if (s.consecutiveHealChance) consecutiveHeal += s.consecutiveHealChance;
      if (s.hunterMarkOnHit) hunterMark = true;
      if (s.energyBurstProc) energyBurst = true;
      if (s.windBladeOnHit) windBlade = true;
      if (s.projectileRangeBonus) projRange += s.projectileRangeBonus * statScale;
      if (s.meleeProximityBonus) meleeProximity += s.meleeProximityBonus * statScale;
      if (s.shockwaveOnConsecutive) shockwaveConsecutive = true;
      if (s.secondarySonicChance) secSonicChance += s.secondarySonicChance * (1 + level * 0.04);
      if (s.movementPulseOnMove) movePulse = true;
      if (s.secondaryVibrationOnSkill) secVibration = true;
      if (s.criticalSoundWaveChance) critSoundWaveChance += s.criticalSoundWaveChance;
      if (s.frequencyStackProc) freqProc = true;
      if (s.resonanceBarrierOnDamage) resBarrier = true;

      // Specific unlocked milestone stat bonuses
      if (level >= 3) {
        if (item.id === 'skull_of_precision') critBoneFragments += 0.2;
        if (item.id === 'eagles_eye') critChance += 0.06;
        if (item.id === 'apex_crown') critDmgPercent += 0.15;
        if (item.id === 'bonebreaker_emblem') atkPercent += 0.06;
        if (item.id === 'feral_fang') atkPercent += 0.05;
        if (item.id === 'ribcage_aegis') { flatHp += 40; defense += 0.04; }
        if (item.id === 'crown_of_the_undying') onKillHeal += 0.02;
        if (item.id === 'phantom_veil') speedPercent += 0.06;
        if (item.id === 'wraith_pendant') cdr += 0.05;
        if (item.id === 'ghoul_claws' || item.id === 'feral_pelt') speedPercent += 0.05;
        if (item.id === 'sky_feather') speedPercent += 0.06;
        if (item.id === 'iron_pelt') { flatHp += 50; defense += 0.04; }
        if (item.id === 'saber_strike') basicAtkPercent += 0.10;
        if (item.id === 'celestial_lens') projRange += 0.15;
        if (item.id === 'striped_totem') meleeProximity += 0.10;
        if (item.id === 'mask_night_listener') critChance += 0.06;
        if (item.id === 'ring_endless_frequencies') cdr += 0.05;
        if (item.id === 'mantle_silent_wings') speedPercent += 0.05;
        if (item.id === 'resonance_crystal') projAtkPercent += 0.08;
      }
      if (level >= 6) {
        if (item.id === 'ancient_marrow_ring') critDmgPercent += 0.25;
        if (item.id === 'skull_of_precision') critDmgPercent += 0.25;
        if (item.id === 'heart_of_nocturne') { flatHp += 45; defense += 0.03; }
        if (item.id === 'staff_first_echo') basicAtkPercent += 0.12;
      }
    }

    // Dynamic runtime set bonuses & stacks
    if (this.hasTwoPieceBonus(heroId, 'phantom_regalia') && this.spectralFlowTimer > 0) {
      speedPercent += 0.3; // Spectral Flow +30% speed
    }

    if (this.hasTwoPieceBonus(heroId, 'feral_hunter')) {
      consecutiveAtkSpeed += this.huntingMomentumStacks * 0.07;
    }

    if (this.hasTwoPieceBonus(heroId, 'king_of_beasts')) {
      atkPercent += this.feralDominanceStacks * 0.05;
    }

    if (this.beastsTrophyTimer > 0) {
      atkPercent += this.beastsTrophyStacks * 0.2;
    }

    if (this.frequencyStacks > 0) {
      consecutiveAtkSpeed += this.frequencyStacks * 0.04;
    }

    const consecutiveSpeedBonus = Math.min(0.55, this.consecutiveHitCount * consecutiveAtkSpeed);

    return {
      atkMultiplier: 1 + Math.max(0, atkPercent),
      flatMaxHpBonus: flatHp,
      defenseReduction: Math.min(0.7, defense),
      critChanceBonus: critChance,
      critDamageMultiplier: 1 + Math.max(0, critDmgPercent),
      speedMultiplier: 1 + Math.max(-0.5, speedPercent),
      cooldownReduction: Math.min(0.5, cdr),
      resourceMultiplier: 1 + Math.max(0, resourcePercent),
      onKillHealPercent: onKillHeal,
      onKillAtkBoostPercent: onKillAtk,
      poisonChance: Math.min(0.9, poisonChance),
      consecutiveAtkSpeedBonus: consecutiveSpeedBonus,
      basicAttackDamageMultiplier: 1 + Math.max(0, basicAtkPercent),
      projectileAtkMultiplier: 1 + Math.max(0, projAtkPercent),
      projectilePierce: projPierce,
      spectralBarrierOnHit: spectralBarrier,
      seekingSpiritOnSkill: seekingSpirit,
      explosiveOnPoisonDefeat: expPoison,
      explosiveSkillProc: expSkill,
      critBoneFragmentChance: Math.min(0.8, critBoneFragments),
      spectralEchoOnSkill: spectralEcho,
      healingEssenceOnPoisonKill: healingEssence,
      consecutiveHealChance: Math.min(0.6, consecutiveHeal),
      hunterMarkOnHit: hunterMark,
      energyBurstProc: energyBurst,
      windBladeOnHit: windBlade,
      projectileRangeMultiplier: projRange,
      meleeProximityMultiplier: meleeProximity,
      shockwaveOnConsecutive: shockwaveConsecutive,
      secondarySonicChance: Math.min(0.7, secSonicChance),
      movementPulseOnMove: movePulse,
      secondaryVibrationOnSkill: secVibration,
      criticalSoundWaveChance: Math.min(0.75, critSoundWaveChance),
      frequencyStackProc: freqProc,
      resonanceBarrierOnDamage: resBarrier,
    };
  }

  // ==========================================
  // RUNTIME COMBAT HOOKS
  // ==========================================
  public update(dt: number) {
    if (!this.isDungeonActive) return;

    if (this.spectralFlowTimer > 0) {
      this.spectralFlowTimer -= dt;
    }
    if (this.etherealMaskCooldown > 0) {
      this.etherealMaskCooldown -= dt;
    }
    if (this.lastSurvivorCooldown > 0) {
      this.lastSurvivorCooldown -= dt;
    }
    if (this.huntingMomentumTimer > 0) {
      this.huntingMomentumTimer -= dt;
      if (this.huntingMomentumTimer <= 0) {
        this.huntingMomentumStacks = 0;
      }
    }
    if (this.beastsTrophyTimer > 0) {
      this.beastsTrophyTimer -= dt;
      if (this.beastsTrophyTimer <= 0) {
        this.beastsTrophyStacks = 0;
      }
    }
    if (this.feralDominanceTimer > 0) {
      this.feralDominanceTimer -= dt;
      if (this.feralDominanceTimer <= 0) {
        this.feralDominanceStacks = 0;
      }
    }
    if (this.consecutiveHitTimer > 0) {
      this.consecutiveHitTimer -= dt;
      if (this.consecutiveHitTimer <= 0) {
        this.consecutiveHitCount = 0;
      }
    }
  }

  public onUseSkill(heroId: HeroId, skillId?: string) {
    if (!this.isDungeonActive) return;

    // Phantom Regalia 2-Piece: Spectral Flow (+30% move speed for 3s)
    if (this.hasTwoPieceBonus(heroId, 'phantom_regalia')) {
      this.spectralFlowTimer = 3.0;
    }

    // Phantom Regalia 4-Piece: Ghostwalk (every 3rd skill creates spectral copy)
    if (this.hasFourPieceBonus(heroId, 'phantom_regalia')) {
      this.ghostwalkSkillCounter += 1;
      if (this.ghostwalkSkillCounter >= 3) {
        this.ghostwalkSkillCounter = 0;
        this.onTriggerGhostwalkEcho?.();
      }
    }

    // Phantom Regalia 6-Piece: Eternal Apparition (creates phantom that imitates the skill)
    if (this.hasSixPieceBonus(heroId, 'phantom_regalia')) {
      this.onTriggerEternalApparition?.();
    }

    // Survivor's Arsenal 2-Piece: Improvised Tactics (enhances next basic attack)
    if (this.hasTwoPieceBonus(heroId, 'survivors_arsenal')) {
      this.improvisedTacticsReady = true;
    }

    // Survivor's Arsenal 6-Piece: Resourceful Genius (successive different skills build Adaptation Energy)
    if (this.hasSixPieceBonus(heroId, 'survivors_arsenal')) {
      if (skillId && skillId !== this.lastSkillUsedId) {
        this.adaptationEnergy = Math.min(3, this.adaptationEnergy + 1);
        this.lastSkillUsedId = skillId;
        if (this.adaptationEnergy >= 3) {
          this.adaptationEnergy = 0;
          this.onTriggerResourcefulGenius?.();
        }
      }
    }

    // Nocturne Regalia 6-Piece: Lord of the Eternal Echo (summon spectral bats)
    if (this.hasSixPieceBonus(heroId, 'nocturne_regalia')) {
      this.onTriggerLordOfEternalEcho?.();
    }
  }

  public onSkillHitEnemy(heroId: HeroId, hitX: number, hitY: number, angle = 0) {
    if (!this.isDungeonActive) return;
    const stats = this.getComputedStats(heroId);

    // Soul Lantern (Phantom Regalia Weapon): 35% chance seeking spirit projectile
    if (stats.seekingSpiritOnSkill && Math.random() < 0.35) {
      this.onTriggerSeekingSpirit?.(hitX, hitY);
    }

    // Survivor's Toolkit (Survivor's Arsenal Spirit): 35% chance explosive shrapnel
    if (stats.explosiveSkillProc && Math.random() < 0.35) {
      this.onTriggerShrapnelExplosion?.(hitX, hitY);
    }

    // Lost Soul Fragment (Phantom Regalia Core): 30% chance spectral echo
    if (stats.spectralEchoOnSkill && Math.random() < 0.3) {
      this.onTriggerSpectralEcho?.(hitX, hitY, angle);
    }

    // Improvised Power Cell (Survivor's Arsenal Core): 25% chance energy burst
    if (stats.energyBurstProc && Math.random() < 0.25) {
      this.onTriggerEnergyBurst?.(hitX, hitY);
    }

    // Nocturne Regalia 2-Piece: Echo Synchronization (echo damages second time)
    if (this.hasTwoPieceBonus(heroId, 'nocturne_regalia')) {
      this.onTriggerEchoDelayed?.(hitX, hitY, 30);
    }

    // Nocturne Regalia 4-Piece: Resonant Overload (builds to 5 stacks, then sound explosion)
    if (this.hasFourPieceBonus(heroId, 'nocturne_regalia')) {
      this.resonantOverloadStacks += 1;
      if (this.resonantOverloadStacks >= 5) {
        this.resonantOverloadStacks = 0;
        this.onTriggerResonantOverload?.(hitX, hitY);
      }
    }

    // Resonance Crystal (Nocturne Spirit): Secondary vibration
    if (stats.secondaryVibrationOnSkill) {
      this.onTriggerResonanceVibration?.(hitX, hitY, 28);
    }
  }

  public onBasicAttackHit(
    heroId: HeroId,
    hitX: number,
    hitY: number,
    angle: number,
    targetEnemyId?: number,
    onHeal?: (amount: number) => void,
    maxHp = 100
  ) {
    if (!this.isDungeonActive) return;
    const stats = this.getComputedStats(heroId);

    // Consecutive hit ramp
    this.consecutiveHitCount = Math.min(5, this.consecutiveHitCount + 1);
    this.consecutiveHitTimer = 3.2;

    // Staff of the First Echo: Consecutive hits build Echo Energy (up to 4 stacks)
    if (this.hasPieceEquipped(heroId, 'staff_first_echo')) {
      this.echoEnergyStacks = Math.min(4, this.echoEnergyStacks + 1);
    }

    // Nocturne Regalia 2-Piece: Basic attack echo chance
    if (this.hasTwoPieceBonus(heroId, 'nocturne_regalia') && Math.random() < 0.35) {
      this.onTriggerEchoDelayed?.(hitX, hitY, 18);
    }

    // Bloodstained Charm (Ghoul Accessory): Consecutive hits chance to restore health
    if (stats.consecutiveHealChance > 0 && Math.random() < stats.consecutiveHealChance && onHeal) {
      onHeal(Math.max(2, Math.round(maxHp * 0.03)));
    }

    // Hunter's Markstone (Ghoul Core): Mark tracking per enemy
    if (stats.hunterMarkOnHit && targetEnemyId) {
      const prev = this.targetHitCounts.get(targetEnemyId) || 0;
      this.targetHitCounts.set(targetEnemyId, Math.min(5, prev + 1));
    }

    // Improvised Power Cell (Human Core): 25% chance energy burst
    if (stats.energyBurstProc && Math.random() < 0.25) {
      this.onTriggerEnergyBurst?.(hitX, hitY);
    }

    // Roaring Heart (Tigerkin Core): 25% chance shockwave
    if (stats.shockwaveOnConsecutive && Math.random() < 0.25) {
      this.onTriggerConsecutiveShockwave?.(hitX, hitY);
    }

    // Feral Hunter 2-pc / 4-pc: Hunting Momentum
    if (this.hasTwoPieceBonus(heroId, 'feral_hunter')) {
      if (this.huntingMomentumStacks >= 5 && this.hasFourPieceBonus(heroId, 'feral_hunter')) {
        this.huntingMomentumStacks = 0;
        this.onTriggerApexClawWave?.();
      } else {
        this.huntingMomentumStacks = Math.min(5, this.huntingMomentumStacks + 1);
        this.huntingMomentumTimer = 3.8;
      }
    }

    // King of Beasts 2-pc / 4-pc / 6-pc: Feral Dominance, Roar of the Apex & Primal Overlord
    if (this.hasTwoPieceBonus(heroId, 'king_of_beasts')) {
      if (this.feralDominanceStacks >= 5) {
        this.feralDominanceStacks = 0;
        if (this.hasSixPieceBonus(heroId, 'king_of_beasts')) {
          this.onTriggerPrimalOverlord?.();
        } else if (this.hasFourPieceBonus(heroId, 'king_of_beasts')) {
          this.onTriggerRoarOfApex?.();
        }
      } else {
        this.feralDominanceStacks = Math.min(5, this.feralDominanceStacks + 1);
        this.feralDominanceTimer = 4.0;
      }
    }

    // Sky Sovereign 2-pc / 4-pc / 6-pc: Piercing Winds, Tempest Wings & Sovereign's Barrage
    if (this.hasTwoPieceBonus(heroId, 'sky_sovereign')) {
      if (Math.random() < 0.35) {
        this.onTriggerWindBlade?.(hitX, hitY, angle);
      }
    }
    // Stormfeather Charm: individual wind blade proc
    if (stats.windBladeOnHit && Math.random() < 0.3) {
      this.onTriggerWindBlade?.(hitX, hitY, angle);
    }

    if (this.hasFourPieceBonus(heroId, 'sky_sovereign')) {
      this.windCharges += 1;
      if (this.windCharges >= 5) {
        this.windCharges = 0;
        if (this.hasSixPieceBonus(heroId, 'sky_sovereign')) {
          this.onTriggerSovereignBarrage?.();
        } else {
          this.onTriggerTempestWingsHurricane?.();
        }
      }
    }

    // Eternal Bone 4-pc: Eternal Framework Bone Shockwave
    if (this.hasFourPieceBonus(heroId, 'eternal_bone') && this.boneEnergyStacks >= 5) {
      this.boneEnergyStacks = 0;
      this.onTriggerBoneShockwave?.();
    }
  }

  public onCriticalStrike(
    heroId: HeroId,
    onHeal: (amount: number) => void,
    maxHp: number,
    critX?: number,
    critY?: number
  ) {
    if (!this.isDungeonActive) return;
    const stats = this.getComputedStats(heroId);

    // Eternal Bone 2-Piece: Bone Resonance (restore 3.5% Max HP on crit)
    if (this.hasTwoPieceBonus(heroId, 'eternal_bone')) {
      const healAmt = Math.max(3, Math.round(maxHp * 0.035));
      onHeal(healAmt);
    }

    // Eternal Bone 4-Piece: Eternal Framework (Crits build Bone Energy)
    if (this.hasFourPieceBonus(heroId, 'eternal_bone')) {
      this.boneEnergyStacks = Math.min(5, this.boneEnergyStacks + 1);
    }

    // Eternal Bone 6-Piece: Undying Bone Sovereign (summon spectral bone warrior)
    if (this.hasSixPieceBonus(heroId, 'eternal_bone') && Math.random() < 0.25) {
      this.onTriggerSpectralWarrior?.();
    }

    // Bone Lord's Phylactery: 30% chance bone fragments
    if (stats.critBoneFragmentChance > 0 && Math.random() < stats.critBoneFragmentChance && critX && critY) {
      this.onTriggerBoneFragments?.(critX, critY);
    }

    // Mask of the Night Listener: Critical sound wave proc
    if (stats.criticalSoundWaveChance && Math.random() < stats.criticalSoundWaveChance && critX && critY) {
      this.onTriggerSoundPulse?.(critX, critY, 35);
    }
  }

  public onTakeDamage(
    heroId: HeroId,
    hp: number,
    maxHp: number,
    onGrantShield: (shieldHp: number) => void
  ) {
    if (!this.isDungeonActive) return;
    const stats = this.getComputedStats(heroId);

    // Ethereal Mask (Phantom Regalia Ancient): Barrier on damage (8s cd)
    if (stats.spectralBarrierOnHit && this.etherealMaskCooldown <= 0) {
      this.etherealMaskCooldown = 8.0;
      onGrantShield(65);
    }

    // Survivor's Arsenal 4-Piece: Last Survivor (<30% HP -> 160 HP barrier + shockwave)
    if (this.hasFourPieceBonus(heroId, 'survivors_arsenal')) {
      if (hp / Math.max(1, maxHp) < 0.3 && this.lastSurvivorCooldown <= 0) {
        this.lastSurvivorCooldown = 30.0;
        onGrantShield(160);
        this.onTriggerLastSurvivorProc?.();
      }
    }

    // Heart of the Nocturne (Core): Protective resonance barrier + defensive sound burst
    if (stats.resonanceBarrierOnDamage || this.hasPieceEquipped(heroId, 'heart_of_nocturne')) {
      if (this.heartOfNocturneCooldown <= 0) {
        this.heartOfNocturneCooldown = 8.0;
        onGrantShield(85);
        this.onTriggerDefensiveSoundBurst?.(0, 0);
      }
    }
  }

  public onEnemyDefeated(
    heroId: HeroId,
    enemyX: number,
    enemyY: number,
    isPoisoned: boolean,
    onHeal: (amt: number) => void,
    maxHp: number,
    enemyId?: number
  ) {
    if (!this.isDungeonActive) return;
    const stats = this.getComputedStats(heroId);

    // Crown of the Undying (Eternal Bone Ancient): 5% heal on kill
    if (stats.onKillHealPercent > 0) {
      const heal = Math.max(2, Math.round(maxHp * stats.onKillHealPercent));
      onHeal(heal);
    }

    // Beast's Trophy (Feral Hunter Ancient): +20% ATK for 4s
    if (stats.onKillAtkBoostPercent > 0) {
      this.beastsTrophyStacks = Math.min(3, this.beastsTrophyStacks + 1);
      this.beastsTrophyTimer = 4.0;
    }

    // Corrupted Flask / Plaguebound 2-pc Spreading Infection
    if (isPoisoned) {
      if (stats.explosiveOnPoisonDefeat || this.hasTwoPieceBonus(heroId, 'plaguebound')) {
        this.onTriggerToxicBurst?.(enemyX, enemyY);
      }
      // Putrid Core: Healing essence drop
      if (stats.healingEssenceOnPoisonKill && Math.random() < 0.35) {
        onHeal(Math.max(3, Math.round(maxHp * 0.04)));
      }
      // Zombie 6-pc: Walking Plague massive toxic explosion
      if (this.hasSixPieceBonus(heroId, 'plaguebound')) {
        this.onTriggerWalkingPlague?.(enemyX, enemyY);
      }
    }

    // Ghoul 6-pc: Endless Pursuit (partially restores momentum + causes lunge)
    if (this.hasSixPieceBonus(heroId, 'feral_hunter') && this.huntingMomentumTimer > 0) {
      this.huntingMomentumStacks = Math.min(5, this.huntingMomentumStacks + 2);
      this.huntingMomentumTimer = 4.0;
      this.onTriggerEndlessPursuit?.();
    }

    if (enemyId) {
      this.targetHitCounts.delete(enemyId);
    }
  }

  // ==========================================
  // BOSS DROP SYSTEM (6 PIECES PER COLLECTION)
  // ==========================================
  public rollBossDropItem(bossHeroId: HeroId): EquipmentItemDef {
    const colId = HERO_TO_COLLECTION[bossHeroId] || 'survivors_arsenal';
    const pieces = getEquipmentForCollection(colId);

    // Prioritize pieces not yet discovered in inventory
    const unowned = pieces.filter((p) => !this.ownedEquipmentIds.has(p.id));
    return unowned.length > 0
      ? unowned[Math.floor(Math.random() * unowned.length)]
      : pieces[Math.floor(Math.random() * pieces.length)];
  }

  public addEquipmentToInventory(itemId: string): EquipmentDropPayload {
    const item = EQUIPMENT_BY_ID[itemId] || ALL_EQUIPMENT_ITEMS[0];
    const colDef = EQUIPMENT_COLLECTIONS[item.collection] || EQUIPMENT_COLLECTIONS.survivors_arsenal;

    const isFirstDiscovery = !this.ownedEquipmentIds.has(item.id);
    this.ownedEquipmentIds.add(item.id);
    if (!this.enhancementLevels[item.id]) {
      this.enhancementLevels[item.id] = 0;
    }
    this.saveToStorage();

    return {
      item,
      collection: colDef,
      isFirstDiscovery,
    };
  }

  public rollBossDrop(bossHeroId: HeroId): EquipmentDropPayload {
    const item = this.rollBossDropItem(bossHeroId);
    return this.addEquipmentToInventory(item.id);
  }

  public unlockAllEquipment() {
    for (const item of ALL_EQUIPMENT_ITEMS) {
      this.ownedEquipmentIds.add(item.id);
      if (this.enhancementLevels[item.id] === undefined) {
        this.enhancementLevels[item.id] = 0;
      }
    }
    this.saveToStorage();
  }

  public resetEquipmentInventory() {
    this.ownedEquipmentIds.clear();
    this.enhancementLevels = {};
    for (const h of ALL_HERO_IDS) {
      this.equippedByHero[h] = createDefaultLoadout();
    }
    this.saveToStorage();
  }

  public getSnapshot(currentHeroId: HeroId): EquipmentStateSnapshot {
    const counts = this.getSetCountsForHero(currentHeroId);
    const activeSetBonuses: EquipmentStateSnapshot['activeSetBonuses'] = [];

    for (const [colKey, count] of Object.entries(counts)) {
      const colId = colKey as EquipmentCollectionId;
      const colDef = EQUIPMENT_COLLECTIONS[colId];
      if (count > 0) {
        activeSetBonuses.push({
          collectionId: colId,
          collectionName: colDef.name,
          piecesEquipped: count,
          hasTwoPiece: count >= 2,
          hasFourPiece: count >= 4,
          hasSixPiece: count >= 6,
          twoPieceName: colDef.twoPieceBonus.name,
          fourPieceName: colDef.fourPieceBonus.name,
          sixPieceName: colDef.sixPieceBonus.name,
        });
      }
    }

    return {
      ownedEquipmentIds: [...this.ownedEquipmentIds],
      equippedByHero: { ...this.equippedByHero },
      enhancementLevels: { ...this.enhancementLevels },
      isDungeonActive: this._isDungeonActive,
      activeSetBonuses,
    };
  }
}

export const equipmentManager = new EquipmentManager();
