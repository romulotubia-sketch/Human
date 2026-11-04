import { HeroId } from '../types/game';
import {
  EquipmentCollectionDef,
  EquipmentCollectionId,
  EquipmentItemDef,
} from '../types/equipment';

export const EQUIPMENT_COLLECTIONS: Record<EquipmentCollectionId, EquipmentCollectionDef> = {
  eternal_bone: {
    id: 'eternal_bone',
    name: 'Eternal Bone Set',
    theme: 'Critical strikes, physical power, and survival',
    correspondingHero: 'skeleton',
    bossName: 'Corrupted Skeleton',
    themeColor: '#67e8f9',
    twoPieceBonus: {
      piecesRequired: 2,
      name: 'Bone Resonance',
      description: 'Critical strikes restore a small amount of health (3.5% Max HP).',
    },
    fourPieceBonus: {
      piecesRequired: 4,
      name: 'Eternal Framework',
      description:
        'Critical strikes build Bone Energy (up to 5). At maximum energy, the next attack releases a crushing bone shockwave around the hero dealing 180% damage.',
    },
  },
  phantom_regalia: {
    id: 'phantom_regalia',
    name: 'Phantom Regalia',
    theme: 'Evasion, skill enhancement, and spectral energy',
    correspondingHero: 'ghost',
    bossName: 'Corrupted Ghost',
    themeColor: '#818cf8',
    twoPieceBonus: {
      piecesRequired: 2,
      name: 'Spectral Flow',
      description: 'Using a skill briefly increases movement speed (+30% for 3 seconds).',
    },
    fourPieceBonus: {
      piecesRequired: 4,
      name: 'Ghostwalk',
      description:
        'After using several skills (every 3rd skill), creates a spectral copy that repeats the skill effect at 60% strength.',
    },
  },
  plaguebound: {
    id: 'plaguebound',
    name: 'Plaguebound Set',
    theme: 'Health recovery, poison, and sustained combat',
    correspondingHero: 'zombie',
    bossName: 'Corrupted Zombie',
    themeColor: '#a3e635',
    twoPieceBonus: {
      piecesRequired: 2,
      name: 'Spreading Infection',
      description:
        'Poisoned enemies spread a portion of their poison effect to nearby enemies when defeated.',
    },
    fourPieceBonus: {
      piecesRequired: 4,
      name: 'Plague Incarnate',
      description:
        'Poisoned enemies periodically release toxic bursts (every 2s) that damage nearby foes and spread the infection.',
    },
  },
  feral_hunter: {
    id: 'feral_hunter',
    name: 'Feral Hunter Set',
    theme: 'Aggression, mobility, and consecutive attacks',
    correspondingHero: 'ghoul',
    bossName: 'Corrupted Ghoul',
    themeColor: '#fb7185',
    twoPieceBonus: {
      piecesRequired: 2,
      name: 'Hunting Rhythm',
      description:
        'Consecutive attacks build Hunting Momentum (up to 5 stacks), granting +7% attack speed per stack.',
    },
    fourPieceBonus: {
      piecesRequired: 4,
      name: 'Apex Instinct',
      description:
        'At maximum Hunting Momentum, your next basic attack releases a powerful forward-reaching claw wave dealing 220% damage.',
    },
  },
  survivors_arsenal: {
    id: 'survivors_arsenal',
    name: "Survivor's Arsenal",
    theme: 'Adaptability, balanced stats, and resourcefulness',
    correspondingHero: 'human',
    bossName: 'Corrupted Human',
    themeColor: '#fb923c',
    twoPieceBonus: {
      piecesRequired: 2,
      name: 'Improvised Tactics',
      description:
        'Using a skill enhances your next basic attack, giving it +50% bonus damage and a concussive shock.',
    },
    fourPieceBonus: {
      piecesRequired: 4,
      name: 'Last Survivor',
      description:
        'When health becomes critically low (<30% HP), automatically creates a protective barrier (160 HP) and releases a repelling kinetic shockwave (30s internal recovery).',
    },
  },
  sky_sovereign: {
    id: 'sky_sovereign',
    name: 'Sky Sovereign Set',
    theme: 'Projectile attacks, precision, and range',
    correspondingHero: 'eaglekin',
    bossName: 'Corrupted Eaglekin',
    themeColor: '#38bdf8',
    twoPieceBonus: {
      piecesRequired: 2,
      name: 'Piercing Winds',
      description:
        'Attacks that hit enemies have a 35% chance to release a small piercing wind projectile (deals 60% ATK).',
    },
    fourPieceBonus: {
      piecesRequired: 4,
      name: 'Tempest Wings',
      description:
        'Repeated attack hits build Wind Charges (up to 5). At maximum charges, the next attack releases a large piercing wind hurricane dealing 240% damage.',
    },
  },
  king_of_beasts: {
    id: 'king_of_beasts',
    name: 'King of Beasts Set',
    theme: 'Melee combat, powerful attacks, and momentum',
    correspondingHero: 'tigerkin',
    bossName: 'Corrupted Tigerkin',
    themeColor: '#f59e0b',
    twoPieceBonus: {
      piecesRequired: 2,
      name: 'Feral Dominance',
      description:
        'Consecutive basic attacks build Feral Energy (up to 5 stacks), granting +5% attack power per stack.',
    },
    fourPieceBonus: {
      piecesRequired: 4,
      name: 'Roar of the Apex',
      description:
        'At maximum Feral Energy, your next basic attack releases a powerful shockwave that damages all nearby enemies for 200% ATK.',
    },
  },
};

