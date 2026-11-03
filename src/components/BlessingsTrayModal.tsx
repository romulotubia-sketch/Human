import React from 'react';
import {
  X,
  Sparkles,
  Shield,
  Heart,
  Flame,
  Zap,
  Swords,
  Info,
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

interface BlessingsTrayModalProps {
  heroId: HeroId;
  blessings: Blessing[];
  maxBlessings: number;
  onClose: () => void;
}

export function BlessingsTrayModal({
  heroId,
  blessings,
  maxBlessings,
  onClose,
}: BlessingsTrayModalProps) {
  const heroProfile = HERO_PROFILES[heroId];

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-md animate-fade-in select-none">
      <div className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-2xl border border-stone-700 bg-gradient-to-b from-[#1b1512] to-[#0f0b09] p-4 shadow-2xl sm:p-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-amber-100 sm:text-xl">
                Active Dungeon Blessings
              </h2>
              <p className="text-xs text-stone-400">
                {heroProfile.name} · {blessings.length} of {maxBlessings} Blessings Earned
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={() => {
              soundEngine.playUiTap();
              onClose();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-700 bg-stone-900 text-stone-300 hover:bg-stone-800 hover:text-white active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* List of Acquired Blessings */}
        <div className="my-4 max-h-[60dvh] overflow-y-auto pr-1 flex flex-col gap-2.5">
          {blessings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-900 border border-stone-800 text-stone-500">
                <Info className="h-6 w-6" />
              </div>
              <h4 className="mt-3 text-sm font-semibold text-stone-300">
                No Blessings Earned Yet
              </h4>
              <p className="mt-1 max-w-sm text-xs text-stone-400 leading-relaxed">
                Pray at Ancient Statues encountered in the Crypt or defeat Floor Bosses to receive up to 6 strategic skill boons!
              </p>
            </div>
          ) : (
            blessings.map((blessing) => {
              const isEnhancement = blessing.type === 'enhancement';
              return (
                <div
                  key={blessing.id}
                  className="flex items-start gap-3 rounded-xl border border-stone-800/80 bg-stone-950/60 p-3 shadow-sm hover:border-stone-700"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-stone-700/80 bg-stone-900"
                    style={{ color: blessing.glowColor }}
                  >
                    {renderIcon(blessing.iconName, 'h-5 w-5')}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-bold text-amber-50">
                        {blessing.name}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          isEnhancement
                            ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                            : 'bg-violet-400/15 text-violet-300 border border-violet-400/30'
                        }`}
                      >
                        {blessing.typeLabel}
                      </span>
                      <span className="text-[11px] font-medium text-stone-400">
                        · Target: <strong className="text-stone-200">{blessing.skillName}</strong>
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-stone-300 leading-relaxed">
                      {blessing.description}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-stone-800 pt-3 text-xs text-stone-400">
          <span>Max capacity: 6 blessings per run</span>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiTap();
              onClose();
            }}
            className="rounded-lg bg-stone-800 px-4 py-1.5 text-xs font-semibold text-stone-200 hover:bg-stone-700 active:scale-95"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
