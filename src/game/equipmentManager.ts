import {
  ALL_EQUIPMENT_ITEMS,
  EQUIPMENT_BY_ID,
  EQUIPMENT_COLLECTIONS,
  getEquipmentForCollection,
  HERO_TO_COLLECTION,
} from '../data/equipmentData';
import {
  EquipmentCollectionId,
  EquipmentDropPayload,
  EquipmentItemDef,
  EquipmentSlot,
  EquipmentStateSnapshot,
  HeroEquipmentLoadout,
} from '../types/equipment';
import { HeroId } from '../types/game';

const INVENTORY_STORAGE_KEY = 'bonehearth_equipment_inventory_v1';
const EQUIPPED_STORAGE_KEY = 'bonehearth_hero_equipped_v1';

const ALL_HERO_IDS: HeroId[] = [
  'human',
  'skeleton',
  'zombie',
  'ghoul',
  'ghost',
  'eaglekin',
  'tigerkin',
];

function createDefaultLoadout(): HeroEquipmentLoadout {
  return {
    weapon: null,
    armor: null,
    spirit: null,
    ancient: null,
  };
}

export class EquipmentManager {
  private ownedEquipmentIds: Set<string> = new Set();
  private equippedByHero: Record<HeroId, HeroEquipmentLoadout> = {
    human: createDefaultLoadout(),
    skeleton: createDefaultLoadout(),
    zombie: createDefaultLoadout(),
    ghoul: createDefaultLoadout(),
    ghost: createDefaultLoadout(),
    eaglekin: createDefaultLoadout(),
    tigerkin: createDefaultLoadout(),
  };

  private isDungeonActive = false;

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
  public windCharges = 0; // Eaglekin 4-pc: 0-5
  public feralDominanceStacks = 0; // Tigerkin 2-pc/4-pc: 0-5
  public feralDominanceTimer = 0;
  public consecutiveHitCount = 0; // Savage Claw / Savage Bracers
  public consecutiveHitTimer = 0;
  public plagueIncarnateTick = 2.0; // Zombie 4-pc: periodic toxic bursts

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

  constructor() {
    this.loadFromStorage();
  }

