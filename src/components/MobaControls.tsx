import React, { useEffect, useRef, useState } from 'react';
import { HERO_SKILLS } from '../data/heroSkills';
import { ActiveSkillId, HeroId, SkillCategory, SkillId, SkillLoadout } from '../types/game';
import { SkillIcon } from './SkillIcon';

interface MobaControlsProps {
  heroId: HeroId;
  loadout: SkillLoadout;
  skillRanks: Record<SkillId, number>;
  cooldowns: Record<ActiveSkillId, number>;
  maxCooldowns: Record<ActiveSkillId, number>;
  skillButtonScale: number;
  joystickScale: number;
  isForcedCssLandscape: boolean;
  nearInteraction:
    | 'door_dungeon'
    | 'skill_shrine'
    | 'chest'
    | 'portal_next'
    | 'portal_guild'
    | 'blessing_statue'
    | 'equipment_drop'
    | 'boss_blessing'
    | 'blacksmith'
    | null;
  nearInteractionLabel?: string | null;
  onJoystickMove: (nx: number, ny: number) => void;
  onBasicAttackHeld: (held: boolean) => void;
  onSkillAim: (
    active: boolean,
    slotIndex: number,
    skillId: ActiveSkillId | null,
    isManual: boolean,
    angle: number,
    distanceRatio: number,
    willCancel: boolean
  ) => void;
  onSkillCast: (
    skillId: ActiveSkillId,
    isManual: boolean,
    angle: number,
    distanceRatio: number
  ) => void;
  onInteract: () => void;
  onOpenSkillTree: () => void;
  onOpenBlacksmith?: () => void;
}

const SKILL_SCALE_CLASSES: Record<string, string> = {
  '0.75': 'scale-[0.75]',
  '0.80': 'scale-[0.80]',
  '0.85': 'scale-[0.85]',
  '0.90': 'scale-[0.90]',
  '0.95': 'scale-[0.95]',
  '1.00': 'scale-100',
  '1.05': 'scale-[1.05]',
  '1.10': 'scale-[1.10]',
  '1.15': 'scale-[1.15]',
  '1.20': 'scale-[1.20]',
  '1.25': 'scale-[1.25]',
  '1.30': 'scale-[1.30]',
  '1.35': 'scale-[1.35]',
};

const JOY_SCALE_CLASSES: Record<string, string> = {
  '0.80': 'scale-[0.80]',
  '0.85': 'scale-[0.85]',
  '0.90': 'scale-[0.90]',
  '0.95': 'scale-[0.95]',
  '1.00': 'scale-100',
  '1.05': 'scale-[1.05]',
  '1.10': 'scale-[1.10]',
  '1.15': 'scale-[1.15]',
  '1.20': 'scale-[1.20]',
  '1.25': 'scale-[1.25]',
  '1.30': 'scale-[1.30]',
};

function resolveScaleClass(val: number, map: Record<string, string>): string {
  const snapped = (Math.round(val * 20) / 20).toFixed(2);
  return map[snapped] || 'scale-100';
}

// MOBA radial slot positions surrounding Basic Attack at bottom-right:
// Slot 0 = Normal 1 (Left), Slot 1 = Normal 2 (Upper-left diagonal), Slot 2 = Ultimate (Top)
const SLOT_POSITION_CLASSES = [
  'left-[54px] top-[156px]',
  'left-[86px] top-[88px]',
  'left-[158px] top-[52px]',
];

const DRAG_DEADZONE = 15;
const MAX_SKILL_DRAG = 52;
const MAX_JOY_RADIUS = 46;

