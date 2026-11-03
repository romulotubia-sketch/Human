import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { HERO_PROFILES, HERO_SKILLS } from '../data/heroSkills';
import {
  HeroId,
  NormalSkillId,
  SkillCategory,
  SkillId,
  SkillLoadout,
  UltimateSkillId,
} from '../types/game';
import { SkillIcon } from './SkillIcon';

interface SkillTreeModalProps {
  heroId: HeroId;
  skillRanks: Record<SkillId, number>;
  skillPoints: number;
  loadout: SkillLoadout;
  isDungeon?: boolean;
  onUpgradeSkill: (skillId: SkillId) => void;
  onSetNormalSlot: (slotIndex: 0 | 1, skillId: NormalSkillId) => void;
  onSetUltimateSlot: (skillId: UltimateSkillId) => void;
  onClose: () => void;
}

export function SkillTreeModal({
  heroId,
  skillRanks,
  skillPoints,
  loadout,
  isDungeon = false,
  onUpgradeSkill,
  onSetNormalSlot,
  onSetUltimateSlot,
  onClose,
}: SkillTreeModalProps) {
  const profile = HERO_PROFILES[heroId];
  const isHuman = heroId === 'human';
  const isZombie = heroId === 'zombie';
  const isGhoul = heroId === 'ghoul';
  const isGhost = heroId === 'ghost';

  const [activeTab, setActiveTab] = useState<'loadout' | 'upgrades'>('loadout');
  const [selectedId, setSelectedId] = useState<SkillId>(loadout[0]);
  const [slotChoiceSkillId, setSlotChoiceSkillId] = useState<NormalSkillId | null>(null);

  useEffect(() => {
    setSelectedId(loadout[0]);
  }, [heroId, loadout]);

  const selectedDef = HERO_SKILLS[selectedId] || HERO_SKILLS[loadout[0]];
  const selectedRank = skillRanks[selectedDef.id] || 1;
  const canUpgrade = isDungeon && skillPoints > 0 && selectedRank < selectedDef.maxRank;

  const isSelectedNormal = selectedDef.category === SkillCategory.NORMAL;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 p-2 backdrop-blur-sm sm:p-3">
      <div className="relative flex h-full max-h-[410px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-stone-700/80 bg-[#181310] text-stone-100 shadow-2xl">
        {/* Compact Top Bar */}
        <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-stone-800 px-3 sm:px-4">
          <div className="flex items-center gap-2.5">
            <h2 className="font-display whitespace-nowrap text-sm font-semibold text-amber-100 sm:text-base">
              {profile.name} Skills
            </h2>
            <div className="flex items-center gap-1 rounded-lg bg-stone-900 p-0.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiTap();
                  setActiveTab('loadout');
                }}
                className={`h-7 whitespace-nowrap rounded-md px-2.5 text-xs font-semibold transition-colors ${
                  activeTab === 'loadout'
                    ? 'bg-stone-700 text-white'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Choose Skills (2 + 1)
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiTap();
                  setActiveTab('upgrades');
                }}
                className={`h-7 whitespace-nowrap rounded-md px-2.5 text-xs font-semibold transition-colors ${
                  activeTab === 'upgrades'
                    ? 'bg-stone-700 text-white'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Skill Tree ({skillPoints} SP)
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiTap();
              onClose();
            }}
            aria-label="Close Skills"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-300 transition-colors hover:bg-stone-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* TAB 1: COMPACT SINGLE-SCREEN SKILL SELECTION (2 of 5 Normal + 1 of 3 Ultimate) */}
        {activeTab === 'loadout' ? (
          <div className="flex min-h-0 flex-1 flex-col justify-between gap-2 overflow-hidden p-2.5 sm:p-3.5">
            {/* 5 Normal Skills */}
            <div className="rounded-xl border border-stone-800 bg-stone-900/50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs font-semibold ${
                    isHuman
                      ? 'text-orange-200'
                      : isGhost
                        ? 'text-indigo-200'
                        : isGhoul
                          ? 'text-rose-200'
                          : isZombie
                            ? 'text-lime-200'
                            : 'text-cyan-200'
                  }`}
                >
                  Normal Skills — Tap to Equip in Slot 1 or 2
                </span>
                <span className="font-mono-num text-[11px] text-stone-400">
                  Slot 1: {HERO_SKILLS[loadout[0]].name} · Slot 2: {HERO_SKILLS[loadout[1]].name}
                </span>
              </div>

              <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {profile.normalSkills.map((id) => {
                  const def = HERO_SKILLS[id];
                  const inSlot1 = loadout[0] === id;
                  const inSlot2 = loadout[1] === id;
                  const equipped = inSlot1 || inSlot2;

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        soundEngine.playUiTap();
                        setSelectedId(id);
                        setSlotChoiceSkillId(id);
                      }}
                      className={`flex h-10 items-center justify-between gap-1.5 rounded-lg border px-2 text-left transition-colors ${
                        equipped
                          ? isHuman
                            ? 'border-orange-400 bg-orange-950/35 text-white'
                            : isGhost
                              ? 'border-indigo-400 bg-indigo-950/40 text-white'
                              : isGhoul
                                ? 'border-rose-400 bg-rose-950/35 text-white'
                                : isZombie
                                  ? 'border-lime-400 bg-lime-950/35 text-white'
                                  : 'border-cyan-400 bg-cyan-950/35 text-white'
                          : selectedId === id
                            ? 'border-stone-500 bg-stone-800 text-stone-100'
                            : 'border-stone-800 bg-stone-900 text-stone-300 hover:border-stone-600'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <SkillIcon skillId={id} className="h-4 w-4 shrink-0" />
                        <span className="truncate text-[11px] font-semibold">{def.name}</span>
                      </div>
                      <span className="font-mono-num shrink-0 text-[10px] text-stone-400">
                        {inSlot1 ? 'S1' : inSlot2 ? 'S2' : `${def.cooldown}s`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3 Ultimate Skills */}
            <div className="rounded-xl border border-stone-800 bg-stone-900/50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-amber-200">
                  Ultimate Skill — Pick 1 of 3
                </span>
                <span className="font-mono-num text-[11px] text-stone-400">
                  Slot 3: {HERO_SKILLS[loadout[2]].name}
                </span>
              </div>

              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {profile.ultimateSkills.map((id) => {
                  const def = HERO_SKILLS[id];
                  const isEquipped = loadout[2] === id;

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        soundEngine.playUiTap();
                        setSelectedId(id);
                        onSetUltimateSlot(id);
                      }}
                      className={`flex h-10 items-center justify-between gap-1.5 rounded-lg border px-2.5 text-left transition-colors ${
                        isEquipped
                          ? 'border-amber-400 bg-amber-950/35 text-amber-50'
                          : selectedId === id
                            ? 'border-stone-500 bg-stone-800 text-stone-100'
                            : 'border-stone-800 bg-stone-900 text-stone-300 hover:border-stone-600'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <SkillIcon skillId={id} className="h-4 w-4 shrink-0" />
                        <span className="truncate text-xs font-semibold">{def.name}</span>
                      </div>
                      <span className="font-mono-num shrink-0 text-[10px] text-amber-300">
                        {isEquipped ? 'ULT' : `${def.cooldown}s`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Inspector + Explicit Slot Assignment */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-800 bg-stone-900/80 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-50">
                  <span>{selectedDef.name}</span>
                  <span className="font-mono-num font-normal text-stone-400">
                    Lv.{selectedRank} · {selectedDef.cooldown}s CD
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-stone-300">
                  {selectedDef.description}
                </p>
              </div>

              {isSelectedNormal && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiTap();
                      onSetNormalSlot(0, selectedDef.id as NormalSkillId);
                    }}
                    className={`h-8 whitespace-nowrap rounded-lg border px-2.5 text-xs font-semibold ${
                      loadout[0] === selectedDef.id
                        ? isHuman
                          ? 'border-orange-300 bg-orange-400 text-stone-950'
                          : isGhost
                            ? 'border-indigo-300 bg-indigo-400 text-stone-950'
                            : isGhoul
                              ? 'border-rose-300 bg-rose-500 text-white'
                              : isZombie
                                ? 'border-lime-300 bg-lime-400 text-stone-950'
                                : 'border-cyan-300 bg-cyan-400 text-stone-950'
                        : 'border-stone-700 bg-stone-950 text-stone-200'
                    }`}
                  >
                    Set Slot 1
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiTap();
                      onSetNormalSlot(1, selectedDef.id as NormalSkillId);
                    }}
                    className={`h-8 whitespace-nowrap rounded-lg border px-2.5 text-xs font-semibold ${
                      loadout[1] === selectedDef.id
                        ? isHuman
                          ? 'border-orange-300 bg-orange-400 text-stone-950'
                          : isGhost
                            ? 'border-indigo-300 bg-indigo-400 text-stone-950'
                            : isGhoul
                              ? 'border-rose-300 bg-rose-500 text-white'
                              : isZombie
                                ? 'border-lime-300 bg-lime-400 text-stone-950'
                                : 'border-cyan-300 bg-cyan-400 text-stone-950'
                        : 'border-stone-700 bg-stone-950 text-stone-200'
                    }`}
                  >
                    Set Slot 2
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* TAB 2: COMPACT SINGLE-SCREEN SKILL TREE RANK UPGRADES */
          <div className="grid min-h-0 flex-1 grid-cols-12 divide-x divide-stone-800 overflow-hidden">
            <div className="col-span-7 grid grid-cols-3 gap-2 overflow-hidden p-3">
              {/* Normal */}
              <div className="flex flex-col gap-1.5">
                <span
                  className={`text-[11px] font-semibold ${
                    isHuman
                      ? 'text-orange-200'
                      : isGhost
                        ? 'text-indigo-200'
                        : isGhoul
                          ? 'text-rose-200'
                          : isZombie
                            ? 'text-lime-200'
                            : 'text-cyan-200'
                  }`}
                >
                  Normal
                </span>
                {profile.normalSkills.map((id) => {
                  const def = HERO_SKILLS[id];
                  const r = skillRanks[id] || 1;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        soundEngine.playUiTap();
                        setSelectedId(id);
                      }}
                      className={`flex h-9 items-center justify-between rounded-lg border px-2 text-left text-[11px] transition-colors ${
                        selectedId === id
                          ? isHuman
                            ? 'border-orange-400 bg-stone-800 text-white'
                            : isGhost
                              ? 'border-indigo-400 bg-stone-800 text-white'
                              : isGhoul
                                ? 'border-rose-400 bg-stone-800 text-white'
                                : 'border-cyan-300 bg-stone-800 text-white'
                          : 'border-stone-800 bg-stone-900/70 text-stone-300 hover:border-stone-600'
                      }`}
                    >
                      <span className="truncate font-medium">{def.name}</span>
                      <span className="font-mono-num ml-1 shrink-0 text-[10px] text-stone-400">
                        {r}/{def.maxRank}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Ultimate */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-amber-200">Ultimate</span>
                {profile.ultimateSkills.map((id) => {
                  const def = HERO_SKILLS[id];
                  const r = skillRanks[id] || 1;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        soundEngine.playUiTap();
                        setSelectedId(id);
                      }}
                      className={`flex h-9 items-center justify-between rounded-lg border px-2 text-left text-[11px] transition-colors ${
                        selectedId === id
                          ? 'border-amber-300 bg-stone-800 text-white'
                          : 'border-stone-800 bg-stone-900/70 text-stone-300 hover:border-stone-600'
                      }`}
                    >
                      <span className="truncate font-medium">{def.name}</span>
                      <span className="font-mono-num ml-1 shrink-0 text-[10px] text-amber-300">
                        {r}/{def.maxRank}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Passives */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-emerald-200">Passives</span>
                {profile.passiveSkills.map((id) => {
                  const def = HERO_SKILLS[id];
                  const r = skillRanks[id] || 1;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        soundEngine.playUiTap();
                        setSelectedId(id);
                      }}
                      className={`flex h-9 items-center justify-between rounded-lg border px-2 text-left text-[11px] transition-colors ${
                        selectedId === id
                          ? 'border-emerald-300 bg-stone-800 text-white'
                          : 'border-stone-800 bg-stone-900/70 text-stone-300 hover:border-stone-600'
                      }`}
                    >
                      <span className="truncate font-medium">{def.name}</span>
                      <span className="font-mono-num ml-1 shrink-0 text-[10px] text-emerald-300">
                        {r}/{def.maxRank}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Upgrade Inspector */}
            <div className="col-span-5 flex flex-col justify-between p-3.5">
              <div>
                <h3 className="text-sm font-semibold text-amber-50 sm:text-base">
                  {selectedDef.name}
                </h3>
                <div className="font-mono-num mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-stone-400">
                  <span>
                    {selectedDef.category === SkillCategory.ULTIMATE
                      ? 'Ultimate'
                      : selectedDef.category === SkillCategory.PASSIVE
                        ? 'Passive'
                        : 'Normal'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Rank {selectedRank}/{selectedDef.maxRank}
                  </span>
                  {selectedDef.cooldown > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{selectedDef.cooldown}s CD</span>
                    </>
                  )}
                </div>

                <p className="mt-2 text-xs leading-relaxed text-stone-300">
                  {selectedDef.description}
                </p>

                {selectedDef.category !== SkillCategory.PASSIVE && (
                  <p
                    className={`font-mono-num mt-2 text-xs ${
                      isHuman
                        ? 'text-orange-300'
                        : isGhost
                          ? 'text-indigo-300'
                          : isGhoul
                            ? 'text-rose-300'
                            : isZombie
                              ? 'text-lime-300'
                              : 'text-cyan-300'
                    }`}
                  >
                    Power:{' '}
                    {Math.round(
                      (selectedDef.baseMultiplier +
                        (selectedRank - 1) * selectedDef.rankMultiplier) *
                        100
                    )}
                    %
                    {selectedRank < selectedDef.maxRank &&
                      ` → ${Math.round(
                        (selectedDef.baseMultiplier +
                          selectedRank * selectedDef.rankMultiplier) *
                          100
                      )}%`}
                  </p>
                {!isDungeon && (
                  <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-950/40 px-2.5 py-1.5 text-center text-[11px] text-amber-200">
                    Skill upgrades can only be purchased inside the dungeon.
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={!canUpgrade}
                onClick={() => onUpgradeSkill(selectedDef.id)}
                className={`mt-3 h-10 w-full whitespace-nowrap rounded-xl px-4 text-xs font-bold transition-colors sm:text-sm ${
                  canUpgrade
                    ? isHuman
                      ? 'bg-orange-400 text-stone-950 hover:bg-orange-300 active:scale-[0.99]'
                      : isGhost
                        ? 'bg-indigo-400 text-stone-950 hover:bg-indigo-300 active:scale-[0.99]'
                        : isGhoul
                          ? 'bg-rose-500 text-white hover:bg-rose-400 active:scale-[0.99]'
                          : isZombie
                            ? 'bg-lime-400 text-stone-950 hover:bg-lime-300 active:scale-[0.99]'
                            : 'bg-cyan-400 text-stone-950 hover:bg-cyan-300 active:scale-[0.99]'
                    : 'cursor-not-allowed bg-stone-800 text-stone-500'
                }`}
              >
                {!isDungeon
                  ? 'Locked in Guild (Dungeon Only)'
                  : selectedRank >= selectedDef.maxRank
                    ? 'Max Rank Reached'
                    : `Upgrade Rank (1 SP · ${skillPoints} Left)`}
              </button>
            </div>
          </div>
        )}

        {/* Modal Prompt: Choose Slot 1 or Slot 2 for Tapped Skill */}
        {slotChoiceSkillId && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl border border-stone-700 bg-[#1c1612] p-4 text-center shadow-2xl">
              <div className="mb-2 flex items-center justify-center gap-2">
                <SkillIcon skillId={slotChoiceSkillId} className="h-6 w-6" />
                <h3 className="font-display text-sm font-bold text-amber-100 sm:text-base">
                  {HERO_SKILLS[slotChoiceSkillId].name}
                </h3>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-stone-300">
                Which skill slot would you like to equip this to?
              </p>

              <div className="mb-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiTap();
                    onSetNormalSlot(0, slotChoiceSkillId);
                    setSlotChoiceSkillId(null);
                  }}
                  className={`flex flex-col items-center justify-center rounded-xl border p-2.5 transition-transform active:scale-95 ${
                    loadout[0] === slotChoiceSkillId
                      ? 'border-amber-400 bg-amber-950/60 text-amber-100 shadow-md'
                      : 'border-stone-700 bg-stone-900 text-stone-200 hover:border-amber-400/60'
                  }`}
                >
                  <span className="text-xs font-bold text-amber-300">Slot 1</span>
                  <span className="mt-1 max-w-[125px] truncate font-mono text-[10px] text-stone-400">
                    {loadout[0] === slotChoiceSkillId
                      ? 'Current: Equipped'
                      : `Replaces: ${HERO_SKILLS[loadout[0]].name}`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiTap();
                    onSetNormalSlot(1, slotChoiceSkillId);
                    setSlotChoiceSkillId(null);
                  }}
                  className={`flex flex-col items-center justify-center rounded-xl border p-2.5 transition-transform active:scale-95 ${
                    loadout[1] === slotChoiceSkillId
                      ? 'border-amber-400 bg-amber-950/60 text-amber-100 shadow-md'
                      : 'border-stone-700 bg-stone-900 text-stone-200 hover:border-amber-400/60'
                  }`}
                >
                  <span className="text-xs font-bold text-amber-300">Slot 2</span>
                  <span className="mt-1 max-w-[125px] truncate font-mono text-[10px] text-stone-400">
                    {loadout[1] === slotChoiceSkillId
                      ? 'Current: Equipped'
                      : `Replaces: ${HERO_SKILLS[loadout[1]].name}`}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSlotChoiceSkillId(null)}
                className="rounded-lg px-3 py-1 text-xs text-stone-400 transition-colors hover:text-stone-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