  public loadFromStorage() {
    try {
      const invRaw = localStorage.getItem(INVENTORY_STORAGE_KEY);
      if (invRaw) {
        const parsed = JSON.parse(invRaw);
        if (Array.isArray(parsed)) {
          this.ownedEquipmentIds = new Set(parsed.filter((id) => EQUIPMENT_BY_ID[id]));
        }
      }
      const eqRaw = localStorage.getItem(EQUIPPED_STORAGE_KEY);
      if (eqRaw) {
        const parsed = JSON.parse(eqRaw);
        for (const h of ALL_HERO_IDS) {
          if (parsed[h]) {
            this.equippedByHero[h] = {
              weapon: parsed[h].weapon && EQUIPMENT_BY_ID[parsed[h].weapon] ? parsed[h].weapon : null,
              armor: parsed[h].armor && EQUIPMENT_BY_ID[parsed[h].armor] ? parsed[h].armor : null,
              spirit: parsed[h].spirit && EQUIPMENT_BY_ID[parsed[h].spirit] ? parsed[h].spirit : null,
              ancient: parsed[h].ancient && EQUIPMENT_BY_ID[parsed[h].ancient] ? parsed[h].ancient : null,
            };
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load equipment data from storage:', e);
    }
  }

  public saveToStorage() {
    try {
      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify([...this.ownedEquipmentIds]));
      localStorage.setItem(EQUIPPED_STORAGE_KEY, JSON.stringify(this.equippedByHero));
    } catch (e) {
      console.warn('Failed to save equipment data to storage:', e);
    }
  }

  public setDungeonActive(active: boolean) {
    this.isDungeonActive = active;
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
      this.windCharges = 0;
      this.feralDominanceStacks = 0;
      this.feralDominanceTimer = 0;
      this.consecutiveHitCount = 0;
      this.consecutiveHitTimer = 0;
    }
  }

  public getIsDungeonActive(): boolean {
    return this.isDungeonActive;
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
      for (const slot of ['weapon', 'armor', 'spirit', 'ancient'] as EquipmentSlot[]) {
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
    // Auto-grant ownership if equipping
    this.ownedEquipmentIds.add(itemId);

    if (!this.equippedByHero[heroId]) {
      this.equippedByHero[heroId] = createDefaultLoadout();
    }
    this.equippedByHero[heroId][item.slot] = itemId;
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
    for (const slot of ['weapon', 'armor', 'spirit', 'ancient'] as EquipmentSlot[]) {
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
    const counts: Record<EquipmentCollectionId, number> = {
      eternal_bone: 0,
      phantom_regalia: 0,
      plaguebound: 0,
      feral_hunter: 0,
      survivors_arsenal: 0,
      sky_sovereign: 0,
      king_of_beasts: 0,
    };
    const loadout = this.equippedByHero[heroId];
    if (!loadout) return counts;

    for (const slot of ['weapon', 'armor', 'spirit', 'ancient'] as EquipmentSlot[]) {
      const itemId = loadout[slot];
      if (itemId && EQUIPMENT_BY_ID[itemId]) {
        const item = EQUIPMENT_BY_ID[itemId];
        counts[item.collection] += 1;
      }
    }
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

  /**
   * Returns list of currently equipped item definitions for a hero
   */
  public getEquippedItemDefs(heroId: HeroId): EquipmentItemDef[] {
    const loadout = this.equippedByHero[heroId];
    if (!loadout) return [];
    const items: EquipmentItemDef[] = [];
    for (const slot of ['weapon', 'armor', 'spirit', 'ancient'] as EquipmentSlot[]) {
      const id = loadout[slot];
      if (id && EQUIPMENT_BY_ID[id]) {
        items.push(EQUIPMENT_BY_ID[id]);
      }
    }
    return items;
  }

  /**
   * Calculates total stat modifiers for a hero.
   * STRICT RULE: Returns completely flat/zero bonuses outside dungeons.
   */
  public getComputedStats(heroId: HeroId) {
    if (!this.isDungeonActive) {
      return {
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
      };
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

    for (const item of items) {
      const s = item.stats;
      if (s.atkBonusPercent) atkPercent += s.atkBonusPercent;
      if (s.maxHpBonus) flatHp += s.maxHpBonus;
      if (s.defensePercent) defense += s.defensePercent;
      if (s.critChancePercent) critChance += s.critChancePercent;
      if (s.critDamagePercent) critDmgPercent += s.critDamagePercent;
      if (s.moveSpeedPercent) speedPercent += s.moveSpeedPercent;
      if (s.cooldownReductionPercent) cdr += s.cooldownReductionPercent;
      if (s.resourceBonusPercent) resourcePercent += s.resourceBonusPercent;
      if (s.onKillHealPercent) onKillHeal += s.onKillHealPercent;
      if (s.onKillAtkBoostPercent) onKillAtk += s.onKillAtkBoostPercent;
      if (s.poisonChancePercent) poisonChance += s.poisonChancePercent;
      if (s.consecutiveAttackSpeed) consecutiveAtkSpeed += s.consecutiveAttackSpeed;
      if (s.basicAttackDamagePercent) basicAtkPercent += s.basicAttackDamagePercent;
      if (s.projectileAtkBonusPercent) projAtkPercent += s.projectileAtkBonusPercent;
      if (s.projectilePierceBonus) projPierce = true;
      if (s.spectralBarrierOnHit) spectralBarrier = true;
      if (s.seekingSpiritOnSkill) seekingSpirit = true;
      if (s.explosiveOnPoisonDefeat) expPoison = true;
      if (s.explosiveSkillProc) expSkill = true;
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

    const consecutiveSpeedBonus = Math.min(0.4, this.consecutiveHitCount * consecutiveAtkSpeed);

    return {
      atkMultiplier: 1 + Math.max(0, atkPercent),
      flatMaxHpBonus: flatHp,
      defenseReduction: Math.min(0.65, defense),
      critChanceBonus: critChance,
      critDamageMultiplier: 1 + Math.max(0, critDmgPercent),
      speedMultiplier: 1 + Math.max(-0.5, speedPercent),
      cooldownReduction: Math.min(0.45, cdr),
      resourceMultiplier: 1 + Math.max(0, resourcePercent),
      onKillHealPercent: onKillHeal,
      onKillAtkBoostPercent: onKillAtk,
      poisonChance: Math.min(0.85, poisonChance),
      consecutiveAtkSpeedBonus: consecutiveSpeedBonus,
      basicAttackDamageMultiplier: 1 + Math.max(0, basicAtkPercent),
      projectileAtkMultiplier: 1 + Math.max(0, projAtkPercent),
      projectilePierce: projPierce,
      spectralBarrierOnHit: spectralBarrier,
      seekingSpiritOnSkill: seekingSpirit,
      explosiveOnPoisonDefeat: expPoison,
      explosiveSkillProc: expSkill,
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

  public onUseSkill(heroId: HeroId) {
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

    // Survivor's Arsenal 2-Piece: Improvised Tactics (enhances next basic attack)
    if (this.hasTwoPieceBonus(heroId, 'survivors_arsenal')) {
      this.improvisedTacticsReady = true;
    }
  }

  public onSkillHitEnemy(heroId: HeroId, hitX: number, hitY: number) {
    if (!this.isDungeonActive) return;
    const stats = this.getComputedStats(heroId);

    // Soul Lantern (Phantom Regalia Weapon): 35% chance to release seeking spirit projectile
    if (stats.seekingSpiritOnSkill && Math.random() < 0.35) {
      this.onTriggerSeekingSpirit?.(hitX, hitY);
    }

    // Survivor's Toolkit (Survivor's Arsenal Spirit): 35% chance explosive shrapnel
    if (stats.explosiveSkillProc && Math.random() < 0.35) {
      this.onTriggerShrapnelExplosion?.(hitX, hitY);
    }
  }

  public onBasicAttackHit(heroId: HeroId, hitX: number, hitY: number, angle: number) {
    if (!this.isDungeonActive) return;

    // Consecutive hit ramp
    this.consecutiveHitCount = Math.min(5, this.consecutiveHitCount + 1);
    this.consecutiveHitTimer = 3.2;

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

    // King of Beasts 2-pc / 4-pc: Feral Dominance & Roar of the Apex
    if (this.hasTwoPieceBonus(heroId, 'king_of_beasts')) {
      if (this.feralDominanceStacks >= 5 && this.hasFourPieceBonus(heroId, 'king_of_beasts')) {
        this.feralDominanceStacks = 0;
        this.onTriggerRoarOfApex?.();
      } else {
        this.feralDominanceStacks = Math.min(5, this.feralDominanceStacks + 1);
        this.feralDominanceTimer = 4.0;
      }
    }

    // Sky Sovereign 2-pc / 4-pc: Piercing Winds & Tempest Wings
    if (this.hasTwoPieceBonus(heroId, 'sky_sovereign')) {
      if (Math.random() < 0.35) {
        this.onTriggerWindBlade?.(hitX, hitY, angle);
      }
    }
    if (this.hasFourPieceBonus(heroId, 'sky_sovereign')) {
      this.windCharges += 1;
      if (this.windCharges >= 5) {
        this.windCharges = 0;
        this.onTriggerTempestWingsHurricane?.();
      }
    }

    // Eternal Bone 4-pc: Eternal Framework Bone Shockwave
    if (this.hasFourPieceBonus(heroId, 'eternal_bone') && this.boneEnergyStacks >= 5) {
      this.boneEnergyStacks = 0;
      this.onTriggerBoneShockwave?.();
    }
  }

  public onCriticalStrike(heroId: HeroId, onHeal: (amount: number) => void, maxHp: number) {
    if (!this.isDungeonActive) return;

    // Eternal Bone 2-Piece: Bone Resonance (restore 3.5% Max HP on crit)
    if (this.hasTwoPieceBonus(heroId, 'eternal_bone')) {
      const healAmt = Math.max(3, Math.round(maxHp * 0.035));
      onHeal(healAmt);
    }

    // Eternal Bone 4-Piece: Eternal Framework (Crits build Bone Energy)
    if (this.hasFourPieceBonus(heroId, 'eternal_bone')) {
      this.boneEnergyStacks = Math.min(5, this.boneEnergyStacks + 1);
    }
  }

  public onTakeDamage(heroId: HeroId, hp: number, maxHp: number, onGrantShield: (shieldHp: number) => void) {
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
  }

  public onEnemyDefeated(
    heroId: HeroId,
    enemyX: number,
    enemyY: number,
    isPoisoned: boolean,
    onHeal: (amt: number) => void,
    maxHp: number
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
    }
  }

  // ==========================================
  // BOSS DROP SYSTEM
  // ==========================================
  /**
   * Drops 1 piece of equipment from the Corrupted Hero's corresponding collection.
   * Defeating Corrupted Skeleton drops Eternal Bone.
   * Corrupted Ghost drops Phantom Regalia.
   * Corrupted Zombie drops Plaguebound.
   * Corrupted Ghoul drops Feral Hunter.
   * Corrupted Human drops Survivor's Arsenal.
   * Corrupted Eaglekin drops Sky Sovereign.
   * Corrupted Tigerkin drops King of Beasts.
   */
  public rollBossDrop(bossHeroId: HeroId): EquipmentDropPayload {
    const colId = HERO_TO_COLLECTION[bossHeroId];
    const colDef = EQUIPMENT_COLLECTIONS[colId];
    const pieces = getEquipmentForCollection(colId);

    // Prioritize pieces not yet discovered in inventory
    const unowned = pieces.filter((p) => !this.ownedEquipmentIds.has(p.id));
    const chosen =
      unowned.length > 0
        ? unowned[Math.floor(Math.random() * unowned.length)]
        : pieces[Math.floor(Math.random() * pieces.length)];

    const isFirstDiscovery = !this.ownedEquipmentIds.has(chosen.id);
    this.ownedEquipmentIds.add(chosen.id);
    this.saveToStorage();

    return {
      item: chosen,
      collection: colDef,
      isFirstDiscovery,
    };
  }

  /**
   * Debug / Testing Helper: Immediately unlocks all 28 pieces across all 7 sets
   * so testing combinations 4, 5, 6, 7 can be verified instantly.
   */
  public unlockAllEquipment() {
    for (const item of ALL_EQUIPMENT_ITEMS) {
      this.ownedEquipmentIds.add(item.id);
    }
    this.saveToStorage();
  }

  public resetEquipmentInventory() {
    this.ownedEquipmentIds.clear();
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
          twoPieceName: colDef.twoPieceBonus.name,
          fourPieceName: colDef.fourPieceBonus.name,
        });
      }
    }

    return {
      ownedEquipmentIds: [...this.ownedEquipmentIds],
      equippedByHero: { ...this.equippedByHero },
      isDungeonActive: this.isDungeonActive,
      activeSetBonuses,
    };
  }
}

export const equipmentManager = new EquipmentManager();
