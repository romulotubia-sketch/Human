import { HeroId } from '../types/game';
import {
  EnhancementMilestoneDef,
  EquipmentCollectionDef,
  EquipmentCollectionId,
  EquipmentItemDef,
} from '../types/equipment';

export const EQUIPMENT_COLLECTIONS: Record<EquipmentCollectionId, EquipmentCollectionDef> = {
  eternal_bone: {
    id: 'eternal_bone',
    name: 'Eternal Bone Set',
    theme: 'Critical strikes, physical power, bone manipulation, and survival',
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
    sixPieceBonus: {
      piecesRequired: 6,
      name: 'Undying Bone Sovereign',
      description:
        'Critical strikes have a 25% chance to summon a temporary spectral bone warrior that attacks nearby enemies. Repeated critical strikes improve its attack pattern and slash radius.',
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
    sixPieceBonus: {
      piecesRequired: 6,
      name: 'Eternal Apparition',
      description:
        "Activating a skill creates a temporary phantom that imitates the hero's next skill or attack at 50% effectiveness.",
    },
  },
  plaguebound: {
    id: 'plaguebound',
    name: 'Plaguebound Set',
    theme: 'Poison, health recovery, infection, and sustained combat',
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
    sixPieceBonus: {
      piecesRequired: 6,
      name: 'Walking Plague',
      description:
        'Poison effects accumulate infection stages (1-3). At maximum infection, the enemy releases a massive toxic explosion and infects all surrounding enemies.',
    },
  },
  feral_hunter: {
    id: 'feral_hunter',
    name: 'Feral Hunter Set',
    theme: 'Aggression, critical attacks, mobility, and consecutive attacks',
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
    sixPieceBonus: {
      piecesRequired: 6,
      name: 'Endless Pursuit',
      description:
        "Defeating an enemy while Hunting Momentum is active partially restores the momentum (+2 stacks) and causes the hero's next attack to pursue and lunge at the nearest enemy.",
    },
  },
  survivors_arsenal: {
    id: 'survivors_arsenal',
    name: "Survivor's Arsenal",
    theme: 'Adaptability, resourcefulness, balanced stats, and improvised combat',
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
    sixPieceBonus: {
      piecesRequired: 6,
      name: 'Resourceful Genius',
      description:
        'Activating different skills in succession builds Adaptation Energy (up to 3). At maximum energy, the next skill unleashes an improvised kinetic detonation shockwave and bonus damage.',
    },
  },
  sky_sovereign: {
    id: 'sky_sovereign',
    name: 'Sky Sovereign Set',
    theme: 'Projectile attacks, precision, critical strikes, and wind manipulation',
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
    sixPieceBonus: {
      piecesRequired: 6,
      name: "Sovereign's Barrage",
      description:
        'At maximum Wind Charges, the next projectile attack creates a spectral formation of feathers that follows the original attack trajectory and releases additional piercing projectiles.',
    },
  },
  king_of_beasts: {
    id: 'king_of_beasts',
    name: 'King of Beasts Set',
    theme: 'Melee combat, physical power, attack speed, and feral momentum',
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
    sixPieceBonus: {
      piecesRequired: 6,
      name: 'Primal Overlord',
      description:
        'At maximum Feral Energy, the next enhanced attack releases a massive spectral tiger claw that sweeps through enemies in front of the hero in a 280° arc dealing 320% damage.',
    },
  },
  nocturne_regalia: {
    id: 'nocturne_regalia',
    name: 'Nocturne Regalia',
    theme: 'Sound waves, vibration control, acoustic resonance, and spectral echoes',
    correspondingHero: 'batkin',
    bossName: 'The Hollow Conductor',
    themeColor: '#c084fc',
    twoPieceBonus: {
      piecesRequired: 2,
      name: 'Echo Synchronization',
      description:
        'Hitting enemies with skills or enhanced attacks creates a delayed echo that damages them a second time for 65% damage.',
    },
    fourPieceBonus: {
      piecesRequired: 4,
      name: 'Resonant Overload',
      description:
        'Dealing sonic or skill damage builds Resonant Overload (up to 5 stacks). Upon reaching full stacks, triggers an explosion of sound waves dealing 250% ATK damage to all nearby enemies.',
    },
    sixPieceBonus: {
      piecesRequired: 6,
      name: 'Lord of the Eternal Echo',
      description:
        'All attacks and skills create echoes. The hero gains a permanent resonance aura that continuously damages and weakens nearby enemies. When an ultimate is cast, summons spectral bats that sweep across the room.',
    },
  },
};

// =========================================================================
// 48 UNIQUE EQUIPMENT PIECES (8 Collections x 6 Relic Slots)
// =========================================================================
export const ALL_EQUIPMENT_ITEMS: EquipmentItemDef[] = [
  // ==========================================
  // A. SKELETON – ETERNAL BONE SET (6 Pieces)
  // ==========================================
  {
    id: 'bonebreaker_emblem',
    name: 'Bonebreaker Emblem',
    collection: 'eternal_bone',
    slot: 'weapon',
    description: 'A heavy bone seal forged from petrified marrow that channels unyielding physical force.',
    effectDescription: 'Increases attack power by +18%.',
    iconName: 'Sword',
    milestones: [
      { level: 3, title: 'Ossuary Might', description: 'Attack power bonus increased by +6%.' },
      { level: 6, title: 'Crushing Force', description: 'Basic attacks hit with +15% increased physical impact.' },
      { level: 9, title: 'Marrow Crack', description: 'Hits have a 25% chance to crack enemy physical armor by 18% for 4s.' },
      { level: 12, title: 'Bone Might', description: 'Consecutive hits grant +3% bonus attack power (stacks up to 5x).' },
      { level: 15, title: 'Fracture Eruption', description: 'Critical strikes against cracked foes trigger a bone fracture explosion (90% ATK AoE).' },
    ],
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
    milestones: [
      { level: 3, title: 'Hardened Marrow', description: 'Increases maximum health by an additional +40 and defense by +4%.' },
      { level: 6, title: 'Ossuary Deflection', description: 'Deflecting attacks releases a burst of calcified dust, reducing attacker speed by 15%.' },
      { level: 9, title: 'Bone Bastion', description: 'Dropping below 40% HP instantly grants an ossuary barrier absorbing 80 damage (20s cd).' },
      { level: 12, title: 'Martyr Ribs', description: 'Gain +1% damage reduction for every 8% missing health.' },
      { level: 15, title: 'Undying Aegis', description: 'Once per floor, completely negates a lethal hit and pushes nearby enemies back.' },
    ],
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
    effectDescription: 'Basic attacks have a +15% chance to deal critical damage.',
    iconName: 'Target',
    milestones: [
      { level: 3, title: 'Bone Splinter', description: 'Critical strikes have a 35% chance to release a small bone projectile.' },
      { level: 6, title: 'Sharpened Instincts', description: 'Further increases critical strike damage by +25%.' },
      { level: 9, title: 'Ossuary Shockwave', description: 'Critical strikes have a 25% chance to trigger a small bone shockwave (60% ATK).' },
      { level: 12, title: 'Bone Fracture', description: 'Repeated critical hits against the same enemy build Bone Fracture, increasing subsequent critical damage by +10% per stack.' },
      { level: 15, title: 'Spectral Shards', description: 'Critical strikes summon seeking spectral bone fragments that strike up to 2 nearby enemies.' },
    ],
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
    effectDescription: 'Defeating an enemy restores 5% of maximum health.',
    iconName: 'Crown',
    milestones: [
      { level: 3, title: 'Deepened Leech', description: 'On-kill health restoration increased to 7% of maximum health.' },
      { level: 6, title: 'Ossuary Vitality', description: 'Overhealing from defeats converts into a temporary shield (up to 60 shield HP).' },
      { level: 9, title: 'Behemoth Siphon', description: 'Defeating elite or champion monsters restores 15% maximum health.' },
      { level: 12, title: 'Echo of the Tomb', description: 'Defeating enemies releases a healing wisp that heals the lowest-health ally or minion.' },
      { level: 15, title: 'Undying Sovereign', description: 'Upon receiving lethal damage, immediately revive with 35% HP (once per dungeon run).' },
    ],
    stats: {
      onKillHealPercent: 0.05,
    },
  },
  {
    id: 'ancient_marrow_ring',
    name: 'Ancient Marrow Ring',
    collection: 'eternal_bone',
    slot: 'accessory',
    description: 'A ring of petrified dinosaur bone imbued with ruthless mortal potency.',
    effectDescription: 'Increases critical strike damage by +45%.',
    iconName: 'Sparkles',
    milestones: [
      { level: 3, title: 'Bone Harvest', description: 'Critical strikes have a 30% chance to generate +1 Bone Energy stack.' },
      { level: 6, title: 'Execute Surge', description: 'Increases critical damage by an additional +30% against enemies below 50% HP.' },
      { level: 9, title: 'Splinter Resonance', description: 'Critical strikes release a secondary bone shard piercing behind the target.' },
      { level: 12, title: 'Relentless Criticals', description: 'Consecutive critical strikes increase critical strike chance by +4% for 4s (stacks up to 20%).' },
      { level: 15, title: 'Marrow Detonation', description: 'Critical strikes trigger a brief bone explosion around the target dealing 110% ATK.' },
    ],
    stats: {
      critDamagePercent: 0.45,
    },
  },
  {
    id: 'bone_lords_phylactery',
    name: "Bone Lord's Phylactery",
    collection: 'eternal_bone',
    slot: 'core',
    description: 'A glowing necrotic vessel holding the essence of an ancient ossuary sovereign.',
    effectDescription: 'Critical strikes have a 30% chance to release small bone fragments that strike nearby enemies.',
    iconName: 'Flame',
    milestones: [
      { level: 3, title: 'Shatter Force', description: 'Bone fragments deal +35% increased damage.' },
      { level: 6, title: 'Pierce Shards', description: 'Bone fragments pierce through the first enemy struck.' },
      { level: 9, title: 'Bone Catalyst', description: 'Bone fragments have their own 20% chance to critically strike.' },
      { level: 12, title: 'Soul Tether', description: 'Releasing bone fragments restores 2% of maximum health.' },
      { level: 15, title: 'Ossuary Maelstrom', description: 'Critical strikes summon a vortex of whirling bone shards dealing 140% ATK in an area.' },
    ],
    stats: {
      critBoneFragmentChance: 0.3,
    },
  },

  // ==========================================
  // B. GHOST – PHANTOM REGALIA (6 Pieces)
  // ==========================================
  {
    id: 'phantom_veil',
    name: 'Phantom Veil',
    collection: 'phantom_regalia',
    slot: 'armor',
    description: 'A diaphanous cowl woven from moonlight mist that allows the bearer to slip between realms.',
    effectDescription: 'Increases movement speed by +18%.',
    iconName: 'Wind',
    milestones: [
      { level: 3, title: 'Mist Step', description: 'Increases movement speed by an additional +6%.' },
      { level: 6, title: 'Spectral Decoy', description: 'Dashing leaves behind a momentary mist decoy that distracts nearby foes.' },
      { level: 9, title: 'Evasive Drift', description: 'Moving continuously grants up to +18% chance to evade enemy projectile damage.' },
      { level: 12, title: 'Momentum Phasing', description: 'While moving at high speed, gain +15% increased skill effectiveness.' },
      { level: 15, title: 'True Phantasm', description: 'Movement speed bonus doubled when out of combat, and allows phasing freely through enemies.' },
    ],
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
    milestones: [
      { level: 3, title: 'Temporal Drift', description: 'Reduces skill cooldowns by an additional +5% (total 25% CDR).' },
      { level: 6, title: 'Phase Haste', description: 'Activating any skill grants +20% movement speed for 2.5 seconds.' },
      { level: 9, title: 'Astral Refund', description: 'Hitting at least 2 enemies with a skill refunds 12% of all other active cooldowns.' },
      { level: 12, title: 'Soul Siphon Reset', description: 'Defeating an elite enemy instantly resets the cooldown of your primary skill.' },
      { level: 15, title: 'Ethereal Quickening', description: 'Skill cooldowns recharge 30% faster while the hero is actively moving.' },
    ],
    stats: {
      cooldownReductionPercent: 0.2,
    },
  },
  {
    id: 'soul_lantern',
    name: 'Soul Lantern',
    collection: 'phantom_regalia',
    slot: 'weapon',
    description: 'An eerie brass thurible brimming with celestial ectoplasm that seeks out nearby foes.',
    effectDescription: 'Skill hits have a 35% chance to release a seeking spirit projectile (85% ATK).',
    iconName: 'Flame',
    milestones: [
      { level: 3, title: 'Swift Spirits', description: 'Spirit projectiles travel 35% faster.' },
      { level: 6, title: 'Astral Guidance', description: 'Spirit projectiles gain improved homing and tracking accuracy.' },
      { level: 9, title: 'Ethereal Piercing', description: 'Spirit projectiles pass through an additional enemy before detonating.' },
      { level: 12, title: 'Phantom Echo', description: 'Spirit projectile hits have a 25% chance to summon a temporary phantom clone.' },
      { level: 15, title: 'Spectral Nova', description: 'Spirit projectiles release a spectral burst dealing 120% ATK upon reaching their target.' },
    ],
    stats: {
      seekingSpiritOnSkill: true,
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
    milestones: [
      { level: 3, title: 'Reinforced Phantasm', description: 'Spectral barrier capacity increased to absorb 100 damage.' },
      { level: 6, title: 'Rapid Phasing', description: 'Spectral barrier cooldown reduced from 8s to 6s.' },
      { level: 9, title: 'Concussive Phase', description: 'When the spectral barrier triggers, knocks back nearby small enemies and slows them by 30%.' },
      { level: 12, title: 'Spectral Resonance', description: 'While the spectral barrier is active, skill damage is increased by +25%.' },
      { level: 15, title: 'Astral Retribution', description: 'When the barrier breaks or expires, it shatters into 4 homing spectral wisps (75% ATK each).' },
    ],
    stats: {
      spectralBarrierOnHit: true,
    },
  },
  {
    id: 'spectral_hourglass',
    name: 'Spectral Hourglass',
    collection: 'phantom_regalia',
    slot: 'accessory',
    description: 'A phantom timepiece filled with luminous spirit dust that bends cooldown recovery.',
    effectDescription: 'Improves skill effectiveness by +15% and reduces skill cooldowns by +12%.',
    iconName: 'Hourglass',
    milestones: [
      { level: 3, title: 'Chrono Surge', description: 'Skill effectiveness increased by an additional +8%.' },
      { level: 6, title: 'Lingering Echoes', description: 'Skill hits leave lingering spectral resonance dealing 20% ATK damage over 3s.' },
      { level: 9, title: 'Time Distortion', description: 'Skill hits slow enemy movement and attack animation speeds by 25% for 3s.' },
      { level: 12, title: 'Chrono Cascade', description: 'Using 2 skills within 4s grants your next basic attack +60% bonus astral damage.' },
      { level: 15, title: 'Spectral Overdrive', description: 'Reduces ultimate cooldown by 25% and causes all skills to trigger double visual echoes.' },
    ],
    stats: {
      cooldownReductionPercent: 0.12,
      atkBonusPercent: 0.15,
    },
  },
  {
    id: 'lost_soul_fragment',
    name: 'Lost Soul Fragment',
    collection: 'phantom_regalia',
    slot: 'core',
    description: 'A crystalline sliver of an ancient wisp that echoes attacks across ethereal planes.',
    effectDescription: 'Skill hits have a 30% chance to release a spectral echo that repeats part of the attack.',
    iconName: 'Ghost',
    milestones: [
      { level: 3, title: 'Potent Echoes', description: 'Spectral echoes deal +40% increased damage.' },
      { level: 6, title: 'Astral Range', description: 'Spectral echoes travel 35% farther through the crypt.' },
      { level: 9, title: 'Twin Resonance', description: 'Echoes have a 25% chance to repeat an additional secondary shockwave.' },
      { level: 12, title: 'Spectral Mark', description: 'Echoes leave a spectral mark on enemies, making them take +15% more damage from all sources.' },
      { level: 15, title: 'Phantasmal Twin', description: 'Echoes have a 30% chance to manifest a second weaker apparition that attacks for 4 seconds.' },
    ],
    stats: {
      spectralEchoOnSkill: true,
    },
  },

  // ==========================================
  // C. ZOMBIE – PLAGUEBOUND SET (6 Pieces)
  // ==========================================
  {
    id: 'rotten_heart',
    name: 'Rotten Heart',
    collection: 'plaguebound',
    slot: 'ancient',
    description: 'A pulsating core of undead endurance that multiplies the bearer’s lifeforce.',
    effectDescription: 'Increases maximum health by +140.',
    iconName: 'Heart',
    milestones: [
      { level: 3, title: 'Enduring Blight', description: 'Maximum health bonus increased to +200 HP.' },
      { level: 6, title: 'Putrid Regeneration', description: 'Regenerates 2% of maximum health per second while near poisoned enemies.' },
      { level: 9, title: 'Toxic Expulsion', description: 'Taking damage exceeding 20% of max HP releases an immediate poisonous spore blast.' },
      { level: 12, title: 'Necrotic Fortitude', description: 'Missing health increases poison damage dealt by up to +35%.' },
      { level: 15, title: 'Undying Pestilence', description: 'Upon near death, enter Putrid Shell for 3s (immune to damage, radiating plague).' },
    ],
    stats: {
      maxHpBonus: 140,
    },
  },
  {
    id: 'plague_gauntlet',
    name: 'Plague Gauntlet',
    collection: 'plaguebound',
    slot: 'weapon',
    description: 'A festering rot-iron gauntlet seeping virulent necrotic venom.',
    effectDescription: 'Attacks have a 40% chance to inflict poison (deals 35% ATK/sec for 4s).',
    iconName: 'Zap',
    milestones: [
      { level: 3, title: 'Virulent Venom', description: 'Poison damage per second increased by +35%.' },
      { level: 6, title: 'Airborne Contagion', description: 'Poison spreads to nearby enemies within 110px with a 45% chance on each damage tick.' },
      { level: 9, title: 'Corpse Burst', description: 'Poisoned enemies release a small toxic burst (75% ATK) when defeated.' },
      { level: 12, title: 'Deep Infection', description: 'Poison can accumulate up to 3 infection stages, multiplying damage per stage.' },
      { level: 15, title: 'Cataclysmic Plague', description: 'Fully infected enemies create a giant plague explosion (180% ATK) on defeat.' },
    ],
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
    milestones: [
      { level: 3, title: 'Leathery Graft', description: 'Damage reduction increased to +22%.' },
      { level: 6, title: 'Miasma Guard', description: 'Poisoned enemies deal 20% less damage to the bearer.' },
      { level: 9, title: 'Spore Ward', description: 'Gaining shield radiates infectious spores damaging surrounding enemies.' },
      { level: 12, title: 'Hardened Calluses', description: 'Direct melee attacks received are reduced by a flat 12 damage.' },
      { level: 15, title: 'Contagious Carapace', description: 'Incoming enemy attacks have a 50% chance to immediately poison the attacker.' },
    ],
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
    milestones: [
      { level: 3, title: 'Pressurized Sludge', description: 'Toxic explosion damage increased to 95% ATK and radius +25%.' },
      { level: 6, title: 'Lingering Fumes', description: 'Toxic clouds left by explosions persist for 3 additional seconds.' },
      { level: 9, title: 'Noxious Siphon', description: 'Standing inside your own toxic clouds restores 12 HP per second.' },
      { level: 12, title: 'Paralytic Gas', description: 'Enemies standing inside toxic clouds have their movement speed slowed by 30%.' },
      { level: 15, title: 'Plague Conflagration', description: 'Toxic clouds ignite into virulent green hellfire dealing 130% ATK over 4s.' },
    ],
    stats: {
      explosiveOnPoisonDefeat: true,
    },
  },
  {
    id: 'blighted_totem',
    name: 'Blighted Totem',
    collection: 'plaguebound',
    slot: 'accessory',
    description: 'A twisted effigy carved from tomb fungus that amplifies necrotic toxins.',
    effectDescription: 'Increases poison effectiveness by +35% and extends poison duration by +2s.',
    iconName: 'Skull',
    milestones: [
      { level: 3, title: 'Endless Miasma', description: 'Poison effectiveness increased to +50% and duration +3s.' },
      { level: 6, title: 'Lingering Torment', description: 'Poisoned enemies remain infected 4 seconds longer.' },
      { level: 9, title: 'Secondary Blight', description: 'Poison damage ticks have a 25% chance to trigger a secondary infection pulse.' },
      { level: 12, title: 'Withering Aura', description: 'Infected enemies weaken nearby foes, reducing their attack power by 15%.' },
      { level: 15, title: 'Toxic Resonance', description: 'Maximum infection causes periodic toxic pulses dealing 65% ATK every 1.5s.' },
    ],
    stats: {
      poisonChancePercent: 0.25,
      atkBonusPercent: 0.12,
    },
  },
  {
    id: 'putrid_core',
    name: 'Putrid Core',
    collection: 'plaguebound',
    slot: 'core',
    description: 'A pulsing necrotic organ that condenses infectious matter into healing essence.',
    effectDescription: 'Poisoned enemies have a 35% chance to release a healing essence (restores 4% Max HP) on defeat.',
    iconName: 'Activity',
    milestones: [
      { level: 3, title: 'Enriched Essence', description: 'Healing essence restores 6% of maximum health.' },
      { level: 6, title: 'Immunity Ward', description: 'Collecting healing essence grants temporary immunity to crowd control for 2s.' },
      { level: 9, title: 'Purifying Eruption', description: 'Collecting healing essence triggers an infectious shockwave damaging nearby foes.' },
      { level: 12, title: 'Vigor Infusion', description: 'Healing essence also restores 15% of active skill cooldowns.' },
      { level: 15, title: 'Orbiting Slime', description: 'Essence coalesces into an orbiting toxic slime orb that attacks nearby enemies for 80% ATK.' },
    ],
    stats: {
      healingEssenceOnPoisonKill: true,
    },
  },

  // ==========================================
  // D. GHOUL – FERAL HUNTER SET (6 Pieces)
  // ==========================================
  {
    id: 'savage_claw',
    name: 'Savage Claw',
    collection: 'feral_hunter',
    slot: 'weapon',
    description: 'A barbed predator claw that quickens its vicious rhythm with every slash.',
    effectDescription: 'Consecutive basic attacks gradually increase attack speed (+6% per hit up to +30%).',
    iconName: 'Swords',
    milestones: [
      { level: 3, title: 'Feral Quicken', description: 'Attack speed bonus increased to +8% per hit up to +40%.' },
      { level: 6, title: 'Savage Momentum', description: 'Consecutive hits also grant +4% bonus attack damage per hit.' },
      { level: 9, title: 'Armor Shred', description: 'At 5 consecutive hits, your attacks shred enemy armor by 25% for 4 seconds.' },
      { level: 12, title: 'Frenzy Claws', description: 'Attack speed bonus cap raised from +40% to +55%.' },
      { level: 15, title: 'Blood Flurry', description: 'At max attack speed, basic attacks release double slash waves slicing through lines of enemies.' },
    ],
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
    milestones: [
      { level: 3, title: 'Silent Stride', description: 'Increases movement speed by an additional +6%.' },
      { level: 6, title: 'Predator Stealth', description: 'Moving uninterrupted for 3s increases your next attack damage by +35%.' },
      { level: 9, title: 'Ambush Critical', description: 'Attacks made from high speed have a +25% bonus critical strike chance.' },
      { level: 12, title: 'Blood Scent', description: 'Gain +12% bonus movement speed towards wounded enemies below 50% HP.' },
      { level: 15, title: 'Phantom Stalker', description: 'Can phase through enemies while sprinting, ignoring traps and unit collision.' },
    ],
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
    milestones: [
      { level: 3, title: 'Sharpened Tooth', description: 'Increases critical strike chance by an additional +5% (total +19%).' },
      { level: 6, title: 'Momentum Claws', description: 'Critical strikes immediately build +1 stack of Hunting Momentum.' },
      { level: 9, title: 'Double Rend', description: 'Critical strikes have a 30% chance to trigger an additional claw strike for 60% ATK.' },
      { level: 12, title: 'Carnage Focus', description: 'Repeated critical strikes against the same target increase critical damage by +12% per hit.' },
      { level: 15, title: 'Apex Wave', description: 'Critical strikes at maximum Hunting Momentum release a spectral claw wave dealing 160% ATK.' },
    ],
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
    milestones: [
      { level: 3, title: 'Blood Feast', description: 'Attack power boost increased to +25% ATK.' },
      { level: 6, title: 'Extended Hunt', description: 'Trophy attack power buff duration extended from 4s to 6s.' },
      { level: 9, title: 'Pack Alpha', description: 'Beast Trophy stacks up to 4 times instead of 3 (up to +100% ATK).' },
      { level: 12, title: 'Predatory Leech', description: 'While Beast Trophy is active, attacks restore 3% of damage dealt as health.' },
      { level: 15, title: 'Apex Bloodlust', description: 'Defeating an elite enemy grants instant maximum stacks and unleashes a feral roar.' },
    ],
    stats: {
      onKillAtkBoostPercent: 0.2,
    },
  },
  {
    id: 'bloodstained_charm',
    name: 'Bloodstained Charm',
    collection: 'feral_hunter',
    slot: 'accessory',
    description: 'An enchanted talisman dipped in beast blood that feeds upon relentless brutality.',
    effectDescription: 'Consecutive attacks have a 25% chance to restore a small amount of health (3% Max HP).',
    iconName: 'HeartPulse',
    milestones: [
      { level: 3, title: 'Sanguine Thirst', description: 'Health restoration increased to 4.5% of maximum health.' },
      { level: 6, title: 'Relentless Flow', description: 'Heal trigger chance increased from 25% to 35%.' },
      { level: 9, title: 'Critical Siphon', description: 'Critical attacks double the amount of health restored.' },
      { level: 12, title: 'Blood Shield', description: 'Excess healing converts into a blood shield (absorbs up to 80 damage).' },
      { level: 15, title: 'Feral Vigor', description: 'Consecutive attacks awaken Blood Hunger, increasing movement speed and lifesteal by 20%.' },
    ],
    stats: {
      consecutiveHealChance: 0.25,
      atkBonusPercent: 0.1,
    },
  },
  {
    id: 'hunters_markstone',
    name: "Hunter's Markstone",
    collection: 'feral_hunter',
    slot: 'core',
    description: 'A runic stone that etches predatory marks upon prey, rendering them helpless.',
    effectDescription: 'Attacking the same enemy repeatedly increases damage dealt by +8% per hit (up to +40%).',
    iconName: 'Crosshair',
    milestones: [
      { level: 3, title: 'Deep Mark', description: 'Repeated hit effectiveness increased to +10% per hit (up to +50%).' },
      { level: 6, title: 'Swift Inscription', description: 'The mark builds twice as fast on basic attacks.' },
      { level: 9, title: 'Vulnerable Prey', description: 'Marked enemies take +25% increased damage from critical strikes.' },
      { level: 12, title: 'Mark Transference', description: 'Defeating a marked enemy transfers the full mark stacks to the nearest enemy.' },
      { level: 15, title: 'Predator Execution', description: 'Fully marked enemies release a spectral hunting wave (150% ATK) when defeated.' },
    ],
    stats: {
      hunterMarkOnHit: true,
    },
  },

  // ==========================================
  // E. HUMAN – SURVIVOR'S ARSENAL (6 Pieces)
  // ==========================================
  {
    id: 'scrappers_gloves',
    name: "Scrapper's Gloves",
    collection: 'survivors_arsenal',
    slot: 'weapon',
    description: 'Reinforced work gloves lined with steel studs for devastating brawler swings.',
    effectDescription: 'Increases attack power by +16%.',
    iconName: 'HandMetal',
    milestones: [
      { level: 3, title: 'Reinforced Knuckles', description: 'Improves attack power by an additional +8% (total +24% ATK).' },
      { level: 6, title: 'Heavy Impact', description: 'Basic attacks have a 25% chance to trigger an additional kinetic impact for 50% ATK.' },
      { level: 9, title: 'Concussive Wave', description: 'Skill-enhanced basic attacks produce a small concussive shockwave (80% ATK AoE).' },
      { level: 12, title: 'Improvised Charge', description: 'Consecutive attacks build Improvised Energy (up to 4 stacks, +4% ATK each).' },
      { level: 15, title: 'Haymaker Finale', description: 'At maximum Improvised Energy, the next attack triggers a powerful improvised blast dealing 190% ATK.' },
    ],
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
    milestones: [
      { level: 3, title: 'Heavy Padding', description: 'Increases maximum health by an additional +60 (total +170 HP).' },
      { level: 6, title: 'Ballistic Plating', description: 'Taking damage grants +6% damage reduction for 4s (stacks up to 3 times).' },
      { level: 9, title: 'Deflective Layer', description: 'Armor plates absorb 50% of the next 3 hits after entering any combat room.' },
      { level: 12, title: 'Field Medic Pouches', description: 'Health orbs and healing effects provide +35% more health.' },
      { level: 15, title: 'Steelclad Brawler', description: 'Incoming melee strikes trigger concussive sparks, damaging the attacker for 40% ATK.' },
    ],
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
    milestones: [
      { level: 3, title: 'High-Explosive Shrapnel', description: 'Shrapnel burst damage increased from 65% to 90% ATK.' },
      { level: 6, title: 'Wider Blast Radius', description: 'Shrapnel burst blast radius increased by 35%.' },
      { level: 9, title: 'Concussive Shrapnel', description: 'Shrapnel explosions briefly stagger normal enemies for 0.4s.' },
      { level: 12, title: 'Ricochet Fragments', description: 'Shrapnel bursts release 2 secondary ricocheting metal fragments.' },
      { level: 15, title: 'Cluster Demolition', description: 'Skill hits have a 25% chance to drop a secondary cluster bomb dealing 140% ATK.' },
    ],
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
    milestones: [
      { level: 3, title: 'Prospector’s Eye', description: 'Increases bone shards collected by +60% and XP gain by +45%.' },
      { level: 6, title: 'Breakable Bounty', description: 'Treasure chests and jars drop 50% additional bonus shards and health orbs.' },
      { level: 9, title: 'Scrap Scavenger', description: 'Defeating enemies has a 20% chance to drop bonus boneshard orbs.' },
      { level: 12, title: 'Relic Magnet', description: 'Bosses and champions have an increased chance to drop higher quality relics.' },
      { level: 15, title: 'Fortune Sovereign', description: 'Double all boneshard and relic drops from dungeon floor completion portals.' },
    ],
    stats: {
      resourceBonusPercent: 0.4,
    },
  },
  {
    id: 'lucky_scrap_coin',
    name: 'Lucky Scrap Coin',
    collection: 'survivors_arsenal',
    slot: 'accessory',
    description: 'A polished brass coin stamped with a brawler fist that attracts valuable crypt materials.',
    effectDescription: 'Increases the chance of obtaining additional dungeon resources (+30% shards, +20% item find).',
    iconName: 'Coins',
    milestones: [
      { level: 3, title: 'Polished Fortune', description: 'Boneshard multiplier increased to +45%.' },
      { level: 6, title: 'Blacksmith Favor', description: 'Increases Blacksmith enhancement success rate by +3% flat.' },
      { level: 9, title: 'Salvage Instincts', description: 'Slaying champion enemies guarantees +20 bonus Boneshards.' },
      { level: 12, title: 'Resource Vigor', description: 'Collecting shards heals the hero for 2 HP per shard picked up.' },
      { level: 15, title: 'Master Negotiator', description: 'Grants a 12% discount on all Blacksmith enhancement costs.' },
    ],
    stats: {
      resourceBonusPercent: 0.3,
      defensePercent: 0.08,
    },
  },
  {
    id: 'improvised_power_cell',
    name: 'Improvised Power Cell',
    collection: 'survivors_arsenal',
    slot: 'core',
    description: 'A cobbled battery pulsing with volatile arc energy that discharges upon impact.',
    effectDescription: 'Basic attacks and skills have a 25% chance to trigger an additional burst of energy damage (90% ATK).',
    iconName: 'Zap',
    milestones: [
      { level: 3, title: 'Supercharged Cell', description: 'Bonus energy damage increased from 90% to 125% ATK.' },
      { level: 6, title: 'Arc Radius', description: 'Energy burst radius increased by 40% to strike surrounding enemies.' },
      { level: 9, title: 'Overcharge Pulse', description: 'Skill hits have a 35% chance to release an additional energy shockwave.' },
      { level: 12, title: 'Resonance Battery', description: 'Consecutive energy bursts increase the next burst damage by +20% (up to +60%).' },
      { level: 15, title: 'Chain Lightning Core', description: 'Maximum energy creates a chain lightning reaction zapping up to 3 nearby enemies.' },
    ],
    stats: {
      energyBurstProc: true,
    },
  },

  // ==========================================
  // F. EAGLEKIN – SKY SOVEREIGN SET (6 Pieces)
  // ==========================================
  {
    id: 'feathered_quiver',
    name: 'Feathered Quiver',
    collection: 'sky_sovereign',
    slot: 'weapon',
    description: 'Aerodynamic sky-quiver crafted from highland falcon pinions.',
    effectDescription: 'Increases projectile attack power by +22% (also empowers melee basic attacks).',
    iconName: 'Feather',
    milestones: [
      { level: 3, title: 'Falcon Fletching', description: 'Projectile attack power bonus increased to +30%.' },
      { level: 6, title: 'Gale Velocity', description: 'Projectiles travel 30% faster and have flatter trajectory.' },
      { level: 9, title: 'Sky Velocity', description: 'Firing projectiles builds Sky Velocity, granting +4% movement speed (stacks up to 20%).' },
      { level: 12, title: 'Razor Pinions', description: 'Projectiles deal +20% bonus damage to enemies above 75% HP.' },
      { level: 15, title: 'Twin Gales', description: 'Basic attacks fire an additional micro-feather projectile dealing 50% ATK.' },
    ],
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
    milestones: [
      { level: 3, title: 'Tailwind Boost', description: 'Movement speed bonus increased to +24%.' },
      { level: 6, title: 'Thermal Updraft', description: 'Updraft currents carry the hero across ground traps without taking damage.' },
      { level: 9, title: 'Wind Screen', description: 'Moving at high speed reflects 25% of incoming projectile attacks.' },
      { level: 12, title: 'Aerial Agility', description: 'Gain +15% dodge chance while sprinting or dashing.' },
      { level: 15, title: 'Sky Glide', description: 'Grants continuous hover glide, ignoring slow debuffs and movement friction.' },
    ],
    stats: {
      moveSpeedPercent: 0.18,
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
    milestones: [
      { level: 3, title: 'Pinpoint Focus', description: 'Increases projectile critical strike chance by an additional +6%.' },
      { level: 6, title: 'Hawk Vision', description: 'Improves projectile accuracy and reduces aim spread to zero.' },
      { level: 9, title: 'Pierce Critical', description: 'Critical projectiles have a 45% chance to pierce an additional enemy.' },
      { level: 12, title: 'Predatory Focus', description: 'Repeated projectile hits improve subsequent critical damage by +12% per hit.' },
      { level: 15, title: 'Seeking Pinions', description: 'Critical projectile hits release 2 seeking mini-feathers striking nearby foes.' },
    ],
    stats: {
      critChancePercent: 0.16,
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
    milestones: [
      { level: 3, title: 'Sonic Piercing', description: 'Piercing attacks retain 100% of their damage through the first target.' },
      { level: 6, title: 'Slipstream Force', description: 'Piercing strikes gain +15% damage for each enemy they pass through.' },
      { level: 9, title: 'Vortex Wake', description: 'Piercing strikes leave trailing sonic vortices dealing 40% ATK.' },
      { level: 12, title: 'Aerodynamic Refund', description: 'Piercing 3 or more enemies refunds 20% of your primary skill cooldown.' },
      { level: 15, title: 'Infinite Horizon', description: 'Projectiles pierce all enemies in their path without losing velocity.' },
    ],
    stats: {
      projectilePierceBonus: true,
    },
  },
  {
    id: 'stormfeather_charm',
    name: 'Stormfeather Charm',
    collection: 'sky_sovereign',
    slot: 'accessory',
    description: 'An enchanted feather talisman that whips up whistling wind blades on projectile impacts.',
    effectDescription: 'Projectile hits have a 30% chance to release a small wind blade (deals 65% ATK).',
    iconName: 'Wind',
    milestones: [
      { level: 3, title: 'Gale Razor', description: 'Wind blade damage increased to 85% ATK.' },
      { level: 6, title: 'Homing Whirlwind', description: 'Wind blades track toward the next nearest enemy.' },
      { level: 9, title: 'Aerial Bleed', description: 'Wind blade hits inflict a cutting bleed dealing 30% ATK over 3s.' },
      { level: 12, title: 'Tempest Acceleration', description: 'Releasing wind blades generates +1 Wind Charge for Tempest Wings.' },
      { level: 15, title: 'Cyclone Convergence', description: 'Wind blades converge into a razor-sharp cyclone vortex dealing 150% ATK.' },
    ],
    stats: {
      windBladeOnHit: true,
      atkBonusPercent: 0.12,
    },
  },
  {
    id: 'celestial_lens',
    name: 'Celestial Lens',
    collection: 'sky_sovereign',
    slot: 'core',
    description: 'A crystalline telescope lens that bends crypt horizons, granting extreme range and accuracy.',
    effectDescription: 'Increases projectile range by +35% and improves projectile accuracy.',
    iconName: 'Maximize2',
    milestones: [
      { level: 3, title: 'Extended Vista', description: 'Projectile range increased to +50%.' },
      { level: 6, title: 'True Vector', description: 'Improves projectile speed and eliminates projectile deviation.' },
      { level: 9, title: 'Celestial Tracking', description: 'Projectiles gain gentle curving guidance toward targeted enemies.' },
      { level: 12, title: 'Ballistic Momentum', description: 'Projectiles maintain full damage and trajectory through soft obstacles.' },
      { level: 15, title: 'Sniper’s Gale', description: 'Long-range projectile hits release a localized sonic wind burst (130% ATK).' },
    ],
    stats: {
      projectileRangeBonus: 0.35,
    },
  },

  // ==========================================
  // G. TIGERKIN – KING OF BEASTS SET (6 Pieces)
  // ==========================================
  {
    id: 'tiger_fang',
    name: 'Tiger Fang',
    collection: 'king_of_beasts',
    slot: 'weapon',
    description: 'A massive amber saber-fang dripping with untamed primeval fury.',
    effectDescription: 'Increases basic attack damage by +20%.',
    iconName: 'Flame',
    milestones: [
      { level: 3, title: 'Saber Strike', description: 'Basic attack damage increased by an additional +10% (total +30%).' },
      { level: 6, title: 'Feral Cadence', description: 'Consecutive basic attacks improve attack speed by +4% per hit.' },
      { level: 9, title: 'Claw Shockwave', description: 'Basic attacks have a 25% chance to release a short-range claw wave for 70% ATK.' },
      { level: 12, title: 'Apex Rend', description: 'Consecutive hits increase critical strike chance by +3% per hit (stacks up to 15%).' },
      { level: 15, title: 'Primal Cleave', description: 'At maximum Feral Energy, the next basic attack releases an additional spectral claw strike.' },
    ],
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
    milestones: [
      { level: 3, title: 'Iron Pelt', description: 'Maximum health increased by an additional +50 and defense by +4%.' },
      { level: 6, title: 'Primal Resilience', description: 'Taking damage builds Primal Resilience, granting +3% defense per stack (up to 15%).' },
      { level: 9, title: 'Beast King Roar', description: 'Dropping below 35% HP unleashes an automatic roar pushing enemies back and granting shield.' },
      { level: 12, title: 'Spiked Hide', description: 'Melee attacks received reflect 25% physical damage back to the attacker.' },
      { level: 15, title: 'Apex Unyielding', description: 'Gain immunity to execution: while above 1 HP, fatal blows leave you at 1 HP for 2s (1x/run).' },
    ],
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
    milestones: [
      { level: 3, title: 'Relentless Frenzy', description: 'Attack speed bonus increased to +8% per hit up to +35%.' },
      { level: 6, title: 'Enduring Rhythm', description: 'Consecutive hits maintain attack speed bonuses 2 seconds longer.' },
      { level: 9, title: 'Twin Paws', description: 'Rapid attacks have a 25% chance to release a secondary lightning strike.' },
      { level: 12, title: 'Feral Battery', description: 'Consecutive attacks build +1 additional stack of Feral Energy.' },
      { level: 15, title: 'Beast God Flurry', description: 'Maximum Feral Energy triggers a rapid flurry of spectral claw strikes.' },
    ],
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
    milestones: [
      { level: 3, title: 'Crushing Might', description: 'Critical strike damage increased to +60%.' },
      { level: 6, title: 'Boss Slayer', description: 'Critical hits against elites and bosses deal an additional +30% bonus damage.' },
      { level: 9, title: 'Terrifying Aura', description: 'Landing a critical strike intimidates surrounding enemies, reducing their speed by 20%.' },
      { level: 12, title: 'Apex Slayer', description: 'Defeating an enemy with a critical strike grants +25% ATK for 5 seconds.' },
      { level: 15, title: 'Cataclysmic Rend', description: 'Critical strikes unleash an explosive shockwave that staggers nearby enemies.' },
    ],
    stats: {
      critDamagePercent: 0.45,
    },
  },
  {
    id: 'striped_beast_totem',
    name: 'Striped Beast Totem',
    collection: 'king_of_beasts',
    slot: 'accessory',
    description: 'An ancient carved idol of the Tiger God radiating savage territorial dominance.',
    effectDescription: 'Increases the effectiveness of melee attacks against nearby enemies by +25%.',
    iconName: 'Flame',
    milestones: [
      { level: 3, title: 'Territorial Fury', description: 'Melee proximity damage bonus increased to +35% within 120px.' },
      { level: 6, title: 'Feral Aura', description: 'Standing near enemies builds +3% ATK per second (up to +15%).' },
      { level: 9, title: 'Cleaving Claws', description: 'Melee strikes in close range have a 30% chance to cleave all nearby enemies.' },
      { level: 12, title: 'Apex Consumption', description: 'Melee kills in close range instantly restore 6% of maximum health.' },
      { level: 15, title: 'Primeval Quake', description: 'Close-range strikes unleash primeval shockwaves in all directions dealing 130% ATK.' },
    ],
    stats: {
      meleeProximityBonus: 0.25,
      atkBonusPercent: 0.1,
    },
  },
  {
    id: 'roaring_heart',
    name: 'Roaring Heart',
    collection: 'king_of_beasts',
    slot: 'core',
    description: 'A burning ruby talisman that thumps with the thunderous heartbeat of the King of Beasts.',
    effectDescription: 'Consecutive attacks have a 25% chance to release a short-range shockwave (110% ATK).',
    iconName: 'Heart',
    milestones: [
      { level: 3, title: 'Thunderous Pulse', description: 'Shockwave damage increased to 140% ATK.' },
      { level: 6, title: 'Feral Surge', description: 'Shockwaves immediately grant +1 stack of Feral Energy.' },
      { level: 9, title: 'Cracked Earth', description: 'Shockwaves crack enemy physical resistance by 20% for 3 seconds.' },
      { level: 12, title: 'Resonant Shock', description: 'Consecutive shockwaves expand by +30% in radius and damage.' },
      { level: 15, title: 'Roaring Avatar', description: 'Shockwaves summon a roaring spectral tiger avatar dealing 200% ATK in an area.' },
    ],
    stats: {
      shockwaveOnConsecutive: true,
    },
  },
  // ==========================================
  // H. BATKIN – NOCTURNE REGALIA (6 Pieces)
  // ==========================================
  {
    id: 'staff_first_echo',
    name: 'Staff of the First Echo',
    collection: 'nocturne_regalia',
    slot: 'weapon',
    description: 'An ancient resonant staff containing a crystal that amplifies sound vibrations.',
    effectDescription: 'Increases basic attack damage (+22%). Basic attacks have a 35% chance to release a small secondary sonic projectile.',
    iconName: 'Sparkles',
    milestones: [
      { level: 3, title: 'Far-Reaching Echo', description: 'Sonic projectiles travel farther (+30% range).' },
      { level: 6, title: 'Harmonic Force', description: 'Secondary projectiles become stronger (+40% projectile damage).' },
      { level: 9, title: 'Oscillation Piercing', description: 'Sonic projectiles may pierce additional enemies (+1 pierce).' },
      { level: 12, title: 'Echo Reservoir', description: 'Consecutive hits build Echo Energy (up to 4 stacks).' },
      { level: 15, title: 'Resonance Nova', description: 'At maximum Echo Energy, the next basic attack releases a large piercing sonic wave.' },
    ],
    stats: {
      basicAttackDamagePercent: 0.22,
      secondarySonicChance: 0.35,
      atkBonusPercent: 0.12,
    },
  },
  {
    id: 'mantle_silent_wings',
    name: 'Mantle of Silent Wings',
    collection: 'nocturne_regalia',
    slot: 'armor',
    description: 'A spectral velvet mantle woven from the wings of quiet night predators.',
    effectDescription: 'Grants +16% movement speed. While moving, periodically releases a quiet sound pulse that slightly damages nearby enemies (55% ATK).',
    iconName: 'Shield',
    milestones: [
      { level: 3, title: 'Rhythmic Cadence', description: 'Sound pulses occur more frequently while moving (+30% frequency).' },
      { level: 6, title: 'Vibrational Amplitude', description: 'Increases pulse damage to 85% ATK.' },
      { level: 9, title: 'Acoustic Snare', description: 'Enemies hit by pulses have their movement speed reduced by 30% for 2 seconds.' },
      { level: 12, title: 'Damping Field', description: 'Pulses reduce incoming ranged projectile damage by 25%.' },
      { level: 15, title: 'Sonic Aegis', description: 'Moving for 3 seconds without stopping generates a temporary sonic shield (120 HP).' },
    ],
    stats: {
      moveSpeedPercent: 0.16,
      defensePercent: 0.10,
      movementPulseOnMove: true,
    },
  },
  {
    id: 'resonance_crystal',
    name: 'Resonance Crystal',
    collection: 'nocturne_regalia',
    slot: 'spirit',
    description: 'A floating acoustic prism humming with high-frequency cosmic vibrations.',
    effectDescription: 'Increases skill damage (+24%). Casting a skill releases a secondary vibration that hits nearby enemies (75% ATK).',
    iconName: 'Sparkles',
    milestones: [
      { level: 3, title: 'Expanding Wavefront', description: 'Vibrations affect a wider area (+35% radius).' },
      { level: 6, title: 'Sonic Disruption', description: 'Increases vibration damage to 110% ATK.' },
      { level: 9, title: 'Frequency Fracture', description: 'Vibrations reduce enemy defense temporarily by 20% for 3 seconds.' },
      { level: 12, title: 'Harmonic Stun', description: 'Vibrations have a 30% chance to briefly disrupt enemy attacks.' },
      { level: 15, title: 'Symphonic Climax', description: 'Casting an ultimate triggers multiple resonant vibrations simultaneously.' },
    ],
    stats: {
      projectileAtkBonusPercent: 0.24,
      secondaryVibrationOnSkill: true,
    },
  },
  {
    id: 'mask_night_listener',
    name: 'Mask of the Night Listener',
    collection: 'nocturne_regalia',
    slot: 'ancient',
    description: 'An ornate echolocation cowl carved from obsidian soundstone.',
    effectDescription: 'Increases critical strike chance (+16%) and critical strike damage (+35%). Critical hits have a 35% chance to release a piercing sound wave.',
    iconName: 'Eye',
    milestones: [
      { level: 3, title: 'Acuteness', description: 'Higher critical strike chance (+6% bonus crit chance).' },
      { level: 6, title: 'Sonic Penetration', description: 'Sound waves travel through more enemies (pierces up to 3 foes).' },
      { level: 9, title: 'Focused Frequency', description: 'Sound waves deal +30% increased damage to isolated targets.' },
      { level: 12, title: 'Auditory Reflex', description: 'Critical hits slightly reduce skill cooldowns (-0.4s).' },
      { level: 15, title: 'Autonomous Echo', description: 'Landing 4 critical hits triggers an automatic resonant echo dealing 180% ATK.' },
    ],
    stats: {
      critChancePercent: 0.16,
      critDamagePercent: 0.35,
      criticalSoundWaveChance: 0.35,
    },
  },
  {
    id: 'ring_endless_frequencies',
    name: 'Ring of Endless Frequencies',
    collection: 'nocturne_regalia',
    slot: 'accessory',
    description: 'A spiraling platinum band pulsating with infinite harmonic oscillations.',
    effectDescription: 'Increases cooldown reduction (+18%). Hitting enemies with skills builds Frequency stacks (up to 5).',
    iconName: 'Zap',
    milestones: [
      { level: 3, title: 'Harmonic Drift', description: 'Higher cooldown reduction (+5% bonus CDR).' },
      { level: 6, title: 'Rapid Modulation', description: 'Frequency stacks build faster (grants 2 stacks per skill hit).' },
      { level: 9, title: 'Acoustic Tempo', description: 'Frequency stacks increase attack speed (+4% ASPD per stack).' },
      { level: 12, title: 'Frequency Surge', description: 'At maximum Frequency stacks, next skill damage is amplified by +50%.' },
      { level: 15, title: 'Periodic Resonance', description: 'Frequency stacks occasionally trigger an automatic sonic burst (140% ATK).' },
    ],
    stats: {
      cooldownReductionPercent: 0.18,
      frequencyStackProc: true,
    },
  },
  {
    id: 'heart_of_nocturne',
    name: 'Heart of Nocturne',
    collection: 'nocturne_regalia',
    slot: 'core',
    description: 'An impenetrable harmonic core humming with protective acoustic damping fields.',
    effectDescription: 'Increases maximum health (+95 HP) and damage reduction (+14%). Taking damage releases a defensive sound burst that knocks enemies back.',
    iconName: 'Heart',
    milestones: [
      { level: 3, title: 'Dilation Pulse', description: 'Defensive burst affects a larger radius (+35% radius).' },
      { level: 6, title: 'Resonant Cushion', description: 'Grants a temporary shield (90 HP) after the defensive burst.' },
      { level: 9, title: 'Sound Dampening', description: 'Increases damage reduction by +10% while shield is active.' },
      { level: 12, title: 'Quick Reset', description: 'Reduces cooldown of defensive sound burst from 8s to 5s.' },
      { level: 15, title: 'Emergency Barrier', description: 'Low health (<35% HP) triggers an emergency resonance barrier blocking several attacks.' },
    ],
    stats: {
      maxHpBonus: 95,
      defensePercent: 0.14,
      resonanceBarrierOnDamage: true,
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
  batkin: 'nocturne_regalia',
};

export const COLLECTION_TO_HERO: Record<EquipmentCollectionId, HeroId> = {
  eternal_bone: 'skeleton',
  phantom_regalia: 'ghost',
  plaguebound: 'zombie',
  feral_hunter: 'ghoul',
  survivors_arsenal: 'human',
  sky_sovereign: 'eaglekin',
  king_of_beasts: 'tigerkin',
  nocturne_regalia: 'batkin',
};

/**
 * Gets the 6 equipment pieces that belong to a specific collection or hero
 */
export function getEquipmentForCollection(collectionId: EquipmentCollectionId): EquipmentItemDef[] {
  return ALL_EQUIPMENT_ITEMS.filter((item) => item.collection === collectionId);
}

export function getEquipmentForHero(heroId: HeroId): EquipmentItemDef[] {
  const colId = HERO_TO_COLLECTION[heroId];
  return getEquipmentForCollection(colId);
}

// =========================================================================
// ENHANCEMENT COST AND SUCCESS PROBABILITY PROGRESSIONS
// =========================================================================

const BASE_ENHANCEMENT_COSTS: Record<number, number> = {
  0: 20,   // +0 to +1
  1: 35,   // +1 to +2
  2: 55,   // +2 to +3
  3: 80,   // +3 to +4
  4: 110,  // +4 to +5
  5: 150,  // +5 to +6
  6: 200,  // +6 to +7
  7: 260,  // +7 to +8
  8: 330,  // +8 to +9
  9: 420,  // +9 to +10
  10: 520, // +10 to +11
  11: 640, // +11 to +12
  12: 780, // +12 to +13
  13: 940, // +13 to +14
  14: 1120,// +14 to +15
};

const BASE_SUCCESS_PROBABILITIES: Record<number, number> = {
  0: 0.85,  // +0 to +1: 85%
  1: 0.75,  // +1 to +2: 75%
  2: 0.65,  // +2 to +3: 65%
  3: 0.55,  // +3 to +4: 55%
  4: 0.45,  // +4 to +5: 45%
  5: 0.35,  // +5 to +6: 35%
  6: 0.28,  // +6 to +7: 28%
  7: 0.22,  // +7 to +8: 22%
  8: 0.17,  // +8 to +9: 17%
  9: 0.12,  // +9 to +10: 12%
  10: 0.10, // +10 to +11: 10%
  11: 0.08, // +11 to +12: 8%
  12: 0.06, // +12 to +13: 6%
  13: 0.05, // +13 to +14: 5%
  14: 0.04, // +14 to +15: 4%
};

export function getEnhancementCost(currentLevel: number): number {
  if (currentLevel in BASE_ENHANCEMENT_COSTS) {
    return BASE_ENHANCEMENT_COSTS[currentLevel];
  }
  // Continues scaling smoothly beyond +15
  return 1120 + (currentLevel - 14) * 200;
}

export function getEnhancementSuccessRate(currentLevel: number): number {
  if (currentLevel in BASE_SUCCESS_PROBABILITIES) {
    return BASE_SUCCESS_PROBABILITIES[currentLevel];
  }
  // Minimum configurable rate is 3%
  return Math.max(0.03, 0.04 - (currentLevel - 14) * 0.005);
}

export function getUnlockedMilestones(item: EquipmentItemDef, currentLevel: number): EnhancementMilestoneDef[] {
  return item.milestones.filter((m) => m.level <= currentLevel);
}

export function getNextMilestone(item: EquipmentItemDef, currentLevel: number): EnhancementMilestoneDef | null {
  const future = item.milestones.filter((m) => m.level > currentLevel).sort((a, b) => a.level - b.level);
  return future.length > 0 ? future[0] : null;
}

export interface UpgradedStatTag {
  label: string;
  value: string;
  color: string;
  isBoosted?: boolean;
}

export interface UpgradedItemInfo {
  level: number;
  dynamicDescription: string;
  dynamicEffectDescription: string;
  primaryEffectSummary: string;
  statTags: UpgradedStatTag[];
  unlockedMilestones: EnhancementMilestoneDef[];
  nextMilestone: EnhancementMilestoneDef | null;
  bonusSummary: string;
}

export function getUpgradedItemInfo(item: EquipmentItemDef, currentLevel: number): UpgradedItemInfo {
  const level = Math.max(0, currentLevel);
  const scale = 1 + level * 0.08;
  const s = item.stats;
  const statTags: UpgradedStatTag[] = [];
  const effectParts: string[] = [];
  const forgeGainParts: string[] = [];

  const unlockedMilestones = getUnlockedMilestones(item, level);
  const nextMilestone = getNextMilestone(item, level);

  const fmtPct = (val: number) => {
    const p = Math.round(val * 1000) / 10;
    return p % 1 === 0 ? p.toFixed(0) : p.toFixed(1);
  };

  // 1. Move Speed
  if (s.moveSpeedPercent !== undefined) {
    const baseVal = s.moveSpeedPercent;
    let milestoneBonus = 0;
    if (level >= 3 && (item.id === 'phantom_veil' || item.id === 'sky_feather')) milestoneBonus += 0.06;
    if (level >= 3 && (item.id === 'ghoul_claws' || item.id === 'feral_pelt')) milestoneBonus += 0.05;
    const totalVal = baseVal * scale + milestoneBonus;
    const gainVal = totalVal - baseVal;

    statTags.push({
      label: 'Speed',
      value: `+${fmtPct(totalVal)}%`,
      color: '#38bdf8',
      isBoosted: level > 0,
    });
    effectParts.push(`+${fmtPct(totalVal)}% Movement Speed`);
    if (level > 0) {
      forgeGainParts.push(`+${fmtPct(gainVal)}% Speed`);
    }
  }

  // 2. Attack Power
  if (s.atkBonusPercent !== undefined) {
    const baseVal = s.atkBonusPercent;
    let milestoneBonus = 0;
    if (level >= 3 && item.id === 'bonebreaker_emblem') milestoneBonus += 0.06;
    if (level >= 3 && item.id === 'feral_fang') milestoneBonus += 0.05;
    const totalVal = baseVal * scale + milestoneBonus;
    const gainVal = totalVal - baseVal;

    statTags.push({
      label: 'Attack',
      value: `+${fmtPct(totalVal)}%`,
      color: '#f87171',
      isBoosted: level > 0,
    });
    effectParts.push(`+${fmtPct(totalVal)}% Attack Power`);
    if (level > 0) {
      forgeGainParts.push(`+${fmtPct(gainVal)}% ATK`);
    }
  }

  // 3. Max HP
  if (s.maxHpBonus !== undefined) {
    const baseVal = s.maxHpBonus;
    let milestoneBonus = 0;
    if (level >= 3 && item.id === 'ribcage_aegis') milestoneBonus += 40;
    if (level >= 3 && item.id === 'iron_pelt') milestoneBonus += 50;
    const totalVal = Math.round(baseVal * scale) + milestoneBonus;
    const gainVal = totalVal - baseVal;

    statTags.push({
      label: 'Max HP',
      value: `+${totalVal}`,
      color: '#4ade80',
      isBoosted: level > 0,
    });
    effectParts.push(`+${totalVal} Max HP`);
    if (level > 0) {
      forgeGainParts.push(`+${gainVal} HP`);
    }
  }

  // 4. Defense Reduction
  if (s.defensePercent !== undefined) {
    const baseVal = s.defensePercent;
    let milestoneBonus = 0;
    if (level >= 3 && (item.id === 'ribcage_aegis' || item.id === 'iron_pelt')) milestoneBonus += 0.04;
    const totalVal = baseVal * scale + milestoneBonus;
    const gainVal = totalVal - baseVal;

    statTags.push({
      label: 'Defense',
      value: `+${fmtPct(totalVal)}%`,
      color: '#60a5fa',
      isBoosted: level > 0,
    });
    effectParts.push(`+${fmtPct(totalVal)}% Damage Reduction`);
    if (level > 0) {
      forgeGainParts.push(`+${fmtPct(gainVal)}% DEF`);
    }
  }

  // 5. Crit Chance
  if (s.critChancePercent !== undefined) {
    const baseVal = s.critChancePercent;
    let milestoneBonus = 0;
    if (level >= 3 && item.id === 'eagles_eye') milestoneBonus += 0.06;
    const totalVal = baseVal * scale + milestoneBonus;
    const gainVal = totalVal - baseVal;

    statTags.push({
      label: 'Crit %',
      value: `+${fmtPct(totalVal)}%`,
      color: '#facc15',
      isBoosted: level > 0,
    });
    effectParts.push(`+${fmtPct(totalVal)}% Crit Chance`);
    if (level > 0) {
      forgeGainParts.push(`+${fmtPct(gainVal)}% Crit`);
    }
  }

  // 6. Crit Damage
  if (s.critDamagePercent !== undefined) {
    const baseVal = s.critDamagePercent;
    let milestoneBonus = 0;
    if (level >= 6 && (item.id === 'ancient_marrow_ring' || item.id === 'skull_of_precision')) milestoneBonus += 0.25;
    if (level >= 3 && item.id === 'apex_crown') milestoneBonus += 0.15;
    const totalVal = baseVal * scale + milestoneBonus;
    const gainVal = totalVal - baseVal;

    statTags.push({
      label: 'Crit DMG',
      value: `+${fmtPct(totalVal)}%`,
      color: '#fb923c',
      isBoosted: level > 0,
    });
    effectParts.push(`+${fmtPct(totalVal)}% Crit Damage`);
    if (level > 0) {
      forgeGainParts.push(`+${fmtPct(gainVal)}% Crit DMG`);
    }
  }

  // 7. Cooldown Reduction
  if (s.cooldownReductionPercent !== undefined) {
    const baseVal = s.cooldownReductionPercent;
    let milestoneBonus = 0;
    if (level >= 3 && item.id === 'wraith_pendant') milestoneBonus += 0.05;
    const totalVal = baseVal * scale + milestoneBonus;
    const gainVal = totalVal - baseVal;

    statTags.push({
      label: 'CDR',
      value: `${fmtPct(totalVal)}%`,
      color: '#a78bfa',
      isBoosted: level > 0,
    });
    effectParts.push(`${fmtPct(totalVal)}% Cooldown Reduction`);
    if (level > 0) {
      forgeGainParts.push(`+${fmtPct(gainVal)}% CDR`);
    }
  }

  // 8. Basic Attack Damage
  if (s.basicAttackDamagePercent !== undefined) {
    const baseVal = s.basicAttackDamagePercent;
    let milestoneBonus = 0;
    if (level >= 3 && item.id === 'saber_strike') milestoneBonus += 0.10;
    const totalVal = baseVal * scale + milestoneBonus;
    const gainVal = totalVal - baseVal;

    statTags.push({
      label: 'Basic ATK',
      value: `+${fmtPct(totalVal)}%`,
      color: '#fb923c',
      isBoosted: level > 0,
    });
    effectParts.push(`+${fmtPct(totalVal)}% Basic ATK Damage`);
    if (level > 0) {
      forgeGainParts.push(`+${fmtPct(gainVal)}% Basic ATK`);
    }
  }

  // 9. Projectile ATK
  if (s.projectileAtkBonusPercent !== undefined) {
    const baseVal = s.projectileAtkBonusPercent;
    const totalVal = baseVal * scale;
    const gainVal = totalVal - baseVal;

    statTags.push({
      label: 'Proj ATK',
      value: `+${fmtPct(totalVal)}%`,
      color: '#38bdf8',
      isBoosted: level > 0,
    });
    effectParts.push(`+${fmtPct(totalVal)}% Projectile ATK`);
    if (level > 0) {
      forgeGainParts.push(`+${fmtPct(gainVal)}% Proj ATK`);
    }
  }

  // 10. Consecutive ASPD
  if (s.consecutiveAttackSpeed !== undefined) {
    const baseVal = s.consecutiveAttackSpeed;
    const totalVal = baseVal * scale;
    const gainVal = totalVal - baseVal;

    statTags.push({
      label: 'ASPD',
      value: `+${fmtPct(totalVal)}%/hit`,
      color: '#f472b6',
      isBoosted: level > 0,
    });
    effectParts.push(`+${fmtPct(totalVal)}% ASPD per hit (up to +${Math.round(totalVal * 500)}%)`);
    if (level > 0) {
      forgeGainParts.push(`+${fmtPct(gainVal)}% ASPD`);
    }
  }

  // 11. Range Bonus
  if (s.projectileRangeBonus !== undefined) {
    const baseVal = s.projectileRangeBonus;
    let milestoneBonus = 0;
    if (level >= 3 && item.id === 'celestial_lens') milestoneBonus += 0.15;
    const totalVal = baseVal * scale + milestoneBonus;
    const gainVal = totalVal - baseVal;

    statTags.push({
      label: 'Range',
      value: `+${fmtPct(totalVal)}%`,
      color: '#67e8f9',
      isBoosted: level > 0,
    });
    effectParts.push(`+${fmtPct(totalVal)}% Projectile Range`);
    if (level > 0) {
      forgeGainParts.push(`+${fmtPct(gainVal)}% Range`);
    }
  }

  // 12. Melee Proximity
  if (s.meleeProximityBonus !== undefined) {
    const baseVal = s.meleeProximityBonus;
    let milestoneBonus = 0;
    if (level >= 3 && item.id === 'striped_totem') milestoneBonus += 0.10;
    const totalVal = baseVal * scale + milestoneBonus;
    const gainVal = totalVal - baseVal;

    statTags.push({
      label: 'Close Melee',
      value: `+${fmtPct(totalVal)}%`,
      color: '#f59e0b',
      isBoosted: level > 0,
    });
    effectParts.push(`+${fmtPct(totalVal)}% Close Melee DMG`);
    if (level > 0) {
      forgeGainParts.push(`+${fmtPct(gainVal)}% Melee`);
    }
  }

  // 13. Resource Bonus
  if (s.resourceBonusPercent !== undefined) {
    const totalVal = s.resourceBonusPercent * scale;
    statTags.push({
      label: 'Yield',
      value: `+${fmtPct(totalVal)}%`,
      color: '#fbbf24',
      isBoosted: level > 0,
    });
    effectParts.push(`+${fmtPct(totalVal)}% Shard & XP Gain`);
    if (level > 0) {
      forgeGainParts.push(`+${fmtPct(totalVal - s.resourceBonusPercent)}% Yield`);
    }
  }

  // 14. On Kill Heal
  if (s.onKillHealPercent !== undefined) {
    let milestoneBonus = 0;
    if (level >= 3 && item.id === 'crown_of_the_undying') milestoneBonus += 0.02;
    const totalVal = s.onKillHealPercent * scale + milestoneBonus;
    statTags.push({
      label: 'Kill Heal',
      value: `${fmtPct(totalVal)}% HP`,
      color: '#34d399',
      isBoosted: level > 0,
    });
    effectParts.push(`Restore ${fmtPct(totalVal)}% Max HP on kill`);
    if (level > 0) {
      forgeGainParts.push(`+${fmtPct(totalVal - s.onKillHealPercent)}% Leech`);
    }
  }

  // 15. Poison Chance
  if (s.poisonChancePercent !== undefined) {
    const totalVal = s.poisonChancePercent * scale;
    statTags.push({
      label: 'Poison',
      value: `${fmtPct(totalVal)}%`,
      color: '#a3e635',
      isBoosted: level > 0,
    });
    effectParts.push(`${fmtPct(totalVal)}% Chance to Poison (35% ATK/s)`);
    if (level > 0) {
      forgeGainParts.push(`+${fmtPct(totalVal - s.poisonChancePercent)}% Poison`);
    }
  }

  // 16. On Kill ATK Boost
  if (s.onKillAtkBoostPercent !== undefined) {
    const totalVal = s.onKillAtkBoostPercent * scale;
    statTags.push({
      label: 'Kill ATK',
      value: `+${fmtPct(totalVal)}%`,
      color: '#f87171',
      isBoosted: level > 0,
    });
    effectParts.push(`+${fmtPct(totalVal)}% ATK for 4s on kill`);
  }

  // 17. Specialized Proc Tags
  if (s.spectralBarrierOnHit) {
    const barrierHp = Math.round(65 * scale);
    statTags.push({
      label: 'Barrier',
      value: `${barrierHp} HP`,
      color: '#818cf8',
      isBoosted: level > 0,
    });
    effectParts.push(`Spectral Barrier (${barrierHp} HP, 8s cd)`);
    if (level > 0) forgeGainParts.push(`+${barrierHp - 65} Barrier`);
  }

  if (s.seekingSpiritOnSkill) {
    const spiritDmg = Math.round(85 * scale);
    statTags.push({
      label: 'Spirit',
      value: `${spiritDmg}% ATK`,
      color: '#c084fc',
      isBoosted: level > 0,
    });
    effectParts.push(`Seeking Spirit (${spiritDmg}% ATK on skill hit)`);
    if (level > 0) forgeGainParts.push(`+${spiritDmg - 85}% Spirit`);
  }

  if (s.windBladeOnHit) {
    const bladeDmg = Math.round((level >= 3 ? 85 : 65) * scale);
    statTags.push({
      label: 'Wind Blade',
      value: `${bladeDmg}% ATK`,
      color: '#38bdf8',
      isBoosted: level > 0,
    });
    effectParts.push(`Wind Blade (${bladeDmg}% ATK on hit)`);
    if (level > 0) forgeGainParts.push(`+${bladeDmg - 65}% Blade`);
  }

  if (s.shockwaveOnConsecutive) {
    const shockDmg = Math.round((level >= 3 ? 140 : 110) * scale);
    statTags.push({
      label: 'Shockwave',
      value: `${shockDmg}% ATK`,
      color: '#f59e0b',
      isBoosted: level > 0,
    });
    effectParts.push(`Shockwave (${shockDmg}% ATK on consecutive hit)`);
    if (level > 0) forgeGainParts.push(`+${shockDmg - 110}% Shockwave`);
  }

  if (s.critBoneFragmentChance !== undefined) {
    const boneChance = Math.min(0.8, (0.30 + (level >= 3 && item.id === 'skull_of_precision' ? 0.20 : 0)) * (1 + level * 0.04));
    statTags.push({
      label: 'Bone Frag',
      value: `${Math.round(boneChance * 100)}%`,
      color: '#c084fc',
      isBoosted: level > 0,
    });
    effectParts.push(`Bone Fragments (${Math.round(boneChance * 100)}% chance)`);
  }

  if (s.projectilePierceBonus) {
    statTags.push({
      label: 'Pierce',
      value: '+1 Foe',
      color: '#38bdf8',
      isBoosted: level > 0,
    });
    effectParts.push('Projectile Pierce (+1 enemy)');
  }

  if (s.explosiveSkillProc) {
    const shrapnelDmg = Math.round(65 * scale);
    statTags.push({
      label: 'Shrapnel',
      value: `${shrapnelDmg}% ATK`,
      color: '#f97316',
      isBoosted: level > 0,
    });
    effectParts.push(`Shrapnel Burst (${shrapnelDmg}% ATK)`);
  }

  if (s.explosiveOnPoisonDefeat) {
    const toxicDmg = Math.round(70 * scale);
    statTags.push({
      label: 'Toxic Burst',
      value: `${toxicDmg}% ATK`,
      color: '#84cc16',
      isBoosted: level > 0,
    });
    effectParts.push(`Toxic Burst (${toxicDmg}% ATK AoE on poisoned kill)`);
  }

  if (s.energyBurstProc) {
    const burstDmg = Math.round(90 * scale);
    statTags.push({
      label: 'Burst',
      value: `${burstDmg}% ATK`,
      color: '#eab308',
      isBoosted: level > 0,
    });
    effectParts.push(`Energy Burst (${burstDmg}% ATK)`);
  }

  if (s.consecutiveHealChance !== undefined) {
    const healChance = Math.min(0.6, 0.25 * (1 + level * 0.04));
    statTags.push({
      label: 'Heal Proc',
      value: `${Math.round(healChance * 100)}%`,
      color: '#10b981',
      isBoosted: level > 0,
    });
    effectParts.push(`Consecutive Heal (${Math.round(healChance * 100)}% chance)`);
  }

  // Batkin Nocturne Regalia Procs
  if (s.secondarySonicChance !== undefined) {
    const sonicChance = Math.min(0.7, s.secondarySonicChance * (1 + level * 0.04));
    statTags.push({
      label: 'Echo Bolt',
      value: `${Math.round(sonicChance * 100)}%`,
      color: '#c084fc',
      isBoosted: level > 0,
    });
    effectParts.push(`Secondary Sonic Projectile (${Math.round(sonicChance * 100)}% chance)`);
  }

  if (s.movementPulseOnMove) {
    const pulseDmg = Math.round((level >= 6 ? 85 : 55) * scale);
    statTags.push({
      label: 'Wing Pulse',
      value: `${pulseDmg}% ATK`,
      color: '#a855f7',
      isBoosted: level > 0,
    });
    effectParts.push(`Silent Wing Sound Pulse (${pulseDmg}% ATK AoE)`);
    if (level > 0) forgeGainParts.push(`+${pulseDmg - 55}% Pulse`);
  }

  if (s.secondaryVibrationOnSkill) {
    const vibDmg = Math.round((level >= 6 ? 110 : 75) * scale);
    statTags.push({
      label: 'Vibration',
      value: `${vibDmg}% ATK`,
      color: '#d8b4fe',
      isBoosted: level > 0,
    });
    effectParts.push(`Harmonic Vibration (${vibDmg}% ATK on skill cast)`);
    if (level > 0) forgeGainParts.push(`+${vibDmg - 75}% Vibration`);
  }

  if (s.criticalSoundWaveChance !== undefined) {
    const waveChance = Math.min(0.75, (0.35 + (level >= 3 ? 0.06 : 0)) * (1 + level * 0.03));
    statTags.push({
      label: 'Wave Proc',
      value: `${Math.round(waveChance * 100)}%`,
      color: '#c084fc',
      isBoosted: level > 0,
    });
    effectParts.push(`Piercing Sound Wave (${Math.round(waveChance * 100)}% chance on crit)`);
  }

  if (s.frequencyStackProc) {
    const ampVal = level >= 12 ? 50 : 30;
    statTags.push({
      label: 'Frequency',
      value: `+${ampVal}% Burst`,
      color: '#e879f9',
      isBoosted: level > 0,
    });
    effectParts.push(`Frequency Stacks (+${ampVal}% next skill damage at 5 stacks)`);
  }

  if (s.resonanceBarrierOnDamage) {
    const barrierHp = Math.round((level >= 6 ? 90 : 60) * scale);
    statTags.push({
      label: 'Acoustic Aegis',
      value: `${barrierHp} HP`,
      color: '#c084fc',
      isBoosted: level > 0,
    });
    effectParts.push(`Defensive Sound Burst & Barrier (${barrierHp} HP)`);
    if (level > 0) forgeGainParts.push(`+${barrierHp - 60} Barrier`);
  }

  // Primary effect summary
  const primaryEffectSummary = effectParts.length > 0 ? effectParts.join(' · ') : item.effectDescription;
  const bonusSummary = forgeGainParts.length > 0 ? forgeGainParts.join(', ') : '+0%';

  // Dynamic Effect Description (updates each upgrade!)
  let dynamicEffectDescription = primaryEffectSummary;
  if (level > 0) {
    const milestoneNames = unlockedMilestones.map((m) => m.title).join(', ');
    const milestoneNote = milestoneNames ? ` · Perks: ${milestoneNames}` : '';
    dynamicEffectDescription = `${primaryEffectSummary} (+${bonusSummary} upgrade power${milestoneNote}).`;
  }

  // Dynamic Base Description (updates each upgrade!)
  let dynamicDescription = item.description;
  if (level > 0) {
    const milestoneNames = unlockedMilestones.map((m) => m.title).join(', ');
    const milestoneText = milestoneNames ? ` · Unlocked: ${milestoneNames}` : '';
    dynamicDescription = `${item.description} [Reforged +${level}]: ${primaryEffectSummary} (+${bonusSummary} Forge bonus${milestoneText}).`;
  }

  return {
    level,
    dynamicDescription,
    dynamicEffectDescription,
    primaryEffectSummary,
    statTags,
    unlockedMilestones,
    nextMilestone,
    bonusSummary,
  };
}
