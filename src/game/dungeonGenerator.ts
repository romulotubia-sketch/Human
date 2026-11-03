import {
  DungeonRoom,
  EnemyEntity,
  EnemyKind,
  RectZone,
  WorldMap,
  WorldProp,
} from '../types/game';

let nextEntityId = 1;
export function allocEntityId(): number {
  return nextEntityId++;
}

export function buildGuildHouse(): { map: WorldMap; enemies: EnemyEntity[] } {
  const width = 1040;
  const height = 740;

  // Main cozy hall + wide overlapping doorway recess leading outside to the dungeon
  const walkableRects: RectZone[] = [
    { x: 90, y: 120, w: 860, h: 520 },
    { x: 430, y: 45, w: 180, h: 140 }, // Generous overlap into main hall (y: 45..185 overlaps y: 120..640)
  ];

  const rooms: DungeonRoom[] = [
    {
      id: 0,
      kind: 'guild',
      x: 90,
      y: 120,
      w: 860,
      h: 520,
      cleared: true,
    },
  ];

  const props: WorldProp[] = [
    {
      id: 'guild_rug',
      kind: 'rug',
      x: 350,
      y: 280,
      w: 340,
      h: 210,
      solid: false,
    },
    {
      id: 'guild_hearth',
      kind: 'hearth',
      x: 155,
      y: 122,
      w: 155,
      h: 66,
      solid: true,
      label: 'Warm Hearth',
    },
    {
      id: 'guild_bookshelf_r',
      kind: 'bookshelf',
      x: 710,
      y: 122,
      w: 165,
      h: 54,
      solid: true,
    },
    {
      id: 'guild_counter',
      kind: 'counter',
      x: 120,
      y: 430,
      w: 140,
      h: 68,
      solid: true,
    },
    {
      id: 'skill_shrine',
      kind: 'skill_shrine',
      x: 245,
      y: 275,
      w: 58,
      h: 58,
      solid: true,
      label: 'Skill Tome',
    },
    {
      id: 'door_dungeon',
      kind: 'door_dungeon',
      x: 455,
      y: 44,
      w: 130,
      h: 50,
      solid: false,
      label: 'Enter Dungeon',
    },
    {
      id: 'guild_torch_1',
      kind: 'torch',
      x: 405,
      y: 126,
      w: 20,
      h: 20,
      solid: false,
    },
    {
      id: 'guild_torch_2',
      kind: 'torch',
      x: 615,
      y: 126,
      w: 20,
      h: 20,
      solid: false,
    },
  ];

  const dummy: EnemyEntity = {
    id: allocEntityId(),
    kind: EnemyKind.TRAINING_DUMMY,
    name: 'Practice Dummy',
    x: 790,
    y: 385,
    vx: 0,
    vy: 0,
    radius: 24,
    hp: 9999,
    maxHp: 9999,
    atk: 0,
    speed: 0,
    facing: Math.PI,
    walkPhase: 0,
    attackCooldown: 99,
    windupTimer: 0,
    windupDuration: 0,
    windupType: 'slash',
    windupAngle: 0,
    attackAnimTimer: 0,
    attackAnimDuration: 0.25,
    hitFlash: 0,
    roomId: 0,
    weaponAngle: 0,
    weaponSwing: 0,
    armorCrackTimer: 0,
    poisonTimer: 0,
    poisonDps: 0,
    poisonTickAccum: 0,
    slowTimer: 0,
    preyMarkTimer: 0,
    pounceMarkTimer: 0,
    fearTimer: 0,
    possessedTimer: 0,
    staggerTimer: 0,
  };

  return {
    map: {
      isGuild: true,
      floor: 0,
      width,
      height,
      walkableRects,
      rooms,
      props,
      spawnX: 520,
      spawnY: 395,
    },
    enemies: [dummy],
  };
}