export const ALL_EQUIPMENT_ITEMS: EquipmentItemDef[] = [
  // ==========================================
  // A. SKELETON – ETERNAL BONE SET (4 Pieces)
  // ==========================================
  {
    id: 'bonebreaker_emblem',
    name: 'Bonebreaker Emblem',
    collection: 'eternal_bone',
    slot: 'weapon',
    description: 'A heavy bone seal forged from petrified marrow that channels unyielding physical force.',
    effectDescription: 'Increases attack power by +18%.',
    iconName: 'Sword',
    stats: {
      atkBonusPercent: 0.18,
    },
  },
  {
    id: 'ribcage_aegis',
    name: 'Ribcage Aegis',
    collection: 'eternal_bone',
    slot: 'armor',
    description: 'An interwoven cuirass of fossilized ribs that deflects mortal blows.',
    effectDescription: 'Increases maximum health by +80 and grants +12% damage reduction.',
    iconName: 'Shield',
    stats: {
      maxHpBonus: 80,
      defensePercent: 0.12,
    },
  },
  {
    id: 'skull_of_precision',
    name: 'Skull of Precision',
    collection: 'eternal_bone',
    slot: 'spirit',
    description: 'A polished ivory relic that sharpens the wielder’s combat instincts.',
    effectDescription: 'Basic attacks and strikes gain a +15% bonus chance to deal critical damage.',
    iconName: 'Target',
    stats: {
      critChancePercent: 0.15,
    },
  },
  {
    id: 'crown_of_the_undying',
    name: 'Crown of the Undying',
    collection: 'eternal_bone',
    slot: 'ancient',
    description: 'An ancient diademed circlet inscribed with ossuary runes of perpetual vitality.',
    effectDescription: 'Defeating any enemy restores 5% of maximum health.',
    iconName: 'Crown',
    stats: {
      onKillHealPercent: 0.05,
    },
  },

  // ==========================================
  // B. GHOST – PHANTOM REGALIA (4 Pieces)
  // ==========================================
  {
    id: 'soul_lantern',
    name: 'Soul Lantern',
    collection: 'phantom_regalia',
    slot: 'weapon',
    description: 'An eerie brass thurible brimming with celestial ectoplasm that seeks out nearby foes.',
    effectDescription: 'Skill hits have a 35% chance to release a seeking spirit projectile (85% ATK).',
    iconName: 'Flame',
    stats: {
      seekingSpiritOnSkill: true,
    },
  },
  {
    id: 'phantom_veil',
    name: 'Phantom Veil',
    collection: 'phantom_regalia',
    slot: 'armor',
    description: 'A diaphanous cowl woven from moonlight mist that allows the bearer to slip between realms.',
    effectDescription: 'Increases movement speed by +18%.',
    iconName: 'Wind',
    stats: {
      moveSpeedPercent: 0.18,
    },
  },
  {
    id: 'wraith_pendant',
    name: 'Wraith Pendant',
    collection: 'phantom_regalia',
    slot: 'spirit',
    description: 'A ghostly lodestone that hastens astral resonance and spell recovery.',
    effectDescription: 'Reduces skill cooldowns by 20%.',
    iconName: 'Clock',
    stats: {
      cooldownReductionPercent: 0.2,
    },
  },
  {
    id: 'ethereal_mask',
    name: 'Ethereal Mask',
    collection: 'phantom_regalia',
    slot: 'ancient',
    description: 'An otherworldly porcelain visage that temporarily phases the bearer into the spirit plane.',
    effectDescription: 'Taking damage grants a brief defensive spectral barrier (absorbs 65 damage, 8s cooldown).',
    iconName: 'Sparkles',
    stats: {
      spectralBarrierOnHit: true,
    },
  },

  // ==========================================
  // C. ZOMBIE – PLAGUEBOUND SET (4 Pieces)
  // ==========================================
  {
    id: 'plague_gauntlet',
    name: 'Plague Gauntlet',
    collection: 'plaguebound',
    slot: 'weapon',
    description: 'A festering rot-iron gauntlet seeping virulent necrotic venom.',
    effectDescription: 'Attacks have a 40% chance to inflict poison (deals 35% ATK/sec for 4s).',
    iconName: 'Zap',
    stats: {
      poisonChancePercent: 0.4,
    },
  },
  {
    id: 'fleshbound_armor',
    name: 'Fleshbound Armor',
    collection: 'plaguebound',
    slot: 'armor',
    description: 'Thick leathery carapaces treated with preserve-balm that shrug off physical force.',
    effectDescription: 'Increases defense (+16% damage reduction).',
    iconName: 'ShieldAlert',
    stats: {
      defensePercent: 0.16,
    },
  },
  {
    id: 'corrupted_flask',
    name: 'Corrupted Flask',
    collection: 'plaguebound',
    slot: 'spirit',
    description: 'A pressurized vial of reactive blight sludge that combusts upon pestilence.',
    effectDescription: 'Defeating poisoned enemies releases a small toxic explosion (70% ATK AoE).',
    iconName: 'FlaskConical',
    stats: {
      explosiveOnPoisonDefeat: true,
    },
  },
  {
    id: 'rotten_heart',
    name: 'Rotten Heart',
    collection: 'plaguebound',
    slot: 'ancient',
    description: 'A pulsating core of undead endurance that multiplies the bearer’s lifeforce.',
    effectDescription: 'Increases maximum health by +140.',
    iconName: 'Heart',
    stats: {
      maxHpBonus: 140,
    },
  },

  // ==========================================
  // D. GHOUL – FERAL HUNTER SET (4 Pieces)
  // ==========================================
  {
    id: 'savage_claw',
    name: 'Savage Claw',
    collection: 'feral_hunter',
    slot: 'weapon',
    description: 'A barbed predator claw that quickens its vicious rhythm with every slash.',
    effectDescription: 'Consecutive basic attacks gradually increase attack speed (+6% per hit up to +30%).',
    iconName: 'Swords',
    stats: {
      consecutiveAttackSpeed: 0.06,
    },
  },
  {
    id: 'hunters_mantle',
    name: "Hunter's Mantle",
    collection: 'feral_hunter',
    slot: 'armor',
    description: 'A lightweight cloak tailored from midnight stalker hides.',
    effectDescription: 'Increases movement speed by +16%.',
    iconName: 'Footprints',
    stats: {
      moveSpeedPercent: 0.16,
    },
  },
  {
    id: 'predators_fang',
    name: "Predator's Fang",
    collection: 'feral_hunter',
    slot: 'spirit',
    description: 'A serrated fang that instinctively seeks out vulnerable arteries.',
    effectDescription: 'Increases critical strike chance by +14%.',
    iconName: 'Crosshair',
    stats: {
      critChancePercent: 0.14,
    },
  },
  {
    id: 'beasts_trophy',
    name: "Beast's Trophy",
    collection: 'feral_hunter',
    slot: 'ancient',
    description: 'A dried predator totem that fuels bloodlust whenever prey falls.',
    effectDescription: 'Defeating an enemy briefly increases attack power (+20% ATK for 4 seconds).',
    iconName: 'Skull',
    stats: {
      onKillAtkBoostPercent: 0.2,
    },
  },

  // ==========================================
  // E. HUMAN – SURVIVOR'S ARSENAL (4 Pieces)
  // ==========================================
  {
    id: 'scrappers_gloves',
    name: "Scrapper's Gloves",
    collection: 'survivors_arsenal',
    slot: 'weapon',
    description: 'Reinforced work gloves lined with steel studs for devastating brawler swings.',
    effectDescription: 'Increases attack power by +16%.',
    iconName: 'HandMetal',
    stats: {
      atkBonusPercent: 0.16,
    },
  },
  {
    id: 'reinforced_jacket',
    name: 'Reinforced Jacket',
    collection: 'survivors_arsenal',
    slot: 'armor',
    description: 'A padded canvas duster armored with scavenged iron plates.',
    effectDescription: 'Increases maximum health by +110.',
    iconName: 'ShieldCheck',
    stats: {
      maxHpBonus: 110,
    },
  },
  {
    id: 'survivors_toolkit',
    name: "Survivor's Toolkit",
    collection: 'survivors_arsenal',
    slot: 'spirit',
    description: 'A pouch of improvised shrapnel charges rigged to detonate on impact.',
    effectDescription: 'Skill hits have a 35% chance to trigger an additional explosive shrapnel burst (65% ATK).',
    iconName: 'Wrench',
    stats: {
      explosiveSkillProc: true,
    },
  },
  {
    id: 'scavenger_charm',
    name: "Scavenger's Charm",
    collection: 'survivors_arsenal',
    slot: 'ancient',
    description: 'A lucky horseshoe and brass sprocket trinket that attracts buried treasure.',
    effectDescription: 'Increases bone shards collected by +40% and XP gain by +30%.',
    iconName: 'Coins',
    stats: {
      resourceBonusPercent: 0.4,
    },
  },

  // ==========================================
  // F. EAGLEKIN – SKY SOVEREIGN SET (4 Pieces)
  // ==========================================
  {
    id: 'feathered_quiver',
    name: 'Feathered Quiver',
    collection: 'sky_sovereign',
    slot: 'weapon',
    description: 'Aerodynamic sky-quiver crafted from highland falcon pinions.',
    effectDescription: 'Increases projectile and ranged skill attack power by +22% (also empowers melee basic attacks).',
    iconName: 'Feather',
    stats: {
      projectileAtkBonusPercent: 0.22,
    },
  },
  {
    id: 'windborne_mantle',
    name: 'Windborne Mantle',
    collection: 'sky_sovereign',
    slot: 'armor',
    description: 'Silken aerial cape infused with soaring updraft currents.',
    effectDescription: 'Increases movement speed by +18%.',
    iconName: 'Compass',
    stats: {
      moveSpeedPercent: 0.18,
    },
  },
  {
    id: 'skyheart_amulet',
    name: 'Skyheart Amulet',
    collection: 'sky_sovereign',
    slot: 'spirit',
    description: 'A sapphire teardrop gem that imbues strikes with piercing sonic resonance.',
    effectDescription: 'Projectile attacks and weapon sweeps pierce an additional enemy.',
    iconName: 'Eye',
    stats: {
      projectilePierceBonus: true,
    },
  },
  {
    id: 'eagles_eye',
    name: "Eagle's Eye",
    collection: 'sky_sovereign',
    slot: 'ancient',
    description: 'A gold-rimmed prism granting absolute battlefield clarity.',
    effectDescription: 'Increases critical strike chance by +16%.',
    iconName: 'Sun',
    stats: {
      critChancePercent: 0.16,
    },
  },

  // ==========================================
  // G. TIGERKIN – KING OF BEASTS SET (4 Pieces)
  // ==========================================
  {
    id: 'tiger_fang',
    name: 'Tiger Fang',
    collection: 'king_of_beasts',
    slot: 'weapon',
    description: 'A massive amber saber-fang dripping with untamed primeval fury.',
    effectDescription: 'Increases basic attack damage by +20%.',
    iconName: 'Flame',
    stats: {
      basicAttackDamagePercent: 0.2,
    },
  },
  {
    id: 'kings_hide',
    name: "King's Hide",
    collection: 'king_of_beasts',
    slot: 'armor',
    description: 'Tough striped pelts hardened in mountain trial fires.',
    effectDescription: 'Increases maximum health by +90 and defense by +10%.',
    iconName: 'Shield',
    stats: {
      maxHpBonus: 90,
      defensePercent: 0.1,
    },
  },
  {
    id: 'savage_bracers',
    name: 'Savage Bracers',
    collection: 'king_of_beasts',
    slot: 'spirit',
    description: 'Heavy brass wristbands that whip strikes into a relentless frenzy.',
    effectDescription: 'Consecutive basic attacks increase attack speed (+7% per hit up to +28%).',
    iconName: 'Activity',
    stats: {
      consecutiveAttackSpeed: 0.07,
    },
  },
  {
    id: 'apex_crown',
    name: 'Apex Crown',
    collection: 'king_of_beasts',
    slot: 'ancient',
    description: 'A gilded crown fashioned from the horns of legendary crypt behemoths.',
    effectDescription: 'Increases critical strike damage by +45%.',
    iconName: 'Award',
    stats: {
      critDamagePercent: 0.45,
    },
  },
];

