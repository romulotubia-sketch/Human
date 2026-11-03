import { ActiveSkillId, HeroId } from './game';

export type BlessingType = 'enhancement' | 'new_effect';

export interface BlessingModifier {
  damageMultBonus?: number;       // e.g. +0.35 (+35% damage)
  cooldownReduction?: number;     // e.g. 0.25 (25% cooldown reduction)
  radiusMultBonus?: number;       // e.g. 0.40 (+40% radius / AoE width)
  durationBonus?: number;         // e.g. 1.5s additional buff/zone duration
  extraProjectiles?: number;      // e.g. +1 or +2 extra bolts/wisps
  lifestealPct?: number;          // e.g. 0.12 (12% damage converted to HP)
  burnDpsPct?: number;            // e.g. 0.35 (burn damage per second)
  slowPct?: number;               // e.g. 0.45 (slow enemy move speed)
  chainHits?: boolean;            // fork or chain into nearby enemies
  knockbackMultBonus?: number;    // e.g. +0.60
  critChanceBonus?: number;       // e.g. +0.20
  shieldBonus?: number;           // e.g. +50 bonus shield
  staggerBonus?: number;          // stun/stagger foes
  rangeBonus?: number;            // bonus projectile / attack range
}

export interface Blessing {
  id: string;
  heroId: HeroId;
  skillId: ActiveSkillId | 'all_skills' | 'basic_attack';
  skillName: string;
  name: string;
  title: string;
  description: string;
  type: BlessingType;
  typeLabel: string; // 'Skill Enhancement' | 'New Effect'
  iconName: string;
  glowColor: string;
  secondaryColor: string;
  modifiers: BlessingModifier;
}
