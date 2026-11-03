import { Check, Copy, Crown, Play, Shield, Sparkles, User, UserCheck, Users, X } from 'lucide-react';
import React, { useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { HERO_PROFILES } from '../data/heroSkills';
import { HeroId, NormalSkillId, SkillLoadout, UltimateSkillId } from '../types/game';
import { LobbyPlayer, RoomDetails } from '../types/multiplayer';
import { SkillIcon } from './SkillIcon';

interface MultiplayerLobbyScreenProps {
  roomDetails: RoomDetails;
  localPlayerId: string;
  isHost: boolean;
  localHeroId: HeroId;
  localLoadout: SkillLoadout;
  onSelectHero: (heroId: HeroId) => void;
  onToggleReady: () => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  errorMessage?: string | null;
}

const HERO_LIST: HeroId[] = ['human', 'skeleton', 'zombie', 'ghoul', 'ghost'];

export function MultiplayerLobbyScreen({
  roomDetails,
  localPlayerId,
  isHost,
  localHeroId,
  localLoadout,
  onSelectHero,
  onToggleReady,
  onStartGame,
  onLeaveRoom,
  errorMessage,
}: MultiplayerLobbyScreenProps) {
  const [copied, setCopied] = useState(false);
  const [showHeroPicker, setShowHeroPicker] = useState(false);

  const localPlayer = roomDetails.players.find((p) => p.id === localPlayerId);
  const isReady = localPlayer?.ready ?? false;

  const handleCopyCode = () => {
    soundEngine.unlock();
    soundEngine.playUiTap();
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(roomDetails.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }
  };

  const playerCount = roomDetails.players.length;
  const allReady = roomDetails.players.every((p) => p.ready);
  const canStart = isHost && playerCount >= 2 && allReady;

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-gradient-to-b from-[#1c140e] via-[#130d0a] to-[#0c0907] text-[#f5efe6] select-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-stone-800 bg-stone-950/75 px-5 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.playUiTap();
              onLeaveRoom();
            }}
            className="flex items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-900 px-3 py-1.5 text-xs font-semibold text-stone-300 hover:bg-stone-800"
          >
            <X className="h-3.5 w-3.5" />
            Leave
          </button>

          <div>
            <span className="text-[10px] font-bold tracking-wider text-amber-400 uppercase">
              CO-OP LOBBY
            </span>
            <h2 className="font-display text-base font-bold text-stone-100">
              The Bonehearth Guildhouse
            </h2>
          </div>
        </div>

        {/* Room Code Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5">
            <span className="text-xs text-stone-300">Room Code:</span>
            <span className="font-mono text-base font-black tracking-widest text-amber-300">
              {roomDetails.roomCode}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              title="Copy Room Code"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/20 text-amber-200 transition-colors hover:bg-amber-400/30"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          {copied && (
            <span className="animate-fade-in text-xs font-semibold text-emerald-400">
              Copied!
            </span>
          )}
        </div>
      </div>

      {/* Error banner */}
      {errorMessage && (
        <div className="border-b border-rose-900/60 bg-rose-950/80 px-6 py-2 text-center text-xs font-semibold text-rose-200">
          {errorMessage}
        </div>
      )}

      {/* Main 4-Slot Player Roster */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-400">
              Squad Members ({playerCount}/4)
            </span>
            <span className="text-xs text-amber-300/80">
              {playerCount < 2 ? 'Requires at least 2 players to start' : allReady ? 'All ready to descend!' : 'Waiting for everyone to Ready Up...'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            {[0, 1, 2, 3].map((slotIdx) => {
              const player = roomDetails.players[slotIdx];

              if (!player) {
                return (
                  <div
                    key={slotIdx}
                    className="flex min-h-[175px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-800/80 bg-stone-950/30 p-4 text-center"
                  >
                    <User className="h-8 w-8 text-stone-700" />
                    <span className="mt-2 text-xs font-semibold text-stone-600">
                      Empty Slot
                    </span>
                    <span className="text-[10px] text-stone-700">Waiting for ally...</span>
                  </div>
                );
              }

              const profile = HERO_PROFILES[player.heroId] || HERO_PROFILES.human;
              const isMe = player.id === localPlayerId;

              return (
                <div
                  key={player.id}
                  className={`relative flex min-h-[175px] flex-col justify-between rounded-2xl border p-3.5 shadow-xl transition-all ${
                    player.ready
                      ? 'border-emerald-500/60 bg-gradient-to-b from-stone-900 to-emerald-950/30 shadow-[0_0_20px_rgba(16,185,129,0.12)]'
                      : 'border-stone-700/80 bg-stone-900/90'
                  } ${isMe ? 'ring-2 ring-amber-400/50' : ''}`}
                >
                  {/* Top badges */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-300">
                      {player.isHost && <Crown className="h-3.5 w-3.5 text-amber-400" />}
                      <span className="truncate max-w-[85px]">{player.name}</span>
                      {isMe && <span className="text-[9px] text-stone-400">(You)</span>}
                    </span>

                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase ${
                        player.ready
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {player.ready ? 'READY' : 'WAITING'}
                    </span>
                  </div>

                  {/* Character visual */}
                  <div className="my-2 flex flex-col items-center text-center">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-stone-600 bg-stone-800 shadow-md ${
                        player.heroId === 'human'
                          ? 'border-orange-400/60'
                          : player.heroId === 'ghost'
                            ? 'border-indigo-400/60'
                            : player.heroId === 'ghoul'
                              ? 'border-rose-400/60'
                              : player.heroId === 'zombie'
                                ? 'border-lime-400/60'
                                : 'border-cyan-400/60'
                      }`}
                    >
                      <SkillIcon
                        skillId={
                          player.heroId === 'human'
                            ? 'basic_pipe'
                            : player.heroId === 'ghost'
                              ? 'basic_ghost'
                              : player.heroId === 'ghoul'
                                ? 'basic_ghoul'
                                : player.heroId === 'zombie'
                                  ? 'basic_claw'
                                  : 'basic_sword'
                        }
                        className="h-8 w-8"
                      />
                    </div>
                    <span className="mt-1.5 font-display text-xs font-bold text-stone-200">
                      {profile.name}
                    </span>
                    <span className="text-[10px] text-stone-400">{profile.title}</span>
                  </div>

                  {/* Skills Preview */}
                  <div className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-800 bg-stone-950/60 py-1">
                    {player.loadout.map((skId, idx) => (
                      <div key={idx} className="flex h-5 w-5 items-center justify-center">
                        <SkillIcon skillId={skId} className="h-4 w-4" />
                      </div>
                    ))}
                  </div>

                  {/* Change Hero button for local player */}
                  {isMe && (
                    <button
                      type="button"
                      onClick={() => setShowHeroPicker(!showHeroPicker)}
                      className="mt-2 w-full rounded-lg bg-stone-800 py-1 text-[10px] font-semibold text-amber-300 hover:bg-stone-700"
                    >
                      Change Hero
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Hero Picker Dropdown for Local Player */}
          {showHeroPicker && (
            <div className="mt-4 rounded-2xl border border-amber-500/40 bg-stone-900/95 p-4 shadow-xl">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-bold text-amber-200">Select Your Hero:</span>
                <button
                  type="button"
                  onClick={() => setShowHeroPicker(false)}
                  className="text-xs text-stone-400 hover:text-stone-200"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {HERO_LIST.map((hId) => {
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
                        setShowHeroPicker(false);
                      }}
                      className={`flex flex-col items-center rounded-xl border p-2.5 text-center transition-all ${
                        selected
                          ? 'border-amber-400 bg-amber-400/15 shadow-md'
                          : 'border-stone-700 bg-stone-800/80 hover:bg-stone-700'
                      }`}
                    >
                      <SkillIcon
                        skillId={
                          hId === 'human'
                            ? 'basic_pipe'
                            : hId === 'ghost'
                              ? 'basic_ghost'
                              : hId === 'ghoul'
                                ? 'basic_ghoul'
                                : hId === 'zombie'
                                  ? 'basic_claw'
                                  : 'basic_sword'
                        }
                        className="h-6 w-6"
                      />
                      <span className="mt-1 font-display text-xs font-bold text-stone-100">
                        {prof.name}
                      </span>
                      <span className="text-[9px] text-stone-400">{prof.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="border-t border-stone-800 bg-stone-950/90 px-5 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.unlock();
                soundEngine.playUiTap();
                onToggleReady();
              }}
              className={`flex min-h-[46px] items-center gap-2 rounded-xl px-7 text-sm font-bold shadow-lg transition-transform active:scale-95 ${
                isReady
                  ? 'border border-emerald-500/60 bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-amber-400 text-stone-950 hover:bg-amber-300'
              }`}
            >
              {isReady ? <Check className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
              {isReady ? 'READY!' : 'READY UP'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            {isHost && (
              <button
                type="button"
                disabled={!canStart}
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.playSkill('shield');
                  onStartGame();
                }}
                className={`flex min-h-[46px] items-center gap-2 rounded-xl px-8 text-sm font-bold shadow-xl transition-all ${
                  canStart
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-stone-950 hover:from-emerald-400 hover:to-teal-300 active:scale-95'
                    : 'border border-stone-700 bg-stone-800 text-stone-500 cursor-not-allowed opacity-60'
                }`}
              >
                <Play className="h-4 w-4" />
                START CO-OP RUN
              </button>
            )}

            {!isHost && (
              <span className="text-xs font-medium text-stone-400">
                Waiting for host to start the run...
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
