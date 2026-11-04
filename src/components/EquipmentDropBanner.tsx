import React, { useEffect, useState } from 'react';
import { Sparkles, Shield, Swords, Zap, Crown, Flame, Award } from 'lucide-react';
import { EquipmentDropPayload, EquipmentSlot } from '../types/equipment';
import { soundEngine } from '../audio/soundEngine';

interface EquipmentDropBannerProps {
  drop: EquipmentDropPayload | null;
  onDismiss: () => void;
}

export function EquipmentDropBanner({ drop, onDismiss }: EquipmentDropBannerProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (drop) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onDismiss, 350);
      }, 5500);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [drop, onDismiss]);

  if (!drop) return null;

  const item = drop.item;
  const col = drop.collection;

  const getSlotIcon = (slot: EquipmentSlot) => {
    switch (slot) {
      case 'weapon':
        return <Swords className="h-5 w-5 text-amber-400" />;
      case 'armor':
        return <Shield className="h-5 w-5 text-emerald-400" />;
      case 'spirit':
        return <Zap className="h-5 w-5 text-cyan-400" />;
      case 'ancient':
        return <Crown className="h-5 w-5 text-purple-400" />;
    }
  };

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[92vw] transition-all duration-300 pointer-events-auto select-none ${
        isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95 pointer-events-none'
      }`}
    >
      <div
        className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-r from-[#1f1510] via-[#291a13] to-[#1f1510] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.85)] ring-1 ring-amber-400/20 backdrop-blur-md"
        style={{
          boxShadow: `0 0 30px ${col.themeColor}33`,
        }}
      >
        {/* Glow accent bar at top */}
        <div
          className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent"
          style={{ backgroundColor: col.themeColor }}
        />

        <div className="flex items-start gap-3.5">
          {/* Icon frame */}
          <div
            className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-stone-900 shadow-inner"
            style={{
              borderColor: col.themeColor,
              boxShadow: `inset 0 0 12px ${col.themeColor}44`,
            }}
          >
            {getSlotIcon(item.slot)}
            <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
              <Award className="h-3 w-3" />
              <span>Dungeon Boss Relic Drop</span>
              {drop.isFirstDiscovery && (
                <span className="ml-auto rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-400/30">
                  NEW
                </span>
              )}
            </div>

            <h3 className="font-display text-base font-bold text-amber-100 truncate">
              {item.name}
            </h3>

            <p className="text-xs text-stone-300 font-medium">
              {col.name} · <span className="capitalize text-stone-400">{item.slot} Relic</span>
            </p>

            <p className="mt-1 text-xs text-amber-200/90 leading-snug line-clamp-2">
              {item.effectDescription}
            </p>

            <div className="mt-2 text-[10px] text-stone-400 italic">
              Stored in shared Equipment Inventory · Equip anytime inside dungeon
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiTap();
              setIsVisible(false);
              setTimeout(onDismiss, 300);
            }}
            className="text-stone-400 hover:text-stone-200 p-1 -mr-1 -mt-1 rounded-lg"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
