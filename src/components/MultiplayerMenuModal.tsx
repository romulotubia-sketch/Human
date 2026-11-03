import { ArrowLeft, Copy, Globe, Play, Plus, RefreshCw, Sparkles, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { HERO_PROFILES, HERO_SKILLS } from '../data/heroSkills';
import { HeroId, SkillLoadout } from '../types/game';
import { RoomDetails } from '../types/multiplayer';

interface MultiplayerMenuModalProps {
  playerName: string;
  heroId: HeroId;
  loadout: SkillLoadout;
  onPlayerNameChange: (name: string) => void;
  onSelectHero?: (heroId: HeroId) => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onQuickJoin: () => void;
  onBack: () => void;
  errorMessage?: string | null;
  isLoading?: boolean;
}

const ALL_HERO_IDS: HeroId[] = [
  'human',
  'skeleton',
  'zombie',
  'ghoul',
  'ghost',
  'tigerkin',
  'eaglekin',
];

export function MultiplayerMenuModal({
  playerName,
  heroId,
  loadout,
  onPlayerNameChange,
  onSelectHero,
  onCreateRoom,
  onJoinRoom,
  onQuickJoin,
  onBack,
  errorMessage,
  isLoading,
}: MultiplayerMenuModalProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'join' | 'browse'>('create');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [publicRooms, setPublicRooms] = useState<RoomDetails[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPublicRooms = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/multiplayer/rooms');
      if (res.ok) {
        const data = await res.json();
        setPublicRooms(data.rooms || []);
      }
    } catch (e) {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPublicRooms();
  }, []);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    soundEngine.unlock();
    soundEngine.playUiTap();
    onJoinRoom(roomCodeInput.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="relative flex h-full max-h-[580px] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-stone-700/80 bg-gradient-to-b from-stone-900 via-[#181412] to-[#120e0c] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                soundEngine.unlock();
                soundEngine.playUiTap();
                onBack();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-700 bg-stone-800 text-stone-300 transition-colors hover:bg-stone-700"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-400" />
                <h2 className="font-display text-lg font-bold text-amber-50">Online Co-Op Crypts</h2>
              </div>
              <p className="text-xs text-stone-400">Team up with 2–4 players across devices in real time</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-stone-400">Your Name:</label>
            <input
              type="text"
              value={playerName}
              maxLength={12}
              onChange={(e) => onPlayerNameChange(e.target.value)}
              className="h-8 w-28 rounded-lg border border-stone-700 bg-stone-950 px-2.5 text-xs font-semibold text-amber-200 outline-none focus:border-amber-400"
              placeholder="Hero Name"
            />
          </div>
        </div>

        {/* Error message banner */}
        {errorMessage && (
          <div className="border-b border-rose-900/60 bg-rose-950/70 px-6 py-2 text-center text-xs font-semibold text-rose-200">
            {errorMessage}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-800 bg-stone-950/40 px-6 pt-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.playUiTap();
              setActiveTab('create');
            }}
            className={`flex items-center gap-2 border-b-2 px-5 py-2.5 text-xs font-bold transition-colors ${
              activeTab === 'create'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            CREATE ROOM
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.playUiTap();
              setActiveTab('join');
            }}
            className={`flex items-center gap-2 border-b-2 px-5 py-2.5 text-xs font-bold transition-colors ${
              activeTab === 'join'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            JOIN CODE
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.playUiTap();
              setActiveTab('browse');
              fetchPublicRooms();
            }}
            className={`flex items-center gap-2 border-b-2 px-5 py-2.5 text-xs font-bold transition-colors ${
              activeTab === 'browse'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            PUBLIC ROOMS
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'create' && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-400/10 shadow-[0_0_30px_rgba(251,191,36,0.15)]">
                <Sparkles className="h-8 w-8 text-amber-400" />
              </div>
              <h3 className="font-display mt-4 text-xl font-bold text-amber-100">Host a New Co-Op Run</h3>
              <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-stone-400">
                Create a lobby, share the 4-letter room code with your friends or play with anyone who joins.
                Supports 2 to 4 players simultaneously!
              </p>

              {onSelectHero && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                  {ALL_HERO_IDS.map((hId) => {
                    const selected = heroId === hId;
                    return (
                      <button
                        key={hId}
                        type="button"
                        onClick={() => {
                          soundEngine.unlock();
                          soundEngine.playUiTap();
                          onSelectHero(hId);
                        }}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95 ${
                          selected
                            ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                            : 'border-stone-800 bg-stone-900/90 text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                        }`}
                      >
                        {HERO_PROFILES[hId].name}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-2.5 inline-flex items-center gap-2 rounded-xl border border-stone-700/80 bg-stone-900/90 px-3 py-1.5 text-xs text-stone-300">
                <span className="font-semibold text-amber-300">{HERO_PROFILES[heroId].name}</span>
                <span aria-hidden="true" className="text-stone-600">·</span>
                <span className="text-stone-400">
                  {HERO_SKILLS[loadout[0]].name} / {HERO_SKILLS[loadout[1]].name} / {HERO_SKILLS[loadout[2]].name}
                </span>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    soundEngine.unlock();
                    soundEngine.playUiTap();
                    onCreateRoom();
                  }}
                  className="flex min-h-[46px] items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-8 py-2.5 text-sm font-bold text-stone-950 shadow-lg transition-transform hover:from-amber-400 hover:to-amber-300 active:scale-95 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {isLoading ? 'Creating Room...' : 'CREATE ROOM'}
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    soundEngine.unlock();
                    soundEngine.playUiTap();
                    onQuickJoin();
                  }}
                  className="flex min-h-[46px] items-center gap-2 rounded-xl border border-stone-600 bg-stone-800/90 px-6 py-2.5 text-sm font-semibold text-stone-200 transition-colors hover:bg-stone-700 active:scale-95 disabled:opacity-50"
                >
                  <Play className="h-4 w-4 text-emerald-400" />
                  QUICK MATCH
                </button>
              </div>
            </div>
          )}

          {activeTab === 'join' && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-400/40 bg-indigo-400/10 shadow-[0_0_30px_rgba(129,140,248,0.15)]">
                <Globe className="h-8 w-8 text-indigo-400" />
              </div>
              <h3 className="font-display mt-4 text-xl font-bold text-indigo-100">Enter Room Code</h3>
              <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-stone-400">
                Ask the room host for their 4-character room code to join their lobby.
              </p>

              <form onSubmit={handleJoinSubmit} className="mt-6 flex flex-col items-center gap-4">
                <input
                  type="text"
                  maxLength={6}
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="CODE"
                  className="h-14 w-48 rounded-2xl border-2 border-stone-700 bg-stone-950 text-center font-mono text-2xl font-black tracking-widest text-amber-300 outline-none transition-colors focus:border-amber-400"
                />

                <button
                  type="submit"
                  disabled={isLoading || !roomCodeInput.trim()}
                  className="flex min-h-[46px] items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-8 py-2.5 text-sm font-bold text-white shadow-lg transition-transform hover:from-indigo-400 hover:to-indigo-300 active:scale-95 disabled:opacity-40"
                >
                  <Users className="h-4 w-4" />
                  {isLoading ? 'Connecting...' : 'JOIN ROOM'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'browse' && (
            <div className="flex h-full flex-col">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-300">
                  {publicRooms.length} Available Lobbies
                </span>
                <button
                  type="button"
                  onClick={fetchPublicRooms}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200"
                >
                  <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {publicRooms.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-stone-800 p-8 text-center">
                  <p className="text-xs text-stone-400">No open public rooms found right now.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className="mt-3 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-stone-950"
                  >
                    Create a Room
                  </button>
                </div>
              ) : (
                <div className="grid gap-2.5">
                  {publicRooms.map((room) => (
                    <div
                      key={room.roomCode}
                      className="flex items-center justify-between rounded-xl border border-stone-700/80 bg-stone-900/80 p-3.5 transition-colors hover:border-amber-400/50"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-amber-300">
                            {room.roomCode}
                          </span>
                          <span className="rounded-full bg-stone-800 px-2 py-0.5 text-[10px] font-semibold text-stone-300">
                            Floor {room.floor}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-400">
                          Host: <span className="text-stone-200">{room.players[0]?.name || 'Hero'}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-stone-300">
                          {room.players.length}/4 Players
                        </span>
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => {
                            soundEngine.unlock();
                            soundEngine.playUiTap();
                            onJoinRoom(room.roomCode);
                          }}
                          className="rounded-lg bg-amber-400 px-4 py-1.5 text-xs font-bold text-stone-950 hover:bg-amber-300"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
