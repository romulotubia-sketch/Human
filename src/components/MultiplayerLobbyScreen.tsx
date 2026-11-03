import { ArrowLeftRight, Check, Copy, Crown, Play, Shield, SlidersHorizontal, User, X } from 'lucide-react';
import { useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { HERO_PROFILES, HERO_SKILLS } from '../data/heroSkills';
import { HeroId, NormalSkillId, SkillLoadout, UltimateSkillId } from '../types/game';
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
  onSwapNormalSlots: () => void;
  onSelectUltimateSkill: (skillId: UltimateSkillId) => void;
  onToggleReady: () => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  errorMessage?: string | null;
}

const HERO_LIST: HeroId[] = ['human', 'skeleton', 'zombie', 'ghoul', 'ghost', 'eaglekin'];

export function MultiplayerLobbyScreen({
  roomDetails,
  localPlayerId,
  isHost,
  localHeroId,
  localLoadout,
  onSelectHero,
  onSelectNormalSkill,
  onSwapNormalSlots,
  onSelectUltimateSkill,
  onToggleReady,
  onStartGame,
  onLeaveRoom,
  errorMessage,
}: MultiplayerLobbyScreenProps) {
  const [copied, setCopied] = useState(false);
  const [showBuildDrawer, setShowBuildDrawer] = useState(false);

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

  const playerCount = roomDetails.players.length;
  const allReady = playerCount >= 2 && roomDetails.players.every((p) => p.ready);
  const canStart = isHost && playerCount >= 2 && allReady;

  const activeProfile = HERO_PROFILES[localHeroId];

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-gradient-to-b from-[#1c140e] via-[#130d0a] to-[#0c0907] text-[#f5efe6] select-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-stone-800 bg-stone-950/80 px-4 py-2.5 backdrop-blur-md sm:px-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.playUiTap();
              onLeaveRoom();
            }}
            className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-900 px-3 py-1.5 text-xs font-semibold text-stone-300 hover:bg-stone-800 active:scale-95"
          >
            <X className="h-3.5 w-3.5" />
            <span>Leave</span>
          </button>

          <div>
            <span className="text-[10px] font-bold tracking-wider text-amber-400 uppercase">
              CO-OP EXPEDITION LOBBY
            </span>
            <h2 className="font-display text-sm font-bold text-stone-100 sm:text-base">
              The Bonehearth Guildhouse
            </h2>
          </div>
        </div>

        {/* Room Code & Copy Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1">
            <span className="hidden text-xs text-stone-300 sm:inline">Room Code:</span>
            <span className="font-mono text-base font-black tracking-widest text-amber-300">
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
            <span className="text-xs font-semibold text-emerald-400">Copied!</span>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="border-b border-rose-900/60 bg-rose-950/85 px-6 py-1.5 text-center text-xs font-semibold text-rose-200">
          {errorMessage}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5">
        <div className="mx-auto max-w-5xl">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-300">
              Squad Roster ({playerCount}/4 Heroes)
            </span>
            <span className="text-xs text-amber-300/90">
              {playerCount < 2
                ? 'Share Room Code — at least 2 players required to start'
                : allReady
                  ? 'All heroes ready! Host can launch the run.'
                  : 'Waiting for all squad members to Ready Up…'}
            </span>
          </div>

          {/* 4-Player Squad Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((slotIdx) => {
              const player = roomDetails.players[slotIdx];

              if (!player) {
                return (
                  <div
                    key={slotIdx}
                    className="flex min-h-[168px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-800/80 bg-stone-950/35 p-3 text-center"
                  >
                    <User className="h-7 w-7 text-stone-700" />
                    <span className="mt-1.5 text-xs font-semibold text-stone-500">
                      Open Ally Slot
                    </span>
                    <span className="text-[10px] text-stone-600">
                      Code: {roomDetails.roomCode}
                    </span>
                  </div>
                );
              }

              const profile = HERO_PROFILES[player.heroId] || HERO_PROFILES.human;
              const isMe = player.id === localPlayerId;

              return (
                <div
                  key={player.id}
                  className={`relative flex min-h-[168px] flex-col justify-between rounded-2xl border p-3 shadow-xl transition-all ${
                    player.ready
                      ? 'border-emerald-500/60 bg-gradient-to-b from-stone-900 to-emerald-950/35'
                      : 'border-stone-700/80 bg-stone-900/90'
                  } ${isMe ? 'ring-2 ring-amber-400/55' : ''}`}
                >
                  {/* Name & Ready Tag */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex min-w-0 items-center gap-1 text-[11px] font-bold text-amber-200">
                      {player.isHost && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                      <span className="truncate">{player.name}</span>
                      {isMe && <span className="shrink-0 text-[9px] text-stone-400">(You)</span>}
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

                  {/* Hero Emblem & Role */}
                  <div className="my-1.5 flex flex-col items-center text-center">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl border bg-stone-800 shadow-md ${
                        player.heroId === 'human'
                          ? 'border-orange-400/65'
                          : player.heroId === 'ghost'
                            ? 'border-indigo-400/65'
                            : player.heroId === 'ghoul'
                              ? 'border-rose-400/65'
                              : player.heroId === 'zombie'
                                ? 'border-lime-400/65'
                                : 'border-cyan-400/65'
                      }`}
                    >
                      <SkillIcon skillId={profile.basicSkillId || profile.defaultLoadout[0]} className="h-7 w-7" />
                    </div>
                    <span className="mt-1 font-display text-xs font-bold text-stone-100">
                      {profile.name}
                    </span>
                    <span className="text-[10px] text-stone-400">{profile.title}</span>
                  </div>

                  {/* Equipped 2 Normal + 1 Ultimate Skills */}
                  <div className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-800 bg-stone-950/65 px-2 py-1">
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

                  {isMe && (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiTap();
                        setShowBuildDrawer((prev) => !prev);
                      }}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400/40 bg-stone-800 py-1.5 text-[10px] font-semibold text-amber-200 hover:bg-stone-700 active:scale-95"
                    >
                      <SlidersHorizontal className="h-3 w-3" />
                      <span>{showBuildDrawer ? 'Hide Hero & Skills' : 'Hero & Skills'}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Compact Landscape Hero + Loadout Customizer Drawer */}
          {showBuildDrawer && (
            <div className="mt-3 rounded-2xl border border-amber-500/40 bg-stone-900/95 p-3.5 shadow-2xl">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-amber-200">
                  Customize Your Hero &amp; 3-Skill Loadout
                </span>
                <button
                  type="button"
                  onClick={() => setShowBuildDrawer(false)}
                  className="rounded-lg bg-stone-800 px-2.5 py-1 text-[11px] font-semibold text-stone-300 hover:text-white"
                >
                  Done
                </button>
              </div>

              {/* Heroes Selector Grouped by Category */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {/* Default Character */}
                <div className="flex flex-col gap-1 rounded-xl border border-stone-800 bg-stone-950/40 p-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 px-1">
                    Default Character
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.unlock();
                      soundEngine.playUiTap();
                      onSelectHero('human');
                    }}
                    className={`flex items-center gap-2 rounded-lg border p-1.5 text-left transition-all ${
                      localHeroId === 'human'
                        ? 'border-orange-400 bg-orange-400/15 shadow-sm'
                        : 'border-stone-800 bg-stone-900/80 hover:bg-stone-800'
                    }`}
                  >
                    <SkillIcon skillId={HERO_PROFILES.human.basicSkillId || HERO_PROFILES.human.defaultLoadout[0]} className="h-6 w-6 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-display text-xs font-bold text-stone-100">Human</div>
                      <div className="text-[10px] text-stone-400">Pipe Brawler</div>
                    </div>
                  </button>
                </div>

                {/* Undead Legion */}
                <div className="flex flex-col gap-1 rounded-xl border border-purple-900/40 bg-purple-950/15 p-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400/90 px-1">
                    Undead Legion
                  </span>
                  <div className="grid grid-cols-2 gap-1">
                    {(['skeleton', 'zombie', 'ghoul', 'ghost'] as HeroId[]).map((hId) => {
                      const prof = HERO_PROFILES[hId];
                      const selected = localHeroId === hId;
                      return (
                        <button
                          key={hId}
                          type="button"
                          onClick={() => {
                            soundEngine.unlock();
                            soundEngine.playUiTap();
                            onSelectHero(hId);
                          }}
                          className={`flex items-center gap-1.5 rounded-lg border p-1 text-left transition-all ${
                            selected
                              ? 'border-purple-400 bg-purple-400/20 shadow-sm'
                              : 'border-stone-800 bg-stone-900/80 hover:bg-stone-800'
                          }`}
                        >
                          <SkillIcon skillId={prof.basicSkillId || prof.defaultLoadout[0]} className="h-5 w-5 shrink-0" />
                          <span className="truncate font-display text-[11px] font-bold text-stone-100">
                            {prof.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Wildborn Tribes */}
                <div className="flex flex-col gap-1 rounded-xl border border-sky-900/40 bg-sky-950/15 p-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400/90 px-1">
                    Wildborn Tribes
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.unlock();
                      soundEngine.playUiTap();
                      onSelectHero('eaglekin');
                    }}
                    className={`flex items-center gap-2 rounded-lg border p-1.5 text-left transition-all ${
                      localHeroId === 'eaglekin'
                        ? 'border-sky-400 bg-sky-400/20 shadow-sm'
                        : 'border-stone-800 bg-stone-900/80 hover:bg-stone-800'
                    }`}
                  >
                    <SkillIcon skillId={HERO_PROFILES.eaglekin.basicSkillId || HERO_PROFILES.eaglekin.defaultLoadout[0]} className="h-6 w-6 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-display text-xs font-bold text-stone-100">Eaglekin</div>
                      <div className="text-[10px] text-sky-300">Sky Marksman</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Normal Skills (Choose 2) & Ultimate Skill (Choose 1) */}
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-stone-300">
                      Normal Skills (Tap to Equip 2)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiTap();
                        onSwapNormalSlots();
                      }}
                      className="flex items-center gap-1 rounded bg-stone-800 px-2 py-0.5 text-[10px] font-semibold text-amber-300 hover:bg-stone-700"
                    >
                      <ArrowLeftRight className="h-3 w-3" />
                      <span>Swap Slots 1/2</span>
                    </button>
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
                            onSelectNormalSkill(skId);
                          }}
                          className={`relative flex flex-col items-center rounded-xl border p-1.5 text-center transition-all ${
                            slotIdx > 0
                              ? 'border-emerald-400 bg-emerald-500/15'
                              : 'border-stone-700 bg-stone-800/75 hover:bg-stone-700'
                          }`}
                        >
                          {slotIdx > 0 && (
                            <span className="absolute right-1 top-0.5 text-[9px] font-black text-emerald-300">
                              S{slotIdx}
                            </span>
                          )}
                          <SkillIcon skillId={skId} className="h-5 w-5" />
                          <span className="mt-1 line-clamp-1 text-[9px] font-medium text-stone-200">
                            {sk.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[11px] font-semibold text-amber-300">
                    Ultimate Skill (Choose 1)
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
                            onSelectUltimateSkill(ultId);
                          }}
                          className={`flex flex-col items-center rounded-xl border p-1.5 text-center transition-all ${
                            equipped
                              ? 'border-amber-400 bg-amber-400/20'
                              : 'border-stone-700 bg-stone-800/75 hover:bg-stone-700'
                          }`}
                        >
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
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="border-t border-stone-800 bg-stone-950/90 px-4 py-2.5 backdrop-blur-md sm:px-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.playUiTap();
              onToggleReady();
            }}
            className={`flex min-h-[44px] items-center gap-2 rounded-xl px-6 text-sm font-bold shadow-lg transition-transform active:scale-95 ${
              isReady
                ? 'border border-emerald-500/60 bg-emerald-600 text-white hover:bg-emerald-500'
                : 'bg-amber-400 text-stone-950 hover:bg-amber-300'
            }`}
          >
            {isReady ? <Check className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
            <span>{isReady ? 'READY! (Tap to Unready)' : 'READY UP'}</span>
          </button>

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
                className={`flex min-h-[44px] items-center gap-2 rounded-xl px-7 text-sm font-bold shadow-xl transition-all ${
                  canStart
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-stone-950 hover:from-emerald-400 hover:to-teal-300 active:scale-95'
                    : 'cursor-not-allowed border border-stone-700 bg-stone-800 text-stone-500 opacity-60'
                }`}
              >
                <Play className="h-4 w-4" />
                <span>START CO-OP RUN</span>
              </button>
            ) : (
              <span className="text-xs font-medium text-stone-400">
                {allReady
                  ? 'Waiting for Host to launch the dungeon…'
                  : 'Ready up when your build is set!'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
