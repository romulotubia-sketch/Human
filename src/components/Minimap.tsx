import React, { useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { HeroId, MinimapSnapshot } from '../types/game';

interface MinimapProps {
  minimap: MinimapSnapshot;
  heroId: HeroId;
  floor: number;
}

function MinimapComponent({ minimap, heroId, floor }: MinimapProps) {
  const [expanded, setExpanded] = useState(false);

  // Compute tight bounding box around randomized dungeon rooms & corridors
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < minimap.walkableRects.length; i++) {
    const r = minimap.walkableRects[i];
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }

  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = minimap.width;
    maxY = minimap.height;
  }

  const pad = 110;
  const vbX = minX - pad;
  const vbY = minY - pad;
  const vbW = Math.max(400, maxX - minX + pad * 2);
  const vbH = Math.max(300, maxY - minY + pad * 2);

  // Scale marker sizes proportionally to dungeon bounds so dots stay crisp at any map scale
  const unit = Math.max(vbW, vbH) / 42;

  const heroColor =
    heroId === 'batkin'
      ? '#c084fc'
      : heroId === 'tigerkin'
        ? '#f59e0b'
      : heroId === 'eaglekin'
        ? '#38bdf8'
        : heroId === 'human'
          ? '#fb923c'
          : heroId === 'ghost'
            ? '#818cf8'
            : heroId === 'ghoul'
              ? '#fb7185'
              : heroId === 'zombie'
                ? '#a3e635'
                : '#67e8f9';

  const cos = Math.cos(minimap.playerFacing);
  const sin = Math.sin(minimap.playerFacing);
  const tipX = minimap.playerX + cos * (unit * 1.45);
  const tipY = minimap.playerY + sin * (unit * 1.45);
  const leftX = minimap.playerX + Math.cos(minimap.playerFacing + 2.45) * (unit * 1.05);
  const leftY = minimap.playerY + Math.sin(minimap.playerFacing + 2.45) * (unit * 1.05);
  const rightX = minimap.playerX + Math.cos(minimap.playerFacing - 2.45) * (unit * 1.05);
  const rightY = minimap.playerY + Math.sin(minimap.playerFacing - 2.45) * (unit * 1.05);

  return (
    <button
      type="button"
      onClick={() => {
        soundEngine.playUiTap();
        setExpanded((prev) => !prev);
      }}
      aria-label={expanded ? 'Collapse Minimap' : 'Expand Minimap'}
      className={`group relative block overflow-hidden rounded-xl border border-stone-700/85 bg-stone-950/88 p-1.5 text-left shadow-lg backdrop-blur-md transition-all duration-150 active:scale-95 ${
        expanded ? 'h-36 w-56 sm:h-44 sm:w-68' : 'h-[66px] w-28 sm:h-[74px] sm:w-32'
      }`}
    >
      {/* Top-left Floor Tag */}
      <div className="pointer-events-none absolute left-1.5 top-1 z-10 flex items-center gap-1 rounded bg-stone-950/80 px-1 py-0.5">
        <span className="font-mono-num text-[9px] font-bold tracking-tight text-amber-300">
          F{floor}
        </span>
        <span className="text-[8px] font-medium text-stone-400">
          {expanded ? 'Tap −' : 'Map +'}
        </span>
      </div>

      <svg
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
      >
        {/* Walkable Corridors */}
        {minimap.walkableRects.map((r, idx) => (
          <rect
            key={`cor_${idx}`}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx={unit * 0.22}
            fill="#334155"
          />
        ))}

        {/* Randomized Dungeon Rooms with Cleared / Treasure / Boss states */}
        {minimap.rooms.map((rm) => {
          const fill =
            rm.kind === 'boss'
              ? rm.cleared
                ? '#065f46'
                : '#7f1d1d'
              : rm.kind === 'treasure'
                ? '#78350f'
                : rm.kind === 'blacksmith'
                  ? '#431407'
                  : rm.kind === 'start'
                    ? '#1e293b'
                    : rm.cleared
                      ? '#14532d'
                      : '#292524';
          const stroke =
            rm.kind === 'boss'
              ? '#fb7185'
              : rm.kind === 'treasure'
                ? '#fbbf24'
                : rm.kind === 'blacksmith'
                  ? '#f97316'
                  : rm.cleared
                    ? '#34d399'
                    : '#64748b';

          return (
            <rect
              key={`rm_${rm.id}`}
              x={rm.x}
              y={rm.y}
              width={rm.w}
              height={rm.h}
              rx={unit * 0.3}
              fill={fill}
              stroke={stroke}
              strokeWidth={unit * 0.16}
            />
          );
        })}

        {/* Interactive Props: Unopened Chests, Blessing Statues & Portals */}
        {minimap.markers.map((mk, idx) => {
          if (mk.kind === 'chest') {
            return (
              <rect
                key={`mk_${idx}`}
                x={mk.x - unit * 0.52}
                y={mk.y - unit * 0.52}
                width={unit * 1.04}
                height={unit * 1.04}
                fill="#fde047"
                stroke="#78350f"
                strokeWidth={unit * 0.14}
                transform={`rotate(45 ${mk.x} ${mk.y})`}
              />
            );
          }
          if (mk.kind === 'blessing_statue') {
            return (
              <g key={`mk_${idx}`}>
                <circle
                  cx={mk.x}
                  cy={mk.y}
                  r={unit * 0.78}
                  fill="#38bdf8"
                  fillOpacity="0.4"
                />
                <circle
                  cx={mk.x}
                  cy={mk.y}
                  r={unit * 0.55}
                  fill="#38bdf8"
                  stroke="#fde047"
                  strokeWidth={unit * 0.16}
                />
              </g>
            );
          }
          if (mk.kind === 'blacksmith') {
            return (
              <g key={`mk_${idx}`}>
                <circle
                  cx={mk.x}
                  cy={mk.y}
                  r={unit * 0.9}
                  fill="#ea580c"
                  fillOpacity="0.45"
                />
                <circle
                  cx={mk.x}
                  cy={mk.y}
                  r={unit * 0.62}
                  fill="#f97316"
                  stroke="#fde047"
                  strokeWidth={unit * 0.16}
                />
              </g>
            );
          }
          return (
            <circle
              key={`mk_${idx}`}
              cx={mk.x}
              cy={mk.y}
              r={unit * 0.72}
              fill={mk.kind === 'portal_next' ? '#38bdf8' : '#fde68a'}
              stroke="#0f172a"
              strokeWidth={unit * 0.16}
            />
          );
        })}

        {/* Live Enemy & Boss Radar Dots */}
        {minimap.enemies.map((e, idx) =>
          e.isBoss ? (
            <g key={`en_${idx}`}>
              <circle
                cx={e.x}
                cy={e.y}
                r={unit * 1.35}
                fill="#f43f5e"
                fillOpacity="0.32"
              />
              <circle
                cx={e.x}
                cy={e.y}
                r={unit * 0.85}
                fill="#fb7185"
                stroke="#fde047"
                strokeWidth={unit * 0.2}
              />
            </g>
          ) : (
            <g key={`en_${idx}`}>
              {e.isVulnerable && heroId === 'ghoul' && (
                <circle
                  cx={e.x}
                  cy={e.y}
                  r={unit * 0.9}
                  fill="none"
                  stroke="#fda4af"
                  strokeWidth={unit * 0.16}
                />
              )}
              <circle
                cx={e.x}
                cy={e.y}
                r={unit * 0.48}
                fill={e.isVulnerable && heroId === 'ghoul' ? '#fda4af' : '#f87171'}
              />
            </g>
          )
        )}

        {/* Co-Op Teammate Beacons */}
        {minimap.teammates &&
          minimap.teammates.map((tm) => {
            const tmColor = tm.isDowned
              ? '#ef4444'
              : tm.heroId === 'batkin'
                ? '#c084fc'
                : tm.heroId === 'tigerkin'
                  ? '#f59e0b'
                : tm.heroId === 'eaglekin'
                  ? '#38bdf8'
                  : tm.heroId === 'human'
                    ? '#fb923c'
                    : tm.heroId === 'ghost'
                      ? '#818cf8'
                      : tm.heroId === 'ghoul'
                        ? '#fb7185'
                        : tm.heroId === 'zombie'
                          ? '#a3e635'
                          : '#67e8f9';
            return (
              <g key={`tm_${tm.id}`}>
                <circle
                  cx={tm.x}
                  cy={tm.y}
                  r={unit * (tm.isDowned ? 1.55 : 1.15)}
                  fill={tmColor}
                  fillOpacity={tm.isDowned ? '0.42' : '0.25'}
                />
                <circle
                  cx={tm.x}
                  cy={tm.y}
                  r={unit * 0.72}
                  fill={tmColor}
                  stroke="#f8fafc"
                  strokeWidth={unit * 0.18}
                />
              </g>
            );
          })}

        {/* Player Directional Arrow & Beacon */}
        <circle
          cx={minimap.playerX}
          cy={minimap.playerY}
          r={unit * 1.45}
          fill={heroColor}
          fillOpacity="0.24"
        />
        <polygon
          points={`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`}
          fill={heroColor}
          stroke="#0c0a09"
          strokeWidth={unit * 0.2}
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export const Minimap = React.memo(MinimapComponent);

