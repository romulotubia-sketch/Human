import { WebSocket } from 'ws';
import { buildProceduralDungeon } from '../game/dungeonGenerator';
import { EnemyEntity, WorldMap } from '../types/game';
import {
  LobbyPlayer,
  RemotePlayerSyncState,
  RoomDetails,
  SyncEnemyState,
  SyncLootItem,
} from '../types/multiplayer';

interface ConnectedPlayer extends LobbyPlayer {
  ws: WebSocket | null;
  disconnectTimer: NodeJS.Timeout | null;
  state: RemotePlayerSyncState;
  revivingPlayerId: string | null;
}

interface GameRoom {
  roomCode: string;
  hostId: string;
  status: 'lobby' | 'playing' | 'game_over';
  floor: number;
  players: Map<string, ConnectedPlayer>;
  dungeonMap: WorldMap | null;
  enemies: Map<number, EnemyEntity>;
  loot: Map<number, SyncLootItem>;
  nextFloorReady: Set<string>;
  loopInterval: NodeJS.Timeout | null;
  lastTickTime: number;
  createdAt: number;
}

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private playerRoomMap = new Map<string, string>(); // playerId -> roomCode
  private nextLootId = 1000;

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return this.rooms.has(code) ? this.generateCode() : code;
  }

  public getPublicLobbies(): RoomDetails[] {
    const result: RoomDetails[] = [];
    for (const room of this.rooms.values()) {
      if (room.status === 'lobby' && room.players.size < 4) {
        result.push(this.formatRoomDetails(room));
      }
    }
    return result;
  }

  public createRoom(
    playerName: string,
    heroId: any,
    loadout: any,
    ws: WebSocket
  ): { roomCode: string; playerId: string } {
    const roomCode = this.generateCode();
    const playerId = `p_${Math.random().toString(36).substring(2, 9)}`;

    const player: ConnectedPlayer = {
      id: playerId,
      name: playerName.trim() || 'Hero',
      heroId: heroId || 'human',
      loadout: loadout || ['pipe_swing', 'headcracker', 'last_stand'],
      ready: true, // Host is ready by default
      isHost: true,
      connected: true,
      ws,
      disconnectTimer: null,
      revivingPlayerId: null,
      state: this.createInitialPlayerState(playerId, playerName, heroId),
    };

    const room: GameRoom = {
      roomCode,
      hostId: playerId,
      status: 'lobby',
      floor: 1,
      players: new Map([[playerId, player]]),
      dungeonMap: null,
      enemies: new Map(),
      loot: new Map(),
      nextFloorReady: new Set(),
      loopInterval: null,
      lastTickTime: Date.now(),
      createdAt: Date.now(),
    };

    this.rooms.set(roomCode, room);
    this.playerRoomMap.set(playerId, roomCode);

    return { roomCode, playerId };
  }

  public joinRoom(
    roomCodeInput: string,
    playerName: string,
    heroId: any,
    loadout: any,
    ws: WebSocket
  ): { success: boolean; error?: string; playerId?: string; roomDetails?: RoomDetails } {
    const code = roomCodeInput.trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      return { success: false, error: 'Room not found. Check the room code and try again.' };
    }

    if (room.status !== 'lobby') {
      return { success: false, error: 'This co-op run has already started!' };
    }

    if (room.players.size >= 4) {
      return { success: false, error: 'Room is full (Maximum 4 players).' };
    }

    const playerId = `p_${Math.random().toString(36).substring(2, 9)}`;
    const player: ConnectedPlayer = {
      id: playerId,
      name: playerName.trim() || `Adventurer ${room.players.size + 1}`,
      heroId: heroId || 'skeleton',
      loadout: loadout || ['bone_slash', 'skeletal_rush', 'bone_colossus'],
      ready: false,
      isHost: false,
      connected: true,
      ws,
      disconnectTimer: null,
      revivingPlayerId: null,
      state: this.createInitialPlayerState(playerId, playerName, heroId),
    };

    room.players.set(playerId, player);
    this.playerRoomMap.set(playerId, code);

    // Notify all players in lobby
    this.broadcastLobbyUpdate(room);

    return {
      success: true,
      playerId,
      roomDetails: this.formatRoomDetails(room),
    };
  }

  public quickJoin(
    playerName: string,
    heroId: any,
    loadout: any,
    ws: WebSocket
  ): { roomCode: string; playerId: string; isHost: boolean } {
    // Find open room
    for (const room of this.rooms.values()) {
      if (room.status === 'lobby' && room.players.size < 4) {
        const res = this.joinRoom(room.roomCode, playerName, heroId, loadout, ws);
        if (res.success && res.playerId) {
          return { roomCode: room.roomCode, playerId: res.playerId, isHost: false };
        }
      }
    }

    // Otherwise create new room
    const created = this.createRoom(playerName, heroId, loadout, ws);
    return { roomCode: created.roomCode, playerId: created.playerId, isHost: true };
  }

  public setReady(playerId: string, ready: boolean) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room || room.status !== 'lobby') return;

    const player = room.players.get(playerId);
    if (!player) return;

    player.ready = ready;
    this.broadcastLobbyUpdate(room);
  }

  public setHero(playerId: string, heroId: any, loadout: any) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room || room.status !== 'lobby') return;

    const player = room.players.get(playerId);
    if (!player) return;

    player.heroId = heroId;
    if (loadout) player.loadout = loadout;
    player.state.heroId = heroId;

    this.broadcastLobbyUpdate(room);
  }

  public startGame(playerId: string): { success: boolean; error?: string } {
    const room = this.getRoomByPlayerId(playerId);
    if (!room) return { success: false, error: 'Room not found' };
    if (room.hostId !== playerId) return { success: false, error: 'Only the host can start the game' };
    if (room.players.size < 2) return { success: false, error: 'Co-op requires at least 2 players' };

    for (const p of room.players.values()) {
      if (!p.ready) {
        return { success: false, error: 'All players must be Ready before starting!' };
      }
    }

    this.initDungeonFloor(room, 1);
    room.status = 'playing';

    // Broadcast game start to all players
    this.broadcast(room, {
      type: 's:game_start',
      floor: room.floor,
      dungeonMap: room.dungeonMap,
      enemies: Array.from(room.enemies.values()),
      players: this.formatRoomDetails(room).players,
    });

    this.startAuthoritativeLoop(room);

    return { success: true };
  }

  private initDungeonFloor(room: GameRoom, floor: number) {
    room.floor = floor;
    room.nextFloorReady.clear();

    const { map, enemies } = buildProceduralDungeon(floor);
    room.dungeonMap = map;
    room.enemies.clear();
    room.loot.clear();

    for (const e of enemies) {
      room.enemies.set(e.id, { ...e });
    }

    // Position players around the start room center
    const startRoom = map.rooms.find((r) => r.kind === 'start') || map.rooms[0];
    const spawnCenterX = startRoom ? startRoom.x + startRoom.w / 2 : 400;
    const spawnCenterY = startRoom ? startRoom.y + startRoom.h / 2 : 400;

    let idx = 0;
    for (const p of room.players.values()) {
      const offsetX = (idx % 2 === 0 ? -1 : 1) * (28 + Math.floor(idx / 2) * 22);
      const offsetY = (idx < 2 ? -1 : 1) * 25;
      p.state.x = spawnCenterX + offsetX;
      p.state.y = spawnCenterY + offsetY;
      p.state.isDowned = false;
      p.state.hp = p.state.maxHp;
      p.state.reviveProgress = 0;
      p.revivingPlayerId = null;
      idx++;
    }
  }

  public updatePlayerState(playerId: string, partialState: Partial<RemotePlayerSyncState>) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room || room.status !== 'playing') return;

    const p = room.players.get(playerId);
    if (!p) return;

    Object.assign(p.state, partialState);
  }

  public handlePlayerAttack(playerId: string, attackData: any) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room || room.status !== 'playing') return;

    // Relay attack to teammates so they render the visual animation and effects
    this.broadcast(
      room,
      {
        type: 's:player_attack',
        playerId,
        ...attackData,
      },
      playerId
    );
  }

  public handlePlayerSkill(playerId: string, skillData: any) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room || room.status !== 'playing') return;

    // Relay skill visual effect & action to all other players
    this.broadcast(
      room,
      {
        type: 's:player_skill',
        playerId,
        ...skillData,
      },
      playerId
    );
  }

  public handleEnemyDamage(playerId: string, enemyId: number, damage: number, isCrit: boolean, sparkColor: string) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room || room.status !== 'playing') return;

    const enemy = room.enemies.get(enemyId);
    if (!enemy || enemy.hp <= 0) return;

    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.hitFlashTimer = 0.12;

    this.broadcast(room, {
      type: 's:enemy_damaged',
      enemyId,
      hp: enemy.hp,
      damage,
      isCrit,
      sparkColor,
      attackerId: playerId,
    });

    if (enemy.hp <= 0) {
      this.handleEnemyDeath(room, enemy, playerId);
    }
  }

  private handleEnemyDeath(room: GameRoom, enemy: EnemyEntity, killerId: string) {
    const spawnedLoot: SyncLootItem[] = [];

    // Drop bone shards
    const shardCount = enemy.kind === 'boss' ? 8 : enemy.kind === 'brute' ? 3 : 1;
    for (let i = 0; i < shardCount; i++) {
      const lootItem: SyncLootItem = {
        id: this.nextLootId++,
        kind: 'shard',
        x: enemy.x + (Math.random() - 0.5) * 36,
        y: enemy.y + (Math.random() - 0.5) * 36,
        value: 1,
        active: true,
      };
      room.loot.set(lootItem.id, lootItem);
      spawnedLoot.push(lootItem);
    }

    // Chance for health potion
    if (Math.random() < (enemy.kind === 'boss' ? 1.0 : 0.2)) {
      const healItem: SyncLootItem = {
        id: this.nextLootId++,
        kind: 'heal',
        x: enemy.x + (Math.random() - 0.5) * 30,
        y: enemy.y + (Math.random() - 0.5) * 30,
        value: 40,
        active: true,
      };
      room.loot.set(healItem.id, healItem);
      spawnedLoot.push(healItem);
    }

    // Always drop experience
    const xpItem: SyncLootItem = {
      id: this.nextLootId++,
      kind: 'xp',
      x: enemy.x,
      y: enemy.y,
      value: enemy.kind === 'boss' ? 120 : enemy.kind === 'brute' ? 45 : 20,
      active: true,
    };
    room.loot.set(xpItem.id, xpItem);
    spawnedLoot.push(xpItem);

    this.broadcast(room, {
      type: 's:enemy_died',
      enemyId: enemy.id,
      killerId,
      loot: spawnedLoot,
    });

    // Check if all enemies on floor are defeated
    let remaining = 0;
    for (const e of room.enemies.values()) {
      if (e.hp > 0) remaining++;
    }

    if (remaining === 0) {
      this.broadcast(room, {
        type: 's:floor_cleared',
        message: 'Floor Cleared! Descend through the Portal to proceed!',
      });
    }
  }

  public handleLootPickup(playerId: string, lootId: number) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room || room.status !== 'playing') return;

    const item = room.loot.get(lootId);
    if (!item || !item.active) return;

    item.active = false;
    room.loot.delete(lootId);

    this.broadcast(room, {
      type: 's:loot_collected',
      lootId,
      collectorId: playerId,
      kind: item.kind,
      value: item.value,
    });
  }

  public handlePlayerDowned(playerId: string) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room || room.status !== 'playing') return;

    const p = room.players.get(playerId);
    if (!p) return;

    p.state.isDowned = true;
    p.state.hp = 0;
    p.state.reviveProgress = 0;

    this.broadcast(room, {
      type: 's:player_downed',
      playerId,
      name: p.name,
    });

    // Check if ALL players are downed -> Game Over!
    let anyAlive = false;
    for (const pl of room.players.values()) {
      if (pl.connected && !pl.state.isDowned) {
        anyAlive = true;
        break;
      }
    }

    if (!anyAlive) {
      room.status = 'game_over';
      if (room.loopInterval) {
        clearInterval(room.loopInterval);
        room.loopInterval = null;
      }
      this.broadcast(room, {
        type: 's:game_over',
        reason: 'All heroes have fallen in the crypts.',
        floorReached: room.floor,
      });
    }
  }

  public handleStartRevive(reviverId: string, targetPlayerId: string) {
    const room = this.getRoomByPlayerId(reviverId);
    if (!room || room.status !== 'playing') return;

    const reviver = room.players.get(reviverId);
    const target = room.players.get(targetPlayerId);

    if (!reviver || !target || !target.state.isDowned) return;

    reviver.revivingPlayerId = targetPlayerId;
  }

  public handleCancelRevive(reviverId: string) {
    const room = this.getRoomByPlayerId(reviverId);
    if (!room) return;

    const reviver = room.players.get(reviverId);
    if (reviver) {
      reviver.revivingPlayerId = null;
    }
  }

  public handleEnterPortal(playerId: string) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room || room.status !== 'playing') return;

    room.nextFloorReady.add(playerId);

    // Count living connected players
    let activeLivingCount = 0;
    for (const p of room.players.values()) {
      if (p.connected && !p.state.isDowned) activeLivingCount++;
    }

    if (room.nextFloorReady.size >= Math.max(1, activeLivingCount)) {
      // Advance to next floor
      this.initDungeonFloor(room, room.floor + 1);
      this.broadcast(room, {
        type: 's:next_floor',
        floor: room.floor,
        dungeonMap: room.dungeonMap,
        enemies: Array.from(room.enemies.values()),
        players: this.formatRoomDetails(room).players,
      });
    } else {
      this.broadcast(room, {
        type: 's:portal_waiting',
        readyCount: room.nextFloorReady.size,
        requiredCount: activeLivingCount,
      });
    }
  }

  public handleDisconnect(ws: WebSocket) {
    for (const room of this.rooms.values()) {
      for (const [playerId, player] of room.players.entries()) {
        if (player.ws === ws) {
          player.connected = false;
          player.ws = null;

          if (room.status === 'lobby') {
            // Remove immediately from lobby
            room.players.delete(playerId);
            this.playerRoomMap.delete(playerId);

            if (room.players.size === 0) {
              this.cleanupRoom(room.roomCode);
              return;
            }

            // Transfer host if host left
            if (room.hostId === playerId) {
              const nextHost = room.players.values().next().value;
              if (nextHost) {
                nextHost.isHost = true;
                nextHost.ready = true;
                room.hostId = nextHost.id;
              }
            }

            this.broadcastLobbyUpdate(room);
          } else {
            // In game: give 45-second reconnect window
            this.broadcast(room, {
              type: 's:player_disconnected',
              playerId,
              name: player.name,
            });

            if (room.hostId === playerId) {
              for (const other of room.players.values()) {
                if (other.connected) {
                  other.isHost = true;
                  room.hostId = other.id;
                  this.broadcast(room, {
                    type: 's:host_migrated',
                    newHostId: other.id,
                  });
                  break;
                }
              }
            }

            player.disconnectTimer = setTimeout(() => {
              room.players.delete(playerId);
              this.playerRoomMap.delete(playerId);

              let activeCount = 0;
              for (const p of room.players.values()) {
                if (p.connected) activeCount++;
              }

              if (activeCount === 0) {
                this.cleanupRoom(room.roomCode);
              } else {
                this.broadcast(room, {
                  type: 's:player_left',
                  playerId,
                });
              }
            }, 45000);
          }
          return;
        }
      }
    }
  }

  public handleReconnect(roomCodeInput: string, playerId: string, ws: WebSocket): boolean {
    const code = roomCodeInput.trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return false;

    const player = room.players.get(playerId);
    if (!player) return false;

    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = null;
    }

    player.connected = true;
    player.ws = ws;

    this.broadcast(room, {
      type: 's:player_reconnected',
      playerId,
      name: player.name,
    });

    // Send full current state
    ws.send(
      JSON.stringify({
        type: 's:sync_full_state',
        roomCode: room.roomCode,
        floor: room.floor,
        status: room.status,
        dungeonMap: room.dungeonMap,
        enemies: Array.from(room.enemies.values()),
        loot: Array.from(room.loot.values()),
        players: Array.from(room.players.values()).map((p) => ({
          ...p.state,
          isHost: p.isHost,
          connected: p.connected,
        })),
      })
    );

    return true;
  }

  public leaveRoom(playerId: string) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room) return;

    room.players.delete(playerId);
    this.playerRoomMap.delete(playerId);

    if (room.players.size === 0) {
      this.cleanupRoom(room.roomCode);
      return;
    }

    if (room.hostId === playerId) {
      const nextHost = room.players.values().next().value;
      if (nextHost) {
        nextHost.isHost = true;
        nextHost.ready = true;
        room.hostId = nextHost.id;
        this.broadcast(room, {
          type: 's:host_migrated',
          newHostId: nextHost.id,
        });
      }
    }

    this.broadcast(room, {
      type: 's:player_left',
      playerId,
    });

    if (room.status === 'lobby') {
      this.broadcastLobbyUpdate(room);
    }
  }

  private startAuthoritativeLoop(room: GameRoom) {
    if (room.loopInterval) clearInterval(room.loopInterval);

    room.lastTickTime = Date.now();

    room.loopInterval = setInterval(() => {
      const now = Date.now();
      const dt = Math.min((now - room.lastTickTime) / 1000, 0.1);
      room.lastTickTime = now;

      if (room.status !== 'playing') return;

      // 1. Process Revival Channels
      for (const p of room.players.values()) {
        if (!p.connected || p.state.isDowned || !p.revivingPlayerId) continue;

        const target = room.players.get(p.revivingPlayerId);
        if (!target || !target.state.isDowned) {
          p.revivingPlayerId = null;
          continue;
        }

        const dist = Math.hypot(p.state.x - target.state.x, p.state.y - target.state.y);
        if (dist <= 75) {
          target.state.reviveProgress = Math.min(1.0, target.state.reviveProgress + dt / 3.0);
          if (target.state.reviveProgress >= 1.0) {
            target.state.isDowned = false;
            target.state.hp = Math.round(target.state.maxHp * 0.45);
            target.state.reviveProgress = 0;
            p.revivingPlayerId = null;

            this.broadcast(room, {
              type: 's:player_revived',
              targetId: target.id,
              reviverId: p.id,
            });
          }
        } else {
          p.revivingPlayerId = null;
        }
      }

      // 2. Authoritative Enemy AI & Movement towards nearest living player
      const syncEnemies: SyncEnemyState[] = [];
      const livingPlayers = Array.from(room.players.values()).filter(
        (p) => p.connected && !p.state.isDowned && p.state.hp > 0
      );

      for (const enemy of room.enemies.values()) {
        if (enemy.hp <= 0) continue;

        if (enemy.hitFlashTimer > 0) {
          enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
        }

        if (enemy.attackCooldown > 0) {
          enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
        }

        if (livingPlayers.length > 0) {
          // Find nearest player
          let nearestP = livingPlayers[0];
          let minDist = Math.hypot(enemy.x - nearestP.state.x, enemy.y - nearestP.state.y);
          for (let i = 1; i < livingPlayers.length; i++) {
            const dist = Math.hypot(enemy.x - livingPlayers[i].state.x, enemy.y - livingPlayers[i].state.y);
            if (dist < minDist) {
              minDist = dist;
              nearestP = livingPlayers[i];
            }
          }

          const dx = nearestP.state.x - enemy.x;
          const dy = nearestP.state.y - enemy.y;
          const angleToP = Math.atan2(dy, dx);
          enemy.facing = angleToP;

          const isBoss = enemy.kind === 'boss';
          const attackRange = isBoss ? 95 : 62;

          if (minDist <= attackRange && enemy.attackCooldown <= 0 && enemy.windupTimer <= 0) {
            // Start telegraph attack
            enemy.windupTimer = isBoss ? 0.75 : 0.5;
            enemy.windupDuration = enemy.windupTimer;
            enemy.vx = 0;
            enemy.vy = 0;
          } else if (enemy.windupTimer > 0) {
            enemy.windupTimer -= dt;
            if (enemy.windupTimer <= 0) {
              // Execute enemy attack!
              enemy.attackCooldown = isBoss ? 1.6 : 1.25;
              const hitRadius = isBoss ? 120 : 75;
              const hitDamage = isBoss ? 28 : 14;

              // Check if any player hit
              for (const lp of livingPlayers) {
                if (Math.hypot(lp.state.x - enemy.x, lp.state.y - enemy.y) <= hitRadius) {
                  // Damage player
                  const shieldDmg = Math.min(lp.state.shield, hitDamage);
                  lp.state.shield -= shieldDmg;
                  const hpDmg = hitDamage - shieldDmg;
                  lp.state.hp = Math.max(0, lp.state.hp - hpDmg);

                  this.broadcast(room, {
                    type: 's:player_damaged',
                    playerId: lp.id,
                    hp: lp.state.hp,
                    shield: lp.state.shield,
                    damage: hitDamage,
                  });

                  if (lp.state.hp <= 0 && !lp.state.isDowned) {
                    this.handlePlayerDowned(lp.id);
                  }
                }
              }
            }
          } else if (minDist > attackRange * 0.75) {
            // Walk toward target
            const speed = enemy.speed || (isBoss ? 78 : 95);
            enemy.vx = Math.cos(angleToP) * speed;
            enemy.vy = Math.sin(angleToP) * speed;
            enemy.x += enemy.vx * dt;
            enemy.y += enemy.vy * dt;
            enemy.walkPhase += dt * 6.5;
          } else {
            enemy.vx = 0;
            enemy.vy = 0;
          }
        }

        syncEnemies.push({
          id: enemy.id,
          kind: enemy.kind,
          x: Math.round(enemy.x * 10) / 10,
          y: Math.round(enemy.y * 10) / 10,
          vx: Math.round(enemy.vx),
          vy: Math.round(enemy.vy),
          hp: enemy.hp,
          maxHp: enemy.maxHp,
          facing: Math.round(enemy.facing * 100) / 100,
          isAttacking: enemy.windupTimer > 0,
          windupTimer: Math.round(enemy.windupTimer * 100) / 100,
          telegraphProgress:
            enemy.windupTimer > 0
              ? 1 - enemy.windupTimer / Math.max(0.01, enemy.windupDuration)
              : 0,
        });
      }

      // 3. Broadcast 20Hz Tick: Player States & Enemy States
      const playerStatesPayload: Record<string, RemotePlayerSyncState> = {};
      for (const p of room.players.values()) {
        playerStatesPayload[p.id] = p.state;
      }

      this.broadcast(room, {
        type: 's:game_tick',
        players: playerStatesPayload,
        enemies: syncEnemies,
      });
    }, 50);
  }

  private cleanupRoom(roomCode: string) {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    if (room.loopInterval) {
      clearInterval(room.loopInterval);
      room.loopInterval = null;
    }

    for (const p of room.players.values()) {
      if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
      this.playerRoomMap.delete(p.id);
    }

    this.rooms.delete(roomCode);
  }

  private broadcast(room: GameRoom, data: any, excludePlayerId?: string) {
    const payload = JSON.stringify(data);
    for (const [id, player] of room.players.entries()) {
      if (id !== excludePlayerId && player.connected && player.ws && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(payload);
      }
    }
  }

  private broadcastLobbyUpdate(room: GameRoom) {
    this.broadcast(room, {
      type: 's:lobby_update',
      roomDetails: this.formatRoomDetails(room),
    });
  }

  private formatRoomDetails(room: GameRoom): RoomDetails {
    const players: LobbyPlayer[] = [];
    for (const p of room.players.values()) {
      players.push({
        id: p.id,
        name: p.name,
        heroId: p.heroId,
        loadout: p.loadout,
        ready: p.ready,
        isHost: p.isHost,
        connected: p.connected,
      });
    }

    return {
      roomCode: room.roomCode,
      hostId: room.hostId,
      status: room.status,
      floor: room.floor,
      players,
      maxPlayers: 4,
      createdAt: room.createdAt,
    };
  }

  private getRoomByPlayerId(playerId: string): GameRoom | null {
    const roomCode = this.playerRoomMap.get(playerId);
    if (!roomCode) return null;
    return this.rooms.get(roomCode) || null;
  }

  private createInitialPlayerState(
    id: string,
    name: string,
    heroId: any
  ): RemotePlayerSyncState {
    return {
      id,
      name,
      heroId: heroId || 'human',
      x: 400,
      y: 400,
      vx: 0,
      vy: 0,
      facing: 0,
      walkPhase: 0,
      hp: 120,
      maxHp: 120,
      shield: 0,
      swordAnim: 0,
      swordX: 420,
      swordY: 390,
      swordAngle: 0,
      offhandX: 380,
      offhandY: 390,
      offhandAngle: 0,
      swordScale: 1.0,
      swordGlowColor: '#fb923c',
      swordGlowIntensity: 0.5,
      colossusTimer: 0,
      boneStormTimer: 0,
      undyingTimer: 0,
      bloodFrenzyTimer: 0,
      nightmareTimer: 0,
      lastStandTimer: 0,
      oneManArmyTimer: 0,
      isDowned: false,
      reviveProgress: 0,
    };
  }
}

export const roomManager = new RoomManager();
