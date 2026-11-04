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
  Flame,
  Info,
  Layers,
  RotateCcw,
  Sparkle,
  Lock,
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
  const [inspectedItemId, setInspectedItemId] = useState<string | null>(null);

  // Force re-render trigger when equip/unequip happens
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

  const inspectedItem = inspectedItemId ? EQUIPMENT_BY_ID[inspectedItemId] : null;

  const getSlotIcon = (slot: EquipmentSlot, className = 'h-5 w-5') => {
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

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-md animate-fade-in select-none">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-stone-700 bg-gradient-to-b from-[#1c1613] via-[#140f0c] to-[#0c0907] p-3 sm:p-5 shadow-2xl text-stone-200 overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg sm:text-xl font-bold text-amber-100">
                  Dungeon Equipment Relics
                </h2>
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                    isDungeonActive
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-stone-800 text-stone-400 border-stone-700'
                  }`}
                >
                  {isDungeonActive ? 'Dungeon Active (Stats Applied)' : 'Sanctuary (Inactive)'}
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Hero: <span className="font-semibold text-amber-200">{heroProfile.name}</span> · {snapshot.ownedEquipmentIds.length}/28 Relics Discovered
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUnlockAll}
              title="Instantly unlock all 28 relics to test any build and set bonuses"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 text-xs font-semibold"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Unlock All 28 (Test)</span>
            </button>

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
        </div>

        {/* Modal Body: Split into Upper (Equipped + Sets) and Lower (Inventory + Details) */}
        <div className="flex-1 overflow-y-auto pr-1 mt-3 space-y-4">
          
          {/* Top Hero Loadout & Active Set Bonuses */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            
            {/* 4 Hero Equipment Slots (7 cols) */}
            <div className="lg:col-span-7 rounded-xl border border-stone-800 bg-stone-950/60 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300/90 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Equipped Relics ({heroProfile.name})
                </span>
                <span className="text-[11px] text-stone-400">
                  Universal: Any piece fits any hero
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                      className={`relative flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all cursor-pointer ${
                        item
                          ? isInspected
                            ? 'border-amber-400 bg-amber-950/30 ring-2 ring-amber-400/30'
                            : 'border-stone-700 bg-stone-900/80 hover:border-stone-500'
                          : 'border-dashed border-stone-800 bg-stone-950/40 text-stone-600'
                      }`}
                    >
                      {/* Slot icon / Item graphic */}
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-lg mb-1.5 ${
                          item
                            ? 'bg-gradient-to-br from-stone-800 to-stone-900 shadow-md'
                            : 'bg-stone-900/50'
                        }`}
                        style={{
                          borderColor: col ? col.themeColor : undefined,
                          color: col ? col.themeColor : undefined,
                        }}
                      >
                        {getSlotIcon(slot, 'h-5 w-5')}
                      </div>

                      <div className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                        {EQUIPMENT_SLOT_LABELS[slot]}
                      </div>

                      {item ? (
                        <>
                          <div className="text-xs font-bold text-amber-100 truncate w-full text-center">
                            {item.name}
                          </div>
                          <div
                            className="text-[10px] font-medium truncate w-full text-center"
                            style={{ color: col?.themeColor }}
                          >
                            {col?.name}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnequip(slot);
                            }}
                            className="mt-1.5 text-[10px] text-rose-400 hover:text-rose-300 underline font-medium"
                          >
                            Unequip
                          </button>
                        </>
                      ) : (
                        <div className="text-[11px] text-stone-500 italic mt-0.5">
                          Empty
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Set Bonuses Panel (5 cols) */}
            <div className="lg:col-span-5 rounded-xl border border-stone-800 bg-stone-950/60 p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300/90 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Active Set Bonuses
                  </span>
                  <span className="text-[10px] text-stone-400">2-pc & 4-pc synergies</span>
                </div>

                {snapshot.activeSetBonuses.length === 0 ? (
                  <div className="py-4 text-center text-xs text-stone-500 italic">
                    Equip 2 or 4 pieces from the same collection to trigger powerful set bonuses.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                    {snapshot.activeSetBonuses.map((bonus) => {
                      const col = EQUIPMENT_COLLECTIONS[bonus.collectionId];
                      return (
                        <div
                          key={bonus.collectionId}
                          className="rounded-lg border border-stone-800 bg-stone-900/60 p-2 text-xs"
                          style={{ borderLeftColor: col.themeColor, borderLeftWidth: 3 }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-100">
                              {bonus.collectionName}
                            </span>
                            <span className="text-[10px] font-semibold text-amber-400">
                              {bonus.piecesEquipped}/4 Pieces
                            </span>
                          </div>

                          {/* 2-pc effect */}
                          {bonus.hasTwoPiece && (
                            <div className="mt-1 text-[11px] text-emerald-300 flex items-start gap-1">
                              <span className="font-bold text-amber-400">[2-PC]</span>
                              <span>{col.twoPieceBonus.name}: {col.twoPieceBonus.description}</span>
                            </div>
                          )}

                          {/* 4-pc effect */}
                          {bonus.hasFourPiece && (
                            <div className="mt-1 text-[11px] text-cyan-300 flex items-start gap-1">
                              <span className="font-bold text-amber-400">[4-PC]</span>
                              <span>{col.fourPieceBonus.name}: {col.fourPieceBonus.description}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-2 text-[10px] text-stone-500 border-t border-stone-800/80 pt-1.5">
                4-piece sets retain their 2-piece bonus. You can combine 2 pieces from one set with 2 pieces from another!
              </div>
            </div>

          </div>

          {/* Inspected Item Detail Banner */}
          {inspectedItem && (
            <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-stone-900/80 to-amber-950/30 p-3.5 shadow-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-stone-950 shadow-inner"
                    style={{
                      borderColor: EQUIPMENT_COLLECTIONS[inspectedItem.collection].themeColor,
                      color: EQUIPMENT_COLLECTIONS[inspectedItem.collection].themeColor,
                    }}
                  >
                    {getSlotIcon(inspectedItem.slot, 'h-6 w-6')}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-display text-base font-bold text-amber-100">
                        {inspectedItem.name}
                      </h4>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                        {EQUIPMENT_SLOT_LABELS[inspectedItem.slot]}
                      </span>
                    </div>

                    <p className="text-xs font-semibold" style={{ color: EQUIPMENT_COLLECTIONS[inspectedItem.collection].themeColor }}>
                      Set: {EQUIPMENT_COLLECTIONS[inspectedItem.collection].name} ({EQUIPMENT_COLLECTIONS[inspectedItem.collection].theme})
                    </p>

                    <p className="mt-1 text-xs text-stone-300">
                      {inspectedItem.effectDescription}
                    </p>

                    {/* Set Synergy Preview */}
                    <div className="mt-2 text-[11px] text-stone-400 bg-stone-950/50 p-2 rounded-lg border border-stone-800">
                      <div>
                        <span className="font-bold text-amber-300">2-Piece Bonus:</span> {EQUIPMENT_COLLECTIONS[inspectedItem.collection].twoPieceBonus.name} – {EQUIPMENT_COLLECTIONS[inspectedItem.collection].twoPieceBonus.description}
                      </div>
                      <div className="mt-1">
                        <span className="font-bold text-cyan-300">4-Piece Bonus:</span> {EQUIPMENT_COLLECTIONS[inspectedItem.collection].fourPieceBonus.name} – {EQUIPMENT_COLLECTIONS[inspectedItem.collection].fourPieceBonus.description}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Equip / Unequip Action Button */}
                <div className="flex sm:flex-col items-center gap-2 w-full sm:w-auto shrink-0">
                  {loadout[inspectedItem.slot] === inspectedItem.id ? (
                    <button
                      type="button"
                      onClick={() => handleUnequip(inspectedItem.slot)}
                      className="w-full sm:w-28 py-2 rounded-xl border border-rose-500/40 bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 text-xs font-bold transition-all"
                    >
                      Unequip
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleEquip(inspectedItem.id)}
                      className="w-full sm:w-28 py-2 rounded-xl border border-amber-400 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 text-xs font-bold shadow-md transition-all active:scale-95"
                    >
                      Equip on {heroProfile.name}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Lower Shared Inventory Section */}
          <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-3">
            
            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 pb-2.5 mb-3">
              {/* Slot Filters */}
              <div className="flex items-center gap-1 overflow-x-auto">
                <span className="text-[11px] font-bold text-stone-400 uppercase mr-1">Slot:</span>
                {(['all', 'weapon', 'armor', 'spirit', 'ancient'] as const).map((slotKey) => (
                  <button
                    key={slotKey}
                    type="button"
                    onClick={() => setSelectedSlotFilter(slotKey)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                      selectedSlotFilter === slotKey
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-stone-900 text-stone-400 hover:bg-stone-800 hover:text-stone-300 border border-stone-800'
                    }`}
                  >
                    {slotKey}
                  </button>
                ))}
              </div>

              {/* Collection Dropdown / Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-stone-400 uppercase">Set:</span>
                <select
                  value={selectedCollectionFilter}
                  onChange={(e) => setSelectedCollectionFilter(e.target.value as any)}
                  className="bg-stone-900 border border-stone-700 text-xs text-stone-200 rounded-lg px-2 py-1 outline-none font-medium"
                >
                  <option value="all">All 7 Sets</option>
                  <option value="eternal_bone">Eternal Bone (Skeleton)</option>
                  <option value="phantom_regalia">Phantom Regalia (Ghost)</option>
                  <option value="plaguebound">Plaguebound (Zombie)</option>
                  <option value="feral_hunter">Feral Hunter (Ghoul)</option>
                  <option value="survivors_arsenal">Survivor's Arsenal (Human)</option>
                  <option value="sky_sovereign">Sky Sovereign (Eaglekin)</option>
                  <option value="king_of_beasts">King of Beasts (Tigerkin)</option>
                </select>
              </div>
            </div>

            {/* Inventory Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[290px] overflow-y-auto pr-1">
              {inventoryItems.map((item) => {
                const isOwned = snapshot.ownedEquipmentIds.includes(item.id);
                const col = EQUIPMENT_COLLECTIONS[item.collection];
                const isEquippedHere = loadout[item.slot] === item.id;
                const equippedWhere = equipmentManager.isItemEquippedAnywhere(item.id);
                const isSelected = inspectedItemId === item.id;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (isOwned) {
                        setInspectedItemId(item.id);
                      }
                    }}
                    className={`relative rounded-xl border p-2.5 transition-all flex flex-col justify-between ${
                      !isOwned
                        ? 'border-stone-800/80 bg-stone-950/40 opacity-40 cursor-not-allowed'
                        : isEquippedHere
                          ? 'border-emerald-500/60 bg-emerald-950/20 ring-1 ring-emerald-500/30 cursor-pointer'
                          : isSelected
                            ? 'border-amber-400 bg-amber-950/25 ring-1 ring-amber-400/40 cursor-pointer'
                            : 'border-stone-800 bg-stone-900/60 hover:border-stone-600 hover:bg-stone-900 cursor-pointer'
                    }`}
                  >
                    <div>
                      {/* Card Header: Slot badge + ownership status */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] uppercase font-bold text-stone-400 flex items-center gap-1">
                          {getSlotIcon(item.slot, 'h-3.5 w-3.5')}
                          {EQUIPMENT_SLOT_LABELS[item.slot]}
                        </span>

                        {isOwned ? (
                          isEquippedHere ? (
                            <span className="text-[9px] font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/40 flex items-center gap-0.5">
                              <Check className="h-2.5 w-2.5" /> Equipped
                            </span>
                          ) : equippedWhere ? (
                            <span className="text-[9px] font-semibold text-stone-400 bg-stone-800 px-1.5 py-0.5 rounded">
                              on {HERO_PROFILES[equippedWhere.heroId].name}
                            </span>
                          ) : (
                            <span className="text-[9px] text-stone-400 bg-stone-800/80 px-1.5 py-0.5 rounded">
                              Owned
                            </span>
                          )
                        ) : (
                          <span className="text-[9px] text-stone-500 flex items-center gap-1">
                            <Lock className="h-2.5 w-2.5" /> Drops from {col.bossName}
                          </span>
                        )}
                      </div>

                      {/* Name & Collection */}
                      <h5 className="font-display text-xs font-bold text-amber-100 truncate">
                        {item.name}
                      </h5>

                      <div
                        className="text-[10px] font-semibold truncate"
                        style={{ color: col.themeColor }}
                      >
                        {col.name}
                      </div>

                      {/* Description */}
                      <p className="mt-1 text-[11px] text-stone-300/90 line-clamp-2 leading-tight">
                        {item.effectDescription}
                      </p>
                    </div>

                    {/* Footer Action */}
                    <div className="mt-2.5 pt-2 border-t border-stone-800/80 flex items-center justify-between">
                      {isOwned ? (
                        isEquippedHere ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnequip(item.slot);
                            }}
                            className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold"
                          >
                            Unequip
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEquip(item.id);
                            }}
                            className="text-[11px] text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1"
                          >
                            <span>Equip</span>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        )
                      ) : (
                        <span className="text-[10px] text-stone-500 italic">
                          Undiscovered
                        </span>
                      )}

                      <span className="text-[10px] text-stone-500">
                        {col.theme}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Dev testing footer helpers */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-800 pt-2 text-[11px] text-stone-500">
            <div>
              <span>Defeat Corrupted Heroes (bosses) on dungeon floors to earn their corresponding Relic drops.</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleUnlockAll}
                className="text-amber-400 hover:text-amber-300 underline font-medium"
              >
                Unlock All 28 Relics
              </button>
              <button
                type="button"
                onClick={handleResetInventory}
                className="text-stone-400 hover:text-rose-400 underline font-medium"
              >
                Reset Inventory
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
