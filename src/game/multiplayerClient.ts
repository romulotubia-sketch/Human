import { EnemyEntity, HeroId, SkillLoadout, WorldMap } from '../types/game';
import {
  RemotePlayerSyncState,
  RoomDetails,
  SyncEnemyState,
  SyncLootItem,
} from '../types/multiplayer';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface MultiplayerCallbacks {
  onLobbyUpdate?: (details: RoomDetails) => void;
  onGameStart?: (
    floor: number,
    map: WorldMap,
    enemies: EnemyEntity[],
    players: RoomDetails['players']
  ) => void;
  onGameTick?: (
    players: Record<string, RemotePlayerSyncState>,
    enemies: SyncEnemyState[]
  ) => void;
  onPlayerAttack?: (playerId: string, attackData: any) => void;
  onPlayerSkill?: (playerId: string, skillData: any) => void;
  onEnemyDamaged?: (
    enemyId: number,
    hp: number,
    damage: number,
    isCrit: boolean,
    sparkColor: string,
    attackerId: string
  ) => void;
  onEnemyDied?: (enemyId: number, killerId: string, loot: SyncLootItem[]) => void;
  onLootCollected?: (lootId: number, collectorId: string, kind: string, value: number) => void;
  onPlayerDowned?: (playerId: string, name: string) => void;
  onPlayerRevived?: (targetId: string, reviverId: string) => void;
  onNextFloor?: (floor: number, map: WorldMap, enemies: EnemyEntity[]) => void;
  onGameOver?: (reason: string, floorReached: number) => void;
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
  private reconnectTimer: any = null;
  private shouldReconnect = false;
  private lastStateSendTime = 0;

  constructor() {
    // Check saved session in case of page reload or brief network drop
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('bonehearth_mp_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          this.localPlayerId = parsed.playerId;
          this.currentRoomCode = parsed.roomCode;
        }
      } catch (e) {
        // ignore
      }
    }
  }

  public setCallbacks(callbacks: MultiplayerCallbacks) {
    this.callbacks = callbacks;
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
      } catch (e) {
        // ignore
      }
    }
  }

  private clearSession() {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('bonehearth_mp_session');
      } catch (e) {
        // ignore
      }
    }
    this.localPlayerId = null;
    this.currentRoomCode = null;
    this.isHost = false;
  }

  public connect(): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.status = 'connecting';
      this.callbacks.onConnectionChange?.('connecting');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.status = 'connected';
          this.reconnectAttempts = 0;
          this.callbacks.onConnectionChange?.('connected');

          // If we had a stored session, try to reconnect
          if (this.currentRoomCode && this.localPlayerId) {
            this.send({
              type: 'c:reconnect',
              roomCode: this.currentRoomCode,
              playerId: this.localPlayerId,
            });
          }

          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = () => {
          this.status = 'disconnected';
          this.callbacks.onConnectionChange?.('disconnected');

          if (this.shouldReconnect && this.currentRoomCode) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (err) => {
          console.warn('[MultiplayerClient] WebSocket connection error:', err);
          if (this.status === 'connecting') {
            reject(err);
          }
        };
      } catch (err) {
        this.status = 'disconnected';
        this.callbacks.onConnectionChange?.('disconnected');
        reject(err);
      }
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect().catch(() => {});
      }
    }, delay);
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public async createRoom(playerName: string, heroId: HeroId, loadout: SkillLoadout): Promise<string> {
    this.shouldReconnect = true;
    await this.connect();

    return new Promise((resolve) => {
      const onCreated = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 's:room_created') {
            this.ws?.removeEventListener('message', onCreated);
            this.currentRoomCode = data.roomCode;
            this.localPlayerId = data.playerId;
            this.isHost = true;
            this.saveSession();
            resolve(data.roomCode);
          }
        } catch (e) {
          // ignore
        }
      };

      this.ws?.addEventListener('message', onCreated);
      this.send({
        type: 'c:create_room',
        playerName,
        heroId,
        loadout,
      });
    });
  }

  public async joinRoom(
    roomCode: string,
    playerName: string,
    heroId: HeroId,
    loadout: SkillLoadout
  ): Promise<{ success: boolean; error?: string }> {
    this.shouldReconnect = true;
    await this.connect();

    return new Promise((resolve) => {
      const onJoined = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 's:room_joined') {
            this.ws?.removeEventListener('message', onJoined);
            this.currentRoomCode = data.roomCode;
            this.localPlayerId = data.playerId;
            this.isHost = Boolean(data.isHost);
            this.saveSession();
            if (data.roomDetails) {
              this.callbacks.onLobbyUpdate?.(data.roomDetails);
            }
            resolve({ success: true });
          } else if (data.type === 's:join_error') {
            this.ws?.removeEventListener('message', onJoined);
            resolve({ success: false, error: data.error });
          }
        } catch (e) {
          // ignore
        }
      };

      this.ws?.addEventListener('message', onJoined);
      this.send({
        type: 'c:join_room',
        roomCode,
        playerName,
        heroId,
        loadout,
      });
    });
  }

  public async quickJoin(
    playerName: string,
    heroId: HeroId,
    loadout: SkillLoadout
  ): Promise<{ success: boolean; roomCode?: string; error?: string }> {
    this.shouldReconnect = true;
    await this.connect();

    return new Promise((resolve) => {
      const onJoined = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 's:room_joined') {
            this.ws?.removeEventListener('message', onJoined);
            this.currentRoomCode = data.roomCode;
            this.localPlayerId = data.playerId;
            this.isHost = Boolean(data.isHost);
            this.saveSession();
            resolve({ success: true, roomCode: data.roomCode });
          } else if (data.type === 's:join_error') {
            this.ws?.removeEventListener('message', onJoined);
            resolve({ success: false, error: data.error });
          }
        } catch (e) {
          // ignore
        }
      };

      this.ws?.addEventListener('message', onJoined);
      this.send({
        type: 'c:quick_join',
        playerName,
        heroId,
        loadout,
      });
    });
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
    this.send({ type: 'c:leave_room' });
    this.clearSession();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public sendPlayerState(state: Partial<RemotePlayerSyncState>) {
    const now = performance.now();
    // Throttle to 25Hz (every 40ms) to ensure smooth 60fps interpolation without flooding network
    if (now - this.lastStateSendTime < 38) return;
    this.lastStateSendTime = now;

    this.send({
      type: 'c:player_state',
      state,
    });
  }

  public sendAttack(comboStep: number, facing: number, x: number, y: number, reach: number) {
    this.send({
      type: 'c:player_attack',
      comboStep,
      facing,
      x,
      y,
      reach,
    });
  }

  public sendSkill(
    skillId: string,
    isManual: boolean,
    angle: number,
    distanceRatio: number,
    x: number,
    y: number
  ) {
    this.send({
      type: 'c:player_skill',
      skillId,
      isManual,
      angle,
      distanceRatio,
      x,
      y,
    });
  }

  public sendEnemyDamage(
    enemyId: number,
    damage: number,
    isCrit: boolean,
    sparkColor: string
  ) {
    this.send({
      type: 'c:enemy_damage',
      enemyId,
      damage,
      isCrit,
      sparkColor,
    });
  }

  public sendLootPickup(lootId: number) {
    this.send({
      type: 'c:loot_pickup',
      lootId,
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

  public sendEnterPortal() {
    this.send({
      type: 'c:enter_portal',
    });
  }

  private handleMessage(raw: string) {
    try {
      const data = JSON.parse(raw);

      switch (data.type) {
        case 's:lobby_update':
          this.callbacks.onLobbyUpdate?.(data.roomDetails);
          break;

        case 's:game_start':
          this.callbacks.onGameStart?.(
            data.floor,
            data.dungeonMap,
            data.enemies,
            data.players
          );
          break;

        case 's:game_tick':
          this.callbacks.onGameTick?.(data.players, data.enemies);
          break;

        case 's:player_attack':
          this.callbacks.onPlayerAttack?.(data.playerId, data);
          break;

        case 's:player_skill':
          this.callbacks.onPlayerSkill?.(data.playerId, data);
          break;

        case 's:enemy_damaged':
          this.callbacks.onEnemyDamaged?.(
            data.enemyId,
            data.hp,
            data.damage,
            data.isCrit,
            data.sparkColor,
            data.attackerId
          );
          break;

        case 's:enemy_died':
          this.callbacks.onEnemyDied?.(data.enemyId, data.killerId, data.loot);
          break;

        case 's:loot_collected':
          this.callbacks.onLootCollected?.(
            data.lootId,
            data.collectorId,
            data.kind,
            data.value
          );
          break;

        case 's:player_downed':
          this.callbacks.onPlayerDowned?.(data.playerId, data.name);
          break;

        case 's:player_revived':
          this.callbacks.onPlayerRevived?.(data.targetId, data.reviverId);
          break;

        case 's:next_floor':
          this.callbacks.onNextFloor?.(data.floor, data.dungeonMap, data.enemies);
          break;

        case 's:game_over':
          this.callbacks.onGameOver?.(data.reason, data.floorReached);
          break;

        case 's:host_migrated':
          if (data.newHostId === this.localPlayerId) {
            this.isHost = true;
          }
          break;

        case 's:start_error':
        case 's:error':
          this.callbacks.onError?.(data.error || data.message || 'Error occurred');
          break;

        case 's:sync_full_state':
          if (data.dungeonMap && data.enemies) {
            this.callbacks.onGameStart?.(
              data.floor,
              data.dungeonMap,
              data.enemies,
              data.players
            );
          }
          break;
      }
    } catch (err) {
      console.error('[MultiplayerClient] Error parsing message:', err);
    }
  }
}

export const multiplayerClient = new MultiplayerClient();
