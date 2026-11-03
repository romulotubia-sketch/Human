import { X } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { GameSettings } from '../types/game';

interface SettingsModalProps {
  settings: GameSettings;
  isFullscreen: boolean;
  fullscreenBlockedNote: boolean;
  isDungeon: boolean;
  isMultiplayer?: boolean;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onToggleFullscreen: () => void;
  onReturnToGuild: () => void;
  onReturnToLobby: () => void;
  onLeaveMultiplayer?: () => void;
  onClose: () => void;
}

export function SettingsModal({
  settings,
  isFullscreen,
  fullscreenBlockedNote,
  isDungeon,
  isMultiplayer,
  onUpdateSettings,
  onToggleFullscreen,
  onReturnToGuild,
  onReturnToLobby,
  onLeaveMultiplayer,
  onClose,
}: SettingsModalProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-sm">
      <div className="flex max-h-[92%] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-stone-700/80 bg-[#181310] text-stone-100 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-stone-800 px-4 py-2.5 sm:px-5 sm:py-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-sm sm:text-base font-bold text-amber-100">
              Game Paused
            </h2>
            <span className="rounded border border-amber-400/30 bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
              Paused
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiTap();
              onClose();
            }}
            aria-label="Resume Game"
            className="flex h-8 items-center gap-1 rounded-xl border border-stone-700 bg-stone-900 px-2.5 text-xs font-semibold text-stone-200 transition-colors hover:bg-stone-800 hover:text-white"
          >
            <X className="h-4 w-4" />
            <span>Resume</span>
          </button>
        </div>

        <div className="touch-scroll-y flex flex-col gap-4 overflow-y-auto p-5">
          {/* Skill Button Size Adjustment */}
          <div>
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="skill-size-range" className="font-medium text-stone-200">
                MOBA Skill Button Size
              </label>
              <span className="font-mono-num text-xs text-cyan-300">
                {Math.round(settings.skillButtonScale * 100)}%
              </span>
            </div>
            <input
              id="skill-size-range"
              type="range"
              min="0.75"
              max="1.35"
              step="0.05"
              value={settings.skillButtonScale}
              onChange={(e) =>
                onUpdateSettings({ skillButtonScale: parseFloat(e.target.value) })
              }
              className="mt-1.5 h-6 w-full accent-cyan-400"
            />
            <div className="flex justify-between text-[11px] text-stone-400">
              <span>Compact (75%)</span>
              <span>Default (100%)</span>
              <span>Large (135%)</span>
            </div>
          </div>

          {/* Joystick Size Adjustment */}
          <div>
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="joy-size-range" className="font-medium text-stone-200">
                Virtual Joystick Size
              </label>
              <span className="font-mono-num text-xs text-cyan-300">
                {Math.round(settings.joystickScale * 100)}%
              </span>
            </div>
            <input
              id="joy-size-range"
              type="range"
              min="0.80"
              max="1.30"
              step="0.05"
              value={settings.joystickScale}
              onChange={(e) =>
                onUpdateSettings({ joystickScale: parseFloat(e.target.value) })
              }
              className="mt-1.5 h-6 w-full accent-cyan-400"
            />
          </div>

          {/* Sound Volume */}
          <div>
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="sfx-range" className="font-medium text-stone-200">
                Sound Effects Volume
              </label>
              <span className="font-mono-num text-xs text-cyan-300">
                {Math.round(settings.sfxVolume * 100)}%
              </span>
            </div>
            <input
              id="sfx-range"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.sfxVolume}
              onChange={(e) => {
                const vol = parseFloat(e.target.value);
                soundEngine.setVolume(vol);
                onUpdateSettings({ sfxVolume: vol });
              }}
              className="mt-1.5 h-6 w-full accent-amber-400"
            />
          </div>

          {/* Native Fullscreen Toggle */}
          <div className="flex flex-col gap-1.5 border-t border-stone-800 pt-3.5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-stone-200">
                  Fullscreen Display
                </div>
                <div className="text-xs text-stone-400">
                  Expands game screen and hides browser bars
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleFullscreen}
                className={`min-h-[44px] min-w-[128px] whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                  isFullscreen
                    ? 'bg-amber-400 text-stone-950'
                    : 'border border-amber-300/60 bg-stone-900 text-amber-200 hover:bg-stone-800'
                }`}
              >
                {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              </button>
            </div>
            {fullscreenBlockedNote && !isFullscreen && (
              <p className="text-[11px] text-amber-300/90">
                Maximized to full viewport. Browser or preview frame restricted OS fullscreen; open in a standalone tab on mobile for OS fullscreen.
              </p>
            )}
          </div>

          {/* Automatic Landscape Orientation Lock */}
          <div className="flex items-center justify-between gap-4 border-t border-stone-800 pt-3.5">
            <div>
              <div className="text-sm font-medium text-stone-200">
                Landscape Mode Lock
              </div>
              <div className="text-xs text-stone-400">
                Automatically renders in landscape even on portrait devices
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiTap();
                onUpdateSettings({ landscapeLock: !settings.landscapeLock });
              }}
              className={`min-h-[44px] min-w-[128px] whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                settings.landscapeLock
                  ? 'bg-cyan-400 text-stone-950'
                  : 'border border-stone-700 bg-stone-900 text-stone-300'
              }`}
            >
              {settings.landscapeLock ? 'Landscape On' : 'Auto Rotate'}
            </button>
          </div>

          {/* Pause Menu & Navigation Actions */}
          <div className="flex flex-col gap-2 border-t border-stone-800 pt-3">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiTap();
                onReturnToLobby();
              }}
              className="min-h-[42px] w-full items-center justify-center rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-stone-950 shadow-md transition-transform hover:bg-amber-300 active:scale-95"
            >
              Return to Lobby
            </button>

            {isDungeon && !isMultiplayer && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiTap();
                  onReturnToGuild();
                  onClose();
                }}
                className="min-h-[38px] w-full items-center justify-center rounded-xl border border-amber-400/50 bg-amber-950/50 px-4 py-2 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-900/60"
              >
                Return to Guild Hearth
              </button>
            )}

            {isMultiplayer && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiTap();
                  onLeaveMultiplayer?.();
                  onClose();
                }}
                className="min-h-[38px] w-full items-center justify-center rounded-xl border border-rose-500/50 bg-rose-950/70 px-4 py-2 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-900/80 active:scale-95"
              >
                Leave Co-Op Session
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiTap();
                onClose();
              }}
              className="min-h-[38px] w-full items-center justify-center rounded-xl border border-stone-700 bg-stone-900 px-4 py-2 text-xs font-semibold text-stone-300 hover:bg-stone-800 hover:text-white"
            >
              Resume Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