function randRange(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

interface GridNode {
  id: number;
  gx: number;
  gy: number;
  kind: 'start' | 'combat' | 'treasure' | 'boss';
  depth: number;
  parentId: number | null;
}

/**
 * Generates a genuinely randomized 2D procedural Crypt layout every floor & run:
 * - Branching 2D spanning tree across a virtual grid with randomized N/S/E/W turns
 * - Per-room randomized dimensions + sub-cell position jitter
 * - Wide 176px corridors overlapping 90px into connected rooms for 100% seamless traversal
 * - Steep compounding floor scaling (HP, ATK, Speed, Reflexes & Mob Density) on higher floors
 */
export function buildProceduralDungeon(floor: number): {
  map: WorldMap;
  enemies: EnemyEntity[];
} {
  const GRID_COLS = 6;
  const GRID_ROWS = 5;
  const CELL_PITCH_X = 1160;
  const CELL_PITCH_Y = 980;
  const DIRS = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  const occupied = new Map<string, GridNode>();
  const nodes: GridNode[] = [];
  const edges: Array<[number, number]> = [];
  const cellKey = (gx: number, gy: number) => `${gx},${gy}`;

  const startGx = randRange(1, GRID_COLS - 2);
  const startGy = randRange(1, GRID_ROWS - 2);
  const startNode: GridNode = {
    id: 0,
    gx: startGx,
    gy: startGy,
    kind: 'start',
    depth: 0,
    parentId: null,
  };
  nodes.push(startNode);
  occupied.set(cellKey(startGx, startGy), startNode);

  const countOccupiedNeighbors = (gx: number, gy: number): number => {
    let count = 0;
    for (const d of DIRS) {
      if (occupied.has(cellKey(gx + d.dx, gy + d.dy))) count++;
    }
    return count;
  };

  // 1. Grow a winding main & branching path of combat rooms (scales from 4 up to 6 combat rooms on deeper floors)
  const targetCombatCount = Math.min(6, 4 + Math.floor((floor - 1) / 2));
  let current = startNode;
  for (let c = 0; c < targetCombatCount; c++) {
    // Prefer continuing from deep nodes so the dungeon winds far across 2D space, fallback to any node
    const candidateParents = [...nodes].sort((a, b) => b.depth - a.depth);
    if (Math.random() < 0.32 && candidateParents.length > 1) {
      current = candidateParents[randRange(0, Math.min(2, candidateParents.length - 1))];
    }

    let placed: GridNode | null = null;
    const parentPool = [current, ...shuffleInPlace([...nodes])];

    for (const pNode of parentPool) {
      const dirs = shuffleInPlace([...DIRS]);
      // Prefer cells with only 1 occupied neighbor so branches spread out cleanly
      dirs.sort(
        (a, b) =>
          countOccupiedNeighbors(pNode.gx + a.dx, pNode.gy + a.dy) -
          countOccupiedNeighbors(pNode.gx + b.dx, pNode.gy + b.dy)
      );

      for (const d of dirs) {
        const ngx = pNode.gx + d.dx;
        const ngy = pNode.gy + d.dy;
        if (ngx < 0 || ngx >= GRID_COLS || ngy < 0 || ngy >= GRID_ROWS) continue;
        if (occupied.has(cellKey(ngx, ngy))) continue;

        placed = {
          id: nodes.length,
          gx: ngx,
          gy: ngy,
          kind: 'combat',
          depth: pNode.depth + 1,
          parentId: pNode.id,
        };
        nodes.push(placed);
        occupied.set(cellKey(ngx, ngy), placed);
        edges.push([pNode.id, placed.id]);
        current = placed;
        break;
      }
      if (placed) break;
    }
  }

  // 2. Place Boss Sanctum extending from the deepest reachable combat room!
  const sortedByDepth = [...nodes]
    .filter((n) => n.kind === 'combat')
    .sort((a, b) => b.depth - a.depth);

  let bossPlaced = false;
  for (const deepNode of sortedByDepth) {
    const dirs = shuffleInPlace([...DIRS]);
    dirs.sort(
      (a, b) =>
        countOccupiedNeighbors(deepNode.gx + a.dx, deepNode.gy + a.dy) -
        countOccupiedNeighbors(deepNode.gx + b.dx, deepNode.gy + b.dy)
    );
    for (const d of dirs) {
      const bgx = deepNode.gx + d.dx;
      const bgy = deepNode.gy + d.dy;
      if (bgx < 0 || bgx >= GRID_COLS || bgy < 0 || bgy >= GRID_ROWS) continue;
      if (occupied.has(cellKey(bgx, bgy))) continue;

      const bossNode: GridNode = {
        id: nodes.length,
        gx: bgx,
        gy: bgy,
        kind: 'boss',
        depth: deepNode.depth + 1,
        parentId: deepNode.id,
      };
      nodes.push(bossNode);
      occupied.set(cellKey(bgx, bgy), bossNode);
      edges.push([deepNode.id, bossNode.id]);
      bossPlaced = true;
      break;
    }
    if (bossPlaced) break;
  }

  if (!bossPlaced && sortedByDepth.length > 0) {
    sortedByDepth[0].kind = 'boss';
  }

  // 3. Attach 2 randomized Treasure Vault side-branches off non-boss rooms!
  let treasurePlaced = 0;
  const branchParents = shuffleInPlace(nodes.filter((n) => n.kind === 'combat' || n.kind === 'start'));
  for (const pNode of branchParents) {
    if (treasurePlaced >= 2) break;
    const dirs = shuffleInPlace([...DIRS]);
    for (const d of dirs) {
      const tgx = pNode.gx + d.dx;
      const tgy = pNode.gy + d.dy;
      if (tgx < 0 || tgx >= GRID_COLS || tgy < 0 || tgy >= GRID_ROWS) continue;
      if (occupied.has(cellKey(tgx, tgy))) continue;

      const tNode: GridNode = {
        id: nodes.length,
        gx: tgx,
        gy: tgy,
        kind: 'treasure',
        depth: pNode.depth + 1,
        parentId: pNode.id,
      };
      nodes.push(tNode);
      occupied.set(cellKey(tgx, tgy), tNode);
      edges.push([pNode.id, tNode.id]);
      treasurePlaced++;
      break;
    }
  }

  // 4. Materialize DungeonRooms with randomized dimensions & sub-cell (x, y) jitter
  const rawRoomsById = new Map<number, DungeonRoom>();
  for (const n of nodes) {
    const cx = 600 + n.gx * CELL_PITCH_X;
    const cy = 600 + n.gy * CELL_PITCH_Y;

    let rw = 740;
    let rh = 600;
    let jx = randRange(-62, 62);
    let jy = randRange(-52, 52);

    if (n.kind === 'start') {
      rw = randRange(500, 560);
      rh = randRange(460, 510);
      jx = randRange(-45, 45);
      jy = randRange(-40, 40);
    } else if (n.kind === 'combat') {
      rw = randRange(700, 850);
      rh = randRange(560, 680);
    } else if (n.kind === 'treasure') {
      rw = randRange(600, 690);
      rh = randRange(490, 560);
    } else if (n.kind === 'boss') {
      rw = 960;
      rh = 860;
      jx = randRange(-20, 20);
      jy = randRange(-20, 20);
    }

    const rm: DungeonRoom = {
      id: n.id,
      kind: n.kind,
      x: Math.round(cx - rw / 2 + jx),
      y: Math.round(cy - rh / 2 + jy),
      w: rw,
      h: rh,
      cleared: n.kind === 'start',
    };
    rawRoomsById.set(n.id, rm);
  }

  const rooms: DungeonRoom[] = nodes.map((n) => rawRoomsById.get(n.id)!);
  const walkableRects: RectZone[] = [];

  for (const rm of rooms) {
    walkableRects.push({ x: rm.x, y: rm.y, w: rm.w, h: rm.h });
  }

  // 5. Connect parent <-> child rooms with wide 176px corridors overlapping 90px into both rooms
  const corridorSize = 176;
  const overlap = 90;

  for (const [idA, idB] of edges) {
    const nodeA = nodes[idA];
    const nodeB = nodes[idB];
    const rmA = rawRoomsById.get(idA)!;
    const rmB = rawRoomsById.get(idB)!;

    if (nodeA.gx !== nodeB.gx) {
      const left = nodeA.gx < nodeB.gx ? rmA : rmB;
      const right = nodeA.gx < nodeB.gx ? rmB : rmA;
      const minMidY = Math.max(left.y + 96, right.y + 96);
      const maxMidY = Math.min(left.y + left.h - 96, right.y + right.h - 96);
      const avgY = Math.round((left.y + left.h / 2 + right.y + right.h / 2) / 2);
      const midY = Math.max(minMidY, Math.min(maxMidY, avgY));

      const startX = left.x + left.w - overlap;
      const endX = right.x + overlap;
      walkableRects.push({
        x: startX,
        y: midY - Math.floor(corridorSize / 2),
        w: Math.max(corridorSize, endX - startX),
        h: corridorSize,
      });
    } else {
      const top = nodeA.gy < nodeB.gy ? rmA : rmB;
      const bottom = nodeA.gy < nodeB.gy ? rmB : rmA;
      const minMidX = Math.max(top.x + 96, bottom.x + 96);
      const maxMidX = Math.min(top.x + top.w - 96, bottom.x + bottom.w - 96);
      const avgX = Math.round((top.x + top.w / 2 + bottom.x + bottom.w / 2) / 2);
      const midX = Math.max(minMidX, Math.min(maxMidX, avgX));

      const startY = top.y + top.h - overlap;
      const endY = bottom.y + overlap;
      walkableRects.push({
        x: midX - Math.floor(corridorSize / 2),
        y: startY,
        w: corridorSize,
        h: Math.max(corridorSize, endY - startY),
      });
    }
  }

  // 6. Normalize world coordinates so bounding box fits tightly with a clean 220px border
  let minWorldX = Infinity;
  let minWorldY = Infinity;
  for (const r of walkableRects) {
    if (r.x < minWorldX) minWorldX = r.x;
    if (r.y < minWorldY) minWorldY = r.y;
  }
  const shiftX = 220 - minWorldX;
  const shiftY = 220 - minWorldY;

  let maxWorldX = 0;
  let maxWorldY = 0;
  for (const rm of rooms) {
    rm.x += shiftX;
    rm.y += shiftY;
  }
  for (const r of walkableRects) {
    r.x += shiftX;
    r.y += shiftY;
    if (r.x + r.w > maxWorldX) maxWorldX = r.x + r.w;
    if (r.y + r.h > maxWorldY) maxWorldY = r.y + r.h;
  }

  const props: WorldProp[] = [];
  const enemies: EnemyEntity[] = [];
  const startRoom = rooms.find((r) => r.kind === 'start')!;

  props.push({
    id: 'start_guild_portal',
    kind: 'portal_guild',
    x: startRoom.x + 68,
    y: startRoom.y + 68,
    w: 56,
    h: 56,
    solid: false,
    label: 'Return to Guild',
  });

  // 7. Compounding Higher-Floor Scaling (Noticeably tougher HP, ATK, Speed, Reflexes & Mob Density!)
  const scaleHp = Math.pow(1.42, floor - 1) * (1 + (floor - 1) * 0.14);
  const scaleAtk = Math.pow(1.28, floor - 1) * (1 + (floor - 1) * 0.09);
  const scaleSpeed = Math.min(1.48, 1 + (floor - 1) * 0.065);
  const windupScale = Math.max(0.72, 1 - (floor - 1) * 0.045);

  const spawnSkeletonMob = (kind: EnemyKind, rm: DungeonRoom, x: number, y: number) => {
    const baseDebuffs = {
      attackAnimTimer: 0,
      attackAnimDuration: 0.26,
      poisonTimer: 0,
      poisonDps: 0,
      poisonTickAccum: 0,
      slowTimer: 0,
      preyMarkTimer: 0,
      pounceMarkTimer: 0,
      fearTimer: 0,
      possessedTimer: 0,
      staggerTimer: 0,
    };

    if (kind === EnemyKind.RATTLER) {
      enemies.push({
        id: allocEntityId(),
        kind,
        name: floor >= 3 ? `Dread Rattler Lv.${floor}` : 'Crypt Rattler',
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 19,
        hp: Math.round(98 * scaleHp),
        maxHp: Math.round(98 * scaleHp),
        atk: Math.round(14 * scaleAtk),
        speed: Math.round(115 * scaleSpeed),
        facing: Math.random() * Math.PI * 2,
        walkPhase: Math.random() * Math.PI * 2,
        attackCooldown: 0.55 + Math.random() * 0.55,
        windupTimer: 0,
        windupDuration: Math.max(0.27, 0.38 * windupScale),
        windupType: 'slash',
        windupAngle: 0,
        hitFlash: 0,
        roomId: rm.id,
        weaponAngle: 0,
        weaponSwing: 0,
        armorCrackTimer: 0,
        ...baseDebuffs,
      });
    } else if (kind === EnemyKind.ARCHER) {
      enemies.push({
        id: allocEntityId(),
        kind,
        name: floor >= 3 ? `Venomdead Archer Lv.${floor}` : 'Marrow Archer',
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 18,
        hp: Math.round(80 * scaleHp),
        maxHp: Math.round(80 * scaleHp),
        atk: Math.round(16 * scaleAtk),
        speed: Math.round(92 * scaleSpeed),
        facing: Math.random() * Math.PI * 2,
        walkPhase: Math.random() * Math.PI * 2,
        attackCooldown: 0.95 + Math.random() * 0.65,
        windupTimer: 0,
        windupDuration: Math.max(0.38, 0.55 * windupScale),
        windupType: 'shoot',
        windupAngle: 0,
        hitFlash: 0,
        roomId: rm.id,
        weaponAngle: 0,
        weaponSwing: 0,
        armorCrackTimer: 0,
        ...baseDebuffs,
      });
    } else if (kind === EnemyKind.BRUTE) {
      enemies.push({
        id: allocEntityId(),
        kind,
        name: floor >= 3 ? `Catacomb Crusher Lv.${floor}` : 'Skullguard Brute',
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 26,
        hp: Math.round(225 * scaleHp),
        maxHp: Math.round(225 * scaleHp),
        atk: Math.round(24 * scaleAtk),
        speed: Math.round(80 * scaleSpeed),
        facing: Math.random() * Math.PI * 2,
        walkPhase: Math.random() * Math.PI * 2,
        attackCooldown: 1.15 + Math.random() * 0.45,
        windupTimer: 0,
        windupDuration: Math.max(0.48, 0.68 * windupScale),
        windupType: 'slam',
        windupAngle: 0,
        hitFlash: 0,
        roomId: rm.id,
        weaponAngle: 0,
        weaponSwing: 0,
        armorCrackTimer: 0,
        ...baseDebuffs,
      });
    }
  };

  // 8. Populate props, chests, pillars (away from doorway midlines!) & scaled enemy packs per room
  let combatIndex = 0;
  let treasureIndex = 0;

  for (const rm of rooms) {
    props.push(
      {
        id: `torch_${rm.id}_tl`,
        kind: 'torch',
        x: rm.x + 34,
        y: rm.y + 34,
        w: 20,
        h: 20,
        solid: false,
      },
      {
        id: `torch_${rm.id}_tr`,
        kind: 'torch',
        x: rm.x + rm.w - 54,
        y: rm.y + 34,
        w: 20,
        h: 20,
        solid: false,
      },
      {
        id: `torch_${rm.id}_bl`,
        kind: 'torch',
        x: rm.x + 34,
        y: rm.y + rm.h - 54,
        w: 20,
        h: 20,
        solid: false,
      },
      {
        id: `torch_${rm.id}_br`,
        kind: 'torch',
        x: rm.x + rm.w - 54,
        y: rm.y + rm.h - 54,
        w: 20,
        h: 20,
        solid: false,
      }
    );

    if (rm.kind === 'combat') {
      combatIndex++;
      // Corner pillars placed strictly at 20%/80% so center N/S/E/W corridors stay 100% open
      const pxL = rm.x + Math.floor(rm.w * 0.2);
      const pxR = rm.x + Math.floor(rm.w * 0.8) - 44;
      const pyT = rm.y + Math.floor(rm.h * 0.2);
      const pyB = rm.y + Math.floor(rm.h * 0.8) - 44;
      props.push(
        { id: `pil_${rm.id}_1`, kind: 'pillar', x: pxL, y: pyT, w: 44, h: 44, solid: true },
        { id: `pil_${rm.id}_2`, kind: 'pillar', x: pxR, y: pyT, w: 44, h: 44, solid: true },
        { id: `pil_${rm.id}_3`, kind: 'pillar', x: pxL, y: pyB, w: 44, h: 44, solid: true },
        { id: `pil_${rm.id}_4`, kind: 'pillar', x: pxR, y: pyB, w: 44, h: 44, solid: true }
      );

      const baseCount = 4 + (combatIndex % 2) + Math.min(4, floor - 1);
      for (let m = 0; m < baseCount; m++) {
        const ang = (m / baseCount) * Math.PI * 2 + Math.random() * 0.45;
        const radX = rm.w * (0.14 + Math.random() * 0.16);
        const radY = rm.h * (0.14 + Math.random() * 0.16);
        const mx = rm.x + rm.w * 0.5 + Math.cos(ang) * radX;
        const my = rm.y + rm.h * 0.5 + Math.sin(ang) * radY;

        let kind = EnemyKind.RATTLER;
        if (m === 0 && (combatIndex >= 2 || floor >= 2)) {
          kind = EnemyKind.BRUTE;
        } else if (m === 1 && floor >= 3) {
          kind = EnemyKind.BRUTE;
        } else if (m % 3 === 1) {
          kind = EnemyKind.ARCHER;
        }
        spawnSkeletonMob(kind, rm, mx, my);
      }
    } else if (rm.kind === 'treasure') {
      treasureIndex++;
      props.push({
        id: `chest_${treasureIndex}_${floor}`,
        kind: 'chest',
        x: rm.x + Math.floor(rm.w * 0.5) - 28,
        y: rm.y + Math.floor(rm.h * 0.5) - 24,
        w: 56,
        h: 48,
        solid: true,
        opened: false,
        label: treasureIndex === 1 ? 'Open Reliquary Chest' : 'Open Crypt Chest',
      });

      const guardCount = 3 + Math.min(2, Math.floor(floor / 2));
      for (let g = 0; g < guardCount; g++) {
        const ga = (g / guardCount) * Math.PI * 2 + 0.5;
        const gx = rm.x + rm.w * 0.5 + Math.cos(ga) * (rm.w * 0.24);
        const gy = rm.y + rm.h * 0.5 + Math.sin(ga) * (rm.h * 0.24);
        const gKind = g === 0 ? EnemyKind.BRUTE : g === 1 ? EnemyKind.ARCHER : EnemyKind.RATTLER;
        spawnSkeletonMob(gKind, rm, gx, gy);
      }
    } else if (rm.kind === 'boss') {
      const bOff = 170;
      props.push(
        { id: `bp_${rm.id}_1`, kind: 'pillar', x: rm.x + bOff, y: rm.y + bOff, w: 50, h: 50, solid: true },
        { id: `bp_${rm.id}_2`, kind: 'pillar', x: rm.x + rm.w - bOff - 50, y: rm.y + bOff, w: 50, h: 50, solid: true },
        { id: `bp_${rm.id}_3`, kind: 'pillar', x: rm.x + bOff, y: rm.y + rm.h - bOff - 50, w: 50, h: 50, solid: true },
        { id: `bp_${rm.id}_4`, kind: 'pillar', x: rm.x + rm.w - bOff - 50, y: rm.y + rm.h - bOff - 50, w: 50, h: 50, solid: true }
      );

      enemies.push({
        id: allocEntityId(),
        kind: EnemyKind.BOSS_WARDEN,
        name:
          floor === 1
            ? 'High Warden Ossian'
            : `Ascendant Ossian · Crypt ${floor}`,
        x: rm.x + rm.w * 0.5,
        y: rm.y + rm.h * 0.5,
        vx: 0,
        vy: 0,
        radius: 38,
        hp: Math.round(1020 * scaleHp),
        maxHp: Math.round(1020 * scaleHp),
        atk: Math.round(29 * scaleAtk),
        speed: Math.round(98 * scaleSpeed),
        facing: Math.PI,
        walkPhase: 0,
        attackCooldown: Math.max(0.95, 1.45 * windupScale),
        windupTimer: 0,
        windupDuration: Math.max(0.58, 0.84 * windupScale),
        windupType: 'slam',
        windupAngle: 0,
        attackAnimTimer: 0,
        attackAnimDuration: 0.36,
        hitFlash: 0,
        roomId: rm.id,
        weaponAngle: 0,
        weaponSwing: 0,
        armorCrackTimer: 0,
        poisonTimer: 0,
        poisonDps: 0,
        poisonTickAccum: 0,
        slowTimer: 0,
        preyMarkTimer: 0,
        pounceMarkTimer: 0,
        fearTimer: 0,
        possessedTimer: 0,
        staggerTimer: 0,
      });

      // On higher floors (Floor 2+), Boss Warden is flanked by elite Royal Honor Guards!
      const royalGuards = Math.min(3, floor - 1);
      for (let rg = 0; rg < royalGuards; rg++) {
        const ra = (rg / Math.max(1, royalGuards)) * Math.PI * 2 + 0.8;
        spawnSkeletonMob(
          rg % 2 === 0 ? EnemyKind.BRUTE : EnemyKind.ARCHER,
          rm,
          rm.x + rm.w * 0.5 + Math.cos(ra) * 165,
          rm.y + rm.h * 0.5 + Math.sin(ra) * 145
        );
      }
    }
  }

  return {
    map: {
      isGuild: false,
      floor,
      width: maxWorldX + 220,
      height: maxWorldY + 220,
      walkableRects,
      rooms,
      props,
      spawnX: startRoom.x + startRoom.w * 0.5,
      spawnY: startRoom.y + startRoom.h * 0.5,
    },
    enemies,
  };
}
