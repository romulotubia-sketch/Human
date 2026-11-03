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
}: BlessingSelectionModalProps) {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const heroProfile = HERO_PROFILES[heroId];

  const handleCardClick = (idx: number) => {
    setSelectedIdx(idx);
    soundEngine.playUiTap();
  };

  const handleConfirm = () => {
    const chosen = options[selectedIdx];
    if (!chosen) return;
    soundEngine.playSkill('shield');
    onSelectBlessing(chosen);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-md animate-fade-in select-none">
      <div className="relative flex max-h-[96dvh] w-full max-w-4xl flex-col items-center rounded-2xl border border-amber-500/40 bg-gradient-to-b from-[#1c1613] via-[#140e0b] to-[#0a0706] p-4 shadow-2xl sm:p-6">
        
        {/* Divine Halo Glow */}
        <div className="pointer-events-none absolute -top-16 left-1/2 h-32 w-72 -translate-x-1/2 rounded-full bg-amber-400/15 blur-3xl" />

        {/* Header */}
        <div className="relative z-10 flex w-full flex-col items-center text-center">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span className="font-mono-num text-[11px] font-bold uppercase tracking-widest text-amber-300">
              {heroProfile.name} · Ancient Statue Blessing
            </span>
            <Sparkles className="h-4 w-4 text-amber-300" />
          </div>

          <h2 className="font-display mt-0.5 text-2xl font-bold tracking-tight text-amber-50 sm:text-3xl">
            Choose a Divine Boon
          </h2>

          {/* Blessing Slot Pips */}
          <div className="mt-2 flex items-center gap-2 rounded-full border border-stone-800 bg-stone-950/80 px-3.5 py-1">
            <span className="text-[11px] font-medium text-stone-300">
              Blessings Claimed:
            </span>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: maxCount }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2.5 w-2.5 rotate-45 rounded-xs transition-colors duration-200 ${
                    i < currentCount
                      ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                      : i === currentCount
                        ? 'border border-amber-300 bg-amber-400/20'
                        : 'border border-stone-700 bg-stone-900'
                  }`}
                />
              ))}
            </div>
            <span className="font-mono-num text-[11px] font-bold text-amber-200">
              {currentCount} / {maxCount}
            </span>
          </div>
        </div>

        {/* 3 Blessing Cards Grid */}
        <div className="relative z-10 mt-4 grid w-full grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {options.map((blessing, idx) => {
            const isSelected = selectedIdx === idx;
            const isEnhancement = blessing.type === 'enhancement';

            return (
              <div
                key={blessing.id}
                onClick={() => handleCardClick(idx)}
                className={`group relative flex cursor-pointer flex-col justify-between rounded-xl border p-3.5 transition-all duration-150 active:scale-98 sm:p-4 ${
                  isSelected
                    ? isEnhancement
                      ? 'border-amber-400/90 bg-gradient-to-b from-amber-950/40 to-stone-950 shadow-[0_0_24px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/50'
                      : 'border-violet-400/90 bg-gradient-to-b from-violet-950/40 to-stone-950 shadow-[0_0_24px_rgba(168,85,247,0.25)] ring-1 ring-violet-400/50'
                    : 'border-stone-800 bg-stone-950/70 hover:border-stone-700 hover:bg-stone-900/60'
                }`}
              >
                {/* Type Badge */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                      isEnhancement
                        ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                        : 'bg-violet-400/15 text-violet-300 border border-violet-400/30'
                    }`}
                  >
                    {blessing.typeLabel}
                  </span>

                  {/* Radio checkmark */}
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                      isSelected
                        ? isEnhancement
                          ? 'border-amber-400 bg-amber-400 text-stone-950'
                          : 'border-violet-400 bg-violet-400 text-stone-950'
                        : 'border-stone-700 bg-stone-900 text-transparent'
                    }`}
                  >
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                </div>

                {/* Main Card Content */}
                <div className="my-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-700 bg-stone-900 shadow-inner"
                      style={{ color: blessing.glowColor }}
                    >
                      {renderIcon(blessing.iconName, 'h-5 w-5')}
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-bold text-stone-100 sm:text-base">
                        {blessing.name}
                      </h3>
                      <p className="text-[11px] font-medium text-amber-200/80">
                        {blessing.title}
                      </p>
                    </div>
                  </div>

                  {/* Target Skill Tag */}
                  <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-stone-900/90 px-2 py-1 text-[11px] text-stone-300">
                    <span className="text-stone-400">Target:</span>
                    <span className="font-semibold text-amber-100">
                      {blessing.skillName}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="mt-2 text-xs leading-relaxed text-stone-300 sm:text-[13px]">
                    {blessing.description}
                  </p>
                </div>

                {/* Bottom select prompt */}
                <div
                  className={`mt-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-colors ${
                    isSelected
                      ? isEnhancement
                        ? 'bg-amber-400 text-stone-950'
                        : 'bg-violet-400 text-stone-950'
                      : 'bg-stone-900 text-stone-400 group-hover:bg-stone-800 group-hover:text-stone-200'
                  }`}
                >
                  <span>{isSelected ? 'Selected' : 'Select'}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Confirm Footer */}
        <div className="relative z-10 mt-5 flex w-full items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            className="flex min-h-[46px] items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 px-8 py-2.5 text-sm font-bold text-stone-950 shadow-xl transition-transform duration-150 hover:brightness-105 active:scale-95"
          >
            <span>Claim Selected Blessing</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
