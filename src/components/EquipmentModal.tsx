import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  X,
  Swords,
  Shield,
  Zap,
  Crown,
  Sparkles,
  Check,
  ChevronRight,
  Lock,
  Layers,
  Package,
  BookOpen,
  RotateCcw,
} from 'lucide-react';
import {
  EQUIPMENT_BY_ID,
  EQUIPMENT_COLLECTIONS,
  ALL_EQUIPMENT_ITEMS,
  getEquipmentForCollection,
} from '../data/equipmentData';
import {
  EquipmentCollectionId,
  EquipmentItemDef,
  EquipmentSlot,
  EQUIPMENT_SLOT_LABELS,
} from '../types/equipment';
import { HeroId } from '../types/game';
import { HERO_PROFILES } from '../data/heroSkills';
import { equipmentManager } from '../game/equipmentManager';
import { soundEngine } from '../audio/soundEngine';

interface EquipmentModalProps {
  heroId: HeroId;
  onClose: () => void;
  onEquipmentChanged?: () => void;
}

type ModalSection = 'equipment_bag' | 'codex';
type MobileViewMode = 'bag' | 'inspect';

export function EquipmentModal({
  heroId,
  onClose,
  onEquipmentChanged,
}: EquipmentModalProps) {
  const [activeSection, setActiveSection] = useState<ModalSection>('equipment_bag');
  const [mobileView, setMobileView] = useState<MobileViewMode>('bag');
  const [selectedSlotFilter, setSelectedSlotFilter] = useState<EquipmentSlot | 'all'>('all');
  const [inspectedItemId, setInspectedItemId] = useState<string | null>(() => {
    const currentLoadout = equipmentManager.getEquippedForHero(heroId);
    return (
      currentLoadout.weapon ||
      currentLoadout.armor ||
      currentLoadout.spirit ||
      currentLoadout.ancient ||
      'scavenger_pipe'
    );
  });

  // Re-render trigger when equip/unequip happens
  const [, setTick] = useState(0);
  const refresh = () => {
    setTick((t) => t + 1);
    onEquipmentChanged?.();
  };

  const heroProfile = HERO_PROFILES[heroId];
  const loadout = equipmentManager.getEquippedForHero(heroId);
  const snapshot = equipmentManager.getSnapshot(heroId);
  const isDungeonActive = equipmentManager.getIsDungeonActive();
  const setCounts = equipmentManager.getSetCountsForHero(heroId);

  // Player's actual owned inventory (bag)
  const ownedItems = useMemo(() => {
    return ALL_EQUIPMENT_ITEMS.filter((item) => snapshot.ownedEquipmentIds.includes(item.id));
  }, [snapshot.ownedEquipmentIds]);

  // Filtered inventory items for the Bag panel
  const filteredBagItems = useMemo(() => {
    if (selectedSlotFilter === 'all') return ownedItems;
    return ownedItems.filter((item) => item.slot === selectedSlotFilter);
  }, [ownedItems, selectedSlotFilter]);

  const inspectedItem: EquipmentItemDef | null = inspectedItemId
    ? EQUIPMENT_BY_ID[inspectedItemId] || null
    : null;

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
    }
  };

  const handleEquip = (itemId: string) => {
    soundEngine.playUiTap();
    equipmentManager.equipItem(heroId, itemId);
    refresh();
  };

  const handleUnequip = (slot: EquipmentSlot) => {
    soundEngine.playUiTap();
    equipmentManager.unequipItem(heroId, slot);
    refresh();
  };

  const handleUnlockAll = () => {
    soundEngine.playPickup();
    equipmentManager.unlockAllEquipment();
    refresh();
  };

  const handleResetInventory = () => {
    soundEngine.playUiTap();
    equipmentManager.resetEquipmentInventory();
    refresh();
  };

  // Inspect calculations
  const inspectedSlot = inspectedItem?.slot;
  const isEquippedOnCurrentHero = Boolean(
    inspectedItem && inspectedSlot && loadout[inspectedSlot] === inspectedItem.id
  );
  const equippedWhere = inspectedItem ? equipmentManager.isItemEquippedAnywhere(inspectedItem.id) : null;
  const isOwned = inspectedItem ? snapshot.ownedEquipmentIds.includes(inspectedItem.id) : false;

  const currentCount = inspectedItem ? setCounts[inspectedItem.collection] || 0 : 0;
  const oldItemId = inspectedSlot ? loadout[inspectedSlot] : null;
  const oldItemCol = oldItemId ? EQUIPMENT_BY_ID[oldItemId]?.collection : null;
  const netChange = inspectedItem && oldItemCol === inspectedItem.collection ? 0 : 1;
  const countAfterEquip = isEquippedOnCurrentHero ? currentCount : currentCount + netChange;
  const activatesTwoPiece = !isEquippedOnCurrentHero && currentCount < 2 && countAfterEquip >= 2;
  const activatesFourPiece = !isEquippedOnCurrentHero && currentCount < 4 && countAfterEquip >= 4;
  const inspectedCol = inspectedItem ? EQUIPMENT_COLLECTIONS[inspectedItem.collection] : null;

  return (
    // Outer overlay: items-start prevents flexbox from ever pushing the modal top offscreen!
    <div className="absolute inset-0 z-50 flex items-start sm:items-center justify-center bg-black/85 p-1 sm:p-2.5 backdrop-blur-md overflow-y-auto select-none">
      
      {/* Modal Card: guaranteed visible top bar, fits within viewport */}
      <div className="relative flex w-full max-w-5xl h-[calc(100dvh-8px)] sm:h-[min(94dvh,500px)] flex-col rounded-2xl border border-stone-700 bg-gradient-to-b from-[#1c1613] via-[#120e0c] to-[#0a0806] shadow-2xl text-stone-200 overflow-hidden my-auto shrink-0">
        
        {/* ========================================================
            TOP HEADER BAR (ALWAYS VISIBLE WITH PROMINENT BACK BUTTON)
           ======================================================== */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-stone-800 bg-[#16110e] px-2 sm:px-3.5 gap-1.5 z-20">
          
          {/* Prominent Back Button & Title */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiTap();
                onClose();
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl border border-amber-500/60 bg-gradient-to-r from-amber-950/80 to-stone-900 hover:from-amber-900/80 hover:to-stone-800 text-amber-200 hover:text-white font-bold text-xs shadow-md transition-all active:scale-95 shrink-0"
              aria-label="Back to Game"
            >
              <ArrowLeft className="h-4 w-4 text-amber-300 shrink-0" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="font-display text-xs sm:text-sm font-bold text-amber-100 truncate">
                Relics
              </h2>
              <span
                className={`text-[8.5px] uppercase font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                  isDungeonActive
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-stone-800 text-stone-400 border-stone-700'
                }`}
              >
                {isDungeonActive ? 'Dungeon' : 'Sanctuary'}
              </span>
              <span className="text-[10px] text-stone-400 hidden md:inline truncate">
                · {heroProfile.name}
              </span>
            </div>
          </div>

          {/* Section Navigation Tabs: Equipment & Bag vs Relic Codex */}
          <div className="flex items-center gap-1">
            <div className="flex bg-stone-950/90 border border-stone-800 rounded-xl p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiTap();
                  setActiveSection('equipment_bag');
                }}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg transition-all text-xs ${
                  activeSection === 'equipment_bag'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Package className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span>Bag & Slots</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiTap();
                  setActiveSection('codex');
                }}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg transition-all text-xs ${
                  activeSection === 'codex'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span>Codex (28)</span>
              </button>
            </div>

            {/* Mobile View Toggle (Only shown on very small portrait screens below sm) */}
            {activeSection === 'equipment_bag' && (
              <div className="flex sm:hidden bg-stone-900 border border-stone-800 rounded-lg p-0.5 text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setMobileView('bag')}
                  className={`px-1.5 py-0.5 rounded ${
                    mobileView === 'bag' ? 'bg-amber-500/20 text-amber-300' : 'text-stone-400'
                  }`}
                >
                  Bag
                </button>
                <button
                  type="button"
                  onClick={() => setMobileView('inspect')}
                  className={`px-1.5 py-0.5 rounded ${
                    mobileView === 'inspect' ? 'bg-amber-500/20 text-amber-300' : 'text-stone-400'
                  }`}
                >
                  Inspect
                </button>
              </div>
            )}

            {/* Close Button */}
            <button
              type="button"
              aria-label="Close"
              onClick={() => {
                soundEngine.playUiTap();
                onClose();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-700 bg-stone-900 text-stone-300 hover:bg-stone-800 hover:text-white active:scale-95 shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

        </div>

        {/* ========================================================
            MAIN SECTION 1: HERO EQUIPMENT & BAG (FOCUSED INTERFACE)
           ======================================================== */}
        {activeSection === 'equipment_bag' && (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 flex-1 min-h-0 p-1.5 sm:p-2.5 overflow-hidden">
            
            {/* LEFT PANE: 4 Equipped Slots Bar + Relic Bag (7 cols on landscape) */}
            <div
              className={`sm:col-span-7 flex flex-col gap-1.5 min-h-0 overflow-hidden ${
                mobileView === 'bag' ? 'flex' : 'hidden sm:flex'
              }`}
            >
              
              {/* 4 Hero Equipment Slots (Compact 4-column bar, height ~62px) */}
              <div className="rounded-xl border border-stone-800 bg-stone-950/70 p-1.5 sm:p-2 shrink-0">
                <div className="flex items-center justify-between mb-1 px-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/90 flex items-center gap-1">
                    <Shield className="h-3 w-3 text-amber-400" />
                    Equipped Relics ({heroProfile.name})
                  </span>
                  <span className="text-[9.5px] text-amber-300 font-mono-num font-semibold">
                    {equipmentManager.getEquippedCountForHero(heroId)}/4 Slots
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1">
                  {(['weapon', 'armor', 'spirit', 'ancient'] as EquipmentSlot[]).map((slot) => {
                    const itemId = loadout[slot];
                    const item = itemId ? EQUIPMENT_BY_ID[itemId] : null;
                    const col = item ? EQUIPMENT_COLLECTIONS[item.collection] : null;
                    const isInspected = inspectedItemId === itemId;

                    return (
                      <div
                        key={slot}
                        onClick={() => {
                          if (item) {
                            setInspectedItemId(item.id);
                            if (window.innerWidth < 640) setMobileView('inspect');
                          }
                        }}
                        className={`group relative flex flex-col items-center justify-center p-1 rounded-lg border transition-all cursor-pointer h-[54px] sm:h-[58px] ${
                          item
                            ? isInspected
                              ? 'border-amber-400 bg-amber-950/40 ring-1 ring-amber-400/40 shadow-sm'
                              : 'border-stone-700 bg-stone-900/80 hover:border-stone-500'
                            : 'border-dashed border-stone-800 bg-stone-950/30 hover:border-stone-700'
                        }`}
                      >
                        {/* Top: Icon + Unequip button */}
                        <div className="flex items-center justify-between w-full px-0.5">
                          <div
                            className="flex h-4 w-4 items-center justify-center rounded shrink-0"
                            style={{
                              color: col ? col.themeColor : '#78716c',
                            }}
                          >
                            {getSlotIcon(slot, 'h-3.5 w-3.5')}
                          </div>

                          <span className="text-[8.5px] uppercase font-bold text-stone-500">
                            {slot.slice(0, 3)}
                          </span>

                          {item && (
                            <button
                              type="button"
                              title="Unequip from slot"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnequip(slot);
                              }}
                              className="text-stone-500 hover:text-rose-400 text-[10px] leading-none px-0.5"
                            >
                              ×
                            </button>
                          )}
                        </div>

                        {/* Bottom: Item Name */}
                        {item ? (
                          <div className="w-full text-center mt-0.5 px-0.5">
                            <div className="text-[9.5px] font-bold text-amber-100 truncate leading-tight">
                              {item.name}
                            </div>
                            <div
                              className="text-[8px] font-semibold truncate leading-none"
                              style={{ color: col?.themeColor }}
                            >
                              {col?.name.replace(' Set', '')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[9px] text-stone-600 italic mt-0.5">
                            Empty
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Relic Bag (Inventory of owned items) */}
              <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-stone-800 bg-stone-950/60 p-2 overflow-hidden">
                
                {/* Bag Header & Filter Pills */}
                <div className="flex items-center justify-between border-b border-stone-800 pb-1.5 mb-1.5 shrink-0 gap-1">
                  <div className="flex items-center gap-1">
                    <Package className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-xs font-bold text-amber-100">
                      Bag ({ownedItems.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5">
                    {(['all', 'weapon', 'armor', 'spirit', 'ancient'] as const).map((slotKey) => (
                      <button
                        key={slotKey}
                        type="button"
                        onClick={() => setSelectedSlotFilter(slotKey)}
                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase transition-all whitespace-nowrap ${
                          selectedSlotFilter === slotKey
                            ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
                            : 'bg-stone-900 text-stone-400 hover:bg-stone-850 hover:text-stone-300 border border-stone-800'
                        }`}
                      >
                        {slotKey === 'all' ? 'All' : slotKey.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid of Owned Relics in Bag */}
                <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
                  {filteredBagItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-3">
                      <Package className="h-7 w-7 text-stone-700 mb-1" />
                      <p className="text-xs font-semibold text-stone-300">
                        {ownedItems.length === 0
                          ? 'Relic Bag is empty.'
                          : `No ${selectedSlotFilter} relics in bag.`}
                      </p>
                      <p className="text-[10px] text-stone-500 mt-0.5">
                        Open crypt chests or defeat dungeon bosses to find relic drops!
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveSection('codex')}
                        className="mt-2 px-2.5 py-1 rounded-lg border border-indigo-500/30 bg-indigo-950/40 text-indigo-300 text-xs font-semibold hover:bg-indigo-900/60 transition-all"
                      >
                        Browse Codex (28)
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {filteredBagItems.map((item) => {
                        const col = EQUIPMENT_COLLECTIONS[item.collection];
                        const isEquippedHere = loadout[item.slot] === item.id;
                        const isSelected = inspectedItemId === item.id;
                        const wornOnOther = equipmentManager.isItemEquippedAnywhere(item.id);

                        return (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => {
                              setInspectedItemId(item.id);
                              if (window.innerWidth < 640) setMobileView('inspect');
                            }}
                            onDoubleClick={() => {
                              if (isEquippedHere) handleUnequip(item.slot);
                              else handleEquip(item.id);
                            }}
                            className={`flex items-center justify-between p-1.5 rounded-lg border text-left transition-all ${
                              isEquippedHere
                                ? 'border-emerald-500/70 bg-emerald-950/30 ring-1 ring-emerald-500/30'
                                : isSelected
                                  ? 'border-amber-400 bg-amber-950/30 ring-1 ring-amber-400/40'
                                  : 'border-stone-800 bg-stone-900/70 hover:border-stone-600 hover:bg-stone-900'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div
                                className="flex h-6 w-6 items-center justify-center rounded border bg-stone-950 shrink-0"
                                style={{
                                  borderColor: col.themeColor,
                                  color: col.themeColor,
                                }}
                              >
                                {getSlotIcon(item.slot, 'h-3 w-3')}
                              </div>

                              <div className="min-w-0">
                                <div className="text-[10px] font-bold text-amber-100 truncate leading-tight">
                                  {item.name}
                                </div>
                                <div
                                  className="text-[8px] font-semibold truncate leading-none"
                                  style={{ color: col.themeColor }}
                                >
                                  {col.name.replace(' Set', '')}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 pl-1">
                              {isEquippedHere ? (
                                <span className="flex items-center gap-0.5 text-[8.5px] font-bold text-emerald-300 bg-emerald-500/20 px-1 py-0.2 rounded border border-emerald-500/40">
                                  <Check className="h-2 w-2 stroke-[3]" />
                                  <span>Worn</span>
                                </span>
                              ) : wornOnOther ? (
                                <span className="text-[8px] font-bold text-stone-400 bg-stone-800 px-1 py-0.2 rounded">
                                  {HERO_PROFILES[wornOnOther.heroId].name.slice(0, 3)}
                                </span>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* RIGHT PANE: Selected Relic Inspector & Synergies (5 cols on landscape) */}
            <div
              className={`sm:col-span-5 flex flex-col gap-1.5 min-h-0 overflow-hidden ${
                mobileView === 'inspect' ? 'flex' : 'hidden sm:flex'
              }`}
            >
              
              {/* Selected Relic Details */}
              <div className="rounded-xl border border-amber-500/30 bg-gradient-to-b from-stone-900/90 to-stone-950/95 p-2 sm:p-2.5 flex-1 min-h-0 flex flex-col justify-between shadow-lg overflow-hidden">
                {inspectedItem && inspectedCol ? (
                  <div className="flex flex-col justify-between h-full min-h-0">
                    
                    {/* Top details scroll container */}
                    <div className="overflow-y-auto pr-0.5 min-h-0 space-y-1.5">
                      {/* Name & Badge */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-stone-950 shadow-inner"
                            style={{
                              borderColor: inspectedCol.themeColor,
                              color: inspectedCol.themeColor,
                            }}
                          >
                            {getSlotIcon(inspectedItem.slot, 'h-3.5 w-3.5')}
                          </div>
                          <div className="truncate">
                            <h4 className="font-display text-xs font-bold text-amber-100 truncate">
                              {inspectedItem.name}
                            </h4>
                            <span
                              className="text-[9.5px] font-semibold"
                              style={{ color: inspectedCol.themeColor }}
                            >
                              {inspectedCol.name}
                            </span>
                          </div>
                        </div>

                        <span className="text-[8.5px] font-bold uppercase px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700 shrink-0">
                          {EQUIPMENT_SLOT_LABELS[inspectedItem.slot]}
                        </span>
                      </div>

                      {/* Drop Boss Source */}
                      <div className="text-[9.5px] text-stone-400 bg-stone-950/60 border border-stone-800/80 rounded px-2 py-0.5">
                        <span className="font-semibold text-amber-200/90">Drop: </span>
                        <span>{inspectedCol.bossName}</span>
                      </div>

                      {/* Stat Power */}
                      <div className="text-[10px] font-semibold text-amber-200 bg-amber-950/20 border border-amber-500/30 rounded p-1.5 leading-snug">
                        <div className="text-[8.5px] uppercase tracking-wider text-amber-400 font-bold mb-0.5">
                          Relic Effect:
                        </div>
                        {inspectedItem.effectDescription}
                      </div>

                      {/* Synergy Preview */}
                      <div className="rounded border border-stone-800 bg-stone-950/70 p-1.5 text-[9.5px]">
                        <div className="font-bold text-stone-300 flex items-center justify-between">
                          <span>Set Pieces:</span>
                          <span className="font-mono-num text-amber-300">
                            {currentCount}/4 Pieces
                          </span>
                        </div>

                        {activatesFourPiece ? (
                          <div className="mt-0.5 font-bold text-cyan-300 flex items-center gap-1">
                            <Sparkles className="h-2.5 w-2.5 text-cyan-400 shrink-0" />
                            <span>Activates 4-Pc: {inspectedCol.fourPieceBonus.name}!</span>
                          </div>
                        ) : activatesTwoPiece ? (
                          <div className="mt-0.5 font-bold text-amber-300 flex items-center gap-1">
                            <Sparkles className="h-2.5 w-2.5 text-amber-400 shrink-0" />
                            <span>Activates 2-Pc: {inspectedCol.twoPieceBonus.name}!</span>
                          </div>
                        ) : (
                          <div className="mt-0.5 text-stone-400">
                            {countAfterEquip >= 2
                              ? `✓ ${inspectedCol.twoPieceBonus.name} active`
                              : `Need 2 for: ${inspectedCol.twoPieceBonus.name}`}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Button: Always anchored & visible */}
                    <div className="pt-1.5 border-t border-stone-800/80 shrink-0">
                      {isOwned ? (
                        isEquippedOnCurrentHero ? (
                          <button
                            type="button"
                            onClick={() => handleUnequip(inspectedItem.slot)}
                            className="w-full py-2 rounded-xl border border-rose-500/50 bg-rose-950/70 hover:bg-rose-900/90 text-rose-200 text-xs font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-1"
                          >
                            <span>Unequip Relic</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleEquip(inspectedItem.id)}
                            className="w-full py-2 rounded-xl border border-amber-400 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 text-xs font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1"
                          >
                            <span>
                              {equippedWhere ? `Transfer to ${heroProfile.name}` : `Equip on ${heroProfile.name}`}
                            </span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        )
                      ) : (
                        <div className="w-full py-1.5 text-center rounded-xl bg-stone-900 border border-stone-800 text-stone-500 text-[10px] font-semibold">
                          Locked · Drops from {inspectedCol.bossName}
                        </div>
                      )}
                    </div>

                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-center text-[11px] text-stone-500 italic p-2">
                    <Shield className="h-6 w-6 text-stone-700 mb-1" />
                    Tap any relic to inspect stats and equip.
                  </div>
                )}
              </div>

              {/* Active Synergies Summary Card (Compact, max-h-[85px]) */}
              <div className="rounded-xl border border-stone-800 bg-stone-950/70 p-2 shrink-0 max-h-[90px] overflow-y-auto">
                <div className="flex items-center justify-between mb-1 pb-0.5 border-b border-stone-800/80">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-amber-300/90 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-400" />
                    Active Synergies
                  </span>
                  <span className="text-[8.5px] text-stone-500">2-pc & 4-pc</span>
                </div>

                {snapshot.activeSetBonuses.length === 0 ? (
                  <div className="text-[9.5px] text-stone-500 italic py-0.5">
                    Equip 2 or 4 matching relics to trigger set synergy bonuses.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {snapshot.activeSetBonuses.map((bonus) => {
                      const col = EQUIPMENT_COLLECTIONS[bonus.collectionId];
                      return (
                        <div
                          key={bonus.collectionId}
                          className="rounded bg-stone-900/70 p-1 text-[9.5px]"
                          style={{ borderLeftColor: col.themeColor, borderLeftWidth: 2.5 }}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-amber-100">{bonus.collectionName}</span>
                            <span className="text-amber-400 font-mono-num text-[9px]">
                              {bonus.piecesEquipped}/4 Pcs
                            </span>
                          </div>
                          <div className="text-emerald-300 text-[9px] mt-0.5 leading-tight">
                            {bonus.hasFourPiece
                              ? `${col.twoPieceBonus.name} & ${col.fourPieceBonus.name}`
                              : `${col.twoPieceBonus.name}: ${col.twoPieceBonus.description}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* ========================================================
            SEPARATE SECTION 2: RELIC CODEX (ALL 7 SETS / 28 RELICS)
           ======================================================== */}
        {activeSection === 'codex' && (
          <div className="flex flex-col flex-1 min-h-0 p-2 sm:p-2.5 overflow-hidden">
            
            {/* Codex Header with Quick Tools */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-stone-800 pb-1.5 shrink-0">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-amber-100 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
                  Relic Compendium (All 7 Sets · 28 Relics)
                </h3>
                <p className="text-[9.5px] text-stone-400">
                  Collect pieces from crypt bosses to unlock 2-Piece and 4-Piece synergies.
                </p>
              </div>

              {/* Developer / Testing Tools */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUnlockAll}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-500/40 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 text-[11px] font-semibold active:scale-95 transition-all"
                  title="Unlock all 28 relics to test synergies"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>Unlock All 28</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetInventory}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-stone-700 bg-stone-900 text-stone-400 hover:text-rose-400 text-[11px] font-semibold active:scale-95 transition-all"
                  title="Reset inventory"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* All 7 Collections Scrollable Grid */}
            <div className="flex-1 min-h-0 overflow-y-auto pt-1.5 space-y-2 pr-1">
              {Object.values(EQUIPMENT_COLLECTIONS).map((col) => {
                const pieces: EquipmentItemDef[] = getEquipmentForCollection(col.id);
                const ownedInCol = pieces.filter((p) => snapshot.ownedEquipmentIds.includes(p.id)).length;

                return (
                  <div
                    key={col.id}
                    className="rounded-xl border border-stone-800 bg-stone-950/70 p-2 sm:p-2.5"
                    style={{ borderLeftColor: col.themeColor, borderLeftWidth: 3 }}
                  >
                    {/* Collection Header */}
                    <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="font-display text-xs sm:text-sm font-bold"
                          style={{ color: col.themeColor }}
                        >
                          {col.name}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-stone-900 text-stone-300 border border-stone-800">
                          Boss: {col.bossName}
                        </span>
                      </div>

                      <span className="text-[11px] font-mono-num font-bold text-amber-300">
                        {ownedInCol}/4 Discovered
                      </span>
                    </div>

                    {/* Set Synergy Bonuses */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-1.5 text-[9.5px]">
                      <div className="rounded bg-stone-900/60 border border-stone-800/80 p-1.5">
                        <span className="font-bold text-amber-300">2-Pc: </span>
                        <span className="text-stone-300 font-semibold">{col.twoPieceBonus.name}</span>
                        <p className="text-stone-400 leading-snug">{col.twoPieceBonus.description}</p>
                      </div>

                      <div className="rounded bg-stone-900/60 border border-stone-800/80 p-1.5">
                        <span className="font-bold text-cyan-300">4-Pc: </span>
                        <span className="text-stone-300 font-semibold">{col.fourPieceBonus.name}</span>
                        <p className="text-stone-400 leading-snug">{col.fourPieceBonus.description}</p>
                      </div>
                    </div>

                    {/* 4 Items in this Set */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                      {pieces.map((item) => {
                        const isOwnedPiece = snapshot.ownedEquipmentIds.includes(item.id);
                        const isEquippedPiece = loadout[item.slot] === item.id;

                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              setInspectedItemId(item.id);
                              setActiveSection('equipment_bag');
                            }}
                            className={`flex items-center justify-between p-1.5 rounded-lg border transition-all cursor-pointer ${
                              !isOwnedPiece
                                ? 'border-stone-850 bg-stone-950/40 opacity-50 hover:opacity-80'
                                : isEquippedPiece
                                  ? 'border-emerald-500/80 bg-emerald-950/30'
                                  : 'border-stone-800 bg-stone-900/80 hover:border-stone-600'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div
                                className="flex h-5 w-5 items-center justify-center rounded border bg-stone-950 shrink-0"
                                style={{
                                  borderColor: col.themeColor,
                                  color: col.themeColor,
                                }}
                              >
                                {getSlotIcon(item.slot, 'h-3 w-3')}
                              </div>

                              <div className="min-w-0">
                                <div className="text-[8px] uppercase font-bold text-stone-500 leading-none">
                                  {EQUIPMENT_SLOT_LABELS[item.slot]}
                                </div>
                                <div className="text-[9.5px] font-bold text-amber-100 truncate leading-tight">
                                  {item.name}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 pl-1">
                              {isOwnedPiece ? (
                                isEquippedPiece ? (
                                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    <Check className="h-2 w-2 stroke-[3]" />
                                  </span>
                                ) : (
                                  <span className="text-[8px] text-amber-300 font-semibold">
                                    Owned
                                  </span>
                                )
                              ) : (
                                <Lock className="h-2.5 w-2.5 text-stone-600" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                );
              })}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
