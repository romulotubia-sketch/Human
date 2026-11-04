import { HeroId } from './game';

export type EquipmentSlot = 'weapon' | 'armor' | 'spirit' | 'ancient';

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Weapon Relic',
  armor: 'Armor Relic',
  spirit: 'Spirit Relic',
  ancient: 'Ancient Relic',
};

export type EquipmentCollectionId =
  | 'eternal_bone'
  | 'phantom_regalia'
  | 'plaguebound'
  | 'feral_hunter'
  | 'survivors_arsenal'
  | 'sky_sovereign'
  | 'king_of_beasts';

export interface SetBonusInfo {
  piecesRequired: 2 | 4;
  name: string;
  description: string;
}

export interface EquipmentCollectionDef {
  id: EquipmentCollectionId;
  name: string;
  theme: string;
  correspondingHero: HeroId;
  bossName: string;
  themeColor: string;
  twoPieceBonus: SetBonusInfo;
  fourPieceBonus: SetBonusInfo;
}

export type EquipmentItemId = string;

export interface EquipmentItemDef {
  id: EquipmentItemId;
  name: string;
  collection: EquipmentCollectionId;
  slot: EquipmentSlot;
  description: string;
  effectDescription: string;
  iconName: string;
  // Specific numerical stat modifiers applied while in dungeon
  stats: {
    atkBonusPercent?: number;       // e.g. 0.18 (+18% ATK)
    maxHpBonus?: number;            // e.g. 80 (+80 Max HP)
    defensePercent?: number;        // e.g. 0.12 (12% Damage Reduction)
    critChancePercent?: number;     // e.g. 0.15 (+15% Crit Chance)
    critDamagePercent?: number;     // e.g. 0.45 (+45% Crit DMG)
    moveSpeedPercent?: number;      // e.g. 0.18 (+18% Move Speed)
    cooldownReductionPercent?: number; // e.g. 0.20 (+20% CDR)
    resourceBonusPercent?: number;  // e.g. 0.40 (+40% Shards/XP)
    onKillHealPercent?: number;     // e.g. 0.05 (Restore 5% Max HP on kill)
    onKillAtkBoostPercent?: number; // e.g. 0.20 (+20% ATK for 4s)
    poisonChancePercent?: number;   // e.g. 0.40 (40% chance to poison)
    consecutiveAttackSpeed?: number;// e.g. 0.06 (6% ASPD per hit, up to 30%)
    basicAttackDamagePercent?: number;// e.g. 0.20 (+20% Basic ATK)
    projectileAtkBonusPercent?: number;// e.g. 0.22 (+22% Projectile/Slash ATK)
    projectilePierceBonus?: boolean;// true
    spectralBarrierOnHit?: boolean; // grants shield on damage
    seekingSpiritOnSkill?: boolean; // releases homing wisp on skill hit
    explosiveOnPoisonDefeat?: boolean; // toxic burst on poisoned kill
    explosiveSkillProc?: boolean;   // shrapnel explosion on skill hit
  };
}

export type HeroEquipmentLoadout = Record<EquipmentSlot, string | null>;

export interface EquipmentStateSnapshot {
  ownedEquipmentIds: string[];
  equippedByHero: Record<HeroId, HeroEquipmentLoadout>;
  isDungeonActive: boolean;
  activeSetBonuses: Array<{
    collectionId: EquipmentCollectionId;
    collectionName: string;
    piecesEquipped: number;
    hasTwoPiece: boolean;
    hasFourPiece: boolean;
    twoPieceName: string;
    fourPieceName: string;
  }>;
}

export interface EquipmentDropPayload {
  item: EquipmentItemDef;
  collection: EquipmentCollectionDef;
  isFirstDiscovery: boolean;
}
