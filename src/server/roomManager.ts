import { WebSocket } from 'ws';
import { HERO_PROFILES } from '../data/heroSkills';
import { buildProceduralDungeon } from '../game/dungeonGenerator';
import {
  EnemyEntity,
  EnemyKind,
  HeroId,
  isBossKind,
  isMiniHeroKind,
  isUndeadLegionBoss,
  SkillLoadout,
  SwordAnimState,
  WorldMap,
} from '../types/game';
import {
  ClientAttackMessage,
  ClientSkillMessage,
  LobbyPlayer,
  RemotePlayerSyncState,
  RoomDetails,
  SyncEnemyAttackEvent,
  SyncEnemyState,
  SyncLootItem,
} from '../types/multiplayer';

interface ConnectedPlayer extends LobbyPlayer {
  ws: WebSocket | null;
  disconnectTimer: NodeJS.Timeout | null;
  state: RemotePlayerSyncState;
  revivingPlayerId: string | null;
  invulnerableTimer: number;
}

interface ServerEnemyProjectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
}

interface GameRoom {
  roomCode: string;
  hostId: string;
  status: 'lobby' | 'playing' | 'game_over';
  floor: number;
  floorCleared: boolean;
  players: Map<string, ConnectedPlayer>;
  dungeonMap: WorldMap | null;
  enemies: Map<number, EnemyEntity>;
  enemyProjectiles: ServerEnemyProjectile[];
  loot: Map<number, SyncLootItem>;
  nextFloorReady: Set<string>;
  loopInterval: NodeJS.Timeout | null;
  lastTickTime: number;
  createdAt: number;
}

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private playerRoomMap = new Map<string, string>();
  private nextLootId = 1000;
  private nextProjId = 1;

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
    heroId: HeroId,
    loadout: SkillLoadout,
    ws: WebSocket
  ): { roomCode: string; playerId: string; roomDetails: RoomDetails } {
    const validHero: HeroId = HERO_PROFILES[heroId] ? heroId : 'human';
    const validLoadout: SkillLoadout =
      Array.isArray(loadout) && loadout.length === 3
        ? loadout
        : [...HERO_PROFILES[validHero].defaultLoadout];
    const roomCode = this.generateCode();
    const playerId = `p_${Math.random().toString(36).substring(2, 9)}`;
    const cleanName = (playerName || '').trim().slice(0, 14) || 'Host Hero';

    const player: ConnectedPlayer = {
      id: playerId,
      name: cleanName,
      heroId: validHero,
      loadout: validLoadout,
      ready: true,
      isHost: true,
      connected: true,
      ws,
      disconnectTimer: null,
      revivingPlayerId: null,
      invulnerableTimer: 0,
      state: this.createInitialPlayerState(playerId, cleanName, validHero),
    };

    const room: GameRoom = {
      roomCode,
      hostId: playerId,
      status: 'lobby',
      floor: 1,
      floorCleared: false,
      players: new Map([[playerId, player]]),
      dungeonMap: null,
      enemies: new Map(),
      enemyProjectiles: [],
      loot: new Map(),
      nextFloorReady: new Set(),
      loopInterval: null,
      lastTickTime: Date.now(),
      createdAt: Date.now(),
    };

    this.rooms.set(roomCode, room);
    this.playerRoomMap.set(playerId, roomCode);

    return {
      roomCode,
      playerId,
      roomDetails: this.formatRoomDetails(room),
    };
  }

  public joinRoom(
    roomCodeInput: string,
    playerName: string,
    heroId: HeroId,
    loadout: SkillLoadout,
    ws: WebSocket
  ): { success: boolean; error?: string; playerId?: string; roomDetails?: RoomDetails } {
    const code = (roomCodeInput || '').trim().toUpperCase();
    if (!code || code.length !== 4) {
      return { success: false, error: 'Please enter a valid 4-character room code.' };
    }

    const room = this.rooms.get(code);
    if (!room) {
      return { success: false, error: 'Room not found. Check the room code and try again.' };
    }

    if (room.status !== 'lobby') {
      return { success: false, error: 'This co-op dungeon run is already in progress.' };
    }

    if (room.players.size >= 4) {
      return { success: false, error: 'This room is full (4/4 players).' };
    }

    const validHero: HeroId = HERO_PROFILES[heroId] ? heroId : 'skeleton';
    const validLoadout: SkillLoadout =
      Array.isArray(loadout) && loadout.length === 3
        ? loadout
        : [...HERO_PROFILES[validHero].defaultLoadout];
    const playerId = `p_${Math.random().toString(36).substring(2, 9)}`;
    const cleanName =
      (playerName || '').trim().slice(0, 14) || `Hero ${room.players.size + 1}`;

    const player: ConnectedPlayer = {
      id: playerId,
      name: cleanName,
      heroId: validHero,
      loadout: validLoadout,
      ready: false,
      isHost: false,
      connected: true,
      ws,
      disconnectTimer: null,
      revivingPlayerId: null,
      invulnerableTimer: 0,
      state: this.createInitialPlayerState(playerId, cleanName, validHero),
    };

    room.players.set(playerId, player);
    this.playerRoomMap.set(playerId, code);

    const details = this.formatRoomDetails(room);
    this.broadcastLobbyUpdate(room);

    return {
      success: true,
      playerId,
      roomDetails: details,
    };
  }

  public quickJoin(
    playerName: string,
    heroId: HeroId,
    loadout: SkillLoadout,
    ws: WebSocket
  ): { roomCode: string; playerId: string; isHost: boolean; roomDetails: RoomDetails } {
    for (const room of this.rooms.values()) {
      if (room.status === 'lobby' && room.players.size < 4) {
        const res = this.joinRoom(room.roomCode, playerName, heroId, loadout, ws);
        if (res.success && res.playerId && res.roomDetails) {
          return {
            roomCode: room.roomCode,
            playerId: res.playerId,
            isHost: false,
            roomDetails: res.roomDetails,
          };
        }
      }
    }

    const created = this.createRoom(playerName, heroId, loadout, ws);
    return {
      roomCode: created.roomCode,
      playerId: created.playerId,
      isHost: true,
      roomDetails: created.roomDetails,
    };
  }

  public setReady(playerId: string, ready: boolean) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room || room.status !== 'lobby') return;

    const player = room.players.get(playerId);
    if (!player) return;

    player.ready = ready;
    this.broadcastLobbyUpdate(room);
  }

  public setHero(playerId: string, heroId: HeroId, loadout: SkillLoadout) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room || room.status !== 'lobby') return;

    const player = room.players.get(playerId);
    if (!player || !HERO_PROFILES[heroId]) return;

    player.heroId = heroId;
    if (Array.isArray(loadout) && loadout.length === 3) {
      player.loadout = loadout;
    } else {
      player.loadout = [...HERO_PROFILES[heroId].defaultLoadout];
    }
    const baseHp = HERO_PROFILES[heroId].baseHp;
    player.state.heroId = heroId;
    player.state.hp = baseHp;
    player.state.maxHp = baseHp;

    this.broadcastLobbyUpdate(room);
  }

  public startGame(playerId: string): { success: boolean; error?: string } {
    const room = this.getRoomByPlayerId(playerId);
    if (!room) return { success: false, error: 'Room not found.' };
    if (room.hostId !== playerId) {
      return { success: false, error: 'Only the lobby host can start the run.' };
    }
    if (room.players.size < 2) {
      return { success: false, error: 'Co-Op requires at least 2 connected players to start.' };
    }

    for (const p of room.players.values()) {
      if (!p.ready) {
        return { success: false, error: 'All squad members must be Ready before starting!' };
      }
    }

    this.initDungeonFloor(room, 1);
    room.status = 'playing';

    this.broadcast(room, {
      type: 's:game_start',
      floor: room.floor,
      dungeonMap: room.dungeonMap,
      enemies: Array.from(room.enemies.values()),
      players: Array.from(room.players.values()).map((p) => ({
        ...p.state,
        isHost: p.isHost,
        connected: p.connected,
      })),
      roomDetails: this.formatRoomDetails(room),
    });

    this.startAuthoritativeLoop(room);
    return { success: true };
  }

  private initDungeonFloor(room: GameRoom, floor: number) {
    room.floor = floor;
    room.floorCleared = false;
    room.nextFloorReady.clear();
    room.enemyProjectiles = [];
    room.loot.clear();
    room.enemies.clear();

    const { map, enemies } = buildProceduralDungeon(floor);
    room.dungeonMap = map;

    // Co-op enemy durability scaling based on party size (2-4 players)
    const partyMult = 1 + Math.max(0, room.players.size - 1) * 0.35;
    for (const e of enemies) {
      const scaledHp = Math.round(e.maxHp * partyMult);
      room.enemies.set(e.id, {
        ...e,
        hp: scaledHp,
        maxHp: scaledHp,
      });
    }

    const startRoom = map.rooms.find((r) => r.kind === 'start') || map.rooms[0];
    const spawnCenterX = startRoom ? startRoom.x + startRoom.w / 2 : map.spawnX;
    const spawnCenterY = startRoom ? startRoom.y + startRoom.h / 2 : map.spawnY;

    let idx = 0;
    for (const p of room.players.values()) {
      const offsetX = (idx % 2 === 0 ? -1 : 1) * (32 + Math.floor(idx / 2) * 18);
      const offsetY = (idx < 2 ? -1 : 1) * 26;
      p.state.x = spawnCenterX + offsetX;
      p.state.y = spawnCenterY + offsetY;
      p.state.vx = 0;
      p.state.vy = 0;
      p.state.isDowned = false;
      p.state.reviveProgress = 0;
      p.revivingPlayerId = null;
      p.invulnerableTimer = 1.2;

      if (floor === 1) {
        const baseHp = HERO_PROFILES[p.heroId]?.baseHp || 240;
        p.state.maxHp = Math.max(p.state.maxHp, baseHp);
        p.state.hp = p.state.maxHp;
        p.state.shield = 0;
      } else {
        const healAmt = Math.round(p.state.maxHp * 0.5);
        p.state.hp = Math.min(p.state.maxHp, Math.max(Math.round(p.state.maxHp * 0.45), p.state.hp + healAmt));
      }
      idx++;
    }
  }

  public updatePlayerState(playerId: string, partialState: Partial<RemotePlayerSyncState>) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room || room.status !== 'playing') return;

    const p = room.players.get(playerId);
    if (!p) return;

    if (typeof partialState.maxHp === 'number' && partialState.maxHp > p.state.maxHp) {
      const delta = partialState.maxHp - p.state.maxHp;
      p.state.maxHp = partialState.maxHp;
      if (!p.state.isDowned) {
        p.state.hp = Math.min(p.state.maxHp, p.state.hp + delta);
      }
    }
    if (typeof partialState.level === 'number' && partialState.level >= 1) {
      p.state.level = partialState.level;
    }

    // Downed players stay anchored and cannot overwrite their downed HP
    if (!p.state.isDowned) {
      if (typeof partialState.x === 'number') p.state.x = partialState.x;
      if (typeof partialState.y === 'number') p.state.y = partialState.y;
      if (typeof partialState.vx === 'number') p.state.vx = partialState.vx;
      if (typeof partialState.vy === 'number') p.state.vy = partialState.vy;
      if (typeof partialState.facing === 'number') p.state.facing = partialState.facing;
      if (typeof partialState.walkPhase === 'number') p.state.walkPhase = partialState.walkPhase;
      if (typeof partialState.swordAnim === 'string') p.state.swordAnim = partialState.swordAnim;
      if (typeof partialState.swordX === 'number') p.state.swordX = partialState.swordX;
      if (typeof partialState.swordY === 'number') p.state.swordY = partialState.swordY;
      if (typeof partialState.swordAngle === 'number') p.state.swordAngle = partialState.swordAngle;
      if (typeof partialState.offhandX === 'number') p.state.offhandX = partialState.offhandX;
      if (typeof partialState.offhandY === 'number') p.state.offhandY = partialState.offhandY;
      if (typeof partialState.offhandAngle === 'number') p.state.offhandAngle = partialState.offhandAngle;
      if (typeof partialState.swordScale === 'number') p.state.swordScale = partialState.swordScale;
      if (typeof partialState.swordGlowColor === 'string') p.state.swordGlowColor = partialState.swordGlowColor;
      if (typeof partialState.swordGlowIntensity === 'number') {
        p.state.swordGlowIntensity = partialState.swordGlowIntensity;
      }
      if (typeof partialState.isScytheForm === 'boolean') p.state.isScytheForm = partialState.isScytheForm;
      if (typeof partialState.colossusTimer === 'number') p.state.colossusTimer = partialState.colossusTimer;
      if (typeof partialState.boneStormTimer === 'number') p.state.boneStormTimer = partialState.boneStormTimer;
      if (typeof partialState.ribShieldTimer === 'number') p.state.ribShieldTimer = partialState.ribShieldTimer;
      if (typeof partialState.undyingTimer === 'number') p.state.undyingTimer = partialState.undyingTimer;
      if (typeof partialState.stealthTimer === 'number') p.state.stealthTimer = partialState.stealthTimer;
      if (typeof partialState.ambushReady === 'boolean') p.state.ambushReady = partialState.ambushReady;
      if (typeof partialState.bloodFrenzyTimer === 'number') p.state.bloodFrenzyTimer = partialState.bloodFrenzyTimer;
      if (typeof partialState.phantomMistTimer === 'number') p.state.phantomMistTimer = partialState.phantomMistTimer;
      if (typeof partialState.possessingTimer === 'number') p.state.possessingTimer = partialState.possessingTimer;
      if (typeof partialState.nightmareTimer === 'number') p.state.nightmareTimer = partialState.nightmareTimer;
      if (typeof partialState.pipeThrown === 'boolean') p.state.pipeThrown = partialState.pipeThrown;
      if (typeof partialState.kneeStrikeTimer === 'number') p.state.kneeStrikeTimer = partialState.kneeStrikeTimer;
      if (typeof partialState.frenzyStacks === 'number') p.state.frenzyStacks = partialState.frenzyStacks;
      if (typeof partialState.lastStandTimer === 'number') p.state.lastStandTimer = partialState.lastStandTimer;
      if (typeof partialState.oneManArmyTimer === 'number') p.state.oneManArmyTimer = partialState.oneManArmyTimer;
      if (typeof partialState.airborneHeight === 'number') p.state.airborneHeight = partialState.airborneHeight;
      if (typeof partialState.wingFlapTimer === 'number') p.state.wingFlapTimer = partialState.wingFlapTimer;
      if (typeof partialState.rainOfFeathersTimer === 'number') p.state.rainOfFeathersTimer = partialState.rainOfFeathersTimer;
      if (typeof partialState.celestialBarrageTimer === 'number') p.state.celestialBarrageTimer = partialState.celestialBarrageTimer;
      if (typeof partialState.celestialBarrageWings === 'number') p.state.celestialBarrageWings = partialState.celestialBarrageWings;
      if (typeof partialState.wrathSkyTimer === 'number') p.state.wrathSkyTimer = partialState.wrathSkyTimer;
      if (typeof partialState.kingOfBeastsTimer === 'number') p.state.kingOfBeastsTimer = partialState.kingOfBeastsTimer;
      if (typeof partialState.tigerRoarTimer === 'number') p.state.tigerRoarTimer = partialState.tigerRoarTimer;
    } else {
      p.state.vx = 0;
      p.state.vy = 0;
      p.state.walkPhase = 0;
    }
  }

  public handlePlayerHealOrShield(playerId: string, healAmount: number, shieldAmount: number) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room || room.status !== 'playing') return;

    const p = room.players.get(playerId);
    if (!p || p.state.isDowned) return;

    if (healAmount > 0) {
      p.state.hp = Math.min(p.state.maxHp, p.state.hp + Math.round(healAmount));
    }
    if (shieldAmount > 0) {
      p.state.shield = Math.max(p.state.shield, Math.min(p.state.maxHp, Math.round(shieldAmount)));
    }
  }

  public handlePlayerAttack(playerId: string, attackData: ClientAttackMessage) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room || room.status !== 'playing') return;

    const p = room.players.get(playerId);
    if (!p || p.state.isDowned) return;

    this.broadcast(
      room,
      {
        ...attackData,
        type: 's:player_attack',
        playerId,
      },
      playerId
    );
  }

  public handlePlayerSkill(playerId: string, skillData: ClientSkillMessage) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room || room.status !== 'playing') return;

    const p = room.players.get(playerId);
    if (!p || p.state.isDowned) return;

    // Brief i-frames during mobility/invulnerability skills matching solo combat feel
    if (
      skillData.skillId === 'skeletal_rush' ||
      skillData.skillId === 'flesh_ripper' ||
      skillData.skillId === 'phantom_dash' ||
      skillData.skillId === 'scrappers_dash' ||
      skillData.skillId === 'feral_pounce' ||
      skillData.skillId === 'predators_leap' ||
      skillData.skillId === 'shadow_stalker' ||
      skillData.skillId === 'carnage_unleashed' ||
      skillData.skillId === 'one_man_army' ||
      skillData.skillId === 'windstep' ||
      skillData.skillId === 'predators_pounce' ||
      skillData.skillId === 'savage_pursuit' ||
      skillData.skillId === 'apex_devastation'
    ) {
      p.invulnerableTimer = Math.max(p.invulnerableTimer, 0.45);
    } else if (skillData.skillId === 'haunted_possession') {
      p.invulnerableTimer = Math.max(p.invulnerableTimer, 2.5);
    } else if (
      skillData.skillId === 'rain_of_feathers' ||
      skillData.skillId === 'wrath_of_the_sky'
    ) {
      p.invulnerableTimer = Math.max(p.invulnerableTimer, 1.2);
    }

    this.broadcast(
      room,
      {
        ...skillData,
        type: 's:player_skill',
        playerId,
      },
      playerId
    );
  }

  public handleEnemyDamage(
    playerId: string,
    enemyId: number,
    damage: number,
    isCrit: boolean,
    sparkColor: string,
    slowDuration = 0,
    staggerDuration = 0
  ) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room || room.status !== 'playing') return;

    const attacker = room.players.get(playerId);
    if (!attacker || attacker.state.isDowned) return;

    const enemy = room.enemies.get(enemyId);
    if (!enemy || enemy.hp <= 0) return;

    const clampedDmg = Math.max(1, Math.min(2500, Math.round(damage)));
    enemy.hp = Math.max(0, enemy.hp - clampedDmg);
    enemy.hitFlash = 0.12;

    if (slowDuration > 0) {
      enemy.slowTimer = Math.max(enemy.slowTimer, Math.min(4.0, slowDuration));
    }
    if (staggerDuration > 0 && !isBossKind(enemy.kind)) {
      enemy.staggerTimer = Math.max(enemy.staggerTimer, Math.min(1.2, staggerDuration));
      enemy.windupTimer = 0;
    }

    this.broadcast(room, {
      type: 's:enemy_damaged',
      enemyId,
      hp: enemy.hp,
      damage: clampedDmg,
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
    const isBoss = isBossKind(enemy.kind);
    const isBrute = enemy.kind === EnemyKind.BRUTE;

    // Bone Shards
    const shardCount = isBoss ? 8 : isBrute ? 3 : 1;
    for (let i = 0; i < shardCount; i++) {
      const lootItem: SyncLootItem = {
        id: this.nextLootId++,
        kind: 'shard',
        x: Math.round(enemy.x + (Math.random() - 0.5) * 42),
        y: Math.round(enemy.y + (Math.random() - 0.5) * 42),
        value: isBoss ? 8 : 3,
        active: true,
      };
      room.loot.set(lootItem.id, lootItem);
      spawnedLoot.push(lootItem);
    }

    // Healing Orb Drops
    const healCount = isBoss ? Math.max(2, room.players.size) : Math.random() < 0.28 ? 1 : 0;
    for (let i = 0; i < healCount; i++) {
      const healItem: SyncLootItem = {
        id: this.nextLootId++,
        kind: 'heal',
        x: Math.round(enemy.x + (Math.random() - 0.5) * 44),
        y: Math.round(enemy.y + (Math.random() - 0.5) * 44),
        value: 44,
        active: true,
      };
      room.loot.set(healItem.id, healItem);
      spawnedLoot.push(healItem);
    }

    // Experience Orbs
    const xpOrbCount = isBoss ? 6 : isBrute ? 3 : 2;
    const xpValue = isBoss ? 42 : isBrute ? 24 : 18;
    for (let i = 0; i < xpOrbCount; i++) {
      const xpItem: SyncLootItem = {
        id: this.nextLootId++,
        kind: 'xp',
        x: Math.round(enemy.x + (Math.random() - 0.5) * 38),
        y: Math.round(enemy.y + (Math.random() - 0.5) * 38),
        value: xpValue,
        active: true,
      };
      room.loot.set(xpItem.id, xpItem);
      spawnedLoot.push(xpItem);
    }

    // Boss Essence Drop: Drops an essence orb that awards a divine blessing upon pickup!
    if (isBoss) {
      const essenceItem: SyncLootItem = {
        id: this.nextLootId++,
        kind: 'boss_essence',
        x: Math.round(enemy.x),
        y: Math.round(enemy.y),
        value: 1,
        active: true,
      };
      room.loot.set(essenceItem.id, essenceItem);
      spawnedLoot.push(essenceItem);
    }

    this.broadcast(room, {
      type: 's:enemy_died',
      enemyId: enemy.id,
      killerId,
      isBoss,
      loot: spawnedLoot,
    });

    // Unlock Next Floor Portal when the Floor Boss is vanquished (or all foes cleared)
    let bossAlive = false;
    let remaining = 0;
    for (const e of room.enemies.values()) {
      if (e.hp > 0 && e.kind !== EnemyKind.TRAINING_DUMMY) {
        remaining++;
        if (isBossKind(e.kind)) {
          bossAlive = true;
        }
      }
    }

    if (!room.floorCleared && (!bossAlive || remaining === 0) && room.dungeonMap) {
      room.floorCleared = true;
      const bossRoom = room.dungeonMap.rooms.find((r) => r.kind === 'boss') || room.dungeonMap.rooms[room.dungeonMap.rooms.length - 1];
      if (bossRoom) {
        bossRoom.cleared = true;
        const portalId = `portal_next_${room.floor}`;
        if (!room.dungeonMap.props.some((pr) => pr.id === portalId)) {
          room.dungeonMap.props.push({
            id: portalId,
            kind: 'portal_next',
            x: bossRoom.x + bossRoom.w * 0.5 - 27,
            y: bossRoom.y + bossRoom.h * 0.5 - 27,
            w: 54,
            h: 54,
            solid: false,
            label: `Graveyard of the Fallen · Floor ${room.floor + 1}`,
          });
        }

        this.broadcast(room, {
          type: 's:floor_cleared',
          floor: room.floor,
          portalProp: room.dungeonMap.props.find((pr) => pr.id === portalId),
        });
      }
    }
  }

  public handleLootPickup(playerId: string, lootId: number) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room || room.status !== 'playing') return;

    const collector = room.players.get(playerId);
    if (!collector || collector.state.isDowned) return;

    const item = room.loot.get(lootId);
    if (!item || !item.active) return;

    item.active = false;
    room.loot.delete(lootId);

    if (item.kind === 'heal') {
      collector.state.hp = Math.min(collector.state.maxHp, collector.state.hp + item.value);
    }

    this.broadcast(room, {
      type: 's:loot_collected',
      lootId,
      collectorId: playerId,
      kind: item.kind,
      value: item.value,
    });
  }

  public handleOpenChest(playerId: string, propId: string) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room || room.status !== 'playing' || !room.dungeonMap) return;

    const opener = room.players.get(playerId);
    if (!opener || opener.state.isDowned) return;

    const prop = room.dungeonMap.props.find((p) => p.id === propId && p.kind === 'chest');
    if (!prop || prop.opened) return;

    prop.opened = true;

    // Heal all living squad members slightly & grant +1 Skill Point + 25 Shards cooperatively
    for (const pl of room.players.values()) {
      if (!pl.state.isDowned) {
        pl.state.hp = Math.min(pl.state.maxHp, pl.state.hp + Math.round(pl.state.maxHp * 0.35));
      }
    }

    this.broadcast(room, {
      type: 's:chest_opened',
      propId,
      openerId: playerId,
      openerName: opener.name,
    });
  }

  public handlePlayerDowned(room: GameRoom, playerId: string) {
    if (room.status !== 'playing') return;

    const p = room.players.get(playerId);
    if (!p || p.state.isDowned) return;

    p.state.isDowned = true;
    p.state.hp = 0;
    p.state.shield = 0;
    p.state.vx = 0;
    p.state.vy = 0;
    p.state.reviveProgress = 0;
    p.revivingPlayerId = null;
    room.nextFloorReady.delete(playerId);

    this.broadcast(room, {
      type: 's:player_downed',
      playerId,
      name: p.name,
    });

    this.checkAllPlayersDowned(room);
  }

  private checkAllPlayersDowned(room: GameRoom) {
    if (room.status !== 'playing') return;

    let anyConnected = false;
    let anyAlive = false;
    for (const pl of room.players.values()) {
      if (pl.connected) {
        anyConnected = true;
        if (!pl.state.isDowned && pl.state.hp > 0) {
          anyAlive = true;
          break;
        }
      }
    }

    if (anyConnected && !anyAlive) {
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

    if (!reviver || reviver.state.isDowned || !target || !target.state.isDowned) return;
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
    if (!room || room.status !== 'playing' || !room.floorCleared) return;

    const player = room.players.get(playerId);
    if (!player || player.state.isDowned) return;

    room.nextFloorReady.add(playerId);

    let activeLivingCount = 0;
    for (const p of room.players.values()) {
      if (p.connected && !p.state.isDowned) activeLivingCount++;
    }

    if (room.nextFloorReady.size >= Math.max(1, activeLivingCount)) {
      this.initDungeonFloor(room, room.floor + 1);
      this.broadcast(room, {
        type: 's:next_floor',
        floor: room.floor,
        dungeonMap: room.dungeonMap,
        enemies: Array.from(room.enemies.values()),
        players: Array.from(room.players.values()).map((p) => ({
          ...p.state,
          isHost: p.isHost,
          connected: p.connected,
        })),
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
          player.revivingPlayerId = null;
          room.nextFloorReady.delete(playerId);

          if (room.status === 'lobby') {
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
                  newHostName: nextHost.name,
                });
              }
            }

            this.broadcastLobbyUpdate(room);
          } else {
            this.broadcast(room, {
              type: 's:player_disconnected',
              playerId,
              name: player.name,
            });

            if (room.hostId === playerId) {
              for (const other of room.players.values()) {
                if (other.connected) {
                  player.isHost = false;
                  other.isHost = true;
                  room.hostId = other.id;
                  this.broadcast(room, {
                    type: 's:host_migrated',
                    newHostId: other.id,
                    newHostName: other.name,
                  });
                  break;
                }
              }
            }

            this.checkAllPlayersDowned(room);

            if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
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
                  name: player.name,
                });
                this.checkAllPlayersDowned(room);
              }
            }, 45000);
          }
          return;
        }
      }
    }
  }

  public handleReconnect(roomCodeInput: string, playerId: string, ws: WebSocket): boolean {
    const code = (roomCodeInput || '').trim().toUpperCase();
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

    if (room.status === 'lobby') {
      this.broadcastLobbyUpdate(room);
      ws.send(
        JSON.stringify({
          type: 's:sync_full_state',
          roomCode: room.roomCode,
          floor: room.floor,
          status: room.status,
          roomDetails: this.formatRoomDetails(room),
          dungeonMap: null,
          enemies: [],
          loot: [],
          players: [],
          floorCleared: false,
        })
      );
      return true;
    }

    this.broadcast(
      room,
      {
        type: 's:player_reconnected',
        playerId,
        name: player.name,
      },
      playerId
    );

    ws.send(
      JSON.stringify({
        type: 's:sync_full_state',
        roomCode: room.roomCode,
        floor: room.floor,
        status: room.status,
        roomDetails: this.formatRoomDetails(room),
        dungeonMap: room.dungeonMap,
        enemies: Array.from(room.enemies.values()),
        loot: Array.from(room.loot.values()),
        players: Array.from(room.players.values()).map((p) => ({
          ...p.state,
          connected: p.connected,
        })),
        floorCleared: room.floorCleared,
      })
    );

    return true;
  }

  public leaveRoom(playerId: string) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room) return;

    const leaving = room.players.get(playerId);
    if (leaving?.disconnectTimer) {
      clearTimeout(leaving.disconnectTimer);
    }

    room.players.delete(playerId);
    room.nextFloorReady.delete(playerId);
    this.playerRoomMap.delete(playerId);

    if (room.players.size === 0) {
      this.cleanupRoom(room.roomCode);
      return;
    }

    if (room.hostId === playerId) {
      let nextHost: ConnectedPlayer | undefined;
      for (const candidate of room.players.values()) {
        if (candidate.connected) {
          nextHost = candidate;
          break;
        }
      }
      if (!nextHost) {
        nextHost = room.players.values().next().value;
      }
      if (nextHost) {
        nextHost.isHost = true;
        nextHost.ready = true;
        room.hostId = nextHost.id;
        this.broadcast(room, {
          type: 's:host_migrated',
          newHostId: nextHost.id,
          newHostName: nextHost.name,
        });
      }
    }

    this.broadcast(room, {
      type: 's:player_left',
      playerId,
      name: leaving?.name || 'Ally',
    });

    if (room.status === 'lobby') {
      this.broadcastLobbyUpdate(room);
    } else {
      this.checkAllPlayersDowned(room);
    }
  }

  private damagePlayerAuthoritative(room: GameRoom, target: ConnectedPlayer, rawDamage: number) {
    if (!target.connected || target.state.isDowned || target.invulnerableTimer > 0) return;

    // Respect active defensive transformations / shields
    let dmgMult = 1.0;
    if (target.state.colossusTimer > 0) dmgMult *= 0.7;
    if (target.state.boneStormTimer > 0) dmgMult *= 0.72;
    if (target.state.undyingTimer > 0) dmgMult *= 0.68;
    if (target.state.lastStandTimer > 0) dmgMult *= 0.72;
    if (target.state.nightmareTimer > 0) dmgMult *= 0.8;

    let dmg = Math.max(1, Math.round(rawDamage * dmgMult));

    if (target.state.shield > 0) {
      const absorbed = Math.min(target.state.shield, dmg);
      target.state.shield -= absorbed;
      dmg -= absorbed;
    }

    if (dmg > 0) {
      target.state.hp = Math.max(0, target.state.hp - dmg);
    }

    this.broadcast(room, {
      type: 's:player_damaged',
      playerId: target.id,
      hp: target.state.hp,
      shield: target.state.shield,
      damage: dmg,
      blocked: dmg === 0,
    });

    if (target.state.hp <= 0 && !target.state.isDowned) {
      this.handlePlayerDowned(room, target.id);
    }
  }

  private isSinglePointWalkable(map: WorldMap, px: number, py: number): boolean {
    for (let i = 0; i < map.walkableRects.length; i++) {
      const r = map.walkableRects[i];
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
        return true;
      }
    }
    return false;
  }

  private isPointWalkableOnMap(map: WorldMap, x: number, y: number, radius: number, ignoreProps = false): boolean {
    const diag = radius * 0.7071;
    if (
      !this.isSinglePointWalkable(map, x, y) ||
      !this.isSinglePointWalkable(map, x + radius, y) ||
      !this.isSinglePointWalkable(map, x - radius, y) ||
      !this.isSinglePointWalkable(map, x, y + radius) ||
      !this.isSinglePointWalkable(map, x, y - radius) ||
      !this.isSinglePointWalkable(map, x + diag, y + diag) ||
      !this.isSinglePointWalkable(map, x - diag, y + diag) ||
      !this.isSinglePointWalkable(map, x + diag, y - diag) ||
      !this.isSinglePointWalkable(map, x - diag, y - diag)
    ) {
      return false;
    }

    if (!ignoreProps) {
      for (let i = 0; i < map.props.length; i++) {
        const prop = map.props[i];
        if (!prop.solid) continue;
        if (
          x + radius > prop.x &&
          x - radius < prop.x + prop.w &&
          y + radius > prop.y &&
          y - radius < prop.y + prop.h
        ) {
          return false;
        }
      }
    }
    return true;
  }

  private moveEnemyOnServerMap(room: GameRoom, e: EnemyEntity, dirX: number, dirY: number, dt: number) {
    if (!room.dungeonMap) return;
    let sx = dirX;
    let sy = dirY;

    for (const other of room.enemies.values()) {
      if (other.id === e.id || other.hp <= 0) continue;
      const odx = e.x - other.x;
      const ody = e.y - other.y;
      const d = Math.hypot(odx, ody);
      const minSep = e.radius + other.radius + 8;
      if (d > 0.1 && d < minSep) {
        sx += (odx / d) * 0.9;
        sy += (ody / d) * 0.9;
      }
    }

    const len = Math.hypot(sx, sy) || 1;
    const slowMult = e.slowTimer > 0 ? 0.6 : 1.0;
    const stepVx = (sx / len) * e.speed * slowMult;
    const stepVy = (sy / len) * e.speed * slowMult;
    const dx = stepVx * dt;
    const dy = stepVy * dt;
    const colRad = e.radius * 0.75;

    let nx = e.x;
    let ny = e.y;
    if (this.isPointWalkableOnMap(room.dungeonMap, e.x + dx, e.y, colRad)) {
      nx = e.x + dx;
    }
    if (this.isPointWalkableOnMap(room.dungeonMap, nx, e.y + dy, colRad)) {
      ny = e.y + dy;
    }

    e.vx = (nx - e.x) / Math.max(0.001, dt);
    e.vy = (ny - e.y) / Math.max(0.001, dt);
    e.x = nx;
    e.y = ny;
    e.walkPhase += dt * 9 * slowMult;
  }

  private startAuthoritativeLoop(room: GameRoom) {
    if (room.loopInterval) clearInterval(room.loopInterval);

    room.lastTickTime = Date.now();

    room.loopInterval = setInterval(() => {
      const now = Date.now();
      const dt = Math.min((now - room.lastTickTime) / 1000, 0.1);
      room.lastTickTime = now;

      if (room.status !== 'playing' || !room.dungeonMap) return;

      // Update invulnerability timers
      for (const p of room.players.values()) {
        if (p.invulnerableTimer > 0) {
          p.invulnerableTimer = Math.max(0, p.invulnerableTimer - dt);
        }
      }

      // 1. Cooperative Revival Progress (standing within 82px of a downed teammate revives them!)
      for (const target of room.players.values()) {
        if (!target.state.isDowned) continue;

        let reviverCount = 0;
        let lastReviverId = '';
        for (const ally of room.players.values()) {
          if (ally.id === target.id || !ally.connected || ally.state.isDowned) continue;
          const dist = Math.hypot(ally.state.x - target.state.x, ally.state.y - target.state.y);
          if (dist <= 82) {
            reviverCount++;
            lastReviverId = ally.id;
          }
        }

        if (reviverCount > 0) {
          // Multiple allies revive slightly faster
          const speedMult = 1 + (reviverCount - 1) * 0.35;
          target.state.reviveProgress = Math.min(1.0, target.state.reviveProgress + (dt / 2.8) * speedMult);
          if (target.state.reviveProgress >= 1.0) {
            target.state.isDowned = false;
            target.state.hp = Math.max(1, Math.round(target.state.maxHp * 0.45));
            target.state.reviveProgress = 0;
            target.invulnerableTimer = 1.6;

            this.broadcast(room, {
              type: 's:player_revived',
              targetId: target.id,
              reviverId: lastReviverId,
              hp: target.state.hp,
            });
          }
        } else if (target.state.reviveProgress > 0) {
          target.state.reviveProgress = Math.max(0, target.state.reviveProgress - dt * 0.25);
        }
      }

      // 2. Authoritative Enemy AI, Telegraphs & Attacks
      const syncEnemies: SyncEnemyState[] = [];
      const livingPlayers = Array.from(room.players.values()).filter(
        (p) => p.connected && !p.state.isDowned && p.state.hp > 0 && p.state.possessingTimer <= 0
      );

      for (const enemy of room.enemies.values()) {
        if (enemy.hp <= 0) continue;

        if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
        if (enemy.slowTimer > 0) enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
        if (enemy.staggerTimer > 0) enemy.staggerTimer = Math.max(0, enemy.staggerTimer - dt);
        if (enemy.attackAnimTimer > 0) enemy.attackAnimTimer = Math.max(0, enemy.attackAnimTimer - dt);

        if (enemy.staggerTimer > 0) {
          enemy.windupTimer = 0;
          enemy.vx = 0;
          enemy.vy = 0;
        } else if (livingPlayers.length > 0 && enemy.kind !== EnemyKind.TRAINING_DUMMY) {
          let nearestP = livingPlayers[0];
          let minDist = Math.hypot(enemy.x - nearestP.state.x, enemy.y - nearestP.state.y);
          for (let i = 1; i < livingPlayers.length; i++) {
            const dist = Math.hypot(enemy.x - livingPlayers[i].state.x, enemy.y - livingPlayers[i].state.y);
            if (dist < minDist) {
              minDist = dist;
              nearestP = livingPlayers[i];
            }
          }

          if (minDist <= 580) {
            const dx = nearestP.state.x - enemy.x;
            const dy = nearestP.state.y - enemy.y;
            const angToP = Math.atan2(dy, dx);

            if (enemy.windupTimer > 0) {
              enemy.vx = 0;
              enemy.vy = 0;
              if (enemy.kind === EnemyKind.ARCHER && enemy.windupTimer > enemy.windupDuration * 0.35) {
                enemy.windupAngle = angToP;
                enemy.facing = angToP;
              }
              enemy.windupTimer -= dt;
              if (enemy.windupTimer <= 0) {
                enemy.windupTimer = 0;
                this.executeEnemyAttack(room, enemy, livingPlayers);
              }
            } else if (enemy.attackAnimTimer <= 0.08) {
              enemy.facing = angToP;
              enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);

              if (enemy.kind === EnemyKind.ARCHER) {
                if (minDist > 235) {
                  this.moveEnemyOnServerMap(room, enemy, Math.cos(angToP), Math.sin(angToP), dt);
                } else if (minDist < 130) {
                  this.moveEnemyOnServerMap(room, enemy, -Math.cos(angToP), -Math.sin(angToP), dt);
                } else {
                  enemy.vx = 0;
                  enemy.vy = 0;
                  enemy.walkPhase = 0;
                }
                if (minDist <= 295 && enemy.attackCooldown <= 0) {
                  const r = Math.random();
                  enemy.windupType = r < 0.45 ? 'shoot' : r < 0.75 ? 'volley' : 'poison_lob';
                  enemy.windupDuration = 0.54;
                  enemy.windupTimer = 0.54;
                  enemy.windupAngle = angToP;
                }
              } else if (enemy.kind === EnemyKind.BRUTE) {
                if (minDist > 64) {
                  this.moveEnemyOnServerMap(room, enemy, Math.cos(angToP), Math.sin(angToP), dt);
                } else {
                  enemy.vx = 0;
                  enemy.vy = 0;
                  if (enemy.attackCooldown <= 0) {
                    const r = Math.random();
                    enemy.windupType = r < 0.45 ? 'slam' : r < 0.75 ? 'charge' : 'shockwave_line';
                    enemy.windupDuration = 0.66;
                    enemy.windupTimer = 0.66;
                    enemy.windupAngle = angToP;
                  }
                }
              } else if (enemy.kind === EnemyKind.MINI_SKELETON) {
                if (minDist > 44) {
                  this.moveEnemyOnServerMap(room, enemy, Math.cos(angToP), Math.sin(angToP), dt);
                } else {
                  enemy.vx = 0;
                  enemy.vy = 0;
                  if (enemy.attackCooldown <= 0) {
                    enemy.windupType = Math.random() < 0.55 ? 'slash' : 'shoot';
                    enemy.windupDuration = 0.32;
                    enemy.windupTimer = 0.32;
                    enemy.windupAngle = angToP;
                  }
                }
              } else if (enemy.kind === EnemyKind.MINI_ZOMBIE) {
                if (minDist > 46) {
                  this.moveEnemyOnServerMap(room, enemy, Math.cos(angToP), Math.sin(angToP), dt);
                } else {
                  enemy.vx = 0;
                  enemy.vy = 0;
                  if (enemy.attackCooldown <= 0) {
                    enemy.windupType = Math.random() < 0.55 ? 'slash' : 'poison_lob';
                    enemy.windupDuration = 0.36;
                    enemy.windupTimer = 0.36;
                    enemy.windupAngle = angToP;
                  }
                }
              } else if (enemy.kind === EnemyKind.MINI_GHOUL) {
                if (minDist > 50) {
                  this.moveEnemyOnServerMap(room, enemy, Math.cos(angToP), Math.sin(angToP), dt);
                } else {
                  enemy.vx = 0;
                  enemy.vy = 0;
                  if (enemy.attackCooldown <= 0) {
                    enemy.windupType = Math.random() < 0.55 ? 'pounce' : 'slash';
                    enemy.windupDuration = 0.3;
                    enemy.windupTimer = 0.3;
                    enemy.windupAngle = angToP;
                  }
                }
              } else if (enemy.kind === EnemyKind.MINI_GHOST) {
                if (minDist > 75) {
                  this.moveEnemyOnServerMap(room, enemy, Math.cos(angToP), Math.sin(angToP), dt);
                } else {
                  enemy.vx = 0;
                  enemy.vy = 0;
                  if (enemy.attackCooldown <= 0) {
                    enemy.windupType = Math.random() < 0.6 ? 'shoot' : 'spell';
                    enemy.windupDuration = 0.35;
                    enemy.windupTimer = 0.35;
                    enemy.windupAngle = angToP;
                  }
                }
              } else if (isBossKind(enemy.kind)) {
                if (minDist > 105 && enemy.attackCooldown > 0.3) {
                  this.moveEnemyOnServerMap(room, enemy, Math.cos(angToP), Math.sin(angToP), dt);
                } else {
                  enemy.vx = 0;
                  enemy.vy = 0;
                }
                if (enemy.attackCooldown <= 0) {
                  const roll = Math.random();
                  if (minDist <= 130 && roll < 0.38) {
                    enemy.windupType = 'slam';
                    enemy.windupDuration = 0.8;
                    enemy.windupTimer = 0.8;
                    enemy.windupAngle = angToP;
                  } else if (roll < 0.65) {
                    enemy.windupType = 'nova';
                    enemy.windupDuration = 0.74;
                    enemy.windupTimer = 0.74;
                    enemy.windupAngle = angToP;
                  } else if (roll < 0.85) {
                    enemy.windupType = 'whirlwind';
                    enemy.windupDuration = 0.65;
                    enemy.windupTimer = 0.65;
                    enemy.windupAngle = angToP;
                  } else {
                    enemy.windupType = 'dash';
                    enemy.windupDuration = 0.66;
                    enemy.windupTimer = 0.66;
                    enemy.windupAngle = angToP;
                  }
                }
              } else {
                // Crypt Rattler: slash, whirlwind, or thrust!
                if (minDist > 48) {
                  this.moveEnemyOnServerMap(room, enemy, Math.cos(angToP), Math.sin(angToP), dt);
                } else {
                  enemy.vx = 0;
                  enemy.vy = 0;
                  if (enemy.attackCooldown <= 0) {
                    const r = Math.random();
                    enemy.windupType = r < 0.45 ? 'slash' : r < 0.75 ? 'whirlwind' : 'thrust';
                    enemy.windupDuration = 0.38;
                    enemy.windupTimer = 0.38;
                    enemy.windupAngle = angToP;
                  }
                }
              }
            }
          } else {
            enemy.vx = 0;
            enemy.vy = 0;
            enemy.walkPhase = 0;
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
          walkPhase: Math.round(enemy.walkPhase * 100) / 100,
          windupTimer: Math.round(enemy.windupTimer * 100) / 100,
          windupDuration: enemy.windupDuration,
          windupType: enemy.windupType,
          windupAngle: Math.round(enemy.windupAngle * 100) / 100,
        });
      }

      // 3. Step Server-Authoritative Enemy Projectiles (Arrows & Boss Shards)
      for (let i = room.enemyProjectiles.length - 1; i >= 0; i--) {
        const proj = room.enemyProjectiles[i];
        proj.life += dt;
        if (proj.life >= proj.maxLife) {
          room.enemyProjectiles.splice(i, 1);
          continue;
        }
        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;

        if (!this.isPointWalkableOnMap(room.dungeonMap, proj.x, proj.y, 4, false)) {
          room.enemyProjectiles.splice(i, 1);
          continue;
        }

        let hitAny = false;
        for (const lp of livingPlayers) {
          if (Math.hypot(lp.state.x - proj.x, lp.state.y - proj.y) <= 16 + proj.radius) {
            this.damagePlayerAuthoritative(room, lp, proj.damage);
            hitAny = true;
            break;
          }
        }
        if (hitAny) {
          room.enemyProjectiles.splice(i, 1);
        }
      }

      // 4. Broadcast 20Hz Authoritative World Snapshot
      const playerStatesPayload: Record<string, RemotePlayerSyncState> = {};
      for (const p of room.players.values()) {
        playerStatesPayload[p.id] = {
          ...p.state,
          connected: p.connected,
        };
      }

      this.broadcast(room, {
        type: 's:game_tick',
        players: playerStatesPayload,
        enemies: syncEnemies,
      });
    }, 50);
  }

  private executeEnemyAttack(room: GameRoom, e: EnemyEntity, livingPlayers: ConnectedPlayer[]) {
    if (!room.dungeonMap) return;
    const atk = e.atk;
    const originX = e.x;
    const originY = e.y;

    if (e.windupType === 'slash') {
      e.attackAnimTimer = 0.25;
      for (const lp of livingPlayers) {
        const dx = lp.state.x - e.x;
        const dy = lp.state.y - e.y;
        const dist = Math.hypot(dx, dy);
        let diff = Math.atan2(dy, dx) - e.windupAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (dist <= e.radius + 54 && (Math.abs(diff) <= 0.88 || dist <= e.radius + 24)) {
          this.damagePlayerAuthoritative(room, lp, atk);
        }
      }
      this.broadcastEnemyAttack(room, {
        enemyId: e.id,
        kind: e.kind,
        attackType: 'slash',
        x: originX,
        y: originY,
        angle: e.windupAngle,
        damage: atk,
      });
    } else if (e.windupType === 'slam') {
      const isBoss = isBossKind(e.kind);
      const slamRad = isBoss ? 135 : 78;
      e.attackAnimTimer = 0.34;
      for (const lp of livingPlayers) {
        if (Math.hypot(lp.state.x - e.x, lp.state.y - e.y) <= slamRad + 14) {
          this.damagePlayerAuthoritative(room, lp, Math.round(atk * 1.25));
        }
      }
      this.broadcastEnemyAttack(room, {
        enemyId: e.id,
        kind: e.kind,
        attackType: 'slam',
        x: originX,
        y: originY,
        angle: e.windupAngle,
        damage: Math.round(atk * 1.25),
      });
    } else if (e.windupType === 'whirlwind') {
      const isBoss = isBossKind(e.kind);
      const whirlRad = isBoss ? 130 : e.radius + 56;
      e.attackAnimTimer = 0.32;
      for (const lp of livingPlayers) {
        if (Math.hypot(lp.state.x - e.x, lp.state.y - e.y) <= whirlRad + 12) {
          this.damagePlayerAuthoritative(room, lp, Math.round(atk * 1.2));
        }
      }
      this.broadcastEnemyAttack(room, {
        enemyId: e.id,
        kind: e.kind,
        attackType: 'whirlwind',
        x: originX,
        y: originY,
        angle: e.windupAngle,
        damage: Math.round(atk * 1.2),
        radius: whirlRad,
      });
    } else if (e.windupType === 'thrust') {
      const reach = isBossKind(e.kind) ? 160 : 110;
      e.attackAnimTimer = 0.28;
      const step = reach * 0.4;
      const sx = e.x + Math.cos(e.windupAngle) * step;
      const sy = e.y + Math.sin(e.windupAngle) * step;
      if (this.isPointWalkableOnMap(room.dungeonMap, sx, sy, e.radius * 0.78)) {
        e.x = sx;
        e.y = sy;
      }
      for (const lp of livingPlayers) {
        const dx = lp.state.x - e.x;
        const dy = lp.state.y - e.y;
        const dist = Math.hypot(dx, dy);
        let diff = Math.atan2(dy, dx) - e.windupAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (dist <= reach && Math.abs(diff) <= 0.42) {
          this.damagePlayerAuthoritative(room, lp, Math.round(atk * 1.25));
        }
      }
      this.broadcastEnemyAttack(room, {
        enemyId: e.id,
        kind: e.kind,
        attackType: 'thrust',
        x: originX,
        y: originY,
        angle: e.windupAngle,
        damage: Math.round(atk * 1.25),
      });
    } else if (e.windupType === 'shoot') {
      e.attackAnimTimer = 0.22;
      const bowX = e.x + Math.cos(e.windupAngle) * 22;
      const bowY = e.y - 6 + Math.sin(e.windupAngle) * 22;
      room.enemyProjectiles.push({
        id: this.nextProjId++,
        x: bowX,
        y: bowY,
        vx: Math.cos(e.windupAngle) * 320,
        vy: Math.sin(e.windupAngle) * 320,
        radius: 8,
        damage: atk,
        life: 0,
        maxLife: 1.6,
      });
      this.broadcastEnemyAttack(room, {
        enemyId: e.id,
        kind: e.kind,
        attackType: 'shoot',
        x: originX,
        y: originY,
        angle: e.windupAngle,
        damage: atk,
      });
    } else if (e.windupType === 'volley') {
      e.attackAnimTimer = 0.24;
      const bowX = e.x + Math.cos(e.windupAngle) * 22;
      const bowY = e.y - 6 + Math.sin(e.windupAngle) * 22;
      for (const offset of [-0.28, 0, 0.28]) {
        const va = e.windupAngle + offset;
        room.enemyProjectiles.push({
          id: this.nextProjId++,
          x: bowX,
          y: bowY,
          vx: Math.cos(va) * 300,
          vy: Math.sin(va) * 300,
          radius: 7,
          damage: Math.round(atk * 0.85),
          life: 0,
          maxLife: 1.6,
        });
      }
      this.broadcastEnemyAttack(room, {
        enemyId: e.id,
        kind: e.kind,
        attackType: 'volley',
        x: originX,
        y: originY,
        angle: e.windupAngle,
        damage: Math.round(atk * 0.85),
      });
    } else if (e.windupType === 'poison_lob') {
      e.attackAnimTimer = 0.3;
      const tx = e.x + Math.cos(e.windupAngle) * 140;
      const ty = e.y + Math.sin(e.windupAngle) * 140;
      for (const lp of livingPlayers) {
        if (Math.hypot(lp.state.x - tx, lp.state.y - ty) <= 55) {
          this.damagePlayerAuthoritative(room, lp, Math.round(atk * 0.9));
        }
      }
      this.broadcastEnemyAttack(room, {
        enemyId: e.id,
        kind: e.kind,
        attackType: 'poison_lob',
        x: originX,
        y: originY,
        angle: e.windupAngle,
        damage: Math.round(atk * 0.9),
      });
    } else if (e.windupType === 'shockwave_line') {
      e.attackAnimTimer = 0.36;
      const lineLen = isBossKind(e.kind) ? 280 : 220;
      for (const lp of livingPlayers) {
        const dx = lp.state.x - e.x;
        const dy = lp.state.y - e.y;
        const dist = Math.hypot(dx, dy);
        let diff = Math.atan2(dy, dx) - e.windupAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (dist <= lineLen && Math.abs(diff) <= 0.38) {
          this.damagePlayerAuthoritative(room, lp, Math.round(atk * 1.3));
        }
      }
      this.broadcastEnemyAttack(room, {
        enemyId: e.id,
        kind: e.kind,
        attackType: 'shockwave_line',
        x: originX,
        y: originY,
        angle: e.windupAngle,
        damage: Math.round(atk * 1.3),
      });
    } else if (e.windupType === 'charge') {
      e.attackAnimTimer = 0.3;
      const step = 160;
      const subSteps = 8;
      for (let s = 0; s < subSteps; s++) {
        const sx = e.x + Math.cos(e.windupAngle) * (step / subSteps);
        const sy = e.y + Math.sin(e.windupAngle) * (step / subSteps);
        if (this.isPointWalkableOnMap(room.dungeonMap, sx, sy, e.radius * 0.78)) {
          e.x = sx;
          e.y = sy;
        } else break;
      }
      for (const lp of livingPlayers) {
        if (Math.hypot(lp.state.x - e.x, lp.state.y - e.y) <= e.radius + 44) {
          this.damagePlayerAuthoritative(room, lp, Math.round(atk * 1.15));
        }
      }
      this.broadcastEnemyAttack(room, {
        enemyId: e.id,
        kind: e.kind,
        attackType: 'charge',
        x: originX,
        y: originY,
        endX: e.x,
        endY: e.y,
        angle: e.windupAngle,
        damage: Math.round(atk * 1.15),
      });
    } else if (e.windupType === 'pounce') {
      e.attackAnimTimer = 0.32;
      const px = e.x + Math.cos(e.windupAngle) * 130;
      const py = e.y + Math.sin(e.windupAngle) * 130;
      if (this.isPointWalkableOnMap(room.dungeonMap, px, py, e.radius * 0.78)) {
        e.x = px;
        e.y = py;
      }
      for (const lp of livingPlayers) {
        if (Math.hypot(lp.state.x - e.x, lp.state.y - e.y) <= 58) {
          this.damagePlayerAuthoritative(room, lp, Math.round(atk * 1.25));
        }
      }
      this.broadcastEnemyAttack(room, {
        enemyId: e.id,
        kind: e.kind,
        attackType: 'pounce',
        x: originX,
        y: originY,
        angle: e.windupAngle,
        damage: Math.round(atk * 1.25),
      });
    } else if (e.windupType === 'spell') {
      e.attackAnimTimer = 0.34;
      for (let s = 0; s < 3; s++) {
        const sa = e.windupAngle + (s - 1) * 0.45;
        room.enemyProjectiles.push({
          id: this.nextProjId++,
          x: e.x + Math.cos(sa) * 22,
          y: e.y + Math.sin(sa) * 22,
          vx: Math.cos(sa) * 240,
          vy: Math.sin(sa) * 240,
          radius: 8,
          damage: Math.round(atk * 0.95),
          life: 0,
          maxLife: 2.0,
        });
      }
      this.broadcastEnemyAttack(room, {
        enemyId: e.id,
        kind: e.kind,
        attackType: 'spell',
        x: originX,
        y: originY,
        angle: e.windupAngle,
        damage: Math.round(atk * 0.95),
      });
    } else if (e.windupType === 'nova') {
      e.attackAnimTimer = 0.38;
      const count = 8;
      for (let k = 0; k < count; k++) {
        const sa = e.windupAngle + (k * Math.PI * 2) / count;
        room.enemyProjectiles.push({
          id: this.nextProjId++,
          x: e.x + Math.cos(sa) * 24,
          y: e.y + Math.sin(sa) * 24,
          vx: Math.cos(sa) * 265,
          vy: Math.sin(sa) * 265,
          radius: 10,
          damage: atk,
          life: 0,
          maxLife: 1.9,
        });
      }
      this.broadcastEnemyAttack(room, {
        enemyId: e.id,
        kind: e.kind,
        attackType: 'nova',
        x: originX,
        y: originY,
        angle: e.windupAngle,
        damage: atk,
      });
    } else if (e.windupType === 'dash') {
      e.attackAnimTimer = 0.3;
      const totalStep = 180;
      const subSteps = 9;
      for (let s = 0; s < subSteps; s++) {
        const sx = e.x + Math.cos(e.windupAngle) * (totalStep / subSteps);
        const sy = e.y + Math.sin(e.windupAngle) * (totalStep / subSteps);
        if (this.isPointWalkableOnMap(room.dungeonMap, sx, sy, e.radius * 0.78)) {
          e.x = sx;
          e.y = sy;
        } else {
          break;
        }
      }
      for (const lp of livingPlayers) {
        if (Math.hypot(lp.state.x - e.x, lp.state.y - e.y) <= e.radius + 48) {
          this.damagePlayerAuthoritative(room, lp, Math.round(atk * 1.15));
        }
      }
      this.broadcastEnemyAttack(room, {
        enemyId: e.id,
        kind: e.kind,
        attackType: 'dash',
        x: originX,
        y: originY,
        endX: e.x,
        endY: e.y,
        angle: e.windupAngle,
        damage: Math.round(atk * 1.15),
      });
    }

    e.attackCooldown = isBossKind(e.kind) ? 1.35 : 1.12 + Math.random() * 0.35;
  }

  private broadcastEnemyAttack(room: GameRoom, evt: SyncEnemyAttackEvent) {
    this.broadcast(room, {
      type: 's:enemy_attack',
      ...evt,
    });
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

  private broadcast(room: GameRoom, data: unknown, excludePlayerId?: string) {
    const payload = JSON.stringify(data);
    for (const [id, player] of room.players.entries()) {
      if (
        id !== excludePlayerId &&
        player.connected &&
        player.ws &&
        player.ws.readyState === WebSocket.OPEN
      ) {
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
    heroId: HeroId
  ): RemotePlayerSyncState {
    const baseHp = HERO_PROFILES[heroId]?.baseHp || 240;
    return {
      id,
      name,
      heroId,
      level: 1,
      x: 400,
      y: 400,
      vx: 0,
      vy: 0,
      facing: 0,
      walkPhase: 0,
      hp: baseHp,
      maxHp: baseHp,
      shield: 0,
      swordAnim: SwordAnimState.IDLE,
      swordX: 424,
      swordY: 390,
      swordAngle: 0,
      offhandX: 376,
      offhandY: 390,
      offhandAngle: Math.PI,
      swordScale: 1.0,
      swordGlowColor: '#fb923c',
      swordGlowIntensity: 0.5,
      isScytheForm: false,
      colossusTimer: 0,
      boneStormTimer: 0,
      ribShieldTimer: 0,
      undyingTimer: 0,
      stealthTimer: 0,
      ambushReady: false,
      bloodFrenzyTimer: 0,
      phantomMistTimer: 0,
      possessingTimer: 0,
      nightmareTimer: 0,
      pipeThrown: false,
      lastStandTimer: 0,
      oneManArmyTimer: 0,
      airborneHeight: 0,
      isDowned: false,
      reviveProgress: 0,
      connected: true,
    };
  }
}

export const roomManager = new RoomManager();
