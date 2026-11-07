import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  X,
  Hammer,
  Flame,
  Sparkles,
  Shield,
  Swords,
  Zap,
  Crown,
  Disc,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lock,
  Package,
} from 'lucide-react';
import {
  ALL_EQUIPMENT_ITEMS,
  EQUIPMENT_BY_ID,
  EQUIPMENT_COLLECTIONS,
  getEnhancementCost,
  getEnhancementSuccessRate,
  getNextMilestone,
  getUnlockedMilestones,
} from '../data/equipmentData';
import {
  ALL_EQUIPMENT_SLOTS,
  EquipmentItemDef,
  EquipmentSlot,
  EQUIPMENT_SLOT_LABELS,
} from '../types/equipment';
import { HeroId } from '../types/game';
import { equipmentManager } from '../game/equipmentManager';
import { soundEngine } from '../audio/soundEngine';

interface BlacksmithModalProps {
  heroId: HeroId;
  boneShards: number;
  onEnhance: (itemId: string) => {
    success: boolean;
    newLevel: number;
    cost: number;
    milestoneUnlocked?: string;
    error?: string;
  };
  onClose: () => void;
  onEquipmentChanged?: () => void;
}

export function BlacksmithModal({
  heroId,
  boneShards,
  onEnhance,
  onClose,
  onEquipmentChanged,
}: BlacksmithModalProps) {
  const [selectedSlotFilter, setSelectedSlotFilter] = useState<EquipmentSlot | 'all'>('all');
  const [selectedItemId, setSelectedItemId] = useState<string>(() => {
    const loadout = equipmentManager.getEquippedForHero(heroId);
    return (
      loadout.weapon ||
      loadout.armor ||
      loadout.spirit ||
      loadout.ancient ||
      loadout.accessory ||
      loadout.core ||
      ''
    );
  });
  const [mobileTab, setMobileTab] = useState<'relics' | 'forge'>('forge');

  const [isForging, setIsForging] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    itemName: string;
    level: number;
    cost: number;
    milestone?: string;
  } | null>(null);
  const [showHighLevelConfirm, setShowHighLevelConfirm] = useState(false);

  // Trigger state update
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const snapshot = equipmentManager.getSnapshot(heroId);
  const loadout = equipmentManager.getEquippedForHero(heroId);

  // All owned equipment
  const ownedItems = useMemo(() => {
    return ALL_EQUIPMENT_ITEMS.filter((item) =>
      snapshot.ownedEquipmentIds.includes(item.id)
    );
  }, [snapshot.ownedEquipmentIds]);

  const filteredItems = useMemo(() => {
    if (selectedSlotFilter === 'all') return ownedItems;
    return ownedItems.filter((item) => item.slot === selectedSlotFilter);
  }, [ownedItems, selectedSlotFilter]);

  const selectedItem: EquipmentItemDef | null =
    EQUIPMENT_BY_ID[selectedItemId] || (ownedItems[0] ?? null);

  const currentLevel = selectedItem
    ? equipmentManager.getEnhancementLevel(selectedItem.id)
    : 0;
  const cost = getEnhancementCost(currentLevel);
  const successRate = getEnhancementSuccessRate(currentLevel);
  const successPercent = Math.round(successRate * 100);
  const canAfford = boneShards >= cost;
  const isHighLevel = currentLevel >= 6;

  const unlockedMilestones = selectedItem
    ? getUnlockedMilestones(selectedItem, currentLevel)
    : [];
  const nextMilestoneDef = selectedItem
    ? selectedItem.milestones.find((m) => m.level === currentLevel + 1)
    : null;
  const futureMilestone = selectedItem
    ? getNextMilestone(selectedItem, currentLevel)
    : null;
  const collection = selectedItem
    ? EQUIPMENT_COLLECTIONS[selectedItem.collection]
    : null;

  const isEquipped = selectedItem
    ? loadout[selectedItem.slot] === selectedItem.id
    : false;

  const getSlotIcon = (slot: EquipmentSlot, className = 'h-3.5 w-3.5') => {
    switch (slot) {
      case 'weapon':
        return <Swords className={className} />;
      case 'armor':
        return <Shield className={className} />;
      case 'spirit':
        return <Zap className={className} />;
      case 'ancient':
        return <Crown className={className} />;
      case 'accessory':
        return <Sparkles className={className} />;
      case 'core':
        return <Disc className={className} />;
    }
  };

  const handleEnhanceClick = () => {
    if (!selectedItem || !canAfford || isForging) return;

    if (isHighLevel && !showHighLevelConfirm) {
      setShowHighLevelConfirm(true);
      return;
    }

    setShowHighLevelConfirm(false);
    setIsForging(true);
    soundEngine.playPipeClang(1.1, false);

    setTimeout(() => {
      const res = onEnhance(selectedItem.id);
      setIsForging(false);
      refresh();
      onEquipmentChanged?.();

      if (res.success) {
        soundEngine.playPickup();
        setLastResult({
          success: true,
          itemName: selectedItem.name,
          level: res.newLevel,
          cost: res.cost,
          milestone: res.milestoneUnlocked,
        });
      } else {
        soundEngine.playUiTap();
        setLastResult({
          success: false,
          itemName: selectedItem.name,
          level: currentLevel,
          cost: res.cost,
        });
      }
    }, 380);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 p-1 sm:p-2.5 backdrop-blur-md select-none overflow-hidden">
      {/* Fixed Compact Container: Guaranteed to fit in viewport without outer or inner scrolling */}
      <div className="relative flex w-full max-w-4xl h-[92dvh] max-h-[440px] sm:max-h-[430px] flex-col rounded-2xl border border-orange-500/40 bg-gradient-to-b from-[#1a120c] via-[#120d09] to-[#0a0705] shadow-2xl text-stone-200 overflow-hidden shrink-0">
        
        {/* ================= HEADER BAR (Height: 38px with prominent Back button) ================= */}
        <div className="flex h-[38px] shrink-0 items-center justify-between border-b border-orange-950/80 bg-gradient-to-r from-orange-950/90 via-[#18100b] to-stone-950 px-2 sm:px-3.5 gap-1.5 z-20">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Prominent Back Button matching EquipmentModal styling */}
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiTap();
                onClose();
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl border border-orange-500/60 bg-gradient-to-r from-orange-950/90 to-stone-900 hover:from-orange-900/90 hover:to-stone-800 text-orange-200 hover:text-white font-bold text-xs shadow-md transition-all active:scale-95 shrink-0"
              aria-label="Back to Game"
            >
              <ArrowLeft className="h-4 w-4 text-orange-400 shrink-0" />
              <span>Back</span>
            </button>

            <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-orange-500/50 bg-orange-950/80 text-orange-400 shadow-sm shrink-0">
              <Hammer className="h-3.5 w-3.5" />
            </div>
            <h2 className="font-display text-xs sm:text-sm font-bold text-amber-100 truncate">
              Master Grimforge
            </h2>
            <span className="text-[8.5px] uppercase font-bold px-1.5 py-0.2 rounded border border-orange-500/40 bg-orange-950/60 text-orange-300 hidden md:inline shrink-0">
              Cryptfire Forge
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Mobile Tab Switcher */}
            <div className="flex sm:hidden bg-stone-950/90 border border-stone-800 rounded-lg p-0.5 text-[9.5px] font-semibold">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiTap();
                  setMobileTab('relics');
                }}
                className={`px-1.5 py-0.5 rounded transition-all ${
                  mobileTab === 'relics'
                    ? 'bg-orange-500/25 text-orange-300 border border-orange-500/40 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Relics ({ownedItems.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiTap();
                  setMobileTab('forge');
                }}
                className={`px-1.5 py-0.5 rounded transition-all ${
                  mobileTab === 'forge'
                    ? 'bg-orange-500/25 text-orange-300 border border-orange-500/40 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Forge
              </button>
            </div>

            {/* Current Boneshard Balance */}
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg border border-cyan-500/40 bg-cyan-950/60 shadow-inner">
              <Sparkles className="h-3 w-3 text-cyan-400 animate-pulse" />
              <span className="text-[8px] uppercase font-bold text-cyan-300/80 hidden sm:inline">
                Shards:
              </span>
              <span className="font-mono-num font-bold text-xs text-cyan-100">
                {boneShards}
              </span>
            </div>

            <button
              type="button"
              aria-label="Close"
              onClick={() => {
                soundEngine.playUiTap();
                onClose();
              }}
              className="flex h-6 w-6 items-center justify-center rounded-lg border border-stone-700 bg-stone-900 text-stone-300 hover:bg-stone-800 hover:text-white transition-all active:scale-95"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ================= MAIN ZERO-SCROLL BODY ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-12 flex-1 min-h-0 overflow-hidden p-1.5 sm:p-2.5 gap-1.5 sm:gap-2">
          
          {/* LEFT PANE: Relic Selector (5 cols on desktop, responsive tab on mobile) */}
          <div className={`sm:col-span-5 flex-col min-h-0 rounded-xl border border-stone-800 bg-stone-950/70 p-1.5 overflow-hidden ${
            mobileTab === 'relics' ? 'flex' : 'hidden sm:flex'
          }`}>
            {/* Slot Filter Bar */}
            <div className="flex items-center justify-between border-b border-stone-800/80 pb-1 mb-1 gap-1 shrink-0">
              <span className="text-[9.5px] font-bold text-amber-200 uppercase tracking-wider flex items-center gap-1 shrink-0">
                <Shield className="h-2.5 w-2.5 text-amber-400" />
                Relics ({ownedItems.length})
              </span>

              {/* Compact Slot Filter Buttons */}
              <div className="flex items-center gap-0.5 overflow-x-auto">
                {(['all', ...ALL_EQUIPMENT_SLOTS] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSlotFilter(s)}
                    className={`px-1 py-0.2 rounded text-[7.5px] font-bold uppercase transition-all whitespace-nowrap ${
                      selectedSlotFilter === s
                        ? 'bg-orange-500/30 text-orange-300 border border-orange-500/50'
                        : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
                    }`}
                  >
                    {s === 'all' ? 'All' : s.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            {/* List of Owned Relics: Compact cards fitting smoothly */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-1">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-3 text-stone-500">
                  <Package className="h-6 w-6 text-stone-700 mb-1" />
                  <p className="text-[10px] text-stone-300 font-semibold">
                    {ownedItems.length === 0
                      ? 'No relics in inventory.'
                      : `No ${selectedSlotFilter} relics found.`}
                  </p>
                  <p className="text-[8.5px] text-stone-500 mt-0.5">
                    Defeat Corrupted Hero bosses in crypts to collect relics!
                  </p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const itemLvl = equipmentManager.getEnhancementLevel(item.id);
                  const isSelected = selectedItemId === item.id;
                  const col = EQUIPMENT_COLLECTIONS[item.collection];
                  const equippedHere = loadout[item.slot] === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playUiTap();
                        setSelectedItemId(item.id);
                        setLastResult(null);
                        setShowHighLevelConfirm(false);
                        setMobileTab('forge');
                      }}
                      className={`w-full flex items-center justify-between p-1 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'border-orange-400 bg-orange-950/40 ring-1 ring-orange-400/50 shadow-sm'
                          : 'border-stone-800/90 bg-stone-900/60 hover:bg-stone-900 hover:border-stone-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className="flex h-5 w-5 items-center justify-center rounded border shrink-0"
                          style={{
                            borderColor: `${col.themeColor}55`,
                            backgroundColor: `${col.themeColor}15`,
                            color: col.themeColor,
                          }}
                        >
                          {getSlotIcon(item.slot, 'h-3 w-3')}
                        </div>

                        <div className="min-w-0 leading-tight">
                          <div className="flex items-center gap-1 truncate">
                            <span className="text-[10px] font-bold text-stone-100 truncate">
                              {item.name}
                            </span>
                            {equippedHere && (
                              <span className="text-[7px] font-bold uppercase px-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                                Eq
                              </span>
                            )}
                          </div>
                          <div className="text-[8px] text-stone-400 truncate" style={{ color: col.themeColor }}>
                            {EQUIPMENT_SLOT_LABELS[item.slot]} · {col.name.replace(' Set', '')}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`font-mono-num font-bold text-[10px] px-1 py-0.2 rounded border shrink-0 ml-1 ${
                          itemLvl > 0
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            : 'bg-stone-800 text-stone-400 border-stone-700'
                        }`}
                      >
                        +{itemLvl}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT PANE: Dedicated Compact Forge Anvil Stage (7 cols on desktop, responsive tab on mobile) */}
          <div className={`sm:col-span-7 flex-col justify-between min-h-0 rounded-xl border border-stone-800 bg-stone-950/80 p-2 overflow-hidden ${
            mobileTab === 'forge' ? 'flex' : 'hidden sm:flex'
          }`}>
            {selectedItem && collection ? (
              <div className="flex flex-col h-full justify-between gap-1.5 overflow-hidden">
                
                {/* 1. Item Header & Level Transition Strip */}
                <div className="flex items-center justify-between border-b border-stone-800/80 pb-1.5 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg border-2 shadow shrink-0"
                      style={{
                        borderColor: collection.themeColor,
                        backgroundColor: `${collection.themeColor}20`,
                        color: collection.themeColor,
                      }}
                    >
                      {getSlotIcon(selectedItem.slot, 'h-4 w-4')}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1 truncate">
                        <h3 className="font-display text-xs sm:text-sm font-bold text-amber-100 truncate">
                          {selectedItem.name}
                        </h3>
                        {isEquipped && (
                          <span className="text-[7.5px] uppercase font-bold px-1 rounded border border-emerald-500/40 bg-emerald-950/60 text-emerald-300 shrink-0">
                            Equipped
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[8.5px] text-stone-400">
                        <span style={{ color: collection.themeColor }}>
                          {collection.name}
                        </span>
                        <span>·</span>
                        <span className="text-stone-300">
                          {EQUIPMENT_SLOT_LABELS[selectedItem.slot]}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Level Upgrade Visual Transition */}
                  <div className="flex items-center gap-1 shrink-0 pl-1 font-mono-num font-bold">
                    <span className="text-xs px-2 py-0.5 rounded-md border border-stone-700 bg-stone-900 text-stone-300">
                      +{currentLevel}
                    </span>
                    <ArrowRight className="h-3 w-3 text-orange-400" />
                    <span className="text-xs px-2 py-0.5 rounded-md border border-amber-400/80 bg-amber-950/80 text-amber-300 shadow-sm">
                      +{currentLevel + 1}
                    </span>
                  </div>
                </div>

                {/* 2. Unified Compact Effects & Milestone Panel (Strictly bounded height) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 flex-1 min-h-0 overflow-hidden">
                  
                  {/* Current Active Effects Box */}
                  <div className="flex flex-col justify-between rounded-lg border border-stone-800/80 bg-stone-900/50 p-1.5 min-h-0 overflow-hidden">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-amber-300/90 flex items-center gap-1 shrink-0 mb-1">
                      <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                      Active Power (+{currentLevel})
                    </div>
                    
                    <div className="flex-1 min-h-0 overflow-hidden text-[9.5px] leading-tight space-y-1">
                      <div className="text-stone-200 line-clamp-2">
                        <span className="font-semibold text-amber-200">Base: </span>
                        {selectedItem.effectDescription}
                      </div>

                      {unlockedMilestones.length > 0 && (
                        <div className="pt-0.5 border-t border-stone-800/60 space-y-0.5">
                          <span className="text-[7.5px] font-bold uppercase tracking-wider text-emerald-400 block">
                            Milestones ({unlockedMilestones.length}):
                          </span>
                          <div className="flex flex-wrap gap-0.5">
                            {unlockedMilestones.map((m) => (
                              <span
                                key={m.level}
                                className="text-[8px] font-semibold text-stone-300 bg-stone-950/80 px-1 py-0.2 rounded border border-emerald-500/30 truncate max-w-full"
                                title={`${m.title}: ${m.description}`}
                              >
                                <span className="font-mono-num text-emerald-400">+{m.level}</span> {m.title}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Next Upgrade Box */}
                  <div className="flex flex-col justify-between rounded-lg border border-orange-500/30 bg-orange-950/20 p-1.5 min-h-0 overflow-hidden">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-orange-300 flex items-center justify-between shrink-0 mb-1">
                      <span className="flex items-center gap-1">
                        <Flame className="h-2.5 w-2.5 text-orange-400" />
                        Next Level (+{currentLevel + 1})
                      </span>
                      {futureMilestone && (
                        <span className="text-[8px] text-amber-300 font-mono-num">
                          Perk: +{futureMilestone.level}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-h-0 overflow-hidden text-[9.5px] leading-tight">
                      {nextMilestoneDef ? (
                        <div className="p-1 rounded border border-amber-500/40 bg-amber-950/40 text-amber-100">
                          <span className="font-bold text-amber-300 text-[8.5px] block">
                            ✦ UNLOCKS MILESTONE (+{nextMilestoneDef.level}):
                          </span>
                          <span className="font-semibold text-amber-200">{nextMilestoneDef.title}</span> –{' '}
                          <span className="text-stone-300 line-clamp-2">{nextMilestoneDef.description}</span>
                        </div>
                      ) : (
                        <div className="p-1 text-stone-300 space-y-0.5">
                          <p className="font-semibold text-amber-200">
                            Strengthens base combat scaling & power (+6%).
                          </p>
                          {futureMilestone && (
                            <p className="text-[8.5px] text-stone-400">
                              Next milestone perk unlocks at +{futureMilestone.level} ({futureMilestone.title}).
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* 3. Feedback Banner / Confirmation Bar (Single line, ~22px) */}
                <div className="h-[24px] shrink-0 flex items-center">
                  {lastResult ? (
                    <div
                      className={`w-full flex items-center gap-1.5 px-2 py-0.5 rounded text-[9.5px] font-semibold truncate ${
                        lastResult.success
                          ? 'border border-emerald-500/50 bg-emerald-950/70 text-emerald-200'
                          : 'border border-rose-500/50 bg-rose-950/70 text-rose-200'
                      }`}
                    >
                      {lastResult.success ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="h-3 w-3 text-rose-400 shrink-0" />
                      )}
                      <span className="truncate">
                        {lastResult.success
                          ? `✦ Forge Success! ${lastResult.itemName} reached +${lastResult.level}! ${
                              lastResult.milestone ? `[Unlocked ${lastResult.milestone}]` : ''
                            }`
                          : `Forge flickered... Enhancement failed. Item is unharmed!`}
                      </span>
                    </div>
                  ) : isHighLevel && showHighLevelConfirm ? (
                    <div className="w-full flex items-center gap-1.5 px-2 py-0.5 rounded text-[9.5px] font-semibold border border-amber-500/50 bg-amber-950/50 text-amber-200">
                      <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                      <span className="truncate">
                        High-Level Forge (+{currentLevel}): Success chance is {successPercent}%. Click Confirm to forge!
                      </span>
                    </div>
                  ) : (
                    <div className="text-[8.5px] text-stone-500 italic px-1 truncate">
                      {isHighLevel
                        ? 'High-level relics have reduced success chances. Failed attempts never degrade relics.'
                        : 'Failed forge attempts consume Shards, but relics are never degraded or destroyed.'}
                    </div>
                  )}
                </div>

                {/* 4. Forge Action Console (Cost, Chance, & Button in single tight strip ~38px) */}
                <div className="grid grid-cols-12 gap-1.5 shrink-0 pt-1 border-t border-stone-800/80">
                  {/* Cost Pill */}
                  <div className="col-span-3 rounded-lg border border-stone-800 bg-stone-900/80 px-1.5 py-1 text-center flex flex-col justify-center">
                    <span className="text-[7.5px] uppercase font-bold text-stone-400 leading-none">
                      Cost
                    </span>
                    <span
                      className={`font-mono-num font-bold text-xs leading-tight ${
                        canAfford ? 'text-amber-200' : 'text-rose-400'
                      }`}
                    >
                      {cost} Shards
                    </span>
                  </div>

                  {/* Chance Pill */}
                  <div className="col-span-3 rounded-lg border border-stone-800 bg-stone-900/80 px-1.5 py-1 text-center flex flex-col justify-center">
                    <span className="text-[7.5px] uppercase font-bold text-stone-400 leading-none">
                      Chance
                    </span>
                    <span
                      className={`font-mono-num font-bold text-xs leading-tight ${
                        successPercent >= 50
                          ? 'text-emerald-300'
                          : successPercent >= 20
                            ? 'text-amber-300'
                            : 'text-rose-400'
                      }`}
                    >
                      {successPercent}%
                    </span>
                  </div>

                  {/* Enhance Button */}
                  <button
                    type="button"
                    disabled={!canAfford || isForging}
                    onClick={handleEnhanceClick}
                    className={`col-span-6 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-bold text-xs shadow-md transition-all active:scale-95 ${
                      !canAfford
                        ? 'bg-stone-800 text-stone-500 border border-stone-700 cursor-not-allowed'
                        : isForging
                          ? 'bg-orange-700 text-orange-200 border border-orange-500 animate-pulse'
                          : showHighLevelConfirm
                            ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white border border-amber-400 hover:brightness-110 shadow-orange-500/30'
                            : 'bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 hover:brightness-110 text-white border border-orange-400 shadow-orange-500/20'
                    }`}
                  >
                    <Hammer className={`h-3.5 w-3.5 ${isForging ? 'animate-spin' : ''}`} />
                    <span className="truncate">
                      {isForging
                        ? 'Forging...'
                        : !canAfford
                          ? `Need ${cost - boneShards} Shards`
                          : showHighLevelConfirm
                            ? `Confirm Forge (+${currentLevel + 1})`
                            : `Forge (+${currentLevel + 1})`}
                    </span>
                  </button>
                </div>

              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-4 text-stone-500">
                <Shield className="h-8 w-8 text-stone-700 mb-2" />
                <h3 className="text-xs font-bold text-stone-300">Cryptfire Forge is Ready</h3>
                <p className="text-[10px] text-stone-500 mt-1 max-w-xs">
                  {ownedItems.length === 0
                    ? 'No relics owned yet. Defeat Corrupted Hero bosses in crypts to collect relics, then bring them here to enhance them with Boneshards.'
                    : 'Select a relic from your inventory to forge.'}
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