function MobaControlsComponent({
  heroId,
  loadout,
  skillRanks,
  cooldowns,
  maxCooldowns,
  skillButtonScale,
  joystickScale,
  isForcedCssLandscape,
  nearInteraction,
  nearInteractionLabel,
  onJoystickMove,
  onBasicAttackHeld,
  onSkillAim,
  onSkillCast,
  onInteract,
  onOpenSkillTree,
  onOpenBlacksmith,
}: MobaControlsProps) {
  const joyZoneRef = useRef<HTMLDivElement | null>(null);
  const joyTouchIdRef = useRef<number | null>(null);
  const joyMouseActiveRef = useRef(false);
  const joyOriginRef = useRef({ x: 0, y: 0 });
  const [joyOffset, setJoyOffset] = useState({ x: 0, y: 0, active: false });

  const atkTouchIdRef = useRef<number | null>(null);
  const [atkPressed, setAtkPressed] = useState(false);

  const cancelBtnRef = useRef<HTMLDivElement | null>(null);
  const activeSkillGestureRef = useRef<{
    slotIndex: number;
    skillId: ActiveSkillId;
    touchId: number | 'mouse';
    startX: number;
    startY: number;
    dx: number;
    dy: number;
    isManual: boolean;
    willCancel: boolean;
  } | null>(null);

  const [dragVisual, setDragVisual] = useState<{
    slotIndex: number;
    dx: number;
    dy: number;
    isManual: boolean;
    willCancel: boolean;
  } | null>(null);

  const isHuman = heroId === 'human';
  const isZombie = heroId === 'zombie';
  const isGhoul = heroId === 'ghoul';
  const isGhost = heroId === 'ghost';
  const isEaglekin = heroId === 'eaglekin';
  const isTigerkin = heroId === 'tigerkin';
  const isBatkin = heroId === 'batkin';

  // Maps physical screen delta (clientX/clientY) into game landscape coordinate delta
  const mapScreenDelta = (physDx: number, physDy: number) => {
    if (isForcedCssLandscape) {
      return { dx: physDy, dy: -physDx };
    }
    return { dx: physDx, dy: physDy };
  };

  const checkCancelOverlap = (clientX: number, clientY: number): boolean => {
    const el = cancelBtnRef.current;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.hypot(clientX - cx, clientY - cy) <= 44;
  };

  const updateJoystickFromPoint = (clientX: number, clientY: number) => {
    const physDx = clientX - joyOriginRef.current.x;
    const physDy = clientY - joyOriginRef.current.y;
    const { dx, dy } = mapScreenDelta(physDx, physDy);
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(MAX_JOY_RADIUS, dist);
    const ang = Math.atan2(dy, dx);
    const px = dist > 1 ? Math.cos(ang) * clamped : 0;
    const py = dist > 1 ? Math.sin(ang) * clamped : 0;
    setJoyOffset({ x: px, y: py, active: true });
    onJoystickMove(px / MAX_JOY_RADIUS, py / MAX_JOY_RADIUS);
  };

  const handleJoyTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (joyTouchIdRef.current !== null) return;
    const t = e.changedTouches[0];
    if (!t || !joyZoneRef.current) return;
    const rect = joyZoneRef.current.getBoundingClientRect();
    joyTouchIdRef.current = t.identifier;
    joyOriginRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    updateJoystickFromPoint(t.clientX, t.clientY);
  };

  const handleJoyTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (joyTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyTouchIdRef.current) {
        updateJoystickFromPoint(t.clientX, t.clientY);
        break;
      }
    }
  };

  const handleJoyTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (joyTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchIdRef.current) {
        joyTouchIdRef.current = null;
        setJoyOffset({ x: 0, y: 0, active: false });
        onJoystickMove(0, 0);
        break;
      }
    }
  };

  const handleJoyMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (joyTouchIdRef.current !== null || !joyZoneRef.current) return;
    const rect = joyZoneRef.current.getBoundingClientRect();
    joyMouseActiveRef.current = true;
    joyOriginRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    updateJoystickFromPoint(e.clientX, e.clientY);
  };

  const beginSkillGesture = (
    slotIndex: number,
    skillId: ActiveSkillId,
    touchId: number | 'mouse',
    clientX: number,
    clientY: number
  ) => {
    if ((skillRanks[skillId] || 1) <= 0 || cooldowns[skillId] > 0) return;
    activeSkillGestureRef.current = {
      slotIndex,
      skillId,
      touchId,
      startX: clientX,
      startY: clientY,
      dx: 0,
      dy: 0,
      isManual: false,
      willCancel: false,
    };
    setDragVisual({ slotIndex, dx: 0, dy: 0, isManual: false, willCancel: false });
    onSkillAim(true, slotIndex, skillId, false, 0, 0.65, false);
  };

  const moveSkillGesture = (clientX: number, clientY: number) => {
    const g = activeSkillGestureRef.current;
    if (!g) return;
    const physDx = clientX - g.startX;
    const physDy = clientY - g.startY;
    const { dx: rawDx, dy: rawDy } = mapScreenDelta(physDx, physDy);
    const dist = Math.hypot(rawDx, rawDy);
    const isManual = g.isManual || dist >= DRAG_DEADZONE;
    const clamped = Math.min(MAX_SKILL_DRAG, dist);
    const angle = Math.atan2(rawDy, rawDx);
    const dx = dist > 1 ? Math.cos(angle) * clamped : 0;
    const dy = dist > 1 ? Math.sin(angle) * clamped : 0;
    const distRatio = Math.min(1, dist / MAX_SKILL_DRAG);
    const willCancel = isManual && checkCancelOverlap(clientX, clientY);

    g.dx = dx;
    g.dy = dy;
    g.isManual = isManual;
    g.willCancel = willCancel;

    setDragVisual({ slotIndex: g.slotIndex, dx, dy, isManual, willCancel });
    onSkillAim(true, g.slotIndex, g.skillId, isManual, angle, distRatio, willCancel);
  };

  const endSkillGesture = () => {
    const g = activeSkillGestureRef.current;
    if (!g) return;
    activeSkillGestureRef.current = null;
    setDragVisual(null);
    onSkillAim(false, -1, null, false, 0, 0, false);

    if (!g.willCancel) {
      const angle = Math.atan2(g.dy, g.dx);
      const distRatio = Math.min(1, Math.hypot(g.dx, g.dy) / MAX_SKILL_DRAG);
      onSkillCast(g.skillId, g.isManual, angle, distRatio);
    }
  };

  useEffect(() => {
    const onWinMouseMove = (e: MouseEvent) => {
      if (joyMouseActiveRef.current) {
        updateJoystickFromPoint(e.clientX, e.clientY);
      }
      if (activeSkillGestureRef.current?.touchId === 'mouse') {
        moveSkillGesture(e.clientX, e.clientY);
      }
    };
    const onWinMouseUp = () => {
      if (joyMouseActiveRef.current) {
        joyMouseActiveRef.current = false;
        setJoyOffset({ x: 0, y: 0, active: false });
        onJoystickMove(0, 0);
      }
      if (activeSkillGestureRef.current?.touchId === 'mouse') {
        endSkillGesture();
      }
      if (atkTouchIdRef.current === -99) {
        atkTouchIdRef.current = null;
        setAtkPressed(false);
        onBasicAttackHeld(false);
      }
    };
    window.addEventListener('mousemove', onWinMouseMove);
    window.addEventListener('mouseup', onWinMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWinMouseMove);
      window.removeEventListener('mouseup', onWinMouseUp);
    };
  });

  const skillScaleCls = resolveScaleClass(skillButtonScale, SKILL_SCALE_CLASSES);
  const joyScaleCls = resolveScaleClass(joystickScale, JOY_SCALE_CLASSES);

  const interactionLabel =
    nearInteraction === 'door_dungeon'
      ? 'Enter Graveyard of the Fallen'
      : nearInteraction === 'skill_shrine'
        ? 'Open Skill Tree'
        : nearInteraction === 'chest'
          ? 'Open Chest'
          : nearInteraction === 'blessing_statue'
            ? '✦ Receive Ancient Blessing'
            : nearInteraction === 'portal_next'
              ? '✦ Enter Next Dungeon'
              : nearInteraction === 'portal_guild'
                ? '✦ Return to Lobby'
                : nearInteraction === 'equipment_drop'
                  ? `✦ Pick Up: ${nearInteractionLabel || 'Equipment'}`
                  : nearInteraction === 'boss_blessing'
                    ? '✦ Claim Divine Blessing'
                    : nearInteraction === 'blacksmith'
                      ? `✦ Forge: ${nearInteractionLabel || 'Master Grimforge (Blacksmith)'}`
                      : null;

  const isPortalNext = nearInteraction === 'portal_next';
  const isPortalLobby = nearInteraction === 'portal_guild';
  const isEquipment = nearInteraction === 'equipment_drop';
  const isBlessing = nearInteraction === 'boss_blessing';
  const isBlacksmith = nearInteraction === 'blacksmith';
  const interactionBtnCls = isPortalNext
    ? 'animate-portal-btn border-cyan-300/80 bg-slate-950/90 text-cyan-100 shadow-cyan-500/30'
    : isPortalLobby
      ? 'animate-portal-btn border-amber-300/80 bg-amber-950/92 text-amber-100 shadow-amber-500/30'
      : isBlessing
        ? 'animate-portal-btn border-amber-300 bg-amber-950/95 text-amber-100 shadow-amber-500/40 ring-1 ring-amber-400/50 font-bold'
        : isEquipment
          ? 'animate-portal-btn border-amber-400 bg-gradient-to-r from-amber-950/95 via-stone-900/95 to-amber-950/95 text-amber-100 shadow-amber-500/40 ring-1 ring-amber-400/50 font-bold'
          : isBlacksmith
            ? 'animate-portal-btn border-orange-400 bg-gradient-to-r from-orange-950/95 via-stone-900/95 to-amber-950/95 text-amber-100 shadow-orange-500/40 ring-1 ring-orange-400/50 font-bold'
            : 'border-amber-300/60 bg-amber-950/90 text-amber-100';

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end">
      {dragVisual?.isManual && (
        <div
          ref={cancelBtnRef}
          className={`pointer-events-none absolute right-8 top-16 flex h-12 w-12 items-center justify-center rounded-full border-2 text-xs font-semibold transition-transform duration-150 ${
            dragVisual.willCancel
              ? 'scale-110 border-rose-400 bg-rose-600/80 text-white'
              : 'border-stone-500/70 bg-stone-900/80 text-stone-200'
          }`}
        >
          Cancel
        </div>
      )}

      {interactionLabel && (
        <div className="pointer-events-auto absolute bottom-6 left-1/2 -translate-x-1/2">
          <button
            type="button"
            onClick={() => {
              if (nearInteraction === 'skill_shrine') {
                onOpenSkillTree();
              } else if (nearInteraction === 'blacksmith') {
                onOpenBlacksmith?.();
              } else {
                onInteract();
              }
            }}
            className={`min-h-[44px] whitespace-nowrap rounded-xl border px-5 py-2 text-sm font-semibold shadow-lg transition-transform duration-150 active:scale-95 ${interactionBtnCls}`}
          >
            {interactionLabel}
          </button>
        </div>
      )}

      {/* LEFT THUMB VIRTUAL JOYSTICK */}
      <div
        className={`pointer-events-auto absolute bottom-3 left-3 origin-bottom-left transition-transform duration-150 sm:bottom-5 sm:left-6 ${joyScaleCls}`}
      >
        <div
          ref={joyZoneRef}
          onTouchStart={handleJoyTouchStart}
          onTouchMove={handleJoyTouchMove}
          onTouchEnd={handleJoyTouchEnd}
          onTouchCancel={handleJoyTouchEnd}
          onMouseDown={handleJoyMouseDown}
          className="relative flex h-36 w-36 items-center justify-center rounded-full"
        >
          <svg viewBox="0 0 144 144" className="h-full w-full overflow-visible">
            <circle
              cx="72"
              cy="72"
              r="56"
              fill="rgba(20, 16, 14, 0.52)"
              stroke={
                joyOffset.active
                  ? isHuman
                    ? 'rgba(251, 146, 60, 0.78)'
                    : isGhost
                      ? 'rgba(129, 140, 248, 0.78)'
                      : isGhoul
                        ? 'rgba(251, 113, 133, 0.72)'
                        : isZombie
                          ? 'rgba(163, 230, 53, 0.7)'
                          : 'rgba(103, 232, 249, 0.65)'
                  : 'rgba(214, 211, 209, 0.28)'
              }
              strokeWidth="2.5"
            />
            <circle cx="72" cy="24" r="2" fill="rgba(245, 239, 230, 0.35)" />
            <circle cx="72" cy="120" r="2" fill="rgba(245, 239, 230, 0.35)" />
            <circle cx="24" cy="72" r="2" fill="rgba(245, 239, 230, 0.35)" />
            <circle cx="120" cy="72" r="2" fill="rgba(245, 239, 230, 0.35)" />
            <circle
              cx={72 + joyOffset.x}
              cy={72 + joyOffset.y}
              r="24"
              fill={
                joyOffset.active
                  ? isHuman
                    ? 'rgba(251, 146, 60, 0.92)'
                    : isGhost
                      ? 'rgba(129, 140, 248, 0.92)'
                      : isGhoul
                        ? 'rgba(251, 113, 133, 0.92)'
                        : isZombie
                          ? 'rgba(163, 230, 53, 0.9)'
                          : 'rgba(103, 232, 249, 0.88)'
                  : 'rgba(245, 239, 230, 0.78)'
              }
              stroke="#1c1917"
              strokeWidth="2.5"
            />
          </svg>
        </div>
      </div>

      {/* RIGHT THUMB MOBA SKILL CLUSTER: Basic Attack surrounded by 2 Normal Skills + 1 Ultimate */}
      <div
        className={`pointer-events-none absolute bottom-3 right-3 h-60 w-60 origin-bottom-right transition-transform duration-150 sm:bottom-5 sm:right-6 ${skillScaleCls}`}
      >
        {loadout.map((skillId, idx) => {
          const def = HERO_SKILLS[skillId];
          const cd = cooldowns[skillId] || 0;
          const maxCd = maxCooldowns[skillId] || 1;
          const onCd = cd > 0.04;
          const isUlt = def.category === SkillCategory.ULTIMATE;
          const isDraggingThis = dragVisual?.slotIndex === idx;

          const circumference = 2 * Math.PI * 28;
          const dashOffset = onCd ? circumference * (1 - cd / maxCd) : circumference;

          return (
            <div
              key={`${skillId}_${idx}`}
              onTouchStart={(e) => {
                const t = e.changedTouches[0];
                if (!t) return;
                beginSkillGesture(idx, skillId, t.identifier, t.clientX, t.clientY);
              }}
              onTouchMove={(e) => {
                const g = activeSkillGestureRef.current;
                if (!g || g.slotIndex !== idx) return;
                for (let i = 0; i < e.changedTouches.length; i++) {
                  const t = e.changedTouches[i];
                  if (t.identifier === g.touchId) {
                    moveSkillGesture(t.clientX, t.clientY);
                    break;
                  }
                }
              }}
              onTouchEnd={(e) => {
                const g = activeSkillGestureRef.current;
                if (!g || g.slotIndex !== idx) return;
                for (let i = 0; i < e.changedTouches.length; i++) {
                  if (e.changedTouches[i].identifier === g.touchId) {
                    endSkillGesture();
                    break;
                  }
                }
              }}
              onTouchCancel={() => {
                if (activeSkillGestureRef.current?.slotIndex === idx) {
                  activeSkillGestureRef.current = null;
                  setDragVisual(null);
                  onSkillAim(false, -1, null, false, 0, 0, false);
                }
              }}
              onMouseDown={(e) => {
                beginSkillGesture(idx, skillId, 'mouse', e.clientX, e.clientY);
              }}
              className={`pointer-events-auto absolute ${SLOT_POSITION_CLASSES[idx]} flex h-16 w-16 items-center justify-center rounded-full select-none`}
            >
              {isDraggingThis && dragVisual.isManual && (
                <svg
                  viewBox="-64 -64 128 128"
                  className="pointer-events-none absolute -inset-8 h-32 w-32 overflow-visible"
                >
                  <circle
                    cx="0"
                    cy="0"
                    r="52"
                    fill={
                      isHuman
                        ? 'rgba(251, 146, 60, 0.14)'
                        : isGhost
                          ? 'rgba(129, 140, 248, 0.14)'
                          : isGhoul
                            ? 'rgba(244, 63, 94, 0.14)'
                            : isZombie
                              ? 'rgba(132, 204, 22, 0.12)'
                              : 'rgba(14, 165, 233, 0.10)'
                    }
                    stroke={
                      isHuman
                        ? 'rgba(251, 146, 60, 0.7)'
                        : isGhost
                          ? 'rgba(129, 140, 248, 0.7)'
                          : isGhoul
                            ? 'rgba(251, 113, 133, 0.65)'
                            : isZombie
                              ? 'rgba(163, 230, 53, 0.6)'
                              : 'rgba(103, 232, 249, 0.55)'
                    }
                    strokeWidth="1.8"
                  />
                  <line
                    x1="0"
                    y1="0"
                    x2={dragVisual.dx}
                    y2={dragVisual.dy}
                    stroke={
                      isHuman
                        ? 'rgba(253, 186, 116, 0.85)'
                        : isGhost
                          ? 'rgba(94, 234, 212, 0.82)'
                          : isGhoul
                            ? 'rgba(251, 113, 133, 0.8)'
                            : isZombie
                              ? 'rgba(163, 230, 53, 0.75)'
                              : 'rgba(103, 232, 249, 0.7)'
                    }
                    strokeWidth="2.5"
                  />
                  <circle
                    cx={dragVisual.dx}
                    cy={dragVisual.dy}
                    r="13"
                    fill={
                      dragVisual.willCancel
                        ? '#f43f5e'
                        : isBatkin
                          ? '#c084fc'
                          : isTigerkin
                            ? '#f59e0b'
                          : isEaglekin
                            ? '#38bdf8'
                            : isHuman
                              ? '#fb923c'
                              : isGhost
                                ? '#818cf8'
                                : isGhoul
                                  ? '#fb7185'
                                  : isZombie
                                    ? '#a3e635'
                                    : '#67e8f9'
                    }
                  />
                </svg>
              )}

              <div
                className={`relative flex h-15 w-15 items-center justify-center rounded-full border-2 shadow-lg transition-transform duration-100 ${
                  onCd
                    ? 'border-stone-600 bg-stone-900/85'
                    : isUlt
                      ? 'border-amber-300/95 bg-stone-900/95'
                      : isBatkin
                        ? 'border-purple-400/90 bg-stone-900/95'
                        : isTigerkin
                          ? 'border-amber-400/90 bg-stone-900/95'
                        : isEaglekin
                          ? 'border-sky-300/90 bg-stone-900/95'
                          : isHuman
                            ? 'border-orange-400/90 bg-stone-900/95'
                            : isGhost
                              ? 'border-indigo-400/90 bg-stone-900/95'
                              : isGhoul
                                ? 'border-rose-400/90 bg-stone-900/95'
                                : isZombie
                                  ? 'border-lime-300/85 bg-stone-900/95'
                                  : 'border-cyan-300/85 bg-stone-900/95'
                } ${isDraggingThis ? 'scale-95' : ''}`}
              >
                <SkillIcon skillId={skillId} className="h-7 w-7" />

                {onCd && (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/65">
                      <span className="font-mono-num text-xs font-bold text-white">
                        {cd >= 1 ? Math.ceil(cd) : cd.toFixed(1)}
                      </span>
                    </div>
                    <svg viewBox="0 0 64 64" className="pointer-events-none absolute inset-0 h-full w-full -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke={
                          isBatkin
                            ? '#c084fc'
                            : isTigerkin
                              ? '#f59e0b'
                            : isHuman
                              ? '#fb923c'
                              : isGhost
                                ? '#818cf8'
                                : isGhoul
                                  ? '#fb7185'
                                  : isZombie
                                    ? '#84cc16'
                                    : '#38bdf8'
                        }
                        strokeWidth="3.5"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                      />
                    </svg>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* Primary BASIC ATTACK Button */}
        <button
          type="button"
          aria-label="Basic Attack"
          onTouchStart={(e) => {
            const t = e.changedTouches[0];
            if (!t) return;
            atkTouchIdRef.current = t.identifier;
            setAtkPressed(true);
            onBasicAttackHeld(true);
          }}
          onTouchEnd={(e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
              if (e.changedTouches[i].identifier === atkTouchIdRef.current) {
                atkTouchIdRef.current = null;
                setAtkPressed(false);
                onBasicAttackHeld(false);
                break;
              }
            }
          }}
          onTouchCancel={() => {
            atkTouchIdRef.current = null;
            setAtkPressed(false);
            onBasicAttackHeld(false);
          }}
          onMouseDown={() => {
            atkTouchIdRef.current = -99;
            setAtkPressed(true);
            onBasicAttackHeld(true);
          }}
          className={`pointer-events-auto absolute bottom-2 right-2 flex h-[86px] w-[86px] items-center justify-center rounded-full border-[3px] shadow-xl will-change-transform transition-all duration-75 ${
            atkPressed
              ? isBatkin
                ? 'scale-[0.92] border-purple-400 bg-purple-950/60 shadow-[0_0_24px_rgba(192,132,252,0.7)]'
                : isTigerkin
                  ? 'scale-[0.92] border-amber-400 bg-amber-950/60 shadow-[0_0_24px_rgba(245,158,11,0.7)]'
                : isEaglekin
                  ? 'scale-[0.92] border-sky-400 bg-sky-950/60 shadow-[0_0_24px_rgba(56,189,248,0.7)]'
                  : isHuman
                    ? 'scale-[0.92] border-orange-400 bg-orange-950/60 shadow-[0_0_24px_rgba(249,115,22,0.65)]'
                    : isGhost
                      ? 'scale-[0.92] border-indigo-400 bg-indigo-950/60 shadow-[0_0_24px_rgba(129,140,248,0.65)]'
                      : isGhoul
                        ? 'scale-[0.92] border-rose-400 bg-rose-950/60 shadow-[0_0_24px_rgba(251,113,133,0.65)]'
                        : isZombie
                          ? 'scale-[0.92] border-lime-300 bg-lime-950/60 shadow-[0_0_24px_rgba(163,230,53,0.65)]'
                          : 'scale-[0.92] border-cyan-300 bg-cyan-950/60 shadow-[0_0_24px_rgba(103,232,249,0.65)]'
              : 'scale-100 border-amber-200/90 bg-gradient-to-br from-stone-800 via-stone-900 to-stone-950 shadow-lg hover:border-amber-300'
          }`}
        >
          <div className="flex h-[70px] w-[70px] items-center justify-center rounded-full border border-stone-600/70 bg-stone-900/80">
            <SkillIcon
              skillId={
                isTigerkin
                  ? 'basic_tiger_claw'
                  : isEaglekin
                    ? 'basic_feather'
                    : isHuman
                      ? 'basic_pipe'
                      : isGhost
                        ? 'basic_ghost'
                        : isGhoul
                          ? 'basic_ghoul'
                          : isZombie
                            ? 'basic_claw'
                            : 'basic_sword'
              }
              className="h-10 w-10"
            />
          </div>
        </button>
      </div>
    </div>
  );
}

export const MobaControls = React.memo(MobaControlsComponent);

