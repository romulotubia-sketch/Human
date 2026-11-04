import {
  ActiveSkillId,
  EnemyEntity,
  HeroId,
  SkillLoadout,
  WorldMap,
  WorldProp,
} from '../types/game';
import {
  ClientAttackMessage,
  ClientSkillMessage,
  FullGameSyncPayload,
  RemotePlayerSyncState,
  RoomDetails,
  SyncEnemyAttackEvent,
  SyncEnemyState,
  SyncLootItem,
} from '../types/multiplayer';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface MultiplayerCallbacks {
  onLobbyUpdate?: (details: RoomDetails) => void;
  onHostMigrated?: (newHostId: string, newHostName: string) => void;
  onGameStart?: (payload: {
    floor: number;
    map: WorldMap;
    enemies: EnemyEntity[];
    players: RemotePlayerSyncState[];
    roomDetails?: RoomDetails;
  }) => void;
  onGameTick?: (payload: {
    players: Record<string, RemotePlayerSyncState>;
    enemies: SyncEnemyState[];
  }) => void;
  onPlayerAttack?: (playerId: string, attackData: ClientAttackMessage) => void;
  onPlayerSkill?: (playerId: string, skillData: ClientSkillMessage) => void;
  onPlayerDamaged?: (payload: {
    playerId: string;
    hp: number;
    shield: number;
    damage: number;
    blocked: boolean;
  }) => void;
  onEnemyAttack?: (evt: SyncEnemyAttackEvent) => void;
  onEnemyDamaged?: (payload: {
    enemyId: number;
    hp: number;
    shieldHp?: number;
    damage: number;
    isCrit: boolean;
    sparkColor: string;
    attackerId: string;
  }) => void;
  onEnemyDied?: (payload: {
    enemyId: number;
    killerId: string;
    isBoss: boolean;
    loot: SyncLootItem[];
  }) => void;
  onLootCollected?: (payload: {
    lootId: number;
    collectorId: string;
    kind: 'shard' | 'heal' | 'xp' | 'boss_essence';
    value: number;
  }) => void;
  onChestOpened?: (payload: { propId: string; openerId: string; openerName?: string }) => void;
  onPlayerDowned?: (payload: { playerId: string; name: string }) => void;
  onPlayerRevived?: (payload: { targetId: string; reviverId: string; hp: number }) => void;
  onPlayerDisconnected?: (payload: { playerId: string; name: string }) => void;
  onPlayerReconnected?: (payload: { playerId: string; name: string }) => void;
  onPlayerLeft?: (payload: { playerId: string; name: string }) => void;
  onFloorCleared?: (payload: { floor: number; portalProp?: WorldProp; portalProps?: WorldProp[] }) => void;
  onPortalWaiting?: (payload: {
    readyCount: number;
    requiredCount: number;
    portalTarget?: 'next' | 'lobby';
  }) => void;
  onNextFloor?: (payload: {
    floor: number;
    map: WorldMap;
    enemies: EnemyEntity[];
    players: RemotePlayerSyncState[];
  }) => void;
  onFullStateSync?: (payload: FullGameSyncPayload) => void;
  onGameOver?: (payload: { reason: string; floorReached: number }) => void;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onError?: (message: string) => void;
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private callbacks: MultiplayerCallbacks = {};
  private localPlayerId: string | null = null;
  private currentRoomCode: string | null = null;
  private isHost = false;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private shouldReconnect = false;
  private lastStateSendTime = 0;
  private connectPromise: Promise<void> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('bonehearth_mp_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.playerId && parsed?.roomCode) {
            this.localPlayerId = parsed.playerId;
            this.currentRoomCode = parsed.roomCode;
          }
        }
      } catch {
        // ignore storage errors
      }
    }
  }

  public setCallbacks(callbacks: MultiplayerCallbacks) {
    this.callbacks = callbacks;
  }

  public tryAutoReconnectIfSaved() {
    if (this.currentRoomCode && this.localPlayerId && !this.ws) {
      this.shouldReconnect = true;
      this.connect().catch(() => {});
    }
  }

  public getLocalPlayerId(): string | null {
    return this.localPlayerId;
  }

  public getRoomCode(): string | null {
    return this.currentRoomCode;
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  private saveSession() {
    if (typeof window !== 'undefined' && this.localPlayerId && this.currentRoomCode) {
      try {
        sessionStorage.setItem(
          'bonehearth_mp_session',
          JSON.stringify({
            playerId: this.localPlayerId,
            roomCode: this.currentRoomCode,
          })
        );
      } catch {
        // ignore
      }
    }
  }

  private clearSession() {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('bonehearth_mp_session');
      } catch {
        // ignore
      }
    }
    this.localPlayerId = null;
    this.currentRoomCode = null;
    this.isHost = false;
  }

  public connect(skipAutoSessionReconnect = false): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    if (this.connectPromise && this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise((resolve, reject) => {
      this.status = 'connecting';
      this.callbacks.onConnectionChange?.('connecting');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        const socket = new WebSocket(wsUrl);
        this.ws = socket;

        socket.onopen = () => {
          this.status = 'connected';
          this.reconnectAttempts = 0;
          this.connectPromise = null;
          this.callbacks.onConnectionChange?.('connected');

          if (!skipAutoSessionReconnect && this.currentRoomCode && this.localPlayerId) {
            this.send({
              type: 'c:reconnect',
              roomCode: this.currentRoomCode,
              playerId: this.localPlayerId,
            });
          }

          resolve();
        };

        socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        socket.onclose = () => {
          this.connectPromise = null;
          this.status = 'disconnected';
          this.callbacks.onConnectionChange?.('disconnected');

          if (this.shouldReconnect && this.currentRoomCode) {
            this.scheduleReconnect();
          }
        };

        socket.onerror = (err) => {
          this.connectPromise = null;
          if (this.status === 'connecting') {
            reject(err);
          }
        };
      } catch (err) {
        this.connectPromise = null;
        this.status = 'disconnected';
        this.callbacks.onConnectionChange?.('disconnected');
        reject(err);
      }
    });

    return this.connectPromise;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
    }
    const delay = Math.min(1000 * Math.pow(1.45, this.reconnectAttempts), 6000);
    this.reconnectAttempts++;

    this.reconnectTimer = window.setTimeout(() => {
      if (this.shouldReconnect && this.currentRoomCode) {
        this.connect(false).catch(() => {});
      }
    }, delay);
  }

  private send(data: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public async createRoom(playerName: string, heroId: HeroId, loadout: SkillLoadout): Promise<void> {
    this.clearSession();
    this.shouldReconnect = true;
    try {
      await this.connect(true);
      this.send({
        type: 'c:create_room',
        playerName,
        heroId,
        loadout,
      });
    } catch {
      this.callbacks.onError?.('Unable to connect to multiplayer server.');
    }
  }

  public async joinRoom(
    roomCode: string,
    playerName: string,
    heroId: HeroId,
    loadout: SkillLoadout
  ): Promise<void> {
    this.clearSession();
    this.shouldReconnect = true;
    try {
      await this.connect(true);
      this.send({
        type: 'c:join_room',
        roomCode,
        playerName,
        heroId,
        loadout,
      });
    } catch {
      this.callbacks.onError?.('Unable to connect to multiplayer server.');
    }
  }

  public async quickJoin(
    playerName: string,
    heroId: HeroId,
    loadout: SkillLoadout
  ): Promise<void> {
    this.clearSession();
    this.shouldReconnect = true;
    try {
      await this.connect(true);
      this.send({
        type: 'c:quick_join',
        playerName,
        heroId,
        loadout,
      });
    } catch {
      this.callbacks.onError?.('Unable to connect to multiplayer server.');
    }
  }

  public setReady(ready: boolean) {
    this.send({ type: 'c:set_ready', ready });
  }

  public setHero(heroId: HeroId, loadout: SkillLoadout) {
    this.send({ type: 'c:set_hero', heroId, loadout });
  }

  public startGame() {
    this.send({ type: 'c:start_game' });
  }

  public leaveRoom() {
    this.shouldReconnect = false;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.send({ type: 'c:leave_room' });
    this.clearSession();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public sendPlayerState(state: Partial<RemotePlayerSyncState>) {
    const now = performance.now();
    // 25Hz throttled updates for silky 60fps remote interpolation
    if (now - this.lastStateSendTime < 38) return;
    this.lastStateSendTime = now;

    this.send({
      type: 'c:player_state',
      state,
    });
  }

  public sendPlayerHealOrShield(healAmount: number, shieldAmount: number) {
    this.send({
      type: 'c:player_heal',
      healAmount,
      shieldAmount,
    });
  }

  public sendAttack(payload: ClientAttackMessage) {
    this.send({
      type: 'c:player_attack',
      ...payload,
    });
  }

  public sendSkill(
    skillId: ActiveSkillId,
    rank: number,
    isManual: boolean,
    angle: number,
    distanceRatio: number,
    x: number,
    y: number,
    isTransformed = false
  ) {
    this.send({
      type: 'c:player_skill',
      skillId,
      rank,
      isManual,
      angle,
      distanceRatio,
      x,
      y,
      isTransformed,
    });
  }

  public sendEnemyDamage(
    enemyId: number,
    damage: number,
    isCrit: boolean,
    sparkColor: string,
    slowDuration = 0,
    staggerDuration = 0
  ) {
    this.send({
      type: 'c:enemy_damage',
      enemyId,
      damage,
      isCrit,
      sparkColor,
      slowDuration,
      staggerDuration,
    });
  }

  public sendLootPickup(lootId: number) {
    if (!lootId) return;
    this.send({
      type: 'c:loot_pickup',
      lootId,
    });
  }

  public sendOpenChest(propId: string) {
    this.send({
      type: 'c:open_chest',
      propId,
    });
  }

  public sendStartRevive(targetPlayerId: string) {
    this.send({
      type: 'c:start_revive',
      targetPlayerId,
    });
  }

  public sendCancelRevive() {
    this.send({
      type: 'c:cancel_revive',
    });
  }

  public sendEnterPortal(portalKind: 'next' | 'lobby' = 'next') {
    this.send({
      type: 'c:enter_portal',
      portalKind,
    });
  }

  private handleMessage(raw: string) {
    try {
      const data = JSON.parse(raw);

      switch (data.type) {
        case 's:room_created':
        case 's:room_joined': {
          this.currentRoomCode = data.roomCode;
          this.localPlayerId = data.playerId;
          this.isHost = Boolean(data.isHost);
          this.saveSession();
          if (data.roomDetails) {
            this.callbacks.onLobbyUpdate?.(data.roomDetails);
          }
          break;
        }

        case 's:join_error':
        case 's:start_error':
        case 's:error': {
          this.callbacks.onError?.(data.error || data.message || 'Multiplayer error occurred.');
          break;
        }

        case 's:lobby_update': {
          if (data.roomDetails) {
            this.isHost = data.roomDetails.hostId === this.localPlayerId;
            this.callbacks.onLobbyUpdate?.(data.roomDetails);
          }
          break;
        }

        case 's:host_migrated': {
          this.isHost = data.newHostId === this.localPlayerId;
          this.callbacks.onHostMigrated?.(data.newHostId, data.newHostName || 'Host');
          break;
        }

        case 's:game_start': {
          this.callbacks.onGameStart?.({
            floor: data.floor,
            map: data.dungeonMap,
            enemies: data.enemies,
            players: data.players || [],
            roomDetails: data.roomDetails,
          });
          break;
        }

        case 's:game_tick': {
          this.callbacks.onGameTick?.({
            players: data.players || {},
            enemies: data.enemies || [],
          });
          break;
        }

        case 's:player_attack': {
          this.callbacks.onPlayerAttack?.(data.playerId, data);
          break;
        }

        case 's:player_skill': {
          this.callbacks.onPlayerSkill?.(data.playerId, data);
          break;
        }

        case 's:player_damaged': {
          this.callbacks.onPlayerDamaged?.({
            playerId: data.playerId,
            hp: data.hp,
            shield: data.shield,
            damage: data.damage,
            blocked: Boolean(data.blocked),
          });
          break;
        }

        case 's:enemy_attack': {
          this.callbacks.onEnemyAttack?.(data);
          break;
        }

        case 's:enemy_damaged': {
          this.callbacks.onEnemyDamaged?.({
            enemyId: data.enemyId,
            hp: data.hp,
            shieldHp: typeof data.shieldHp === 'number' ? data.shieldHp : undefined,
            damage: data.damage,
            isCrit: Boolean(data.isCrit),
            sparkColor: data.sparkColor || '#ffffff',
            attackerId: data.attackerId,
          });
          break;
        }

        case 's:enemy_died': {
          this.callbacks.onEnemyDied?.({
            enemyId: data.enemyId,
            killerId: data.killerId,
            isBoss: Boolean(data.isBoss),
            loot: data.loot || [],
          });
          break;
        }

        case 's:loot_collected': {
          this.callbacks.onLootCollected?.({
            lootId: data.lootId,
            collectorId: data.collectorId,
            kind: data.kind,
            value: data.value,
          });
          break;
        }

        case 's:chest_opened': {
          this.callbacks.onChestOpened?.({
            propId: data.propId,
            openerId: data.openerId,
            openerName: data.openerName,
          });
          break;
        }

        case 's:player_downed': {
          this.callbacks.onPlayerDowned?.({
            playerId: data.playerId,
            name: data.name || 'Ally',
          });
          break;
        }

        case 's:player_revived': {
          this.callbacks.onPlayerRevived?.({
            targetId: data.targetId,
            reviverId: data.reviverId,
            hp: data.hp || 100,
          });
          break;
        }

        case 's:player_disconnected': {
          this.callbacks.onPlayerDisconnected?.({
            playerId: data.playerId,
            name: data.name || 'Ally',
          });
          break;
        }

        case 's:player_reconnected': {
          this.callbacks.onPlayerReconnected?.({
            playerId: data.playerId,
            name: data.name || 'Ally',
          });
          break;
        }

        case 's:player_left': {
          this.callbacks.onPlayerLeft?.({
            playerId: data.playerId,
            name: data.name || 'Ally',
          });
          break;
        }

        case 's:floor_cleared': {
          this.callbacks.onFloorCleared?.({
            floor: data.floor,
            portalProp: data.portalProp,
            portalProps: Array.isArray(data.portalProps) ? data.portalProps : undefined,
          });
          break;
        }

        case 's:portal_waiting': {
          this.callbacks.onPortalWaiting?.({
            readyCount: data.readyCount,
            requiredCount: data.requiredCount,
            portalTarget: data.portalTarget === 'lobby' ? 'lobby' : 'next',
          });
          break;
        }

        case 's:next_floor': {
          this.callbacks.onNextFloor?.({
            floor: data.floor,
            map: data.dungeonMap,
            enemies: data.enemies || [],
            players: data.players || [],
          });
          break;
        }

        case 's:sync_full_state': {
          if (data.roomDetails) {
            this.isHost = data.roomDetails.hostId === this.localPlayerId;
          }
          this.callbacks.onFullStateSync?.(data);
          break;
        }

        case 's:game_over': {
          this.callbacks.onGameOver?.({
            reason: data.reason || 'All heroes have fallen.',
            floorReached: data.floorReached || 1,
          });
          break;
        }

        case 's:reconnect_failed': {
          this.shouldReconnect = false;
          this.clearSession();
          break;
        }
      }
    } catch (err) {
      console.error('[MultiplayerClient] Error parsing message:', err);
    }
  }
}

export const multiplayerClient = new MultiplayerClient();