export const EQUIPMENT_BY_ID: Record<string, EquipmentItemDef> = Object.fromEntries(
  ALL_EQUIPMENT_ITEMS.map((item) => [item.id, item])
);

export const HERO_TO_COLLECTION: Record<HeroId, EquipmentCollectionId> = {
  skeleton: 'eternal_bone',
  ghost: 'phantom_regalia',
  zombie: 'plaguebound',
  ghoul: 'feral_hunter',
  human: 'survivors_arsenal',
  eaglekin: 'sky_sovereign',
  tigerkin: 'king_of_beasts',
};

export const COLLECTION_TO_HERO: Record<EquipmentCollectionId, HeroId> = {
  eternal_bone: 'skeleton',
  phantom_regalia: 'ghost',
  plaguebound: 'zombie',
  feral_hunter: 'ghoul',
  survivors_arsenal: 'human',
  sky_sovereign: 'eaglekin',
  king_of_beasts: 'tigerkin',
};

/**
 * Gets the 4 equipment pieces that belong to a specific collection or hero
 */
export function getEquipmentForCollection(collectionId: EquipmentCollectionId): EquipmentItemDef[] {
  return ALL_EQUIPMENT_ITEMS.filter((item) => item.collection === collectionId);
}

export function getEquipmentForHero(heroId: HeroId): EquipmentItemDef[] {
  const colId = HERO_TO_COLLECTION[heroId];
  return getEquipmentForCollection(colId);
}
