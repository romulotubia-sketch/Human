import {
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crown,
  Dices,
  Play,
  Shield,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { HERO_PROFILES, HERO_SKILLS } from '../data/heroSkills';
import { renderHeroShowcaseCanvas } from '../game/renderer';
import {
  HeroId,
  NormalSkillId,
  SkillId,
  SkillLoadout,
  UltimateSkillId,
} from '../types/game';
import { RoomDetails } from '../types/multiplayer';
import { SkillIcon } from './SkillIcon';

interface MultiplayerLobbyScreenProps {
  roomDetails: RoomDetails;
  localPlayerId: string | null;
  isHost: boolean;
  localHeroId: HeroId;
  localLoadout: SkillLoadout;
  onSelectHero: (heroId: HeroId) => void;
  onSelectNormalSkill: (skillId: NormalSkillId) => void;
  onSetNormalSlot?: (slotIdx: 0 | 1, skillId: NormalSkillId) => void;
  onSwapNormalSlots: () => void;
  onSelectUltimateSkill: (skillId: UltimateSkillId) => void;
  onToggleReady: () => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  errorMessage?: string | null;
}

type HeroFilterTab = 'all' | 'default' | 'undead' | 'wildborn';

const HERO_ROSTER: HeroId[] = [
  'human',
  'skeleton',
  'zombie',
  'ghoul',
  'ghost',
  'tigerkin',
  'eaglekin',
];

const HERO_THEME: Record<
  HeroId,
  {
    factionLabel: string;
    borderActive: string;
    bgActive: string;
    badgeBg: string;
    textAccent: string;
    ringAccent: string;
  }
> = {
  human: {
    factionLabel: 'Survivor',
    borderActive: 'border-orange-400',
    bgActive: 'bg-orange-500/15',
    badgeBg: 'border-orange-400/50 bg-orange-500/20 text-orange-200',
    textAccent: 'text-orange-300',
    ringAccent: 'ring-orange-400/50',
  },
  skeleton: {
    factionLabel: 'Undead',
    borderActive: 'border-cyan-400',
    bgActive: 'bg-cyan-500/15',
    badgeBg: 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200',
    textAccent: 'text-cyan-300',
    ringAccent: 'ring-cyan-400/50',
  },
  zombie: {
    factionLabel: 'Undead',
    borderActive: 'border-lime-400',
    bgActive: 'bg-lime-500/15',
    badgeBg: 'border-lime-400/50 bg-lime-500/20 text-lime-200',
    textAccent: 'text-lime-300',
    ringAccent: 'ring-lime-400/50',
  },
  ghoul: {
    factionLabel: 'Undead',
    borderActive: 'border-rose-400',
    bgActive: 'bg-rose-500/15',
    badgeBg: 'border-rose-400/50 bg-rose-500/20 text-rose-200',
    textAccent: 'text-rose-300',
    ringAccent: 'ring-rose-400/50',
  },
  ghost: {
    factionLabel: 'Undead',
    borderActive: 'border-indigo-400',
    bgActive: 'bg-indigo-500/15',
    badgeBg: 'border-indigo-400/50 bg-indigo-500/20 text-indigo-200',
    textAccent: 'text-indigo-300',
    ringAccent: 'ring-indigo-400/50',
  },
  tigerkin: {
    factionLabel: 'Wildborn',
    borderActive: 'border-amber-400',
    bgActive: 'bg-amber-500/15',
    badgeBg: 'border-amber-400/50 bg-amber-500/20 text-amber-200',
    textAccent: 'text-amber-300',
    ringAccent: 'ring-amber-400/50',
  },
  eaglekin: {
    factionLabel: 'Wildborn',
    borderActive: 'border-sky-400',
    bgActive: 'bg-sky-500/15',
    badgeBg: 'border-sky-400/50 bg-sky-500/20 text-sky-200',
    textAccent: 'text-sky-300',
    ringAccent: 'ring-sky-400/50',
  },
};

function HeroAvatarCanvas({
  heroId,
  width = 116,
  height = 72,
  className = '',
}: {
  heroId: HeroId;
  width?: number;
  height?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const start = performance.now();

    const loop = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderHeroShowcaseCanvas(ctx, width, height, (now - start) / 1000, heroId);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [heroId, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none block rounded-xl ${className}`}
    />
  );
}

export function MultiplayerLobbyScreen({
  roomDetails,
  localPlayerId,
  isHost,
  localHeroId,
  localLoadout,
  onSelectHero,
  onSelectNormalSkill,
  onSetNormalSlot,
  onSwapNormalSlots,
  onSelectUltimateSkill,
  onToggleReady,
  onStartGame,
  onLeaveRoom,
  errorMessage,
}: MultiplayerLobbyScreenProps) {
  const [copied, setCopied] = useState(false);
  const [filterTab, setFilterTab] = useState<HeroFilterTab>('all');
  const [inspectedSkillId, setInspectedSkillId] = useState<SkillId>(localLoadout[0]);
  const [slotPromptSkillId, setSlotPromptSkillId] = useState<NormalSkillId | null>(null);

  useEffect(() => {
    setInspectedSkillId(HERO_PROFILES[localHeroId].defaultLoadout[0]);
    setSlotPromptSkillId(null);
  }, [localHeroId]);

  const localPlayer = roomDetails.players.find((p) => p.id === localPlayerId);
  const isReady = localPlayer?.ready ?? false;

  const handleCopyCode = () => {
    soundEngine.unlock();
    soundEngine.playUiTap();
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(roomDetails.roomCode).catch(() => {});
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    }
  };

  const handlePickHero = (nextHero: HeroId) => {
    soundEngine.unlock();
    soundEngine.playUiTap();
    if (nextHero !== localHeroId) {
      onSelectHero(nextHero);
    }
  };

  const handleCycleHero = (dir: -1 | 1) => {
    const idx = HERO_ROSTER.indexOf(localHeroId);
    const nextIdx = (idx + dir + HERO_ROSTER.length) % HERO_ROSTER.length;
    handlePickHero(HERO_ROSTER[nextIdx]);
  };

  const handleRandomHero = () => {
    const others = HERO_ROSTER.filter((h) => h !== localHeroId);
    const pick = others[Math.floor(Math.random() * others.length)] || 'human';
    handlePickHero(pick);
  };

  const filteredHeroes = HERO_ROSTER.filter((hId) => {
    if (filterTab === 'default') return hId === 'human';
    if (filterTab === 'undead') {
      return hId === 'skeleton' || hId === 'zombie' || hId === 'ghoul' || hId === 'ghost';
    }
    if (filterTab === 'wildborn') {
      return hId === 'tigerkin' || hId === 'eaglekin';
    }
    return true;
  });

  const playerCount = roomDetails.players.length;
  const allReady = playerCount >= 2 && roomDetails.players.every((p) => p.ready);
  const canStart = isHost && playerCount >= 2 && allReady;

  const activeProfile = HERO_PROFILES[localHeroId];
  const activeTheme = HERO_THEME[localHeroId];
  const inspectedSkill = HERO_SKILLS[inspectedSkillId] || HERO_SKILLS[localLoadout[0]];

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-gradient-to-b from-[#1c140e] via-[#130d0a] to-[#0c0907] text-[#f5efe6] select-none">
      {/* Top Header Bar */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-800 bg-stone-950/85 px-3 py-2 backdrop-blur-md sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.playUiTap();
              onLeaveRoom();
            }}
            className="flex min-h-[38px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-stone-700 bg-stone-900 px-3 py-1.5 text-xs font-semibold text-stone-300 transition-colors hover:bg-stone-800 active:scale-95"
          >
            <X className="h-3.5 w-3.5" />
            <span>Leave</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-[10px] font-bold tracking-wider text-amber-400 uppercase">
                CO-OP READY-UP LOBBY
              </span>
              <span className="hidden rounded-md border border-stone-700/80 bg-stone-900 px-1.5 py-0.5 text-[10px] font-semibold text-stone-300 sm:inline">
                {playerCount}/4 Heroes
              </span>
            </div>
            <h2 className="font-display truncate text-xs font-bold text-stone-100 sm:text-sm">
              The Bonehearth Guildhouse
            </h2>
          </div>
        </div>

        {/* Status + Room Code & Copy Button */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-amber-300/90 lg:inline">
            {playerCount < 2
              ? 'Share code — need 2+ heroes to start'
              : allReady
                ? 'All heroes ready! Host can launch.'
                : 'Choose heroes & Ready Up!'}
          </span>

          <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2.5 py-1">
            <span className="hidden text-[11px] text-stone-300 sm:inline">Code:</span>
            <span className="font-mono text-sm font-black tracking-widest text-amber-300 sm:text-base">
              {roomDetails.roomCode}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              title="Copy Room Code"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/20 text-amber-200 transition-colors hover:bg-amber-400/30 active:scale-95"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          {copied && (
            <span className="hidden text-xs font-semibold text-emerald-400 sm:inline">
              Copied!
            </span>
          )}
        </div>
      </header>

      {/* Error Banner */}
      {errorMessage && (
        <div className="shrink-0 border-b border-rose-900/60 bg-rose-950/85 px-4 py-1.5 text-center text-xs font-semibold text-rose-200">
          {errorMessage}
        </div>
      )}

      {/* Main Scrollable Ready-Up & Hero Picker Workspace */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5 sm:px-5 sm:py-3">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          {/* 1. 4-Player Squad Roster with Live Animated Character Previews */}
          <section aria-label="Squad Roster">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-xs font-bold tracking-wide text-stone-200">
                Squad Roster ({playerCount}/4)
              </span>
              <span className="text-[11px] text-amber-300/90 lg:hidden">
                {playerCount < 2
                  ? 'Need at least 2 players to start'
                  : allReady
                    ? 'All heroes ready!'
                    : 'Waiting for squad to Ready Up…'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[0, 1, 2, 3].map((slotIdx) => {
                const player = roomDetails.players[slotIdx];

                if (!player) {
                  return (
                    <div
                      key={slotIdx}
                      className="flex min-h-[144px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-800/80 bg-stone-950/35 p-2.5 text-center"
                    >
                      <User className="h-6 w-6 text-stone-700" />
                      <span className="mt-1 text-xs font-semibold text-stone-500">
                        Open Ally Slot
                      </span>
                      <span className="font-mono text-[10px] text-stone-600">
                        Code: {roomDetails.roomCode}
                      </span>
                    </div>
                  );
                }

                const pHeroId = HERO_PROFILES[player.heroId] ? player.heroId : 'human';
                const profile = HERO_PROFILES[pHeroId];
                const theme = HERO_THEME[pHeroId];
                const isMe = player.id === localPlayerId;

                return (
                  <div
                    key={player.id}
                    className={`relative flex min-h-[144px] flex-col justify-between rounded-2xl border p-2.5 shadow-xl transition-all ${
                      player.ready
                        ? 'border-emerald-500/60 bg-gradient-to-b from-stone-900/95 to-emerald-950/35'
                        : 'border-stone-700/80 bg-stone-900/90'
                    } ${isMe ? `ring-2 ${theme.ringAccent}` : ''}`}
                  >
                    {/* Player Name & Ready Tag */}
                    <div className="flex items-center justify-between gap-1">
                      <span className="flex min-w-0 items-center gap-1 text-[11px] font-bold text-amber-100">
                        {player.isHost && (
                          <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        )}
                        <span className="truncate">{player.name}</span>
                        {isMe && (
                          <span className="shrink-0 text-[10px] font-semibold text-amber-300">
                            (You)
                          </span>
                        )}
                      </span>

                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase ${
                          player.ready
                            ? 'border border-emerald-500/45 bg-emerald-500/20 text-emerald-300'
                            : 'border border-amber-500/40 bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        {player.ready ? 'READY' : 'PREP'}
                      </span>
                    </div>

                    {/* Live Animated Chibi Hero Canvas (+ Quick Cycle Arrows on Local Player Card) */}
                    <div className="my-1 flex flex-col items-center text-center">
                      <div className="relative flex w-full items-center justify-center">
                        {isMe && (
                          <button
                            type="button"
                            onClick={() => handleCycleHero(-1)}
                            title="Previous Hero"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-stone-700 bg-stone-800/90 text-stone-200 transition-colors hover:border-amber-400/60 hover:bg-stone-700 active:scale-95"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                        )}

                        <div className="mx-auto flex items-center justify-center overflow-hidden rounded-xl border border-stone-800/90 bg-stone-950/65 px-1">
                          <HeroAvatarCanvas heroId={pHeroId} width={104} height={62} />
                        </div>

                        {isMe && (
                          <button
                            type="button"
                            onClick={() => handleCycleHero(1)}
                            title="Next Hero"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-stone-700 bg-stone-800/90 text-stone-200 transition-colors hover:border-amber-400/60 hover:bg-stone-700 active:scale-95"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="mt-1 flex items-center justify-center gap-1.5">
                        <span className="font-display text-xs font-bold text-stone-100">
                          {profile.name}
                        </span>
                        <span className="text-[10px] text-stone-400">· {profile.title}</span>
                      </div>
                    </div>

                    {/* Equipped 2 Normal + 1 Ultimate Skills */}
                    <div className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-800 bg-stone-950/70 px-2 py-1">
                      {player.loadout.map((skId, idx) => (
                        <div
                          key={`${skId}_${idx}`}
                          title={HERO_SKILLS[skId]?.name || skId}
                          className={`flex h-6 w-6 items-center justify-center rounded-lg border ${
                            idx === 2
                              ? 'border-amber-400/50 bg-amber-500/10'
                              : 'border-stone-700 bg-stone-900'
                          }`}
                        >
                          <SkillIcon skillId={skId} className="h-4 w-4" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2. Always-Visible Hero Switcher & Loadout Deck */}
          <section
            aria-label="Choose Your Hero and Skills"
            className="rounded-2xl border border-amber-500/35 bg-stone-900/95 p-3 shadow-2xl"
          >
            {/* Deck Header + Category Filters + Random Hero */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800/90 pb-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <h3 className="font-display text-xs font-bold text-amber-100 sm:text-sm">
                  Choose Your Hero
                </h3>
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  Switch anytime — syncs live{isReady ? ' while Ready' : ''}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'all', label: 'All (7)' },
                    { id: 'default', label: 'Survivor' },
                    { id: 'undead', label: 'Undead (4)' },
                    { id: 'wildborn', label: 'Wildborn (2)' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      soundEngine.unlock();
                      soundEngine.playUiTap();
                      setFilterTab(tab.id);
                    }}
                    className={`min-h-[32px] whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      filterTab === tab.id
                        ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                        : 'border-stone-700/80 bg-stone-950/70 text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleRandomHero}
                  className="flex min-h-[32px] items-center gap-1 whitespace-nowrap rounded-lg border border-stone-700 bg-stone-800 px-2.5 py-1 text-[11px] font-semibold text-amber-300 transition-colors hover:border-amber-400/50 hover:bg-stone-700 active:scale-95"
                  title="Pick a Random Hero"
                >
                  <Dices className="h-3.5 w-3.5" />
                  <span>Random</span>
                </button>
              </div>
            </div>

            {/* One-Tap 7-Hero Roster Cards */}
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {filteredHeroes.map((hId) => {
                const prof = HERO_PROFILES[hId];
                const theme = HERO_THEME[hId];
                const isSelected = localHeroId === hId;
                const alliesOnHero = roomDetails.players.filter(
                  (p) => p.id !== localPlayerId && p.heroId === hId
                ).length;

                return (
                  <button
                    key={hId}
                    type="button"
                    onClick={() => handlePickHero(hId)}
                    className={`group relative flex min-h-[58px] items-center gap-2 rounded-xl border p-2 text-left transition-all active:scale-95 ${
                      isSelected
                        ? `${theme.borderActive} ${theme.bgActive} shadow-lg ring-1 ${theme.ringAccent}`
                        : 'border-stone-800 bg-stone-950/75 hover:border-stone-600 hover:bg-stone-800/85'
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-stone-900 ${
                        isSelected ? theme.borderActive : 'border-stone-700/80'
                      }`}
                    >
                      <SkillIcon
                        skillId={prof.basicSkillId || prof.defaultLoadout[0]}
                        className="h-5 w-5"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-display truncate text-xs font-bold text-stone-100">
                          {prof.name}
                        </span>
                        {isSelected && (
                          <Check className={`h-3.5 w-3.5 shrink-0 ${theme.textAccent}`} />
                        )}
                      </div>
                      <div className="truncate text-[10px] text-stone-400">{prof.title}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[9px] font-semibold">
                        <span className={theme.textAccent}>{theme.factionLabel}</span>
                        {alliesOnHero > 0 && (
                          <span className="rounded bg-stone-800 px-1 text-stone-300">
                            +{alliesOnHero} Ally
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Hero Stats + 3-Skill Loadout Customizer */}
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-stone-800/90 pt-3 lg:grid-cols-12">
              {/* Left: Active Hero Role, Stats & Inspected Skill Info */}
              <div className="flex flex-col justify-between gap-2 rounded-xl border border-stone-800 bg-stone-950/70 p-2.5 lg:col-span-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-display text-sm font-bold text-stone-100">
                        {activeProfile.name} — {activeProfile.title}
                      </span>
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase ${activeTheme.badgeBg}`}
                      >
                        {activeTheme.factionLabel}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-stone-400">{activeProfile.typeLine}</p>
                  </div>

                  {/* Base Stat Badges */}
                  <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold">
                    <span className="rounded-lg border border-stone-800 bg-stone-900 px-2 py-0.5 text-emerald-300">
                      HP {activeProfile.baseHp}
                    </span>
                    <span className="rounded-lg border border-stone-800 bg-stone-900 px-2 py-0.5 text-amber-300">
                      ATK {activeProfile.baseAtk}
                    </span>
                    <span className="rounded-lg border border-stone-800 bg-stone-900 px-2 py-0.5 text-sky-300">
                      SPD {activeProfile.moveSpeed}
                    </span>
                  </div>
                </div>

                {/* Inspected Skill Quick Readout */}
                <div className="flex items-center gap-2 rounded-lg border border-stone-800/90 bg-stone-900/90 px-2.5 py-1.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-stone-700 bg-stone-950">
                    <SkillIcon skillId={inspectedSkill.id} className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] font-bold text-amber-200">
                        {inspectedSkill.name}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-stone-400">
                        CD {inspectedSkill.cooldown}s
                      </span>
                    </div>
                    <p className="line-clamp-1 text-[10px] text-stone-300">
                      {inspectedSkill.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: 2 Normal Skills + 1 Ultimate Skill Selector */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 lg:col-span-7">
                {/* Normal Skills (5 options, equip 2) */}
                <div className="sm:col-span-7">
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-semibold text-stone-200">
                      Normal Skills (Equip 2)
                    </span>
                    <div className="flex items-center gap-1.5">
                      {slotPromptSkillId && onSetNormalSlot && (
                        <div className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-1.5 py-0.5 text-[10px]">
                          <span className="text-emerald-200">Assign:</span>
                          <button
                            type="button"
                            onClick={() => {
                              soundEngine.playUiTap();
                              onSetNormalSlot(0, slotPromptSkillId);
                              setSlotPromptSkillId(null);
                            }}
                            className="rounded bg-emerald-500 px-1.5 py-0.5 font-bold text-stone-950 hover:bg-emerald-400"
                          >
                            S1
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              soundEngine.playUiTap();
                              onSetNormalSlot(1, slotPromptSkillId);
                              setSlotPromptSkillId(null);
                            }}
                            className="rounded bg-emerald-500 px-1.5 py-0.5 font-bold text-stone-950 hover:bg-emerald-400"
                          >
                            S2
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playUiTap();
                          onSwapNormalSlots();
                        }}
                        className="flex min-h-[26px] items-center gap-1 whitespace-nowrap rounded-lg border border-stone-700 bg-stone-800 px-2 py-0.5 text-[10px] font-semibold text-amber-300 hover:bg-stone-700 active:scale-95"
                      >
                        <ArrowLeftRight className="h-3 w-3" />
                        <span>Swap S1/S2</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {activeProfile.normalSkills.map((skId) => {
                      const sk = HERO_SKILLS[skId];
                      const slotIdx =
                        localLoadout[0] === skId ? 1 : localLoadout[1] === skId ? 2 : 0;
                      return (
                        <button
                          key={skId}
                          type="button"
                          onClick={() => {
                            soundEngine.playUiTap();
                            setInspectedSkillId(skId);
                            if (slotIdx === 0) {
                              onSelectNormalSkill(skId);
                              setSlotPromptSkillId(skId);
                            } else {
                              setSlotPromptSkillId(skId);
                            }
                          }}
                          className={`relative flex min-h-[54px] flex-col items-center justify-center rounded-xl border p-1.5 text-center transition-all active:scale-95 ${
                            slotIdx > 0
                              ? 'border-emerald-400 bg-emerald-500/15 shadow-sm'
                              : 'border-stone-700/80 bg-stone-800/75 hover:bg-stone-700'
                          }`}
                        >
                          {slotIdx > 0 && (
                            <span className="absolute right-1 top-0.5 rounded bg-emerald-500/25 px-1 text-[9px] font-black text-emerald-300">
                              S{slotIdx}
                            </span>
                          )}
                          <SkillIcon skillId={skId} className="h-5 w-5" />
                          <span className="mt-1 line-clamp-1 text-[9px] font-semibold text-stone-200">
                            {sk.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Ultimate Skills (3 options, equip 1) */}
                <div className="sm:col-span-5">
                  <div className="mb-1.5 flex min-h-[26px] items-center text-[11px] font-semibold text-amber-300">
                    Ultimate Skill (Equip 1)
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {activeProfile.ultimateSkills.map((ultId) => {
                      const sk = HERO_SKILLS[ultId];
                      const equipped = localLoadout[2] === ultId;
                      return (
                        <button
                          key={ultId}
                          type="button"
                          onClick={() => {
                            soundEngine.playUiTap();
                            setInspectedSkillId(ultId);
                            onSelectUltimateSkill(ultId);
                          }}
                          className={`relative flex min-h-[54px] flex-col items-center justify-center rounded-xl border p-1.5 text-center transition-all active:scale-95 ${
                            equipped
                              ? 'border-amber-400 bg-amber-400/20 shadow-sm'
                              : 'border-stone-700/80 bg-stone-800/75 hover:bg-stone-700'
                          }`}
                        >
                          {equipped && (
                            <span className="absolute right-1 top-0.5 rounded bg-amber-400/25 px-1 text-[8px] font-black text-amber-200">
                              ULT
                            </span>
                          )}
                          <SkillIcon skillId={ultId} className="h-5 w-5" />
                          <span className="mt-1 line-clamp-1 text-[9px] font-semibold text-stone-100">
                            {sk.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Bottom Ready-Up & Launch Action Bar */}
      <footer className="shrink-0 border-t border-stone-800 bg-stone-950/95 px-3 py-2 backdrop-blur-md sm:px-5 sm:py-2.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                soundEngine.unlock();
                soundEngine.playUiTap();
                onToggleReady();
              }}
              className={`flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl px-5 text-xs font-bold shadow-lg transition-transform active:scale-95 sm:px-6 sm:text-sm ${
                isReady
                  ? 'border border-emerald-400/70 bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-amber-400 text-stone-950 hover:bg-amber-300'
              }`}
            >
              {isReady ? <Check className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
              <span>{isReady ? 'READY! (Tap to Unready)' : 'READY UP'}</span>
            </button>

            <div className="hidden items-center gap-2 rounded-xl border border-stone-800 bg-stone-900/90 px-3 py-1.5 text-xs md:flex">
              <SkillIcon
                skillId={activeProfile.basicSkillId || activeProfile.defaultLoadout[0]}
                className="h-4 w-4 shrink-0"
              />
              <span className="text-stone-400">Your Hero:</span>
              <span className="font-display font-bold text-stone-100">{activeProfile.name}</span>
              <span className="text-stone-500">·</span>
              <span className={activeTheme.textAccent}>{activeProfile.title}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isHost ? (
              <button
                type="button"
                disabled={!canStart}
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.playSkill('shield');
                  onStartGame();
                }}
                className={`flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl px-5 text-xs font-bold shadow-xl transition-all sm:px-7 sm:text-sm ${
                  canStart
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-stone-950 hover:from-emerald-400 hover:to-teal-300 active:scale-95'
                    : 'cursor-not-allowed border border-stone-700 bg-stone-800 text-stone-500 opacity-60'
                }`}
              >
                <Play className="h-4 w-4" />
                <span>START CO-OP RUN</span>
              </button>
            ) : (
              <span className="text-right text-xs font-medium text-stone-400">
                {allReady
                  ? 'Waiting for Host to launch…'
                  : 'Pick your hero & tap Ready Up!'}
              </span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
