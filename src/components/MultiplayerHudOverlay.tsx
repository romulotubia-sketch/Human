import { AlertTriangle, Heart, Sparkles } from 'lucide-react';
import { ConnectionStatus } from '../game/multiplayerClient';
import { RemotePlayerRenderState } from '../game/renderer';

interface MultiplayerHudOverlayProps {
  teammates: RemotePlayerRenderState[];
  connectionStatus: ConnectionStatus;
  localIsDowned: boolean;
  localReviveProgress: number;
  revivingTargetName: string | null;
  revivingProgress: number;
  portalWaiting: {
    readyCount: number;
    requiredCount: number;
    portalTarget?: 'next' | 'lobby';
  } | null;
}

export function MultiplayerHudOverlay({
  teammates,
  connectionStatus,
  localIsDowned,
  localReviveProgress,
  revivingTargetName,
  revivingProgress,
  portalWaiting,
}: MultiplayerHudOverlayProps) {
  const anyTeammateDowned = teammates.some((tm) => tm.isDowned && !tm.disconnected);
  const reviveBarWidth = Math.max(0, Math.min(144, Math.round(revivingProgress * 144)));
  const selfReviveBarWidth = Math.max(0, Math.min(160, Math.round(localReviveProgress * 160)));

  return (
    <>
      {/* Top-Left Below Local Stats: Squad Teammates Compact Cards */}
      {teammates.length > 0 && (
        <div className="pointer-events-none absolute left-3 top-[92px] z-20 flex flex-col gap-1.5 sm:left-5 sm:top-[100px]">
          {teammates.map((tm) => {
            const hpRatio = Math.max(0, Math.min(1, tm.hp / Math.max(1, tm.maxHp)));
            const shieldRatio = Math.max(0, Math.min(1, tm.shield / Math.max(1, tm.maxHp)));
            const isDown = tm.isDowned;
            const barFill = isDown
              ? '#ef4444'
              : hpRatio > 0.35
                ? '#34d399'
                : '#f87171';

            return (
              <div
                key={tm.id}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 shadow-md backdrop-blur-md transition-all ${
                  isDown
                    ? 'border-red-500/80 bg-red-950/85 animate-pulse'
                    : tm.disconnected
                      ? 'border-stone-700/50 bg-stone-950/60 opacity-65'
                      : 'border-stone-700/75 bg-stone-950/82'
                }`}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-bold ${
                    isDown
                      ? 'bg-red-500 text-white'
                      : tm.heroId === 'batkin'
                        ? 'bg-purple-500/25 text-purple-200'
                        : tm.heroId === 'tigerkin'
                          ? 'bg-amber-500/25 text-amber-200'
                        : tm.heroId === 'eaglekin'
                          ? 'bg-sky-500/25 text-sky-200'
                          : tm.heroId === 'human'
                            ? 'bg-orange-500/25 text-orange-200'
                            : tm.heroId === 'ghost'
                              ? 'bg-indigo-500/25 text-indigo-200'
                              : tm.heroId === 'ghoul'
                                ? 'bg-rose-500/25 text-rose-200'
                                : tm.heroId === 'zombie'
                                  ? 'bg-lime-500/25 text-lime-200'
                                  : 'bg-cyan-500/25 text-cyan-200'
                  }`}
                >
                  {tm.name.slice(0, 2).toUpperCase()}
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center justify-between gap-3 text-[10px]">
                    <span className={`max-w-[76px] truncate font-semibold ${isDown ? 'text-red-200' : 'text-stone-200'}`}>
                      {tm.name}
                    </span>
                    <span className="font-mono-num text-[9px] text-stone-400">
                      {tm.disconnected
                        ? 'OFFLINE'
                        : isDown
                          ? tm.reviveProgress > 0
                            ? `REV ${Math.round(tm.reviveProgress * 100)}%`
                            : 'DOWNED'
                          : `${Math.round(tm.hp)}/${Math.round(tm.maxHp)}`}
                    </span>
                  </div>

                  {/* SVG HP & Shield Bar (zero inline styles) */}
                  <svg
                    viewBox="0 0 96 6"
                    preserveAspectRatio="none"
                    className="mt-0.5 h-1.5 w-24 overflow-hidden rounded-md bg-stone-800"
                  >
                    <rect
                      x="0"
                      y="0"
                      width={isDown ? Math.round(tm.reviveProgress * 96) : Math.round(hpRatio * 96)}
                      height="6"
                      fill={isDown ? '#4ade80' : barFill}
                    />
                    {!isDown && shieldRatio > 0 && (
                      <rect
                        x="0"
                        y="0"
                        width={Math.round(shieldRatio * 96)}
                        height="6"
                        fill="#fde047"
                        fillOpacity="0.65"
                      />
                    )}
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connection Status Indicator */}
      <div className="pointer-events-none absolute left-3 top-[68px] z-20 flex items-center gap-1.5 rounded-lg border border-stone-800/85 bg-stone-950/82 px-2 py-0.5 text-[10px] font-medium text-stone-300 backdrop-blur-md sm:left-5 sm:top-[74px]">
        {connectionStatus === 'connected' ? (
          <>
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Co-Op Synced</span>
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            <span className="text-amber-300">Reconnecting…</span>
          </>
        )}
      </div>

      {/* Portal Waiting Counter */}
      {portalWaiting && portalWaiting.readyCount > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-14 z-30 -translate-x-1/2">
          <div
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-semibold shadow-xl backdrop-blur-md ${
              portalWaiting.portalTarget === 'lobby'
                ? 'border-amber-400/70 bg-amber-950/90 text-amber-100'
                : 'border-cyan-400/60 bg-stone-950/90 text-cyan-100'
            }`}
          >
            <Sparkles
              className={`h-3.5 w-3.5 ${
                portalWaiting.portalTarget === 'lobby' ? 'text-amber-300' : 'text-cyan-300'
              }`}
            />
            <span>
              {portalWaiting.portalTarget === 'lobby'
                ? `Return to Lobby Portal (${portalWaiting.readyCount}/${portalWaiting.requiredCount} Heroes)`
                : `Next Dungeon Portal (${portalWaiting.readyCount}/${portalWaiting.requiredCount} Heroes)`}
            </span>
          </div>
        </div>
      )}

      {/* Local Player Downed Banner */}
      {localIsDowned && (
        <div className="pointer-events-none absolute inset-x-0 top-14 z-30 flex justify-center px-4">
          <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-red-500/80 bg-red-950/92 px-5 py-2.5 text-center shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs font-bold text-red-100">
              <AlertTriangle className="h-4 w-4 text-amber-300" />
              <span>
                {localReviveProgress > 0
                  ? `Ally Reviving You (${Math.round(localReviveProgress * 100)}%)!`
                  : 'You Are Downed! Wait for a Living Ally to Stand Nearby!'}
              </span>
            </div>
            {localReviveProgress > 0 && (
              <svg
                viewBox="0 0 160 8"
                preserveAspectRatio="none"
                className="h-2 w-40 overflow-hidden rounded-md bg-stone-900"
              >
                <rect x="0" y="0" width={selfReviveBarWidth} height="8" fill="#4ade80" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Teammate Downed Alert Banner (when local player is alive) */}
      {!localIsDowned && anyTeammateDowned && !revivingTargetName && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-xl border border-red-500/75 bg-red-950/90 px-3.5 py-1.5 text-xs font-bold text-red-100 shadow-xl backdrop-blur-md">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span>Ally Downed! Stand inside their circle to revive!</span>
          </div>
        </div>
      )}

      {/* Active Reviving Channel Indicator */}
      {!localIsDowned && revivingTargetName && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1.5 rounded-2xl border border-emerald-500/80 bg-stone-950/92 px-5 py-2 text-center shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
            <Heart className="h-4 w-4 fill-emerald-400 text-emerald-400 animate-pulse" />
            <span>Reviving {revivingTargetName} ({Math.round(revivingProgress * 100)}%)</span>
          </div>
          <svg
            viewBox="0 0 144 8"
            preserveAspectRatio="none"
            className="h-2 w-36 overflow-hidden rounded-md bg-stone-800"
          >
            <rect x="0" y="0" width={reviveBarWidth} height="8" fill="#4ade80" />
          </svg>
        </div>
      )}
    </>
  );
}
