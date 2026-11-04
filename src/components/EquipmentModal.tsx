import React, { useState, useMemo } from 'react';
import {
  X,
  Swords,
  Shield,
  Zap,
  Crown,
  Sparkles,
  Check,
  ChevronRight,
  RotateCcw,
  Lock,
  Layers,
} from 'lucide-react';
import {
  EQUIPMENT_BY_ID,
  EQUIPMENT_COLLECTIONS,
  ALL_EQUIPMENT_ITEMS,
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

export function EquipmentModal({
  heroId,
  onClose,
  onEquipmentChanged,
}: EquipmentModalProps) {
  const [selectedSlotFilter, setSelectedSlotFilter] = useState<EquipmentSlot | 'all'>('all');
  const [selectedCollectionFilter, setSelectedCollectionFilter] = useState<EquipmentCollectionId | 'all'>('all');
  const [inspectedItemId, setInspectedItemId] = useState<string | null>(() => {
    const currentLoadout = equipmentManager.getEquippedForHero(heroId);
    return currentLoadout.weapon || currentLoadout.armor || currentLoadout.spirit || currentLoadout.ancient || 'bonebreaker_emblem';
  });
  const [mobileTab, setMobileTab] = useState<'inventory' | 'loadout'>('inventory');

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

  // Filtered inventory items
  const inventoryItems = useMemo(() => {
    return ALL_EQUIPMENT_ITEMS.filter((item) => {
      const isSlotMatch = selectedSlotFilter === 'all' || item.slot === selectedSlotFilter;
      const isColMatch = selectedCollectionFilter === 'all' || item.collection === selectedCollectionFilter;
      return isSlotMatch && isColMatch;
    });
  }, [selectedSlotFilter, selectedCollectionFilter]);

  const inspectedItem: EquipmentItemDef | null = inspectedItemId ? EQUIPMENT_BY_ID[inspectedItemId] || null : null;

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
  const isEquippedHere = Boolean(inspectedItem && inspectedSlot && loadout[inspectedSlot] === inspectedItem.id);
  const currentCount = inspectedItem ? setCounts[inspectedItem.collection] || 0 : 0;
  const oldItemId = inspectedSlot ? loadout[inspectedSlot] : null;
  const oldItemCol = oldItemId ? EQUIPMENT_BY_ID[oldItemId]?.collection : null;
  const netChange = inspectedItem && oldItemCol === inspectedItem.collection ? 0 : 1;
  const countAfterEquip = isEquippedHere ? currentCount : currentCount + netChange;
  const activatesTwoPiece = !isEquippedHere && currentCount < 2 && countAfterEquip >= 2;
  const activatesFourPiece = !isEquippedHere && currentCount < 4 && countAfterEquip >= 4;
  const inspectedCol = inspectedItem ? EQUIPMENT_COLLECTIONS[inspectedItem.collection] : null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 p-1.5 sm:p-3 backdrop-blur-md animate-fade-in select-none">
      <div className="relative flex w-full max-w-5xl h-[min(94vh,570px)] flex-col rounded-2xl border border-stone-700 bg-gradient-to-b from-[#1b1512] via-[#120e0c] to-[#0a0806] p-2.5 sm:p-3 shadow-2xl text-stone-200 overflow-hidden">
        
        {/* Compact Header Bar */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-sm sm:text-base font-bold text-amber-100 leading-tight">
                  Dungeon Equipment
                </h2>
                <span
                  className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border ${
                    isDungeonActive
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-stone-800 text-stone-400 border-stone-700'
                  }`}
                >
                  {isDungeonActive ? 'Dungeon Active' : 'Sanctuary'}
                </span>
              </div>
              <p className="text-[11px] text-stone-400 leading-none">
                Hero: <span className="font-semibold text-amber-200">{heroProfile.name}</span> · {snapshot.ownedEquipmentIds.length}/28 Relics Discovered
              </p>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-1.5">
            {/* Mobile Tab Toggle */}
            <div className="flex md:hidden bg-stone-900 border border-stone-800 rounded-lg p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => setMobileTab('inventory')}
                className={`px-2 py-0.5 rounded font-semibold ${
                  mobileTab === 'inventory' ? 'bg-amber-500/20 text-amber-300' : 'text-stone-400'
                }`}
              >
                Vault (28)
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('loadout')}
                className={`px-2 py-0.5 rounded font-semibold ${
                  mobileTab === 'loadout' ? 'bg-amber-500/20 text-amber-300' : 'text-stone-400'
                }`}
              >
                Loadout
              </button>
            </div>

            <button
              type="button"
              onClick={handleUnlockAll}
              title="Unlock all 28 relics to test synergies"
              className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-500/30 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 text-[11px] font-semibold active:scale-95"
            >
              <Sparkles className="h-3 w-3" />
              <span>Unlock 28</span>
            </button>

            <button
              type="button"
              aria-label="Close"
              onClick={() => {
                soundEngine.playUiTap();
                onClose();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-700 bg-stone-900 text-stone-300 hover:bg-stone-800 hover:text-white active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Main Content Area: Zero-scroll 2-column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-2.5 flex-1 min-h-0 pt-2 overflow-hidden">
          
          {/* ========================================================
              LEFT COLUMN: Hero Loadout + Active Sets + Inspector
             ======================================================== */}
          <div
            className={`md:col-span-5 flex flex-col gap-2 min-h-0 overflow-hidden ${
              mobileTab === 'loadout' ? 'flex' : 'hidden md:flex'
            }`}
          >
            {/* 1. 4-Slot Loadout Bar */}
            <div className="rounded-xl border border-stone-800/90 bg-stone-950/70 p-2 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/90 flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Equipped Relics ({heroProfile.name})
                </span>
                <span className="text-[10px] text-stone-400">
                  {equipmentManager.getEquippedCountForHero(heroId)}/4 Slots
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {(['weapon', 'armor', 'spirit', 'ancient'] as EquipmentSlot[]).map((slot) => {
                  const itemId = loadout[slot];
                  const item = itemId ? EQUIPMENT_BY_ID[itemId] : null;
                  const col = item ? EQUIPMENT_COLLECTIONS[item.collection] : null;
                  const isInspected = inspectedItemId === itemId;

                  return (
                    <div
                      key={slot}
                      onClick={() => {
                        if (item) setInspectedItemId(item.id);
                      }}
                      className={`relative flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer h-16 ${
                        item
                          ? isInspected
                            ? 'border-amber-400 bg-amber-950/30 ring-1 ring-amber-400/40'
                            : 'border-stone-700 bg-stone-900/80 hover:border-stone-500'
                          : 'border-dashed border-stone-800 bg-stone-950/40 text-stone-600'
                      }`}
                    >
                      <div className="flex items-center gap-1 w-full justify-between">
                        <div
                          className="flex h-5 w-5 items-center justify-center rounded shrink-0"
                          style={{ color: col ? col.themeColor : '#78716c' }}
                        >
                          {getSlotIcon(slot, 'h-3.5 w-3.5')}
                        </div>
                        <span className="text-[9px] uppercase font-bold text-stone-400">
                          {slot.slice(0, 3)}
                        </span>
                        {item && (
                          <button
                            type="button"
                            title="Unequip"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnequip(slot);
                            }}
                            className="text-stone-500 hover:text-rose-400 p-0.5 text-[11px] leading-none"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {item ? (
                        <div className="w-full mt-0.5 text-center">
                          <div className="text-[10px] font-bold text-amber-100 truncate">
                            {item.name}
                          </div>
                          <div
                            className="text-[9px] font-medium truncate"
                            style={{ color: col?.themeColor }}
                          >
                            {col?.name.replace(' Set', '')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[9px] text-stone-600 italic mt-1">Empty</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Active Set Bonuses Panel */}
            <div className="rounded-xl border border-stone-800/90 bg-stone-950/70 p-2 flex flex-col shrink-0 max-h-[140px] overflow-y-auto">
              <div className="flex items-center justify-between mb-1 pb-1 border-b border-stone-800/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/90 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Active Set Bonuses
                </span>
                <span className="text-[9px] text-stone-400">2-pc & 4-pc synergies</span>
              </div>

              {snapshot.activeSetBonuses.length === 0 ? (
                <div className="py-2.5 text-center text-[10px] text-stone-500 italic">
                  Equip 2 or 4 relics from the same set to activate powerful synergies.
                </div>
              ) : (
                <div className="space-y-1.5 pr-0.5">
                  {snapshot.activeSetBonuses.map((bonus) => {
                    const col = EQUIPMENT_COLLECTIONS[bonus.collectionId];
                    return (
                      <div
                        key={bonus.collectionId}
                        className="rounded-md border border-stone-800/90 bg-stone-900/60 p-1.5 text-[10px]"
                        style={{ borderLeftColor: col.themeColor, borderLeftWidth: 3 }}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-amber-100 truncate">{bonus.collectionName}</span>
                          <span className="text-amber-400 shrink-0 font-mono-num">
                            {bonus.piecesEquipped}/4 Pieces Equipped
                          </span>
                        </div>

                        {/* Active Bonus */}
                        <div className="mt-0.5 text-emerald-300">
                          <span className="font-bold text-emerald-400">Active Bonus: </span>
                          {bonus.hasFourPiece ? (
                            <span>
                              {col.twoPieceBonus.name} & {col.fourPieceBonus.name}
                            </span>
                          ) : (
                            <span>
                              {col.twoPieceBonus.name} – {col.twoPieceBonus.description}
                            </span>
                          )}
                        </div>

                        {/* Inactive Bonus */}
                        {!bonus.hasFourPiece && (
                          <div className="mt-0.5 text-stone-400">
                            <span className="font-bold text-stone-400">Inactive Bonus: </span>
                            <span>{col.fourPieceBonus.name} – {col.fourPieceBonus.description}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Compact Inspector & Action Panel */}
            <div className="rounded-xl border border-amber-500/30 bg-gradient-to-b from-stone-900/90 to-stone-950/90 p-2.5 flex-1 min-h-0 flex flex-col justify-between shadow-inner">
              {inspectedItem && inspectedCol ? (
                <div className="flex flex-col justify-between h-full gap-1.5">
                  <div>
                    {/* Top item name & badges */}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <div
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded border bg-stone-950"
                          style={{ borderColor: inspectedCol.themeColor, color: inspectedCol.themeColor }}
                        >
                          {getSlotIcon(inspectedItem.slot, 'h-3.5 w-3.5')}
                        </div>
                        <h4 className="font-display text-xs font-bold text-amber-100 truncate">
                          {inspectedItem.name}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                          {EQUIPMENT_SLOT_LABELS[inspectedItem.slot]}
                        </span>
                        {isEquippedHere ? (
                          <span className="text-[9px] font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/40">
                            Equipped
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Set name & Lore */}
                    <div className="flex items-center justify-between mt-1 text-[10px]">
                      <span className="font-semibold" style={{ color: inspectedCol.themeColor }}>
                        {inspectedCol.name}
                      </span>
                      <span className="text-stone-400 text-[9px] truncate max-w-[130px]">
                        Boss: {inspectedCol.bossName}
                      </span>
                    </div>

                    <p className="text-[10px] text-stone-400 italic mt-0.5 line-clamp-1">
                      "{inspectedItem.description}"
                    </p>

                    {/* Stat Effect */}
                    <div className="mt-1 text-[11px] font-semibold text-amber-200 bg-stone-950/60 border border-stone-800/80 rounded px-2 py-1">
                      Effect: {inspectedItem.effectDescription}
                    </div>

                    {/* Synergy Alert */}
                    <div className="mt-1 text-[10px] text-stone-300">
                      {activatesFourPiece ? (
                        <div className="font-bold text-cyan-300 flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-cyan-400 shrink-0" />
                          <span>Activates 4-Piece: {inspectedCol.fourPieceBonus.name}!</span>
                        </div>
                      ) : activatesTwoPiece ? (
                        <div className="font-bold text-amber-300 flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-amber-400 shrink-0" />
                          <span>Activates 2-Piece: {inspectedCol.twoPieceBonus.name}!</span>
                        </div>
                      ) : (
                        <div className="text-stone-400 truncate">
                          Set Synergy: {currentCount}/4 equipped {countAfterEquip >= 2 ? '(Bonus Active)' : '(Needs 2 for bonus)'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-1">
                    {snapshot.ownedEquipmentIds.includes(inspectedItem.id) ? (
                      isEquippedHere ? (
                        <button
                          type="button"
                          onClick={() => handleUnequip(inspectedItem.slot)}
                          className="w-full py-1.5 rounded-lg border border-rose-500/50 bg-rose-950/70 hover:bg-rose-900/90 text-rose-200 text-xs font-bold transition-all active:scale-95"
                        >
                          Unequip Relic
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleEquip(inspectedItem.id)}
                          className="w-full py-1.5 rounded-lg border border-amber-400 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 text-xs font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1"
                        >
                          <span>Equip on {heroProfile.name}</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      )
                    ) : (
                      <div className="text-center py-1 rounded bg-stone-900/70 text-stone-500 text-[10px] border border-stone-800">
                        Locked · Drops from {inspectedCol.bossName}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-center text-xs text-stone-500 italic p-3">
                  Select any relic to inspect stats and equip
                </div>
              )}
            </div>
          </div>

          {/* ========================================================
              RIGHT COLUMN: Relic Vault (28 Items Filtered Grid)
             ======================================================== */}
          <div
            className={`md:col-span-7 flex flex-col gap-1.5 min-h-0 overflow-hidden ${
              mobileTab === 'inventory' ? 'flex' : 'hidden md:flex'
            }`}
          >
            {/* Filter Controls Bar */}
            <div className="flex items-center justify-between gap-1 border-b border-stone-800 pb-1.5 shrink-0">
              {/* Slot Pills */}
              <div className="flex items-center gap-1 overflow-x-auto">
                {(['all', 'weapon', 'armor', 'spirit', 'ancient'] as const).map((slotKey) => (
                  <button
                    key={slotKey}
                    type="button"
                    onClick={() => setSelectedSlotFilter(slotKey)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all whitespace-nowrap ${
                      selectedSlotFilter === slotKey
                        ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
                        : 'bg-stone-900 text-stone-400 hover:bg-stone-800 hover:text-stone-300 border border-stone-800'
                    }`}
                  >
                    {slotKey === 'all' ? 'All (28)' : slotKey.slice(0, 3)}
                  </button>
                ))}
              </div>

              {/* Set Dropdown */}
              <select
                value={selectedCollectionFilter}
                onChange={(e) => setSelectedCollectionFilter(e.target.value as any)}
                aria-label="Filter by equipment set"
                className="bg-stone-900 border border-stone-700 text-[10px] text-stone-300 rounded px-1.5 py-0.5 outline-none font-medium max-w-[125px] sm:max-w-[150px] truncate"
              >
                <option value="all">All 7 Sets</option>
                <option value="eternal_bone">Eternal Bone</option>
                <option value="phantom_regalia">Phantom Regalia</option>
                <option value="plaguebound">Plaguebound</option>
                <option value="feral_hunter">Feral Hunter</option>
                <option value="survivors_arsenal">Survivor's</option>
                <option value="sky_sovereign">Sky Sovereign</option>
                <option value="king_of_beasts">King of Beasts</option>
              </select>
            </div>

            {/* Compact 28-Relic Grid: Fits cleanly with NO scroll needed on desktop/tablet */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 flex-1 min-h-0 overflow-y-auto md:overflow-hidden pr-0.5">
              {inventoryItems.map((item) => {
                const isOwned = snapshot.ownedEquipmentIds.includes(item.id);
                const col = EQUIPMENT_COLLECTIONS[item.collection];
                const isEquipped = loadout[item.slot] === item.id;
                const isSelected = inspectedItemId === item.id;
                const equippedWhere = equipmentManager.isItemEquippedAnywhere(item.id);

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      setInspectedItemId(item.id);
                      if (mobileTab === 'inventory' && window.innerWidth < 768) {
                        // On small mobile, clicking switches to loadout/inspect tab
                        setMobileTab('loadout');
                      }
                    }}
                    onDoubleClick={() => {
                      if (isOwned) {
                        if (isEquipped) handleUnequip(item.slot);
                        else handleEquip(item.id);
                      }
                    }}
                    className={`relative rounded-lg border p-1.5 transition-all text-left flex items-center justify-between h-[42px] ${
                      !isOwned
                        ? 'border-stone-850 bg-stone-950/30 opacity-40 hover:opacity-60 cursor-pointer'
                        : isEquipped
                          ? 'border-emerald-500/80 bg-emerald-950/30 ring-1 ring-emerald-500/40'
                          : isSelected
                            ? 'border-amber-400 bg-amber-950/30 ring-1 ring-amber-400/40'
                            : 'border-stone-800 bg-stone-900/70 hover:border-stone-600 hover:bg-stone-900'
                    }`}
                  >
                    {/* Left: Slot Icon with Collection Color */}
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border bg-stone-950"
                      style={{
                        borderColor: col.themeColor,
                        color: col.themeColor,
                      }}
                    >
                      {getSlotIcon(item.slot, 'h-3.5 w-3.5')}
                    </div>

                    {/* Middle: Relic Name + Set Name */}
                    <div className="flex-1 min-w-0 px-1.5">
                      <div className="text-[10px] font-bold text-amber-100 truncate leading-tight">
                        {item.name}
                      </div>
                      <div
                        className="text-[8.5px] font-medium truncate leading-tight"
                        style={{ color: col.themeColor }}
                      >
                        {col.name.replace(' Set', '')}
                      </div>
                    </div>

                    {/* Right: Status indicator */}
                    <div className="shrink-0">
                      {isOwned ? (
                        isEquipped ? (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <Check className="h-2.5 w-2.5 stroke-[3]" />
                          </span>
                        ) : equippedWhere ? (
                          <span className="text-[8px] font-bold text-stone-400 bg-stone-800 px-1 py-0.5 rounded">
                            {HERO_PROFILES[equippedWhere.heroId].name.slice(0, 3)}
                          </span>
                        ) : (
                          <div className="h-1.5 w-1.5 rounded-full bg-stone-500" />
                        )
                      ) : (
                        <Lock className="h-3 w-3 text-stone-600" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bottom Quick Bar */}
            <div className="flex items-center justify-between border-t border-stone-800/80 pt-1 shrink-0 text-[10px] text-stone-500">
              <span className="truncate">
                Tip: Click to inspect stats · Double-click to equip/unequip
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleUnlockAll}
                  className="text-amber-400 hover:text-amber-300 underline"
                >
                  Unlock All
                </button>
                <button
                  type="button"
                  onClick={handleResetInventory}
                  className="text-stone-400 hover:text-rose-400 underline"
                >
                  Reset
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
