import { Maximize2, Minimize2, Settings, Shield, Sparkles, Swords, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { BlacksmithModal } from './components/BlacksmithModal';
import { BlessingSelectionModal } from './components/BlessingSelectionModal';
import { BlessingsTrayModal } from './components/BlessingsTrayModal';
import { EquipmentDropBanner } from './components/EquipmentDropBanner';
import { EquipmentModal } from './components/EquipmentModal';
import { HeroSelectScreen } from './components/HeroSelectScreen';
import { Minimap } from './components/Minimap';
import { MobaControls } from './components/MobaControls';
import { MultiplayerHudOverlay } from './components/MultiplayerHudOverlay';
import { MultiplayerLobbyScreen } from './components/MultiplayerLobbyScreen';
import { MultiplayerMenuModal } from './components/MultiplayerMenuModal';
import { SettingsModal } from './components/SettingsModal';
import { SkillTreeModal } from './components/SkillTreeModal';
import { Blessing } from './types/blessing';
import { EquipmentDropPayload } from './types/equipment';
import { equipmentManager } from './game/equipmentManager';
import {
  ALL_ACTIVE_SKILL_IDS,
  createInitialSkillRanks,
  HERO_PROFILES,
  HERO_SKILLS,
} from './data/heroSkills';
import { GameEngine } from './game/engine';
import { ConnectionStatus, multiplayerClient } from './game/multiplayerClient';
import {
  ActiveSkillId,
  GamePhase,
  GameSettings,
  HeroId,
  HudSnapshot,
  NormalSkillId,
  SkillId,
  SkillLoadout,
  UltimateSkillId,
} from './types/game';
import { RoomDetails } from './types/multiplayer';
import {
  exitAppFullscreenSync,
  getActiveFullscreenElement,
  requestAppFullscreenSync,
} from './utils/fullscreen';

const INITIAL_RANKS = createInitialSkillRanks();

function createInitialHud(heroId: HeroId = 'human'): HudSnapshot {
  const cooldowns = {} as Record<ActiveSkillId, number>;
  const maxCooldowns = {} as Record<ActiveSkillId, number>;
  for (const id of ALL_ACTIVE_SKILL_IDS) {
    cooldowns[id] = 0;
    maxCooldowns[id] = HERO_SKILLS[id].cooldown;
  }
  const baseHp = HERO_PROFILES[heroId].baseHp;
  return {
    heroId,
    hp: baseHp,
    maxHp: baseHp,
    shield: 0,
    level: 1,
    xp: 0,
    xpToNext: 100,
    boneShards: 0,
    skillPoints: 0,
    floor: 0,
    enemiesRemaining: 0,
    cooldowns,
    maxCooldowns,
    nearInteraction: null,
    nearInteractionLabel: null,
    bossInfo: null,
    runOutcome: null,
    minimap: null,
    isDowned: false,
    reviveProgress: 0,
    portalWaiting: null,
  };
}

export default function App() {
  const [phase, setPhase] = useState<GamePhase>(GamePhase.TITLE);
  const [heroId, setHeroId] = useState<HeroId>('human');
  const [settings, setSettings] = useState<GameSettings>({
    skillButtonScale: 1.0,
    joystickScale: 1.0,
    landscapeLock: true,
    sfxVolume: 0.65,
  });

  const [loadoutsByHero, setLoadoutsByHero] = useState<Record<HeroId, SkillLoadout>>({
    human: [...HERO_PROFILES.human.defaultLoadout],
    skeleton: [...HERO_PROFILES.skeleton.defaultLoadout],
    zombie: [...HERO_PROFILES.zombie.defaultLoadout],
    ghoul: [...HERO_PROFILES.ghoul.defaultLoadout],
    ghost: [...HERO_PROFILES.ghost.defaultLoadout],
    eaglekin: [...HERO_PROFILES.eaglekin.defaultLoadout],
    tigerkin: [...HERO_PROFILES.tigerkin.defaultLoadout],
  });

  const [skillRanks, setSkillRanks] = useState<Record<SkillId, number>>(INITIAL_RANKS);
  const [hud, setHud] = useState<HudSnapshot>(() => createInitialHud('human'));

  const [showSkillTree, setShowSkillTree] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEquipment, setShowEquipment] = useState(false);
  const [showBlacksmith, setShowBlacksmith] = useState(false);
  const [equipmentDrop, setEquipmentDrop] = useState<EquipmentDropPayload | null>(null);
  const [portalWarp, setPortalWarp] = useState<{ kind: 'next' | 'lobby'; seq: number } | null>(null);
  const [blessingOptions, setBlessingOptions] = useState<Blessing[] | null>(null);
  const [showBlessingsTray, setShowBlessingsTray] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    Boolean(getActiveFullscreenElement())
  );
  const [fullscreenBlockedNote, setFullscreenBlockedNote] = useState(false);
  const [fullscreenToast, setFullscreenToast] = useState<string | null>(null);
  const [isWindowPortrait, setIsWindowPortrait] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false
  );

  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      return localStorage.getItem('bonehearth_player_name') || 'Brawler';
    } catch {
      return 'Brawler';
    }
  });
  const [roomDetails, setRoomDetails] = useState<RoomDetails | null>(null);
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [multiplayerError, setMultiplayerError] = useState<string | null>(null);
  const [isMultiplayerLoading, setIsMultiplayerLoading] = useState<boolean>(false);
  const [multiplayerReturnPhase, setMultiplayerReturnPhase] = useState<GamePhase>(GamePhase.TITLE);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const multiplayerReplacedMapRef = useRef<boolean>(false);
  const pausedRef = useRef<boolean>(false);
  pausedRef.current =
    (showSkillTree || showSettings || Boolean(blessingOptions) || showBlessingsTray || showEquipment || showBlacksmith) &&
    !isMultiplayer;

  if (!engineRef.current) {
    engineRef.current = new GameEngine(
      'human',
      INITIAL_RANKS,
      (snapshot) => {
        setHud(snapshot);
      },
      (isGuild) => {
        setPhase(isGuild ? GamePhase.GUILD_HOUSE : GamePhase.DUNGEON);
        if (engineRef.current) {
          setSkillRanks(engineRef.current.getSkillRanks());
        }
      }
    );
  }

  useEffect(() => {
    engineRef.current?.setOnPromptBlessing((options) => {
      setBlessingOptions(options);
    });
    engineRef.current?.setOnEquipmentDrop((drop) => {
      setEquipmentDrop(drop);
    });
    engineRef.current?.setOnOpenBlacksmith(() => {
      soundEngine.playSkill('shield');
      setShowBlacksmith(true);
    });
    let warpTimer: number | null = null;
    engineRef.current?.setOnPortalWarp((kind) => {
      if (warpTimer !== null) {
        window.clearTimeout(warpTimer);
      }
      setPortalWarp((prev) => ({ kind, seq: (prev?.seq || 0) + 1 }));
      warpTimer = window.setTimeout(() => {
        setPortalWarp(null);
      }, 580);
    });
    return () => {
      if (warpTimer !== null) {
        window.clearTimeout(warpTimer);
      }
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setActiveLoadout(loadoutsByHero[heroId]);
  }, [heroId, loadoutsByHero]);

  useEffect(() => {
    multiplayerClient.setCallbacks({
      onConnectionChange: (status) => {
        setConnectionStatus(status);
      },
      onLobbyUpdate: (room) => {
        setRoomDetails(room);
        setIsMultiplayerLoading(false);
        const localId = multiplayerClient.getLocalPlayerId();
        const me = room.players.find((p) => p.id === localId);
        if (me && HERO_PROFILES[me.heroId]) {
          setHeroId(me.heroId);
          engineRef.current?.setHero(me.heroId);
          if (Array.isArray(me.loadout) && me.loadout.length === 3) {
            setLoadoutsByHero((prev) => ({
              ...prev,
              [me.heroId]: me.loadout,
            }));
          }
        }
        if (room.status === 'lobby') {
          if (engineRef.current?.isMultiplayer) {
            engineRef.current.resetMultiplayerToLobby();
            setIsMultiplayer(false);
          }
          setPhase(GamePhase.MULTIPLAYER_LOBBY);
        }
      },
      onGameStart: ({ floor, map, enemies, players }) => {
        multiplayerReplacedMapRef.current = true;
        setIsMultiplayer(true);
        setIsMultiplayerLoading(false);
        const localId = multiplayerClient.getLocalPlayerId();
        const me = players.find((p) => p.id === localId);
        if (me && HERO_PROFILES[me.heroId]) {
          setHeroId(me.heroId);
          engineRef.current?.setHero(me.heroId);
        }
        engineRef.current?.startMultiplayerGame(floor, map, enemies, players);
        setPhase(GamePhase.DUNGEON);
      },
      onGameTick: ({ players, enemies }) => {
        engineRef.current?.updateMultiplayerTick(players, enemies);
      },
      onPlayerAttack: (playerId, data) => {
        engineRef.current?.handleRemotePlayerAttack(playerId, data);
      },
      onPlayerSkill: (playerId, data) => {
        engineRef.current?.handleRemotePlayerSkill(playerId, data);
      },
      onPlayerDamaged: (data) => {
        engineRef.current?.handleRemotePlayerDamaged(
          data.playerId,
          data.hp,
          data.shield,
          data.damage,
          data.hp <= 0
        );
      },
      onEnemyAttack: (evt) => {
        engineRef.current?.handleRemoteEnemyAttack(evt);
      },
      onEnemyDamaged: (data) => {
        engineRef.current?.handleRemoteEnemyDamaged(data);
      },
      onEnemyDied: (data) => {
        engineRef.current?.handleRemoteEnemyDied(data);
      },
      onLootCollected: (data) => {
        engineRef.current?.handleRemoteLootCollected(
          data.lootId,
          data.collectorId,
          data.kind,
          data.value
        );
      },
      onChestOpened: (data) => {
        engineRef.current?.handleRemoteChestOpened(
          data.propId,
          data.openerId,
          data.openerName || 'Ally'
        );
      },
      onPlayerDowned: ({ playerId, name }) => {
        engineRef.current?.handleRemotePlayerDowned(playerId, name);
      },
      onPlayerRevived: ({ targetId, reviverId, hp }) => {
        engineRef.current?.handleRemotePlayerRevived(targetId, reviverId, hp);
      },
      onPlayerDisconnected: ({ playerId }) => {
        engineRef.current?.handleRemotePlayerDisconnected(playerId);
      },
      onPlayerReconnected: ({ playerId }) => {
        engineRef.current?.handleRemotePlayerReconnected(playerId);
      },
      onPlayerLeft: ({ playerId }) => {
        engineRef.current?.handleRemotePlayerLeft(playerId);
      },
      onFloorCleared: ({ floor }) => {
        engineRef.current?.handleRemoteFloorCleared(floor);
      },
      onPortalWaiting: ({ readyCount, requiredCount, portalTarget }) => {
        engineRef.current?.handleRemotePortalWaiting(readyCount, requiredCount, portalTarget);
      },
      onNextFloor: ({ floor, map, enemies }) => {
        engineRef.current?.handleRemoteNextFloor(floor, map, enemies);
      },
      onFullStateSync: (state) => {
        multiplayerReplacedMapRef.current = true;
        setIsMultiplayer(true);
        setIsMultiplayerLoading(false);
        const localId = multiplayerClient.getLocalPlayerId();
        const playersList = Array.isArray(state.players)
          ? state.players
          : Object.values(state.players || {});
        const me = playersList.find((p) => p.id === localId);
        if (me) {
          setHeroId(me.heroId);
        }
        engineRef.current?.syncFullMultiplayerState(state);
        setPhase(GamePhase.DUNGEON);
      },
      onHostMigrated: (newHostId) => {
        setRoomDetails((prev) =>
          prev
            ? {
                ...prev,
                hostId: newHostId,
                players: prev.players.map((p) => ({
                  ...p,
                  isHost: p.id === newHostId,
                })),
              }
            : prev
        );
      },
      onGameOver: () => {
        engineRef.current?.handleMultiplayerGameOver();
      },
      onError: (err) => {
        setMultiplayerError(err);
        setIsMultiplayerLoading(false);
        window.setTimeout(() => setMultiplayerError(null), 4000);
      },
    });
  }, []);

  useEffect(() => {
    multiplayerClient.tryAutoReconnectIfSaved();
  }, []);

  const activeLoadout = loadoutsByHero[heroId];

  useEffect(() => {
    const syncFs = () => {
      const active = Boolean(getActiveFullscreenElement());
      setIsFullscreen(active);
      if (active) {
        setFullscreenBlockedNote(false);
        setFullscreenToast(null);
      }
    };
    document.addEventListener('fullscreenchange', syncFs);
    document.addEventListener('webkitfullscreenchange', syncFs);
    return () => {
      document.removeEventListener('fullscreenchange', syncFs);
      document.removeEventListener('webkitfullscreenchange', syncFs);
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      setIsWindowPortrait(window.innerHeight > window.innerWidth);
    };
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (showSkillTree || showSettings || showEquipment || showBlacksmith || Boolean(blessingOptions) || showBlessingsTray) {
        return;
      }
      if (e.code === 'KeyE' || e.code === 'KeyF') {
        engineRef.current?.interactNearbyProp();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSkillTree, showSettings, showEquipment, showBlacksmith, blessingOptions, showBlessingsTray]);

  const isForcedCssLandscape = settings.landscapeLock && isWindowPortrait;

  const handleToggleFullscreen = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playUiTap();
    if (getActiveFullscreenElement()) {
      exitAppFullscreenSync();
    } else {
      requestAppFullscreenSync().then((ok) => {
        if (!ok && !getActiveFullscreenElement()) {
          setFullscreenBlockedNote(true);
          setFullscreenToast(
            'Viewport maximized. Open app in a standalone browser tab if preview restricts OS fullscreen.'
          );
          window.setTimeout(() => setFullscreenToast(null), 4200);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (phase !== GamePhase.GUILD_HOUSE && phase !== GamePhase.DUNGEON) return;
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId = 0;
    let lastTime = performance.now();

    const getGameViewportSize = () => {
      const rawW = window.innerWidth;
      const rawH = window.innerHeight;
      if (settings.landscapeLock && rawH > rawW) {
        return { w: rawH, h: rawW };
      }
      return { w: rawW, h: rawH };
    };

    const syncCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const { w, h } = getGameViewportSize();
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
    };

    syncCanvasSize();
    window.addEventListener('resize', syncCanvasSize);

    let stopped = false;
    const frame = (now: number) => {
      if (stopped) return;
      animId = requestAnimationFrame(frame);

      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Number.isFinite(rawDt) ? Math.min(0.05, Math.max(0.0005, rawDt)) : 0.016;

      try {
        const paused = pausedRef.current;
        const { w, h } = getGameViewportSize();
        const safeW = Math.max(120, w);
        const safeH = Math.max(120, h);
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

        if (canvas.width !== Math.floor(safeW * dpr) || canvas.height !== Math.floor(safeH * dpr)) {
          canvas.width = Math.floor(safeW * dpr);
          canvas.height = Math.floor(safeH * dpr);
        }

        const targetLogicalShortSide = 530;
        const scaleFactor = Math.max(0.1, Math.min(safeW, safeH) / targetLogicalShortSide);
        const logicalW = safeW / scaleFactor;
        const logicalH = safeH / scaleFactor;

        ctx.setTransform(dpr * scaleFactor, 0, 0, dpr * scaleFactor, 0, 0);
        engine.stepAndRender(paused ? 0.0001 : dt, ctx, logicalW, logicalH);
      } catch (err) {
        console.error('Frame step recovered:', err);
      }
    };

    animId = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', syncCanvasSize);
    };
  }, [phase, settings.landscapeLock]);

  const handleEnterGameFromTitle = () => {
    setIsMultiplayer(false);
    requestAppFullscreenSync().then((ok) => {
      if (!ok && !getActiveFullscreenElement()) {
        setFullscreenBlockedNote(true);
      }
    });
    soundEngine.unlock();
    soundEngine.playSkill('shield');
    setPhase(GamePhase.HERO_SELECT);
  };

  const handlePlayerNameChange = (name: string) => {
    setPlayerName(name);
    try {
      localStorage.setItem('bonehearth_player_name', name);
    } catch {
      // ignore
    }
  };

  const handleCreateRoom = () => {
    setIsMultiplayerLoading(true);
    setMultiplayerError(null);
    multiplayerClient.createRoom(playerName, heroId, activeLoadout);
  };

  const handleJoinRoom = (code: string) => {
    setIsMultiplayerLoading(true);
    setMultiplayerError(null);
    multiplayerClient.joinRoom(code, playerName, heroId, activeLoadout);
  };

  const handleQuickJoin = () => {
    setIsMultiplayerLoading(true);
    setMultiplayerError(null);
    multiplayerClient.quickJoin(playerName, heroId, activeLoadout);
  };

  const handleStartMultiplayerGame = () => {
    multiplayerClient.startGame();
  };

  const handleOpenMultiplayerMenu = (returnPhase: GamePhase) => {
    setShowSettings(false);
    setShowSkillTree(false);
    setShowBlessingsTray(false);
    setShowEquipment(false);
    setShowBlacksmith(false);
    setMultiplayerError(null);
    setIsMultiplayerLoading(false);
    setMultiplayerReturnPhase(returnPhase);
    setPhase(GamePhase.MULTIPLAYER_MENU);
  };

  const handleBackFromMultiplayerMenu = () => {
    setMultiplayerError(null);
    setIsMultiplayerLoading(false);
    if (
      multiplayerReplacedMapRef.current &&
      (multiplayerReturnPhase === GamePhase.GUILD_HOUSE ||
        multiplayerReturnPhase === GamePhase.DUNGEON)
    ) {
      multiplayerReplacedMapRef.current = false;
      if (engineRef.current) {
        engineRef.current.setHero(heroId);
        engineRef.current.enterGuildHouse();
      } else {
        setPhase(GamePhase.GUILD_HOUSE);
      }
      return;
    }
    setPhase(multiplayerReturnPhase);
  };

  const handleLeaveMultiplayerRoom = () => {
    multiplayerClient.leaveRoom();
    engineRef.current?.leaveMultiplayerGame();
    setRoomDetails(null);
    setIsMultiplayer(false);
    setPhase(GamePhase.MULTIPLAYER_MENU);
  };

  const handleSelectHero = (nextHero: HeroId) => {
    setHeroId(nextHero);
    engineRef.current?.setHero(nextHero);
    setSkillRanks(engineRef.current ? engineRef.current.getSkillRanks() : createInitialSkillRanks());
  };

  const handleConfirmHero = () => {
    multiplayerReplacedMapRef.current = false;
    const engine = engineRef.current;
    if (engine) {
      engine.setHero(heroId);
      engine.enterGuildHouse();
    } else {
      setPhase(GamePhase.GUILD_HOUSE);
    }
  };

  const handleUpgradeSkill = (skillId: SkillId) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.upgradeSkill(skillId)) {
      setSkillRanks(engine.getSkillRanks());
    }
  };

  const handleQuickSelectNormal = (skillId: NormalSkillId) => {
    setLoadoutsByHero((prev) => {
      const cur = prev[heroId];
      if (cur[0] === skillId || cur[1] === skillId) return prev;
      return {
        ...prev,
        [heroId]: [cur[1], skillId, cur[2]],
      };
    });
  };

  const handleSwapNormalSlots = () => {
    setLoadoutsByHero((prev) => {
      const cur = prev[heroId];
      return {
        ...prev,
        [heroId]: [cur[1], cur[0], cur[2]],
      };
    });
  };

  const handleSetNormalSlot = (slotIdx: 0 | 1, skillId: NormalSkillId) => {
    setLoadoutsByHero((prev) => {
      const next: SkillLoadout = [...prev[heroId]];
      const otherSlot = slotIdx === 0 ? 1 : 0;
      if (next[otherSlot] === skillId) {
        next[otherSlot] = next[slotIdx];
      }
      next[slotIdx] = skillId;
      return {
        ...prev,
        [heroId]: next,
      };
    });
  };

  const handleSetUltimateSlot = (skillId: UltimateSkillId) => {
    setLoadoutsByHero((prev) => {
      const cur = prev[heroId];
      return {
        ...prev,
        [heroId]: [cur[0], cur[1], skillId],
      };
    });
  };

  const handleJoystickMove = useCallback((nx: number, ny: number) => {
    engineRef.current?.setJoystick(nx, ny);
  }, []);

  const handleBasicAttackHeld = useCallback((held: boolean) => {
    engineRef.current?.setBasicAttackHeld(held);
  }, []);

  const handleSkillAim = useCallback(
    (
      active: boolean,
      slotIdx: number,
      skillId: ActiveSkillId | null,
      isManual: boolean,
      angle: number,
      distRatio: number,
      willCancel: boolean
    ) => {
      engineRef.current?.updateSkillAim(
        active,
        slotIdx,
        skillId,
        isManual,
        angle,
        distRatio,
        willCancel
      );
    },
    []
  );

  const handleSkillCast = useCallback(
    (skillId: ActiveSkillId, isManual: boolean, angle: number, distRatio: number) => {
      engineRef.current?.castSkill(skillId, isManual, angle, distRatio);
    },
    []
  );

  const handleInteract = useCallback(() => {
    engineRef.current?.interactNearbyProp();
  }, []);

  const handleOpenSkillTree = useCallback(() => {
    setShowSkillTree(true);
  }, []);

  const hpBarWidth = Math.max(0, Math.min(200, (hud.hp / Math.max(1, hud.maxHp)) * 200));
  const shieldBarWidth = Math.max(
    0,
    Math.min(200, (hud.shield / Math.max(1, hud.maxHp)) * 200)
  );
  const xpBarWidth = Math.max(0, Math.min(200, (hud.xp / Math.max(1, hud.xpToNext)) * 200));

  const rootContainerClass = isForcedCssLandscape
    ? 'fixed top-0 left-0 origin-top-left translate-x-[100dvw] rotate-90 h-[100dvw] w-[100dvh] overflow-hidden bg-[#120e0c] text-[#f5efe6] select-none'
    : 'fixed inset-0 h-dvh w-screen overflow-hidden bg-[#120e0c] text-[#f5efe6] select-none';

  const heroDisplayName = HERO_PROFILES[heroId].name;

  return (
    <div className={rootContainerClass}>
      {fullscreenToast && (
        <div className="pointer-events-none absolute left-1/2 top-14 z-50 -translate-x-1/2 rounded-xl border border-amber-400/50 bg-stone-950/95 px-4 py-2 text-center text-xs text-amber-100 shadow-xl">
          {fullscreenToast}
        </div>
      )}

      {/* === PHASE 1: COZY TITLE SCREEN === */}
      {phase === GamePhase.TITLE && (
        <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#1e1510] via-[#150f0c] to-[#0d0a08] px-6 py-4">
          <div className="absolute right-5 top-4 z-20">
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-xl border border-stone-700 bg-stone-900/90 px-3.5 py-1.5 text-xs font-medium text-stone-200 transition-colors hover:bg-stone-800"
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5 text-amber-300" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5 text-amber-300" />
              )}
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>
          </div>

          <div className="relative z-10 flex max-w-xl flex-col items-center text-center">
            <p className="text-xs font-medium tracking-wide text-amber-300/90">
              Cozy 2D Top-Down Roguelike
            </p>
            <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-amber-50 sm:text-5xl">
              Bonehearth: Cozy Crypts
            </h1>
            <p className="mt-2.5 max-w-md text-xs leading-relaxed text-stone-300 sm:text-sm">
              Choose the street-fighting Human Pipe Brawler, swift Skeleton, plague-wielding Zombie,
              savage Ghoul, or ethereal Ghost in the Guild Lobby, customize your 2 Normal + 1
              Ultimate MOBA loadout, and brave the Graveyard of the Fallen.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleEnterGameFromTitle}
                className="min-h-[46px] whitespace-nowrap rounded-xl bg-amber-400 px-7 py-2.5 text-base font-bold text-stone-950 shadow-xl transition-transform duration-150 hover:bg-amber-300 active:scale-95"
              >
                Solo Journey
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.playUiTap();
                  handleOpenMultiplayerMenu(GamePhase.TITLE);
                }}
                className="flex min-h-[46px] items-center gap-2 whitespace-nowrap rounded-xl border border-amber-400/80 bg-amber-500/20 px-6 py-2.5 text-base font-bold text-amber-200 shadow-xl backdrop-blur-md transition-transform duration-150 hover:bg-amber-500/30 active:scale-95"
              >
                <Swords className="h-5 w-5 text-amber-300" />
                <span>Co-Op Multiplayer</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.playUiTap();
                  setShowSettings(true);
                }}
                className="min-h-[46px] whitespace-nowrap rounded-xl border border-stone-700 bg-stone-900/90 px-5 py-2.5 text-sm font-semibold text-stone-100 transition-colors hover:bg-stone-800"
              >
                Settings
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-stone-400">
              <span>Human · Skeleton · Zombie · Ghoul · Ghost · Eaglekin · Tigerkin</span>
              <span aria-hidden="true">·</span>
              <span>Online 2-4 Players Co-Op</span>
              <span aria-hidden="true">·</span>
              <span>Graveyard of the Fallen &amp; Realtime Sync</span>
            </div>
          </div>
        </div>
      )}

      {/* === PHASE 1.5: MULTIPLAYER MENU (CREATE / JOIN / BROWSE) === */}
      {phase === GamePhase.MULTIPLAYER_MENU && (
        <MultiplayerMenuModal
          playerName={playerName}
          heroId={heroId}
          loadout={activeLoadout}
          onPlayerNameChange={handlePlayerNameChange}
          onSelectHero={handleSelectHero}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onQuickJoin={handleQuickJoin}
          onBack={handleBackFromMultiplayerMenu}
          errorMessage={multiplayerError}
          isLoading={isMultiplayerLoading}
        />
      )}

      {/* === PHASE 1.6: MULTIPLAYER LOBBY SCREEN === */}
      {phase === GamePhase.MULTIPLAYER_LOBBY && roomDetails && (
        <MultiplayerLobbyScreen
          roomDetails={roomDetails}
          localPlayerId={multiplayerClient.getLocalPlayerId()}
          isHost={roomDetails.hostId === multiplayerClient.getLocalPlayerId()}
          localHeroId={heroId}
          localLoadout={activeLoadout}
          onSelectHero={(h) => {
            const targetLoadout = loadoutsByHero[h] || [...HERO_PROFILES[h].defaultLoadout];
            handleSelectHero(h);
            multiplayerClient.setHero(h, targetLoadout);
          }}
          onSelectNormalSkill={(skId) => {
            const cur = loadoutsByHero[heroId];
            if (cur[0] === skId || cur[1] === skId) return;
            const next: SkillLoadout = [cur[1], skId, cur[2]];
            setLoadoutsByHero((prev) => ({ ...prev, [heroId]: next }));
            multiplayerClient.setHero(heroId, next);
          }}
          onSetNormalSlot={(slotIdx, skId) => {
            const next: SkillLoadout = [...loadoutsByHero[heroId]];
            const otherSlot = slotIdx === 0 ? 1 : 0;
            if (next[otherSlot] === skId) {
              next[otherSlot] = next[slotIdx];
            }
            next[slotIdx] = skId;
            setLoadoutsByHero((prev) => ({ ...prev, [heroId]: next }));
            multiplayerClient.setHero(heroId, next);
          }}
          onSwapNormalSlots={() => {
            const cur = loadoutsByHero[heroId];
            const next: SkillLoadout = [cur[1], cur[0], cur[2]];
            setLoadoutsByHero((prev) => ({ ...prev, [heroId]: next }));
            multiplayerClient.setHero(heroId, next);
          }}
          onSelectUltimateSkill={(ultId) => {
            const cur = loadoutsByHero[heroId];
            const next: SkillLoadout = [cur[0], cur[1], ultId];
            setLoadoutsByHero((prev) => ({ ...prev, [heroId]: next }));
            multiplayerClient.setHero(heroId, next);
          }}
          onToggleReady={() => {
            const me = roomDetails.players.find(
              (p) => p.id === multiplayerClient.getLocalPlayerId()
            );
            multiplayerClient.setReady(!(me?.ready ?? false));
          }}
          onStartGame={handleStartMultiplayerGame}
          onLeaveRoom={handleLeaveMultiplayerRoom}
          errorMessage={multiplayerError}
        />
      )}

      {/* === PHASE 2: COMPACT SINGLE-SCREEN HERO & SKILL SELECTION === */}
      {phase === GamePhase.HERO_SELECT && (
        <HeroSelectScreen
          heroId={heroId}
          loadout={activeLoadout}
          isFullscreen={isFullscreen}
          onSelectHero={handleSelectHero}
          onSelectNormalSkill={handleQuickSelectNormal}
          onSetNormalSlot={handleSetNormalSlot}
          onSwapNormalSlots={handleSwapNormalSlots}
          onSelectUltimateSkill={handleSetUltimateSlot}
          onToggleFullscreen={handleToggleFullscreen}
          onConfirmHero={handleConfirmHero}
          onOpenMultiplayer={() => handleOpenMultiplayerMenu(GamePhase.HERO_SELECT)}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {/* === PHASE 3 & 4: LIVE 60FPS GUILD HOUSE & PROCEDURAL DUNGEON === */}
      {(phase === GamePhase.GUILD_HOUSE || phase === GamePhase.DUNGEON) && (
        <>
          <canvas ref={canvasRef} className="block h-full w-full" />

          {/* Multiplayer Teammates HUD Overlay */}
          {isMultiplayer && (
            <MultiplayerHudOverlay
              teammates={engineRef.current?.getRemotePlayersList() || []}
              connectionStatus={connectionStatus}
              localIsDowned={Boolean(hud.isDowned)}
              localReviveProgress={hud.reviveProgress || 0}
              revivingTargetName={engineRef.current?.getReviveStatus().targetName || null}
              revivingProgress={engineRef.current?.getReviveStatus().progress || 0}
              portalWaiting={hud.portalWaiting || null}
            />
          )}

          {/* Top Mobile HUD */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-3 pt-2.5 sm:px-5 sm:pt-3">
            <div className="pointer-events-auto flex flex-col gap-1 rounded-2xl border border-stone-700/75 bg-stone-950/80 px-3.5 py-2 backdrop-blur-md">
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="font-semibold text-amber-100">
                  {heroDisplayName} · Lv.{hud.level}
                </span>
                <span className="font-mono-num text-stone-300">
                  HP {hud.hp}/{hud.maxHp}
                  {hud.shield > 0 ? ` (+${hud.shield})` : ''}
                </span>
              </div>

              <svg
                viewBox="0 0 200 8"
                preserveAspectRatio="none"
                className="h-2 w-44 overflow-hidden rounded-full bg-stone-800 sm:w-52"
              >
                <rect
                  x="0"
                  y="0"
                  width={hpBarWidth}
                  height="8"
                  fill={
                    heroId === 'tigerkin'
                      ? '#f59e0b'
                      : heroId === 'eaglekin'
                        ? '#38bdf8'
                        : heroId === 'human'
                          ? '#fb923c'
                          : heroId === 'ghost'
                            ? '#818cf8'
                            : heroId === 'ghoul'
                              ? '#f43f5e'
                              : heroId === 'zombie'
                                ? '#84cc16'
                                : '#10b981'
                  }
                />
                {hud.shield > 0 && (
                  <rect
                    x="0"
                    y="0"
                    width={shieldBarWidth}
                    height="8"
                    fill="#fde047"
                    fillOpacity="0.65"
                  />
                )}
              </svg>

              <svg
                viewBox="0 0 200 3"
                preserveAspectRatio="none"
                className="h-1 w-44 overflow-hidden rounded-full bg-stone-900 sm:w-52"
              >
                <rect x="0" y="0" width={xpBarWidth} height="3" fill="#38bdf8" />
              </svg>

              <div className="font-mono-num flex items-center gap-1.5 text-[11px] text-stone-300">
                <span>
                  {phase === GamePhase.GUILD_HOUSE
                    ? 'Guild House'
                    : `Graveyard of the Fallen · Floor ${hud.floor}`}
                </span>
                {phase === GamePhase.DUNGEON && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{hud.enemiesRemaining} Foes</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="text-amber-300">{hud.boneShards} Shards</span>
              </div>
            </div>

            {hud.bossInfo && (
              <div
                className={`flex max-w-xs flex-1 flex-col items-center rounded-2xl border px-2.5 py-1.5 backdrop-blur-md sm:px-4 sm:py-2 ${
                  hud.bossInfo.isLegionBoss
                    ? 'border-purple-500/80 bg-gradient-to-r from-stone-950/95 via-purple-950/60 to-rose-950/80 shadow-[0_0_20px_rgba(217,70,239,0.3)]'
                    : 'border-rose-500/50 bg-stone-950/85'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    {hud.bossInfo.isLegionBoss && (
                      <span className="shrink-0 rounded bg-rose-500/30 px-1 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-300 border border-rose-500/40">
                        Legion Boss
                      </span>
                    )}
                    <span className="font-display truncate font-semibold text-rose-200">
                      {hud.bossInfo.name}
                    </span>
                  </div>
                  <span className="font-mono-num text-[11px] text-rose-300 shrink-0">
                    {hud.bossInfo.hp}/{hud.bossInfo.maxHp}
                    {(hud.bossInfo.shield || 0) > 0 ? ` (+${hud.bossInfo.shield})` : ''}
                  </span>
                </div>
                <svg
                  viewBox="0 0 240 8"
                  preserveAspectRatio="none"
                  className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-800"
                >
                  <rect
                    x="0"
                    y="0"
                    width={Math.max(
                      0,
                      (hud.bossInfo.hp / Math.max(1, hud.bossInfo.maxHp)) * 240
                    )}
                    height="8"
                    fill={hud.bossInfo.isLegionBoss ? '#e11d48' : '#f43f5e'}
                  />
                  {(hud.bossInfo.shield || 0) > 0 && (
                    <rect
                      x="0"
                      y="0"
                      width={Math.min(
                        240,
                        ((hud.bossInfo.shield || 0) / Math.max(1, hud.bossInfo.maxHp * 0.35)) * 240
                      )}
                      height="8"
                      fill="#fde047"
                      fillOpacity="0.7"
                    />
                  )}
                </svg>
              </div>
            )}

            <div className="pointer-events-auto flex items-start gap-2">
              {hud.minimap && (
                <Minimap minimap={hud.minimap} heroId={heroId} floor={hud.floor} />
              )}

              {phase === GamePhase.GUILD_HOUSE && !isMultiplayer && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.unlock();
                    soundEngine.playUiTap();
                    handleOpenMultiplayerMenu(GamePhase.GUILD_HOUSE);
                  }}
                  className="flex min-h-[42px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-amber-400/75 bg-amber-500/20 px-3 py-2 text-xs font-bold text-amber-100 backdrop-blur-md transition-colors hover:bg-amber-500/30 active:scale-95"
                >
                  <Swords className="h-4 w-4 text-amber-300" />
                  <span>Multiplayer</span>
                </button>
              )}

              {phase === GamePhase.GUILD_HOUSE && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiTap();
                    setPhase(GamePhase.HERO_SELECT);
                  }}
                  className="flex min-h-[42px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-stone-700/80 bg-stone-950/85 px-3 py-2 text-xs font-semibold text-stone-200 backdrop-blur-md active:scale-95"
                >
                  <Users className="h-4 w-4 text-amber-200" />
                  <span className="hidden sm:inline">Heroes</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiTap();
                  setShowSkillTree(true);
                }}
                className={`flex min-h-[42px] items-center gap-1.5 whitespace-nowrap rounded-xl border bg-stone-950/85 px-3 py-2 text-xs font-semibold backdrop-blur-md active:scale-95 ${
                  heroId === 'tigerkin'
                    ? 'border-amber-400/65 text-amber-100'
                    : heroId === 'eaglekin'
                      ? 'border-sky-400/65 text-sky-100'
                      : heroId === 'human'
                        ? 'border-orange-400/65 text-orange-100'
                        : heroId === 'ghost'
                          ? 'border-indigo-400/65 text-indigo-100'
                          : heroId === 'ghoul'
                            ? 'border-rose-400/65 text-rose-100'
                            : heroId === 'zombie'
                              ? 'border-lime-400/60 text-lime-100'
                              : 'border-cyan-400/60 text-cyan-100'
                }`}
              >
                <Sparkles
                  className={`h-4 w-4 ${
                    heroId === 'tigerkin'
                      ? 'text-amber-300'
                      : heroId === 'eaglekin'
                        ? 'text-sky-300'
                        : heroId === 'human'
                          ? 'text-orange-300'
                          : heroId === 'ghost'
                            ? 'text-indigo-300'
                            : heroId === 'ghoul'
                              ? 'text-rose-400'
                              : heroId === 'zombie'
                                ? 'text-lime-300'
                                : 'text-cyan-300'
                  }`}
                />
                <span>
                  Skills{hud.skillPoints > 0 ? ` (${hud.skillPoints})` : ''}
                </span>
              </button>

              <button
                type="button"
                aria-label="View Active Blessings"
                onClick={() => {
                  soundEngine.playUiTap();
                  setShowBlessingsTray(true);
                }}
                className={`flex min-h-[42px] items-center gap-1.5 rounded-xl border bg-stone-950/85 px-3 py-2 text-xs font-semibold backdrop-blur-md active:scale-95 ${
                  (hud.activeBlessings?.length ?? 0) > 0
                    ? 'border-amber-400/80 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                    : 'border-stone-700/80 text-stone-300'
                }`}
              >
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span>
                  Boons ({hud.activeBlessings?.length ?? 0}/{hud.maxBlessings ?? 6})
                </span>
              </button>

              <button
                type="button"
                aria-label="View Dungeon Equipment"
                onClick={() => {
                  soundEngine.playUiTap();
                  setShowEquipment(true);
                }}
                className={`flex min-h-[42px] items-center gap-1.5 rounded-xl border bg-stone-950/85 px-3 py-2 text-xs font-semibold backdrop-blur-md active:scale-95 ${
                  equipmentManager.getEquippedCountForHero(heroId) > 0
                    ? 'border-amber-400/80 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                    : 'border-stone-700/80 text-stone-300'
                }`}
              >
                <Shield className="h-4 w-4 text-amber-400" />
                <span>
                  Relics ({equipmentManager.getEquippedCountForHero(heroId)}/6)
                </span>
              </button>

              <button
                type="button"
                aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                onClick={handleToggleFullscreen}
                className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-stone-700/80 bg-stone-950/85 text-amber-200 backdrop-blur-md active:scale-95"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>

              <button
                type="button"
                aria-label="Settings"
                onClick={() => {
                  soundEngine.playUiTap();
                  setShowSettings(true);
                }}
                className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-stone-700/80 bg-stone-950/85 text-stone-200 backdrop-blur-md active:scale-95"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Post-boss options are handled purely via the in-world animated portals! */}

          {hud.runOutcome === 'defeat' && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
              <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-stone-700 bg-[#181310] p-5 text-center shadow-2xl">
                <h2 className="font-display text-xl font-bold text-rose-200 sm:text-2xl">
                  Fallen in the Graveyard
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-300 sm:text-sm">
                  You reform safely beside the warm Guild Hearth. Shards and glory remain,
                  while skill levels and trees reset for your next graveyard expedition!
                </p>
                <div className="mt-4 flex w-full flex-col gap-2.5 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      if (isMultiplayer) {
                        handleLeaveMultiplayerRoom();
                      } else {
                        engineRef.current?.enterGuildHouse();
                        setSkillRanks(createInitialSkillRanks());
                      }
                    }}
                    className="min-h-[44px] flex-1 whitespace-nowrap rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-stone-950"
                  >
                    {isMultiplayer ? 'Leave to Lobby' : 'Return to Guild House'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isMultiplayer) {
                        handleLeaveMultiplayerRoom();
                      } else {
                        engineRef.current?.enterDungeon(1);
                        setSkillRanks(createInitialSkillRanks());
                      }
                    }}
                    className="min-h-[44px] flex-1 whitespace-nowrap rounded-xl border border-stone-600 bg-stone-900 px-4 py-2 text-sm font-semibold text-stone-200"
                  >
                    {isMultiplayer ? 'Back to Menu' : 'Play Again'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <MobaControls
            heroId={heroId}
            loadout={activeLoadout}
            skillRanks={skillRanks}
            cooldowns={hud.cooldowns}
            maxCooldowns={hud.maxCooldowns}
            skillButtonScale={settings.skillButtonScale}
            joystickScale={settings.joystickScale}
            isForcedCssLandscape={isForcedCssLandscape}
            nearInteraction={hud.nearInteraction}
            nearInteractionLabel={hud.nearInteractionLabel}
            onJoystickMove={handleJoystickMove}
            onBasicAttackHeld={handleBasicAttackHeld}
            onSkillAim={handleSkillAim}
            onSkillCast={handleSkillCast}
            onInteract={handleInteract}
            onOpenSkillTree={handleOpenSkillTree}
            onOpenBlacksmith={() => setShowBlacksmith(true)}
          />
        </>
      )}

      {/* 60fps GPU-Composited Dimensional Portal Warp Overlay (transform & opacity only) */}
      {portalWarp && (
        <div
          key={portalWarp.seq}
          className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
          aria-hidden="true"
        >
          <div
            className={`animate-portal-warp-backdrop absolute inset-0 ${
              portalWarp.kind === 'lobby'
                ? 'bg-radial from-amber-300/45 via-amber-950/55 to-stone-950/85'
                : 'bg-radial from-cyan-300/45 via-indigo-950/60 to-slate-950/90'
            }`}
          />
          <div
            className={`animate-portal-warp-ring absolute left-1/2 top-1/2 h-64 w-64 rounded-full border-4 border-dashed ${
              portalWarp.kind === 'lobby' ? 'border-amber-300/90' : 'border-cyan-300/90'
            }`}
          />
          <div
            className={`animate-portal-warp-counter absolute left-1/2 top-1/2 h-44 w-44 rounded-full border-2 ${
              portalWarp.kind === 'lobby' ? 'border-rose-300/85' : 'border-purple-400/85'
            }`}
          />
          <div
            className={`animate-portal-warp-core absolute left-1/2 top-1/2 h-28 w-28 rounded-full ${
              portalWarp.kind === 'lobby' ? 'bg-amber-100/80' : 'bg-cyan-100/80'
            }`}
          />
        </div>
      )}

      {showSkillTree && (
        <SkillTreeModal
          heroId={heroId}
          skillRanks={skillRanks}
          skillPoints={hud.skillPoints}
          loadout={activeLoadout}
          isDungeon={phase === GamePhase.DUNGEON && !hud.runOutcome}
          onUpgradeSkill={handleUpgradeSkill}
          onSetNormalSlot={handleSetNormalSlot}
          onSetUltimateSlot={handleSetUltimateSlot}
          onClose={() => setShowSkillTree(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          isFullscreen={isFullscreen}
          fullscreenBlockedNote={fullscreenBlockedNote}
          isDungeon={phase === GamePhase.DUNGEON}
          isMultiplayer={isMultiplayer}
          onUpdateSettings={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
          onToggleFullscreen={handleToggleFullscreen}
          onReturnToGuild={() => {
            if (isMultiplayer) {
              handleLeaveMultiplayerRoom();
            } else {
              engineRef.current?.enterGuildHouse();
            }
          }}
          onReturnToLobby={() => {
            if (isMultiplayer) {
              handleLeaveMultiplayerRoom();
            } else {
              multiplayerReplacedMapRef.current = false;
              engineRef.current?.enterGuildHouse();
              engineRef.current?.resetRunProgression();
              setSkillRanks(createInitialSkillRanks());
            }
            setShowSettings(false);
            setPhase(GamePhase.HERO_SELECT);
          }}
          onOpenMultiplayer={() =>
            handleOpenMultiplayerMenu(
              phase === GamePhase.GUILD_HOUSE ||
                phase === GamePhase.DUNGEON ||
                phase === GamePhase.HERO_SELECT
                ? phase
                : GamePhase.TITLE
            )
          }
          onLeaveMultiplayer={handleLeaveMultiplayerRoom}
          onClose={() => setShowSettings(false)}
        />
      )}

      {blessingOptions && blessingOptions.length > 0 && (
        <BlessingSelectionModal
          heroId={heroId}
          options={blessingOptions}
          currentCount={hud.activeBlessings?.length ?? 0}
          maxCount={hud.maxBlessings ?? 6}
          onSelectBlessing={(blessing) => {
            try {
              if (engineRef.current) {
                engineRef.current.addBlessing(blessing);
              }
            } catch (err) {
              console.error('Failed to add blessing:', err);
            } finally {
              setBlessingOptions(null);
            }
          }}
          onClose={() => setBlessingOptions(null)}
        />
      )}

      {showBlessingsTray && (
        <BlessingsTrayModal
          heroId={heroId}
          blessings={hud.activeBlessings ?? []}
          maxBlessings={hud.maxBlessings ?? 6}
          onClose={() => setShowBlessingsTray(false)}
        />
      )}

      <EquipmentDropBanner
        drop={equipmentDrop}
        onDismiss={() => setEquipmentDrop(null)}
      />

      {showEquipment && (
        <EquipmentModal
          heroId={heroId}
          onClose={() => setShowEquipment(false)}
          onEquipmentChanged={() => {
            engineRef.current?.applyEquipmentChanges();
          }}
        />
      )}

      {showBlacksmith && (
        <BlacksmithModal
          heroId={heroId}
          boneShards={hud.boneShards}
          onEnhance={(itemId) => {
            if (!engineRef.current) {
              return { success: false, newLevel: 0, cost: 0, error: 'Engine unavailable' };
            }
            return engineRef.current.enhanceEquipment(itemId);
          }}
          onClose={() => setShowBlacksmith(false)}
          onEquipmentChanged={() => {
            engineRef.current?.applyEquipmentChanges();
          }}
        />
      )}
    </div>
  );
}
