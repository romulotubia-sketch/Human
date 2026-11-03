import React, { useState } from 'react';
import {
  Sparkles,
  Zap,
  Shield,
  Heart,
  Flame,
  Swords,
  Check,
  ArrowRight,
  Compass,
  Crosshair,
  Activity,
  RotateCcw,
  Users,
  X,
} from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { Blessing } from '../types/blessing';
import { HeroId } from '../types/game';
import { HERO_PROFILES } from '../data/heroSkills';

interface BlessingSelectionModalProps {
  heroId: HeroId;
  options: Blessing[];
  currentCount: number;
  maxCount: number;
  onSelectBlessing: (blessing: Blessing) => void;
  onClose?: () => void;
}

export function BlessingSelectionModal({
  heroId,
  options,
  currentCount,
  maxCount,
  onSelectBlessing,
  onClose,
}: BlessingSelectionModalProps) {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const heroProfile = HERO_PROFILES[heroId];

  const handleClaim = (blessing?: Blessing) => {
    const chosen = blessing || options[selectedIdx] || options[0];
    if (!chosen) {
      onClose?.();
      return;
    }
    soundEngine.playSkill('shield');
    onSelectBlessing(chosen);
  };

  const handleCardClick = (idx: number, blessing: Blessing) => {
    if (selectedIdx === idx) {
      // Tapping already-selected card immediately claims it
      handleClaim(blessing);
    } else {
      setSelectedIdx(idx);
      soundEngine.playUiTap();
    }
  };

  const renderIcon = (name: string, className: string) => {
    switch (name) {
      case 'Shield':
        return <Shield className={className} />;
      case 'Heart':
        return <Heart className={className} />;
      case 'Flame':
        return <Flame className={className} />;
      case 'Zap':
        return <Zap className={className} />;
      case 'Swords':
        return <Swords className={className} />;
      case 'Compass':
        return <Compass className={className} />;
      case 'Crosshair':
        return <Crosshair className={className} />;
      case 'Activity':
        return <Activity className={className} />;
      case 'RotateCcw':
        return <RotateCcw className={className} />;
      case 'Users':
        return <Users className={className} />;
      default:
        return <Sparkles className={className} />;
    }
  };

  const selectedBlessing = options[selectedIdx] || options[0];

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-3 backdrop-blur-md select-none animate-in fade-in duration-150">
      <div className="relative flex h-full max-h-[390px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-amber-500/40 bg-[#16110e] text-stone-100 shadow-2xl">
        {/* Divine Background Ambient Glow */}
        <div className="pointer-events-none absolute -top-12 left-1/2 h-24 w-80 -translate-x-1/2 rounded-full bg-amber-400/15 blur-2xl" />

        {/* Compact Top Header Bar */}
        <div className="relative z-10 flex h-10 shrink-0 items-center justify-between border-b border-stone-800/80 px-3 sm:px-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-300" />
            <h2 className="font-display text-sm font-bold text-amber-100 sm:text-base">
              Choose a Divine Blessing
            </h2>
            <div className="ml-1.5 flex items-center gap-1 rounded-full border border-stone-800 bg-stone-900/90 px-2 py-0.5">
              <span className="font-mono-num text-[10px] font-bold text-amber-300">
                {currentCount}/{maxCount}
              </span>
              <span className="text-[10px] text-stone-400">Claimed</span>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiTap();
                onClose();
              }}
              aria-label="Skip Blessing"
              className="flex h-7 items-center gap-1 rounded-lg border border-stone-800 bg-stone-900/80 px-2 text-[11px] font-medium text-stone-400 transition-colors hover:border-stone-700 hover:text-stone-200 active:scale-95"
            >
              <X className="h-3.5 w-3.5" />
              <span>Skip</span>
            </button>
          )}
        </div>

        {/* 3 Compact Blessing Cards Grid */}
        <div className="relative z-10 grid min-h-0 flex-1 grid-cols-3 gap-2 overflow-hidden p-2 sm:gap-2.5 sm:p-3">
          {options.map((blessing, idx) => {
            const isSelected = selectedIdx === idx;
            const isEnhancement = blessing.type === 'enhancement';

            return (
              <div
                key={blessing.id}
                onClick={() => handleCardClick(idx, blessing)}
                className={`group relative flex cursor-pointer flex-col justify-between rounded-xl border p-2.5 transition-all active:scale-[0.99] sm:p-3 ${
                  isSelected
                    ? isEnhancement
                      ? 'border-amber-400 bg-gradient-to-b from-amber-950/40 via-stone-900/90 to-stone-950 shadow-[0_0_18px_rgba(245,158,11,0.2)] ring-1 ring-amber-400/50'
                      : 'border-violet-400 bg-gradient-to-b from-violet-950/40 via-stone-900/90 to-stone-950 shadow-[0_0_18px_rgba(168,85,247,0.2)] ring-1 ring-violet-400/50'
                    : 'border-stone-800/90 bg-stone-950/70 hover:border-stone-700 hover:bg-stone-900/60'
                }`}
              >
                {/* Top Badge Strip */}
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      isEnhancement
                        ? 'border border-amber-400/30 bg-amber-400/15 text-amber-300'
                        : 'border border-violet-400/30 bg-violet-400/15 text-violet-300'
                    }`}
                  >
                    {blessing.typeLabel}
                  </span>

                  <span className="truncate rounded bg-stone-900/90 px-1.5 py-0.5 text-[9px] font-medium text-stone-300">
                    {blessing.skillName}
                  </span>
                </div>

                {/* Main Content Area */}
                <div className="my-1 flex min-h-0 flex-1 flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-700/80 bg-stone-900 shadow-inner"
                      style={{ color: blessing.glowColor || '#fde047' }}
                    >
                      {renderIcon(blessing.iconName, 'h-4 w-4')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display truncate text-xs font-bold text-amber-50 sm:text-sm">
                        {blessing.name}
                      </h3>
                      <p className="truncate text-[10px] font-medium text-amber-200/80">
                        {blessing.title}
                      </p>
                    </div>
                  </div>

                  {/* Concise Description */}
                  <p className="mt-1.5 line-clamp-2 text-[10.5px] leading-snug text-stone-300 sm:line-clamp-3 sm:text-[11px]">
                    {blessing.description}
                  </p>
                </div>

                {/* Direct Action Button per Card */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClaim(blessing);
                  }}
                  className={`flex h-7 w-full items-center justify-center gap-1 rounded-lg text-xs font-bold transition-transform active:scale-95 ${
                    isSelected
                      ? isEnhancement
                        ? 'bg-amber-400 text-stone-950 shadow-md hover:bg-amber-300'
                        : 'bg-violet-400 text-stone-950 shadow-md hover:bg-violet-300'
                      : 'border border-stone-700 bg-stone-900/90 text-stone-300 hover:border-amber-400/60 hover:text-white'
                  }`}
                >
                  {isSelected ? (
                    <>
                      <span>Claim Blessing</span>
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                    </>
                  ) : (
                    <span>Select & Claim</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Compact Footer Bar */}
        <div className="relative z-10 flex h-11 shrink-0 items-center justify-between border-t border-stone-800/80 bg-stone-950/70 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-[11px] text-stone-400">Selected:</span>
            <span className="truncate text-xs font-bold text-amber-200">
              {selectedBlessing ? selectedBlessing.name : 'Choose a boon'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onClose && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiTap();
                  onClose();
                }}
                className="h-8 rounded-lg px-3 text-xs font-medium text-stone-400 hover:text-stone-200"
              >
                Skip
              </button>
            )}

            <button
              type="button"
              onClick={() => handleClaim(selectedBlessing)}
              className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 px-5 text-xs font-bold text-stone-950 shadow-lg transition-transform hover:brightness-105 active:scale-95"
            >
              <span>Confirm & Claim</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
