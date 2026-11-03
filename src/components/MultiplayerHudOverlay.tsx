import { AlertTriangle, Heart, Shield, Wifi, WifiOff } from 'lucide-react';
import React from 'react';
import { ConnectionStatus } from '../game/multiplayerClient';
import { RemotePlayerRenderState } from '../game/renderer';

interface MultiplayerHudOverlayProps {
  teammates: RemotePlayerRenderState[];
  connectionStatus: ConnectionStatus;
  floorCleared: boolean;
  revivingTargetName: string | null;
  revivingProgress: number;
}

export function MultiplayerHudOverlay({
  teammates,
  connectionStatus,
  floorCleared,
  revivingTargetName,
  revivingProgress,
}: MultiplayerHudOverlayProps) {
  if (teammates.length === 0) return null;

  return (
    <>
      {/* Top Left: Co-Op Teammates Bar */}
      <div className="pointer-events-none absolute left-3 top-20 z-20 flex flex-col gap-1.5 sm:left-5 sm:top-24">
        {teammates.map((tm) => {
          const hpRatio = Math.max(0, Math.min(1, tm.hp / Math.max(1, tm.maxHp)));
          const isDown = tm.isDowned;

          return (
            <div
              key={tm.id}
              className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 shadow-md backdrop-blur-md transition-all ${
                isDown
                  ? 'border-red-500/80 bg-red-950/80 animate-pulse'
                  : 'border-stone-700/70 bg-stone-950/80'
              }`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-bold ${
                  isDown ? 'bg-red-500 text-white' : 'bg-stone-800 text-amber-200'
                }`}
              >
                {tm.name.slice(0, 2).toUpperCase()}
              </div>

              <div className="flex flex-col">
                <div className="flex items-center justify-between gap-3 text-[10px]">
                  <span className={`font-semibold ${isDown ? 'text-red-200' : 'text-stone-200'}`}>
                    {tm.name}
                  </span>
                  <span className="font-mono text-[9px] text-stone-400">
                    {isDown ? 'DOWNED' : `${Math.round(tm.hp)}/${tm.maxHp}`}
                  </span>
                </div>

                {/* HP bar */}
                <div className="mt-0.5 h-1.5 w-24 overflow-hidden rounded-full bg-stone-800">
                  <div
                    className={`h-full transition-all duration-100 ${
                      isDown ? 'bg-red-500' : hpRatio > 0.35 ? 'bg-emerald-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${hpRatio * 100}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Connection indicator */}
      <div className="pointer-events-none absolute right-4 top-14 z-20 flex items-center gap-1.5 rounded-full border border-stone-800/80 bg-stone-950/80 px-2.5 py-0.5 text-[10px] font-medium text-stone-300 backdrop-blur-md">
        {connectionStatus === 'connected' ? (
          <>
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Co-Op Online</span>
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            <span className="text-amber-300">Reconnecting...</span>
          </>
        )}
      </div>

      {/* Downed Notification Banner if any teammate is down */}
      {teammates.some((tm) => tm.isDowned) && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center">
          <div className="flex items-center gap-2 rounded-2xl border border-red-500/70 bg-red-950/90 px-4 py-1.5 text-xs font-bold text-red-100 shadow-xl backdrop-blur-md animate-bounce">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span>Teammate Downed! Stand close to them to revive!</span>
          </div>
        </div>
      )}

      {/* Active Reviving Channel Indicator */}
      {revivingTargetName && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-30 -translate-x-1/2 flex flex-col items-center gap-1.5 rounded-2xl border border-emerald-500/80 bg-stone-950/90 px-5 py-2 text-center shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
            <Heart className="h-4 w-4 text-emerald-400 fill-emerald-400 animate-pulse" />
            <span>Reviving {revivingTargetName}...</span>
          </div>
          <div className="h-2 w-36 overflow-hidden rounded-full bg-stone-800">
            <div
              className="h-full bg-emerald-400 transition-all duration-75"
              style={{ width: `${Math.round(revivingProgress * 100)}%` }}
            />
          </div>
        </div>
      )}
    </>
  );
}
