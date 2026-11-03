import { Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { HERO_PROFILES, HERO_SKILLS } from '../data/heroSkills';
import { renderHeroShowcaseCanvas } from '../game/renderer';
import {
  HERO_CATEGORY_MAP,
  HeroId,
  NormalSkillId,
  SkillCategory,
  SkillId,
  SkillLoadout,
  UltimateSkillId,
} from '../types/game';
import { SkillIcon } from './SkillIcon';

interface HeroSelectScreenProps {
  heroId: HeroId;
  loadout: SkillLoadout;
  isFullscreen: boolean;
  onSelectHero: (heroId: HeroId) => void;
  onSelectNormalSkill: (skillId: NormalSkillId) => void;
  onSetNormalSlot?: (slotIdx: 0 | 1, skillId: NormalSkillId) => void;
  onSwapNormalSlots: () => void;
  onSelectUltimateSkill: (skillId: UltimateSkillId) => void;
  onToggleFullscreen: () => void;
  onConfirmHero: () => void;
  onOpenSettings: () => void;
}

export function HeroSelectScreen({
  heroId,
  loadout,
  isFullscreen,
  onSelectHero,
  onSelectNormalSkill,
  onSetNormalSlot,
  onSwapNormalSlots,
  onSelectUltimateSkill,
  onToggleFullscreen,
  onConfirmHero,
  onOpenSettings,
}: HeroSelectScreenProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const profile = HERO_PROFILES[heroId];
  const heroCategory = HERO_CATEGORY_MAP[heroId];
  const isHuman = heroId === 'human';
  const isZombie = heroId === 'zombie';
  const isGhoul = heroId === 'ghoul';
  const isGhost = heroId === 'ghost';
  const isEaglekin = heroId === 'eaglekin';
  const isTigerkin = heroId === 'tigerkin';

  const [activeCategory, setActiveCategory] = useState<'undead_legion' | 'wildborn_tribes' | 'default'>(() => {
    if (heroId === 'eaglekin' || heroId === 'tigerkin') return 'wildborn_tribes';
    if (heroId === 'human') return 'default';
    return 'undead_legion';
  });

  useEffect(() => {
    if (heroId === 'eaglekin' || heroId === 'tigerkin') {
      setActiveCategory('wildborn_tribes');
    } else if (heroId === 'human') {
      setActiveCategory('default');
    } else {
      setActiveCategory('undead_legion');
    }
  }, [heroId]);

  const [inspectedSkillId, setInspectedSkillId] = useState<SkillId>(loadout[0]);
  const [slotChoiceSkillId, setSlotChoiceSkillId] = useState<NormalSkillId | null>(null);

  useEffect(() => {
    setInspectedSkillId(HERO_PROFILES[heroId].defaultLoadout[0]);
  }, [heroId]);

  // Live 60fps Chibi Skeleton / Zombie + Floating Weapon showcase
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const start = performance.now();

    const loop = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = 160;
      const ch = 104;
      if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
        canvas.width = cw * dpr;
        canvas.height = ch * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderHeroShowcaseCanvas(ctx, cw, ch, (now - start) / 1000, heroId);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [heroId]);

  const inspected = HERO_SKILLS[inspectedSkillId] || HERO_SKILLS[loadout[0]];

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#140f0c] text-stone-100">
      {/* Compact 40px Single-Row Header */}
      <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-stone-800/80 px-3 sm:px-4">
        <div className="flex items-center gap-2.5">
          <span className="font-display whitespace-nowrap text-sm font-bold tracking-tight text-amber-100 sm:text-base">
            Guild Lobby
          </span>

          {/* Top Categories Switcher: Undead Legion | Wildborn Tribes | Default */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiTap();
                setActiveCategory('undead_legion');
                if (heroCategory.category !== 'undead_legion') {
                  onSelectHero('skeleton');
                }
              }}
              className={`flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-xs font-semibold transition-all ${
                activeCategory === 'undead_legion'
                  ? 'border-purple-500/80 bg-purple-950/80 text-purple-100 shadow-sm ring-1 ring-purple-400/30'
                  : 'border-purple-900/50 bg-stone-900/80 text-stone-300 hover:border-purple-700/60 hover:text-white'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              Undead Legion
              <span className="rounded bg-purple-900/60 px-1 py-0.2 text-[10px] text-purple-300 font-mono">4</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiTap();
                setActiveCategory('wildborn_tribes');
                if (heroCategory.category !== 'wildborn_tribes') {
                  onSelectHero('tigerkin');
                }
              }}
              className={`flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-xs font-semibold transition-all ${
                activeCategory === 'wildborn_tribes'
                  ? 'border-amber-500/80 bg-amber-950/80 text-amber-100 shadow-sm ring-1 ring-amber-400/30'
                  : 'border-amber-900/50 bg-stone-900/80 text-stone-300 hover:border-amber-700/60 hover:text-white'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Wildborn Tribes
              <span className="rounded bg-amber-900/60 px-1 py-0.2 text-[10px] text-amber-300 font-mono">2</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiTap();
                setActiveCategory('default');
                onSelectHero('human');
              }}
              className={`flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2 text-xs font-semibold transition-all ${
                activeCategory === 'default'
                  ? 'border-orange-500/80 bg-orange-950/80 text-orange-100 shadow-sm ring-1 ring-orange-400/30'
                  : 'border-stone-800 bg-stone-900/70 text-stone-400 hover:text-stone-200'
              }`}
            >
              Default
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            className="flex h-8 items-center gap-1 whitespace-nowrap rounded-lg border border-stone-700 bg-stone-900 px-2.5 text-xs font-medium text-stone-200 transition-colors hover:bg-stone-800"
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5 text-amber-300" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5 text-amber-300" />
            )}
            <span className="hidden sm:inline">
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiTap();
              onOpenSettings();
            }}
            className="h-8 whitespace-nowrap rounded-lg border border-stone-700 bg-stone-900 px-2.5 text-xs font-medium text-stone-200 transition-colors hover:bg-stone-800"
          >
            Settings
          </button>
        </div>
      </header>

      {/* Sub-Header: Heroes under the tapped Category */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-stone-800/80 bg-[#16100d] px-3 sm:px-4">
        <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-stone-400">
          {activeCategory === 'undead_legion'
            ? 'Undead Legion Heroes:'
            : activeCategory === 'wildborn_tribes'
              ? 'Wildborn Tribes Heroes:'
              : 'Default Hero:'}
        </span>

        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {activeCategory === 'undead_legion' &&
            (['skeleton', 'zombie', 'ghoul', 'ghost'] as HeroId[]).map((id) => {
              const active = heroId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    soundEngine.playUiTap();
                    onSelectHero(id);
                  }}
                  className={`h-6.5 whitespace-nowrap rounded-md px-2.5 text-[11px] font-semibold transition-all sm:text-xs ${
                    active
                      ? id === 'ghost'
                        ? 'bg-indigo-400 text-stone-950 font-bold shadow-sm'
                        : id === 'ghoul'
                          ? 'bg-rose-500 text-white font-bold shadow-sm'
                          : id === 'zombie'
                            ? 'bg-lime-400 text-stone-950 font-bold shadow-sm'
                            : 'bg-cyan-400 text-stone-950 font-bold shadow-sm'
                      : 'border border-stone-800 bg-stone-900/80 text-stone-300 hover:border-stone-600 hover:text-white'
                  }`}
                >
                  {HERO_PROFILES[id].name}
                </button>
              );
            })}

          {activeCategory === 'wildborn_tribes' &&
            (['tigerkin', 'eaglekin'] as HeroId[]).map((id) => {
              const active = heroId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    soundEngine.playUiTap();
                    onSelectHero(id);
                  }}
                  className={`h-6.5 whitespace-nowrap rounded-md px-2.5 text-[11px] font-semibold transition-all sm:text-xs ${
                    active
                      ? id === 'tigerkin'
                        ? 'bg-amber-400 text-stone-950 font-bold shadow-sm'
                        : 'bg-sky-400 text-stone-950 font-bold shadow-sm'
                      : 'border border-stone-800 bg-stone-900/80 text-stone-300 hover:border-stone-600 hover:text-white'
                  }`}
                >
                  {HERO_PROFILES[id].name}
                </button>
              );
            })}

          {activeCategory === 'default' && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiTap();
                onSelectHero('human');
              }}
              className="h-6.5 whitespace-nowrap rounded-md bg-orange-400 px-2.5 text-[11px] font-bold text-stone-950 shadow-sm sm:text-xs"
            >
              Human
            </button>
          )}
        </div>
      </div>

      {/* Strict Single-Screen Landscape Grid — Zero Scrolling / Zero Clipping */}
      <main className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-12 gap-2.5 overflow-hidden px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
        {/* Left 4 Cols: Compact Live Chibi Hero Card + Passives + Enter Guild CTA */}
        <div className="col-span-5 flex min-h-0 flex-col justify-between rounded-xl border border-stone-800 bg-[#1a1410] p-2.5 sm:col-span-4 sm:p-3">
          <div className="flex min-h-0 flex-col items-center text-center">
            <canvas ref={previewCanvasRef} className="h-[88px] w-[136px] shrink-0 sm:h-[100px] sm:w-[154px]" />

            <div className="flex items-baseline gap-1.5">
              <h1 className="font-display text-base font-bold text-amber-50 sm:text-lg">
                {profile.name}
              </h1>
              <span className="font-mono-num text-[11px] text-stone-400">
                HP {profile.baseHp} · ATK {profile.baseAtk}
              </span>
            </div>

            {/* Category / Faction Tag */}
            <div className="my-0.5">
              <span
                className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                  heroCategory.category === 'undead_legion'
                    ? 'border-purple-600/50 bg-purple-950/60 text-purple-300'
                    : heroCategory.category === 'wildborn_tribes'
                      ? 'border-sky-500/50 bg-sky-950/60 text-sky-300'
                      : 'border-stone-700 bg-stone-900/90 text-amber-300/90'
                }`}
              >
                {heroCategory.label}
              </span>
            </div>

            <p
              className={`truncate text-[11px] font-medium ${
                isTigerkin
                  ? 'text-amber-400'
                  : isEaglekin
                    ? 'text-sky-300'
                    : isHuman
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
              {profile.typeLine}
            </p>

            {/* Clickable Passive Skills row so players can inspect passives in the detail strip too */}
            <div className="mt-1.5 flex w-full flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                Passives (Tap to Inspect)
              </span>
              <div className="grid grid-cols-2 gap-1">
                {profile.passiveSkills.map((pid) => {
                  const pDef = HERO_SKILLS[pid];
                  const focused = inspectedSkillId === pid;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => {
                        soundEngine.playUiTap();
                        setInspectedSkillId(pid);
                      }}
                      className={`truncate rounded-lg border px-1.5 py-1 text-[11px] font-medium transition-colors ${
                        focused
                          ? 'border-emerald-400 bg-emerald-950/40 text-emerald-100'
                          : 'border-stone-800 bg-stone-900/80 text-stone-300 hover:border-stone-600'
                      }`}
                    >
                      {pDef.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playSkill('rush');
              onConfirmHero();
            }}
            className="mt-2 h-9 w-full shrink-0 whitespace-nowrap rounded-xl bg-amber-400 px-3 text-xs font-bold text-stone-950 shadow-md transition-transform duration-150 hover:bg-amber-300 active:scale-[0.98] sm:h-10 sm:text-sm"
          >
            Enter Guild House
          </button>
        </div>

        {/* Right 8 Cols: Compact All-In-One Skill Selection (2 of 5 Normal + 1 of 3 Ultimate + Detail Strip) */}
        <div className="col-span-7 flex min-h-0 flex-col justify-between gap-1.5 overflow-hidden sm:col-span-8 sm:gap-2">
          {/* Normal Skills: Choose 2 of 5 */}
          <section className="rounded-xl border border-stone-800 bg-[#1a1410] px-2.5 py-2 sm:px-3">
            <div className="flex items-center justify-between gap-2">
              <h2
                className={`text-xs font-semibold ${
                  isTigerkin
                    ? 'text-amber-200'
                    : isEaglekin
                      ? 'text-sky-200'
                      : isHuman
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
                Normal Skills — Choose 2 of 5
              </h2>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiTap();
                  onSwapNormalSlots();
                }}
                className="font-mono-num whitespace-nowrap text-[11px] text-stone-400 underline decoration-stone-600 underline-offset-2 hover:text-stone-200"
              >
                S1: {HERO_SKILLS[loadout[0]].name} · S2: {HERO_SKILLS[loadout[1]].name} (Swap)
              </button>
            </div>

            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {profile.normalSkills.map((id) => {
                const def = HERO_SKILLS[id];
                const slotIdx = loadout[0] === id ? 1 : loadout[1] === id ? 2 : 0;
                const isSelected = slotIdx > 0;
                const isFocused = inspectedSkillId === id;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiTap();
                      setInspectedSkillId(id);
                      setSlotChoiceSkillId(id);
                    }}
                    className={`flex h-9 items-center justify-between gap-1.5 rounded-lg border px-2 text-left transition-colors sm:h-10 sm:px-2.5 ${
                      isSelected
                        ? isTigerkin
                          ? 'border-amber-400 bg-amber-950/45 text-stone-50'
                          : isEaglekin
                            ? 'border-sky-400 bg-sky-950/40 text-stone-50'
                            : isHuman
                              ? 'border-orange-400 bg-orange-950/40 text-stone-50'
                              : isGhost
                                ? 'border-indigo-400 bg-indigo-950/45 text-stone-50'
                                : isGhoul
                                  ? 'border-rose-400 bg-rose-950/40 text-stone-50'
                                  : isZombie
                                    ? 'border-lime-400 bg-lime-950/40 text-stone-50'
                                    : 'border-cyan-400 bg-cyan-950/40 text-stone-50'
                        : isFocused
                          ? 'border-stone-500 bg-stone-800 text-stone-100'
                          : 'border-stone-800 bg-stone-900/75 text-stone-300 hover:border-stone-600'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <SkillIcon skillId={id} className="h-4 w-4 shrink-0" />
                      <span className="truncate text-[11px] font-semibold sm:text-xs">
                        {def.name}
                      </span>
                    </div>
                    <span
                      className={`font-mono-num shrink-0 text-[10px] font-semibold ${
                        isSelected
                          ? isTigerkin
                            ? 'text-amber-300'
                            : isEaglekin
                              ? 'text-sky-300'
                              : isHuman
                                ? 'text-orange-300'
                                : isGhost
                                  ? 'text-indigo-300'
                                  : isGhoul
                                    ? 'text-rose-300'
                                    : isZombie
                                      ? 'text-lime-300'
                                      : 'text-cyan-300'
                          : 'text-stone-400'
                      }`}
                    >
                      {isSelected ? `S${slotIdx}` : `${def.cooldown}s`}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Ultimate Skills: Choose 1 of 3 */}
          <section className="rounded-xl border border-stone-800 bg-[#1a1410] px-2.5 py-2 sm:px-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-amber-200">
                Ultimate Skill — Choose 1 of 3
              </h2>
              <span className="font-mono-num truncate text-[11px] text-stone-400">
                Equipped: {HERO_SKILLS[loadout[2]].name}
              </span>
            </div>

            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {profile.ultimateSkills.map((id) => {
                const def = HERO_SKILLS[id];
                const isSelected = loadout[2] === id;
                const isFocused = inspectedSkillId === id;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiTap();
                      setInspectedSkillId(id);
                      onSelectUltimateSkill(id);
                    }}
                    className={`flex h-9 items-center justify-between gap-1.5 rounded-lg border px-2 text-left transition-colors sm:h-10 sm:px-2.5 ${
                      isSelected
                        ? 'border-amber-400 bg-amber-950/40 text-amber-50'
                        : isFocused
                          ? 'border-stone-500 bg-stone-800 text-stone-100'
                          : 'border-stone-800 bg-stone-900/75 text-stone-300 hover:border-stone-600'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <SkillIcon skillId={id} className="h-4 w-4 shrink-0" />
                      <span className="truncate text-[11px] font-semibold sm:text-xs">
                        {def.name}
                      </span>
                    </div>
                    <span
                      className={`font-mono-num shrink-0 text-[10px] font-semibold ${
                        isSelected ? 'text-amber-300' : 'text-stone-400'
                      }`}
                    >
                      {isSelected ? 'ULT' : `${def.cooldown}s`}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Dedicated Selected Skill Description Strip (Fits cleanly at bottom of screen) */}
          <section className="flex min-h-[54px] flex-col justify-center rounded-xl border border-stone-800 bg-[#1a1410] px-3 py-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-amber-50">{inspected.name}</span>
              <span className="font-mono-num text-[11px] text-stone-400">
                {inspected.category === SkillCategory.ULTIMATE
                  ? 'Ultimate'
                  : inspected.category === SkillCategory.PASSIVE
                    ? 'Passive'
                    : 'Normal'}
                {inspected.cooldown > 0 ? ` · ${inspected.cooldown}s CD` : ' · Always Active'}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-stone-300">
              {inspected.description}
            </p>
          </section>
        </div>
      </main>

      {/* Modal Prompt: Choose Slot 1 or Slot 2 for Normal Skill in Hero Select */}
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
              Choose which slot to equip this skill in:
            </p>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiTap();
                  if (onSetNormalSlot) {
                    onSetNormalSlot(0, slotChoiceSkillId);
                  } else {
                    onSelectNormalSkill(slotChoiceSkillId);
                  }
                  setSlotChoiceSkillId(null);
                }}
                className={`flex flex-col items-center justify-center rounded-xl border p-2.5 transition-transform active:scale-95 ${
                  loadout[0] === slotChoiceSkillId
                    ? 'border-amber-400 bg-amber-950/60 text-amber-100 shadow-md ring-1 ring-amber-400/40'
                    : 'border-stone-700 bg-stone-900 text-stone-200 hover:border-amber-400/60'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-amber-300">Slot 1</span>
                  {loadout[0] === slotChoiceSkillId && (
                    <span className="text-[10px] font-semibold text-emerald-400">✓ Active</span>
                  )}
                </div>
                <span className="mt-1 max-w-[125px] truncate font-mono text-[10px] text-stone-400">
                  {loadout[0] === slotChoiceSkillId
                    ? 'Currently in Slot 1'
                    : `Replaces: ${HERO_SKILLS[loadout[0]].name}`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiTap();
                  if (onSetNormalSlot) {
                    onSetNormalSlot(1, slotChoiceSkillId);
                  } else {
                    onSelectNormalSkill(slotChoiceSkillId);
                  }
                  setSlotChoiceSkillId(null);
                }}
                className={`flex flex-col items-center justify-center rounded-xl border p-2.5 transition-transform active:scale-95 ${
                  loadout[1] === slotChoiceSkillId
                    ? 'border-amber-400 bg-amber-950/60 text-amber-100 shadow-md ring-1 ring-amber-400/40'
                    : 'border-stone-700 bg-stone-900 text-stone-200 hover:border-amber-400/60'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-amber-300">Slot 2</span>
                  {loadout[1] === slotChoiceSkillId && (
                    <span className="text-[10px] font-semibold text-emerald-400">✓ Active</span>
                  )}
                </div>
                <span className="mt-1 max-w-[125px] truncate font-mono text-[10px] text-stone-400">
                  {loadout[1] === slotChoiceSkillId
                    ? 'Currently in Slot 2'
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
  );
}
