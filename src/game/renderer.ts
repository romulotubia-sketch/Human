import { HERO_SKILLS } from '../data/heroSkills';
import {
  AimState,
  AlliedMinion,
  DelayedClawMark,
  EnemyEntity,
  EnemyKind,
  FloatingText,
  GroundEffect,
  HeroId,
  isBossKind,
  isMiniHeroKind,
  isUndeadLegionBoss,
  LifeSiphonBeam,
  Particle,
  PickupOrb,
  Projectile,
  SlashWaveEffect,
  SwordAnimState,
  SwordTrailPoint,
  TargetingMode,
  ToxicCloudZone,
  WorldMap,
  WorldProp,
  OrbitingSpirit,
  PipeStrikeEffect,
  ScrapDebrisPiece,
  SoulDrainTether,
  SpectralRiftZone,
} from '../types/game';

export interface PlayerRenderState {
  heroId: HeroId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  walkPhase: number;
  hp: number;
  maxHp: number;
  shield: number;
  hitFlash: number;
  colossusTimer: number; // Bone Colossus (Skeleton), Abomination Form (Zombie), Apex Predator (Ghoul)
  boneStormTimer: number;
  ribShieldTimer: number;
  undyingTimer: number;
  stealthTimer: number;
  ambushReady: boolean;
  bloodFrenzyTimer: number;
  frenzyStacks: number;
  momentumStacks: number;
  phantomMistTimer: number;
  possessingTimer: number;
  nightmareTimer: number;
  restlessStacks: number;
  etherealShimmerTimer: number;
  pipeThrown: boolean;
  kneeStrikeTimer: number;
  lastStandTimer: number;
  oneManArmyTimer: number;
  instinctSurrounded: boolean;
  wingFlapTimer?: number;
  huntersMarkTargetId?: number | null;
  rainOfFeathersTimer?: number;
  celestialBarrageTimer?: number;
  celestialBarrageWings?: number;
  wrathSkyTimer?: number;
  precisionStacks?: number;
  lastTargetHitId?: number | null;
  kingOfBeastsTimer?: number;
  feralMomentumStacks?: number;
  feralMomentumTimer?: number;
  tigerRoarTimer?: number;
  crushingPawTimer?: number;
  savagePursuitTimer?: number;
  apexDevastationTimer?: number;
  airborneHeight: number;
  attackLunge: number;
  attackTwist: number;
  attackSquash: number;
  swordX: number;
  swordY: number;
  swordAngle: number;
  offhandX: number;
  offhandY: number;
  offhandAngle: number;
  swordScale: number;
  swordAnim: SwordAnimState;
  swordGlowColor: string;
  swordGlowIntensity: number;
  isScytheForm: boolean;
  dashGhostTrail: Array<{ x: number; y: number; alpha: number }>;
  isDowned?: boolean;
  reviveProgress?: number;
}

export interface RemotePlayerRenderState extends PlayerRenderState {
  id: string;
  name: string;
  isDowned: boolean;
  reviveProgress: number;
  disconnected?: boolean;
}

type DepthRenderable =
  | { sortY: number; type: 'prop'; prop: WorldProp }
  | { sortY: number; type: 'player' }
  | { sortY: number; type: 'remote_player'; player: RemotePlayerRenderState }
  | { sortY: number; type: 'enemy'; enemy: EnemyEntity }
  | { sortY: number; type: 'minion'; minion: AlliedMinion };

// Module-level scratch buffers for zero per-frame GC pauses at 60fps
const scratchDepthList: DepthRenderable[] = [];
const scratchTrailPts: SwordTrailPoint[] = [];
const scratchTrailOffhand: SwordTrailPoint[] = [];

export function renderGameWorld(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  camX: number,
  camY: number,
  time: number,
  map: WorldMap,
  player: PlayerRenderState,
  enemies: EnemyEntity[],
  minions: AlliedMinion[],
  toxicClouds: ToxicCloudZone[],
  delayedClawMarks: DelayedClawMark[],
  groundEffects: GroundEffect[],
  slashWaves: SlashWaveEffect[],
  siphonBeams: LifeSiphonBeam[],
  spectralRifts: SpectralRiftZone[],
  orbitingSpirits: OrbitingSpirit[],
  soulTethers: SoulDrainTether[],
  pipeStrikes: PipeStrikeEffect[],
  scrapDebris: ScrapDebrisPiece[],
  projectiles: Projectile[],
  pickups: PickupOrb[],
  swordTrail: SwordTrailPoint[],
  particles: Particle[],
  floatingTexts: FloatingText[],
  aimState: AimState,
  remotePlayers: RemotePlayerRenderState[] = []
) {
  ctx.fillStyle = map.isGuild ? '#140f0c' : '#0b0e13';
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.save();
  ctx.translate(Math.round(viewW / 2 - camX), Math.round(viewH / 2 - camY));

  const cullLeft = camX - viewW / 2 - 180;
  const cullRight = camX + viewW / 2 + 180;
  const cullTop = camY - viewH / 2 - 180;
  const cullBottom = camY + viewH / 2 + 180;

  // 1. Floor & Walls
  drawWorldFloorsAndWalls(ctx, map, cullLeft, cullRight, cullTop, cullBottom, time);

  // 2. Floor Props (with generous offscreen padding so portal auras never pop)
  for (let i = 0; i < map.props.length; i++) {
    const prop = map.props[i];
    if (!prop.solid) {
      if (
        prop.x + prop.w < cullLeft - 90 ||
        prop.x > cullRight + 90 ||
        prop.y + prop.h < cullTop - 90 ||
        prop.y > cullBottom + 90
      ) {
        continue;
      }
      drawProp(ctx, prop, time);
    }
  }

  // 3. Ground Fissures, Spectral Rifts (Death's Passage), Mist Nodes & Delayed Claw Marks
  drawSpectralRifts(ctx, spectralRifts, cullLeft, cullRight, cullTop, cullBottom, time);
  drawGroundEffects(ctx, groundEffects, cullLeft, cullRight, cullTop, cullBottom, time);
  drawDelayedClawMarks(ctx, delayedClawMarks, cullLeft, cullRight, cullTop, cullBottom, time);

  // 4. Lingering Volumetric Toxic Plague Clouds (Zombie Plague Burst)
  for (let i = 0; i < toxicClouds.length; i++) {
    const cloud = toxicClouds[i];
    if (!cloud.active) continue;
    if (
      cloud.x + cloud.radius < cullLeft ||
      cloud.x - cloud.radius > cullRight ||
      cloud.y + cloud.radius < cullTop ||
      cloud.y - cloud.radius > cullBottom
    ) {
      continue;
    }
    drawToxicCloud(ctx, cloud, time);
  }

  // 5. MOBA Ground Targeting Reticle
  if (aimState.active && aimState.skillId && !aimState.willCancel) {
    drawAimIndicator(ctx, player, aimState, time);
  }

  // 6. Pickup Orbs
  for (let i = 0; i < pickups.length; i++) {
    const orb = pickups[i];
    if (!orb.active) continue;
    if (orb.x < cullLeft || orb.x > cullRight || orb.y < cullTop || orb.y > cullBottom) continue;
    drawPickupOrb(ctx, orb, time);
  }

  // 7. Enemy Attack Floor Telegraphs
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.hp > 0 && e.windupTimer > 0) {
      drawEnemyTelegraph(ctx, e);
    }
  }

  if (player.boneStormTimer > 0 && !player.isDowned) {
    drawBoneStormVortex(ctx, player, time);
  }
  if (remotePlayers && remotePlayers.length > 0) {
    for (let i = 0; i < remotePlayers.length; i++) {
      const rp = remotePlayers[i];
      if (rp.boneStormTimer > 0 && !rp.isDowned) {
        drawBoneStormVortex(ctx, rp, time);
      }
    }
  }

  // 8. Depth-sorted Solid Props + Characters (reusing scratchDepthList)
  scratchDepthList.length = 0;
  if (player.possessingTimer <= 0) {
    scratchDepthList.push({ sortY: player.y, type: 'player' });
  }

  if (remotePlayers && remotePlayers.length > 0) {
    for (let i = 0; i < remotePlayers.length; i++) {
      const rp = remotePlayers[i];
      if (rp.x < cullLeft || rp.x > cullRight || rp.y < cullTop || rp.y > cullBottom) continue;
      scratchDepthList.push({ sortY: rp.y, type: 'remote_player', player: rp });
    }
  }

  for (let i = 0; i < map.props.length; i++) {
    const prop = map.props[i];
    if (prop.solid) {
      scratchDepthList.push({ sortY: prop.y + prop.h * 0.85, type: 'prop', prop });
    }
  }
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.hp <= 0) continue;
    if (e.x < cullLeft || e.x > cullRight || e.y < cullTop || e.y > cullBottom) continue;
    scratchDepthList.push({ sortY: e.y, type: 'enemy', enemy: e });
  }
  for (let i = 0; i < minions.length; i++) {
    const m = minions[i];
    if (m.hp <= 0) continue;
    scratchDepthList.push({ sortY: m.y, type: 'minion', minion: m });
  }

  scratchDepthList.sort((a, b) => a.sortY - b.sortY);

  // Rush / Flesh Ripper / Ghoul Shadow-Pounce / Ghost Phantom Dash Afterimages
  for (let i = 0; i < player.dashGhostTrail.length; i++) {
    const ghost = player.dashGhostTrail[i];
    if (ghost.alpha <= 0.02) continue;
    ctx.save();
    ctx.globalAlpha = ghost.alpha * (player.heroId === 'ghoul' || player.heroId === 'ghost' ? 0.6 : 0.5);
    const gScale = player.colossusTimer > 0 ? 1.65 : 1;
    if (player.heroId === 'human') {
      drawChibiHumanBody(
        ctx,
        ghost.x,
        ghost.y,
        player.facing,
        0,
        gScale,
        true,
        false,
        0,
        0
      );
    } else if (player.heroId === 'ghost') {
      drawChibiGhostBody(ctx, ghost.x, ghost.y, player.facing, 0, gScale, true, player.nightmareTimer > 0, 0, 0);
    } else if (player.heroId === 'zombie') {
      drawChibiZombieBody(ctx, ghost.x, ghost.y, player.facing, 0, gScale, true, player.colossusTimer > 0, 0);
    } else if (player.heroId === 'ghoul') {
      drawChibiGhoulBody(ctx, ghost.x, ghost.y, player.facing, 0, gScale, true, player.colossusTimer > 0, 0, 0);
    } else if (player.heroId === 'eaglekin') {
      drawChibiEaglekinBody(ctx, ghost.x, ghost.y, player.facing, 0, gScale, true);
    } else if (player.heroId === 'tigerkin') {
      drawChibiTigerkinBody(ctx, ghost.x, ghost.y, player.facing, 0, gScale, true, (player.kingOfBeastsTimer || 0) > 0);
    } else {
      drawChibiSkeletonBody(ctx, ghost.x, ghost.y, player.facing, 0, gScale, '#67e8f9', true);
    }
    ctx.restore();
  }

  for (let i = 0; i < scratchDepthList.length; i++) {
    const item = scratchDepthList[i];
    if (item.type === 'prop') {
      drawProp(ctx, item.prop, time);
    } else if (item.type === 'player') {
      drawHeroAndEffects(ctx, player, time);
    } else if (item.type === 'remote_player') {
      drawRemotePlayerAndEffects(ctx, item.player, time);
    } else if (item.type === 'enemy') {
      drawEnemy(ctx, item.enemy, time, player.heroId === 'ghoul');
    } else if (item.type === 'minion') {
      drawMinion(ctx, item.minion, time);
    }
  }

  // 9. Life Siphon Tendrils (Zombie) & Ethereal Soul Drain Tethers + Spirit Legion (Ghost)
  drawLifeSiphonBeams(ctx, siphonBeams, player.x, player.y - 12, time);
  drawSoulDrainTethers(ctx, soulTethers, enemies, player.x, player.y - 15, time);
  drawOrbitingSpirits(ctx, orbitingSpirits, time);

  // 10. Additive Glowing Weapon Ribbon Trail, Slash Waves & Human Kinetic Pipe Strikes / Scrapstorm
  drawSwordRibbonTrail(ctx, swordTrail);
  drawSlashWaves(ctx, slashWaves);
  drawPipeStrikeEffects(ctx, pipeStrikes);
  drawScrapDebris(ctx, scrapDebris, time);

  // 11. Independent Floating Hero Weapon (Metal Pipe, Bone Sword, Rotting Claws, Feral Claws, or Astral Soul Lantern!)
  if (player.possessingTimer <= 0 && !player.isDowned) {
    drawFloatingHeroWeapon(ctx, player, time);
  }
  if (remotePlayers && remotePlayers.length > 0) {
    for (let i = 0; i < remotePlayers.length; i++) {
      const rp = remotePlayers[i];
      if (
        !rp.isDowned &&
        rp.possessingTimer <= 0 &&
        rp.x >= cullLeft &&
        rp.x <= cullRight &&
        rp.y >= cullTop &&
        rp.y <= cullBottom
      ) {
        drawFloatingHeroWeapon(ctx, rp, time);
      }
    }
  }

  // 12. Projectiles
  for (let i = 0; i < projectiles.length; i++) {
    const proj = projectiles[i];
    if (!proj.active) continue;
    if (proj.x < cullLeft || proj.x > cullRight || proj.y < cullTop || proj.y > cullBottom) continue;
    drawProjectile(ctx, proj, time);
  }

  // 13. Pooled Particles
  drawParticles(ctx, particles, cullLeft, cullRight, cullTop, cullBottom);

  // 14. Warm Ambient Lighting Overlays & Eternal Nightmare Darkness Realm
  drawAmbientGlows(ctx, map, cullLeft, cullRight, cullTop, cullBottom, time);
  if (player.nightmareTimer > 0) {
    drawEternalNightmareRealm(ctx, camX, camY, viewW, viewH, player, time);
  }

  // 15. Floating Damage Numbers
  drawFloatingTexts(ctx, floatingTexts);

  ctx.restore();
}

export function renderHeroShowcaseCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  heroId: HeroId
) {
  ctx.clearRect(0, 0, w, h);

  const isHuman = heroId === 'human';
  const isZombie = heroId === 'zombie';
  const isGhoul = heroId === 'ghoul';
  const isGhost = heroId === 'ghost';
  const isEaglekin = heroId === 'eaglekin';
  const isTigerkin = heroId === 'tigerkin';
  const grad = ctx.createRadialGradient(w / 2, h * 0.56, 8, w / 2, h * 0.56, w * 0.52);
  grad.addColorStop(
    0,
    isHuman
      ? 'rgba(251, 146, 60, 0.25)'
      : isGhost
        ? 'rgba(129, 140, 248, 0.28)'
        : isGhoul
          ? 'rgba(244, 63, 94, 0.24)'
          : isZombie
            ? 'rgba(132, 204, 22, 0.2)'
            : isEaglekin
              ? 'rgba(56, 189, 248, 0.28)'
              : isTigerkin
                ? 'rgba(245, 158, 11, 0.32)'
                : 'rgba(56, 189, 248, 0.18)'
  );
  grad.addColorStop(0.58, 'rgba(38, 29, 24, 0.55)');
  grad.addColorStop(1, 'rgba(20, 15, 12, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#26201c';
  ctx.strokeStyle = isHuman
    ? 'rgba(251, 146, 60, 0.45)'
    : isGhost
      ? 'rgba(129, 140, 248, 0.45)'
      : isGhoul
        ? 'rgba(251, 113, 133, 0.42)'
        : isZombie
          ? 'rgba(163, 230, 53, 0.35)'
          : isEaglekin
            ? 'rgba(56, 189, 248, 0.45)'
            : isTigerkin
              ? 'rgba(245, 158, 11, 0.55)'
              : 'rgba(251, 191, 36, 0.32)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.78, 54, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const hx = isGhoul || isTigerkin ? w * 0.5 : w * 0.43;
  const hy = h * 0.72;
  if (isHuman) {
    drawChibiHumanBody(ctx, hx, hy, 0.25, time * 2.5, 1.74, false, false, 0, 0);
  } else if (isGhost) {
    drawChibiGhostBody(ctx, hx, hy, 0.25, time * 2.4, 1.74, false, false, 0, 0);
  } else if (isGhoul) {
    drawChibiGhoulBody(ctx, hx, hy, 0.2, time * 3.1, 1.72, false, false, 0, 0);
  } else if (isZombie) {
    drawChibiZombieBody(ctx, hx, hy, 0.25, time * 2.2, 1.75, false, false, 0);
  } else if (isEaglekin) {
    drawChibiEaglekinBody(ctx, hx, hy, 0.25, time * 2.5, 1.75, false, 0, 0, Math.sin(time * 3) > 0.65 ? 0.35 : 0);
  } else if (isTigerkin) {
    drawChibiTigerkinBody(ctx, hx, hy, 0.25, time * 2.4, 1.75, false, false, 0, 0);
  } else {
    drawChibiSkeletonBody(ctx, hx, hy, 0.25, time * 2.4, 1.75, '#67e8f9', false, '#9a3412', null, 0);
  }

  const hover = Math.sin(time * 3.6) * 5;
  const wx = isGhoul || isTigerkin ? hx + 40 : isGhost ? hx + 43 : isEaglekin ? hx + 32 : hx + 46;
  const wy = (isGhost ? h * 0.51 : h * 0.55) + hover;
  const ox = hx - 40;
  const oy = h * 0.56 - hover * 0.85;

  // Eaglekin's wings are its weapon (no floating detached weapon)
  if (!isEaglekin) {
    drawFloatingHeroWeapon(
      ctx,
      {
        heroId,
        x: hx,
        y: hy,
        vx: 0,
        vy: 0,
        facing: 0.25,
        walkPhase: 0,
        hp: 250,
        maxHp: 250,
        shield: 0,
        hitFlash: 0,
        colossusTimer: 0,
        boneStormTimer: 0,
        ribShieldTimer: 0,
        undyingTimer: 0,
        stealthTimer: 0,
        ambushReady: false,
        bloodFrenzyTimer: 0,
        frenzyStacks: 0,
        momentumStacks: 0,
        phantomMistTimer: 0,
        possessingTimer: 0,
        nightmareTimer: 0,
        restlessStacks: 0,
        etherealShimmerTimer: 0,
        pipeThrown: false,
        kneeStrikeTimer: 0,
        lastStandTimer: 0,
        oneManArmyTimer: 0,
        instinctSurrounded: false,
        airborneHeight: 0,
        attackLunge: 0,
        attackTwist: 0,
        attackSquash: 0,
        swordX: wx,
        swordY: wy,
        swordAngle: isGhost
          ? Math.sin(time * 2.8) * 0.14
          : isGhoul || isTigerkin
            ? -Math.PI * 0.18 + Math.sin(time * 3.4) * 0.14
            : -Math.PI * 0.28 + Math.sin(time * 2.4) * 0.1,
        offhandX: ox,
        offhandY: oy,
        offhandAngle: Math.PI + Math.PI * 0.18 - Math.sin(time * 3.4) * 0.14,
        swordScale: isGhoul || isTigerkin ? 1.38 : 1.48,
        swordAnim: SwordAnimState.IDLE,
        swordGlowColor: isHuman
          ? '#fb923c'
          : isGhost
            ? '#818cf8'
            : isGhoul
              ? '#f43f5e'
              : isZombie
                ? '#a3e635'
                : isTigerkin
                  ? '#f59e0b'
                  : '#67e8f9',
        swordGlowIntensity: 0.92,
        isScytheForm: false,
        dashGhostTrail: [],
      },
      time
    );
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const phase = (time * 1.45 + i * 0.37) % 1;
    const px = (isGhoul || isEaglekin || isTigerkin ? hx : wx + 8) + Math.cos(i * 2.1 + time * 2.0) * (isGhoul || isTigerkin ? 36 : isEaglekin ? 24 : 18);
    const py = (isEaglekin ? hy - 16 : wy - 2) - phase * 26;
    ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.85;
    ctx.fillStyle = isHuman
      ? i % 2 === 0
        ? '#fb923c'
        : '#e2e8f0'
      : isGhost
        ? i % 2 === 0
          ? '#5eead4'
          : '#c7d2fe'
        : isGhoul
          ? i % 2 === 0
            ? '#fb7185'
            : '#ffe4e6'
          : isZombie
            ? i % 2 === 0
              ? '#a3e635'
              : '#c084fc'
            : isEaglekin
              ? i % 2 === 0
                ? '#38bdf8'
                : '#fde047'
              : isTigerkin
                ? i % 2 === 0
                  ? '#fbbf24'
                  : '#f97316'
                : i % 2 === 0
                  ? '#67e8f9'
                  : '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDelayedClawMarks(
  ctx: CanvasRenderingContext2D,
  marks: DelayedClawMark[],
  cullL: number,
  cullR: number,
  cullT: number,
  cullB: number,
  time: number
) {
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i];
    if (!m.active || m.erupted) continue;
    if (m.x + 80 < cullL || m.x - 80 > cullR || m.y + 80 < cullT || m.y - 80 > cullB) continue;

    const p = Math.min(1, m.age / m.maxAge);
    const smoothP = p * p * (3 - 2 * p);
    const pulse = 0.65 + Math.sin(time * 16 + i) * 0.2;
    const r = m.radius * (0.58 + 0.28 * smoothP);

    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.angle);

    // Soft dusk-crimson shadow pool
    ctx.globalAlpha = 0.28 + smoothP * 0.22;
    ctx.fillStyle = '#1f060e';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
    ctx.fill();

    // Smooth inward-focusing rose bloom halo + twin soft crescent petals (zero scratchy line clutter)
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = p > 0.72 ? '#ffe4e6' : '#fb7185';
    ctx.lineWidth = 1.8 + smoothP * 1.6;
    ctx.globalAlpha = pulse * 0.78;
    ctx.beginPath();
    ctx.arc(0, 0, m.radius * (0.95 - smoothP * 0.35), 0, Math.PI * 2);
    ctx.stroke();

    drawSilkyCrescentArc(
      ctx,
      r * 0.64,
      -0.85,
      0.85,
      7 + smoothP * 4,
      '#fff1f2',
      '#f43f5e',
      0.62 + smoothP * 0.3
    );
    drawSilkyCrescentArc(
      ctx,
      r * 0.56,
      Math.PI - 0.75,
      Math.PI + 0.75,
      6 + smoothP * 3.5,
      '#ffe4e6',
      '#fb7185',
      0.5 + smoothP * 0.28
    );

    ctx.restore();
  }
}

function drawToxicCloud(ctx: CanvasRenderingContext2D, cloud: ToxicCloudZone, time: number) {
  const expand = Math.min(1, cloud.age / 0.22);
  const fade = Math.min(1, (cloud.maxAge - cloud.age) / 0.75);
  const alpha = Math.max(0, fade);
  const rad = cloud.radius * (0.65 + 0.35 * expand);

  const isHostile = cloud.fromPlayer === false;

  ctx.save();
  ctx.translate(cloud.x, cloud.y);

  // Necrotic miasma base pool (hostile enemy clouds tinted crimson-violet so players read danger)
  ctx.globalAlpha = alpha * 0.28;
  ctx.fillStyle = isHostile ? '#7f1d1d' : '#581c87';
  ctx.beginPath();
  ctx.arc(0, 0, rad * 0.98, 0, Math.PI * 2);
  ctx.fill();

  // 6 swirling volumetric toxic gas billows
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const swirlAng = time * (i % 2 === 0 ? 0.85 : -0.7) + (i * Math.PI) / 3;
    const orbit = rad * (0.28 + 0.14 * Math.sin(time * 2.4 + i));
    const puffR = rad * (0.44 + 0.07 * Math.cos(time * 3.1 + i * 1.7));
    ctx.globalAlpha = alpha * (i % 2 === 0 ? 0.18 : 0.14);
    ctx.fillStyle = isHostile
      ? i % 2 === 0
        ? '#f43f5e'
        : '#84cc16'
      : i % 3 === 0
        ? '#a855f7'
        : '#84cc16';
    ctx.beginPath();
    ctx.arc(Math.cos(swirlAng) * orbit, Math.sin(swirlAng) * orbit * 0.82, puffR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rotating bio-plague containment ring
  ctx.globalAlpha = alpha * 0.62;
  ctx.strokeStyle = isHostile ? '#fb7185' : '#a3e635';
  ctx.lineWidth = 2.2;
  ctx.save();
  ctx.rotate(time * 0.55);
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.arc(0, 0, rad * 0.94, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 8 rising & popping toxic plague boils + skulls/spores
  for (let i = 0; i < 8; i++) {
    const cycle = (time * 1.35 + i * 0.29) % 1;
    const ang = i * 2.399 + Math.sin(time * 0.8 + i) * 0.3;
    const dist = ((i * 37) % Math.max(12, rad * 0.76));
    const bx = Math.cos(ang) * dist;
    const by = Math.sin(ang) * dist * 0.82 - cycle * 14;
    const br = (3.5 + (i % 3) * 1.8) * Math.sin(cycle * Math.PI);

    ctx.globalAlpha = alpha * (1 - cycle * 0.65) * 0.85;
    ctx.fillStyle = i % 2 === 0 ? '#bef264' : '#d8b4fe';
    ctx.beginPath();
    ctx.arc(bx, by, Math.max(1.2, br), 0, Math.PI * 2);
    ctx.fill();

    if (cycle > 0.72) {
      ctx.strokeStyle = '#ecfccb';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(0.5, br * 1.9), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawGroundEffects(
  ctx: CanvasRenderingContext2D,
  effects: GroundEffect[],
  cullL: number,
  cullR: number,
  cullT: number,
  cullB: number,
  time: number
) {
  for (let i = 0; i < effects.length; i++) {
    const g = effects[i];
    if (!g.active) continue;
    const pad = Math.max(g.radius, 180);
    if (g.x + pad < cullL || g.x - pad > cullR || g.y + pad < cullT || g.y - pad > cullB) continue;

    const p = g.age / g.maxAge;
    const fade = Math.max(0, 1 - p * p);

    ctx.save();
    if (g.kind === 'flesh_tear_track') {
      // Flesh Ripper: 3 parallel jagged crimson/toxic claw gouges torn across the ground!
      const dx = g.x2 - g.x;
      const dy = g.y2 - g.y;
      const len = Math.hypot(dx, dy);
      if (len > 4) {
        const nx = -dy / len;
        const ny = dx / len;
        ctx.lineCap = 'round';
        for (let k = -1; k <= 1; k++) {
          const off = k * 9;
          const sx = g.x + nx * off;
          const sy = g.y + ny * off;
          const ex = g.x2 + nx * off;
          const ey = g.y2 + ny * off;

          // Dark torn earth trench
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = fade * 0.7;
          ctx.strokeStyle = '#1f1224';
          ctx.lineWidth = 5.5;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          // Glowing necrotic-crimson & lime tear core
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = fade * 0.85;
          ctx.strokeStyle = k === 0 ? g.color : g.secondaryColor;
          ctx.lineWidth = k === 0 ? 3.2 : 2.3;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
      }
    } else if (g.kind === 'grave_portal') {
      // Grave Call: Cracked burial pit where zombie shamblers claw out of the earth!
      const openScale = Math.min(1, p / 0.14);
      const r = g.radius * openScale;
      ctx.translate(g.x, g.y);

      ctx.globalAlpha = fade * 0.82;
      ctx.fillStyle = '#0f0718';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.78, r * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade * 0.7;
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.82, r * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Radial grave cracks
      ctx.strokeStyle = g.secondaryColor;
      ctx.lineWidth = 1.8;
      for (let c = 0; c < 6; c++) {
        const ca = (c * Math.PI) / 3 + 0.25;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ca) * r * 0.65, Math.sin(ca) * r * 0.38);
        ctx.lineTo(Math.cos(ca + 0.12) * r * 1.15, Math.sin(ca + 0.12) * r * 0.72);
        ctx.stroke();
      }
    } else if (g.kind === 'kingdom_sigil') {
      // Kingdom of the Dead: Giant rotating Necropolis hexagram ritual circle!
      const openScale = Math.min(1, p / 0.12);
      const r = g.radius * openScale;
      ctx.translate(g.x, g.y);

      // Dark undead mire pool
      ctx.globalAlpha = fade * 0.34;
      ctx.fillStyle = '#142615';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = 'lighter';
      ctx.save();
      ctx.rotate(time * 0.75);
      ctx.globalAlpha = fade * 0.78;
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 1.8;
      ctx.strokeStyle = g.secondaryColor;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.76, 0, Math.PI * 2);
      ctx.stroke();

      // Two interlocking ritual triangles (6-pointed Necropolis Star)
      for (let tri = 0; tri < 2; tri++) {
        ctx.strokeStyle = tri === 0 ? g.color : g.secondaryColor;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let v = 0; v < 3; v++) {
          const va = tri * (Math.PI / 3) + (v * Math.PI * 2) / 3;
          const vx = Math.cos(va) * r * 0.76;
          const vy = Math.sin(va) * r * 0.76;
          if (v === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // 6 glowing grave nodes on star vertices
      for (let v = 0; v < 6; v++) {
        const va = (v * Math.PI) / 3;
        ctx.fillStyle = v % 2 === 0 ? '#bef264' : '#e9d5ff';
        ctx.beginPath();
        ctx.arc(Math.cos(va) * r * 0.76, Math.sin(va) * r * 0.76, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (g.kind === 'plague_crater') {
      // Death's Embrace: Massive ground-slam plague fissure + inward life-drain pulse!
      const slamGrow = Math.min(1, p / 0.1);
      const r = g.radius * slamGrow;
      ctx.translate(g.x, g.y);

      ctx.globalAlpha = fade * 0.35;
      ctx.fillStyle = '#2e1065';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = 'lighter';
      // 10 jagged tectonic plague fissures radiating from slam center
      ctx.lineCap = 'round';
      for (let f = 0; f < 10; f++) {
        const baseA = (f * Math.PI * 2) / 10 + g.angle;
        ctx.strokeStyle = f % 2 === 0 ? g.color : g.secondaryColor;
        ctx.lineWidth = f % 2 === 0 ? 3.4 : 2.4;
        ctx.globalAlpha = fade * 0.88;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(baseA + 0.1) * r * 0.45, Math.sin(baseA + 0.1) * r * 0.45);
        ctx.lineTo(Math.cos(baseA - 0.08) * r * 0.78, Math.sin(baseA - 0.08) * r * 0.78);
        ctx.lineTo(Math.cos(baseA + 0.05) * r, Math.sin(baseA + 0.05) * r);
        ctx.stroke();
      }

      // Collapsing inward life-absorption ring pulling essence back into Zombie!
      const pullRatio = 1 - ((p * 2.2) % 1);
      ctx.globalAlpha = fade * 0.75;
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r * pullRatio, 0, Math.PI * 2);
      ctx.stroke();
    } else if (g.kind === 'enemy_slam_crack') {
      // Brute / Boss Warden Ground Smash Crater
      const r = g.radius * Math.min(1, p / 0.09);
      ctx.translate(g.x, g.y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade * 0.8;
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 2.6;
      for (let f = 0; f < 7; f++) {
        const fa = (f * Math.PI * 2) / 7 + g.angle;
        ctx.beginPath();
        ctx.moveTo(Math.cos(fa) * 8, Math.sin(fa) * 8);
        ctx.lineTo(Math.cos(fa + 0.14) * r * 0.55, Math.sin(fa + 0.14) * r * 0.55);
        ctx.lineTo(Math.cos(fa - 0.06) * r * 0.95, Math.sin(fa - 0.06) * r * 0.95);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
      ctx.stroke();
    } else if (g.kind === 'contagion_ring') {
      // Infectious Touch Contagion Spread / Plague Burst Spore Wave
      const r = g.radius * (0.25 + 0.75 * Math.sqrt(p));
      ctx.translate(g.x, g.y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade * 0.85;
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 3 * fade;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (g.kind === 'predator_crater') {
      // Ghoul Predator's Leap / Apex Cast: Smooth velvet-crimson shockwave basin (no jagged spider lines)
      const slamGrow = 1 - Math.pow(1 - Math.min(1, p / 0.14), 3);
      const r = g.radius * slamGrow;
      ctx.translate(g.x, g.y);

      ctx.globalAlpha = fade * 0.36;
      ctx.fillStyle = '#19060c';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade * 0.65;
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 3.2 * fade;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = fade * 0.55;
      ctx.strokeStyle = '#ffe4e6';
      ctx.lineWidth = 1.8 * fade;
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.38 + 0.54 * p), 0, Math.PI * 2);
      ctx.stroke();
    } else if (g.kind === 'shadow_smoke_ring') {
      // Ghoul Shadow Stalker / King of the Hunt: Soft billowing shadow-rose mist ring
      const r = g.radius * (0.38 + 0.62 * Math.sqrt(p));
      ctx.translate(g.x, g.y);
      ctx.globalAlpha = fade * 0.5;
      for (let s = 0; s < 5; s++) {
        const sa = (s * Math.PI * 2) / 5 + p * 1.1;
        const dist = r * 0.58;
        ctx.fillStyle = s % 2 === 0 ? '#0f172a' : '#4c0519';
        ctx.beginPath();
        ctx.arc(Math.cos(sa) * dist, Math.sin(sa) * dist * 0.72, r * 0.34 * fade, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = g.secondaryColor;
      ctx.lineWidth = 1.8 * fade;
      ctx.globalAlpha = fade * 0.55;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.92, r * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (g.kind === 'carnage_dash_line') {
      // Ghoul Carnage Unleashed: Soft tapered silk comet slipstream (zero harsh laser lines)
      const dx = g.x2 - g.x;
      const dy = g.y2 - g.y;
      const len = Math.hypot(dx, dy);
      if (len > 8) {
        const nx = -dy / len;
        const ny = dx / len;
        const halfW = 7.5 * fade;
        const tailX = g.x + dx * Math.min(0.45, p * 0.65);
        const tailY = g.y + dy * Math.min(0.45, p * 0.65);

        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = fade * 0.34;
        ctx.fillStyle = g.color;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.quadraticCurveTo(
          (tailX + g.x2) * 0.5 + nx * halfW * 1.3,
          (tailY + g.y2) * 0.5 + ny * halfW * 1.3,
          g.x2,
          g.y2
        );
        ctx.quadraticCurveTo(
          (tailX + g.x2) * 0.5 - nx * halfW * 1.3,
          (tailY + g.y2) * 0.5 - ny * halfW * 1.3,
          tailX,
          tailY
        );
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = fade * 0.52;
        ctx.fillStyle = g.secondaryColor;
        ctx.beginPath();
        ctx.moveTo(tailX + dx * 0.15, tailY + dy * 0.15);
        ctx.lineTo(g.x2 + nx * (halfW * 0.32), g.y2 + ny * (halfW * 0.32));
        ctx.lineTo(g.x2 - nx * (halfW * 0.32), g.y2 - ny * (halfW * 0.32));
        ctx.closePath();
        ctx.fill();
      }
    } else if (g.kind === 'spectral_mist_node') {
      // Ghost Phantom Dash: Swirling ectoplasm mist pool & rising spirit wisps along dash path!
      const r = g.radius * (0.62 + 0.38 * Math.min(1, p / 0.18));
      ctx.translate(g.x, g.y);

      ctx.globalAlpha = fade * 0.3;
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.96, r * 0.68, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = 'lighter';
      for (let m = 0; m < 4; m++) {
        const ang = time * (m % 2 === 0 ? 1.5 : -1.3) + (m * Math.PI) / 2;
        const ox = Math.cos(ang) * r * 0.35;
        const oy = Math.sin(ang) * r * 0.24;
        ctx.globalAlpha = fade * 0.26;
        ctx.fillStyle = m % 2 === 0 ? g.color : g.secondaryColor;
        ctx.beginPath();
        ctx.arc(ox, oy, r * 0.48, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3 rising starlight spirit motes
      for (let w = 0; w < 3; w++) {
        const cyc = (time * 1.8 + w * 0.33 + g.x * 0.01) % 1;
        const wx = Math.cos(w * 2.1 + time * 2.2) * (r * 0.55);
        const wy = -cyc * 22;
        ctx.globalAlpha = fade * Math.sin(cyc * Math.PI) * 0.85;
        ctx.fillStyle = w === 0 ? '#e0e7ff' : '#5eead4';
        ctx.beginPath();
        ctx.arc(wx, wy, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (g.kind === 'wailing_wave') {
      // Ghost Wailing Scream: Supernatural harmonic acoustic-ectoplasm distortion wave!
      const easeOut = 1 - Math.pow(1 - p, 2.4);
      const r = g.radius * (0.16 + 0.88 * easeOut);
      ctx.translate(g.x, g.y);
      ctx.globalCompositeOperation = 'lighter';

      for (let ring = 0; ring < 2; ring++) {
        const subR = r * (ring === 0 ? 1.0 : 0.76);
        const lobes = ring === 0 ? 8 : 6;
        const amp = (ring === 0 ? 7.5 : 5.0) * fade;
        ctx.strokeStyle = ring === 0 ? g.color : g.secondaryColor;
        ctx.lineWidth = (ring === 0 ? 3.2 : 2.1) * fade;
        ctx.globalAlpha = fade * (ring === 0 ? 0.9 : 0.68);
        ctx.beginPath();
        const steps = 40;
        for (let s = 0; s <= steps; s++) {
          const theta = (s / steps) * Math.PI * 2;
          const wr = subR + Math.sin(theta * lobes + time * 18 * (ring === 0 ? 1 : -1)) * amp;
          const px = Math.cos(theta) * wr;
          const py = Math.sin(theta) * wr * 0.82;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    } else if (g.kind === 'possession_burst') {
      // Ghost Haunted Possession: Ectoplasmic soul-rupture sigil when entering/erupting from host!
      const easeOut = 1 - Math.pow(1 - p, 2.6);
      const r = g.radius * (0.28 + 0.76 * easeOut);
      ctx.translate(g.x, g.y);
      ctx.globalCompositeOperation = 'lighter';

      ctx.globalAlpha = fade * 0.34;
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = fade * 0.88;
      ctx.strokeStyle = g.secondaryColor;
      ctx.lineWidth = 2.8 * fade;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();

      // 6 outward curving spirit wisps
      for (let k = 0; k < 6; k++) {
        const ka = (k * Math.PI) / 3 + p * 1.4;
        ctx.strokeStyle = k % 2 === 0 ? '#e0e7ff' : g.color;
        ctx.lineWidth = 2.2 * fade;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ka) * (r * 0.22), Math.sin(ka) * (r * 0.22));
        ctx.quadraticCurveTo(
          Math.cos(ka + 0.32) * (r * 0.65),
          Math.sin(ka + 0.32) * (r * 0.65),
          Math.cos(ka + 0.12) * (r * 1.08),
          Math.sin(ka + 0.12) * (r * 1.08)
        );
        ctx.stroke();
      }
    } else if (g.kind === 'astral_nova') {
      // Ghost Death's Passage / Spirit Legion / Astral Soul Orb Spiritual Explosion!
      const easeOut = 1 - Math.pow(1 - p, 3);
      const r = g.radius * (0.2 + 0.85 * easeOut);
      ctx.translate(g.x, g.y);
      ctx.globalCompositeOperation = 'lighter';

      ctx.globalAlpha = fade * 0.32;
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = fade * 0.92;
      ctx.strokeStyle = '#e0e7ff';
      ctx.lineWidth = 3.4 * fade;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();

      // 4-point starlight flare inside spiritual burst
      const starR = r * 0.78 * fade;
      ctx.fillStyle = g.secondaryColor;
      ctx.globalAlpha = fade * 0.75;
      ctx.beginPath();
      for (let s = 0; s < 8; s++) {
        const sa = (s * Math.PI) / 4 + p * 0.6;
        const rad = s % 2 === 0 ? starR : starR * 0.24;
        const sx = Math.cos(sa) * rad;
        const sy = Math.sin(sa) * rad;
        if (s === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
    } else if (g.kind === 'scrapper_skid_track') {
      // Human Scrapper's Dash: Twin boot-skid asphalt tracks + lateral V-shove pressure chevrons!
      const dx = g.x2 - g.x;
      const dy = g.y2 - g.y;
      const len = Math.hypot(dx, dy);
      if (len > 4) {
        const ang = Math.atan2(dy, dx);
        ctx.translate(g.x, g.y);
        ctx.rotate(ang);

        ctx.globalAlpha = fade * 0.55;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(len, -8);
        ctx.moveTo(0, 8);
        ctx.lineTo(len, 8);
        ctx.stroke();

        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = fade * 0.78;
        ctx.strokeStyle = g.color;
        ctx.lineWidth = 2.4;
        // Outward V-wake chevrons showing enemies being shoved aside!
        const steps = Math.max(3, Math.floor(len / 44));
        for (let s = 1; s <= steps; s++) {
          const sx = (s / (steps + 0.3)) * len;
          const spread = 14 + p * 18;
          ctx.beginPath();
          ctx.moveTo(sx + 10, -6);
          ctx.lineTo(sx - 10, -spread);
          ctx.moveTo(sx + 10, 6);
          ctx.lineTo(sx - 10, spread);
          ctx.stroke();
        }
      }
    } else if (g.kind === 'headcracker_dent') {
      // Human Headcracker: Cracked stone impact dent + golden-orange concussion shock-ring!
      const easeOut = 1 - Math.pow(1 - p, 3);
      ctx.translate(g.x, g.y);
      ctx.scale(1, 0.74);

      ctx.globalAlpha = fade * 0.52;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, g.radius * 0.52, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2.2 * fade;
      ctx.globalAlpha = fade * 0.8;
      for (let c = 0; c < 6; c++) {
        const ca = (c * Math.PI) / 3 + g.angle;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ca) * 5, Math.sin(ca) * 5);
        ctx.lineTo(Math.cos(ca + 0.14) * (g.radius * 0.48), Math.sin(ca + 0.14) * (g.radius * 0.48));
        ctx.lineTo(Math.cos(ca - 0.08) * (g.radius * 0.85), Math.sin(ca - 0.08) * (g.radius * 0.85));
        ctx.stroke();
      }

      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = g.secondaryColor;
      ctx.lineWidth = 3.6 * fade;
      ctx.globalAlpha = fade * 0.92;
      ctx.beginPath();
      ctx.arc(0, 0, g.radius * (0.25 + 0.85 * easeOut), 0, Math.PI * 2);
      ctx.stroke();
    } else if (g.kind === 'seismic_pipe_shockwave') {
      // Human Last Stand Finisher: Massive tectonic fault-lines + twin expanding seismic rings!
      const easeOut = 1 - Math.pow(1 - p, 3);
      const curR = g.radius * (0.14 + 0.92 * easeOut);
      ctx.translate(g.x, g.y);
      ctx.scale(1, 0.74);

      // Scorched crater core
      ctx.globalAlpha = fade * 0.45;
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(0, 0, g.radius * 0.36, 0, Math.PI * 2);
      ctx.fill();

      // 10 jagged seismic fault fissures radiating across the battlefield
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (let f = 0; f < 10; f++) {
        const fa = (f * Math.PI * 2) / 10 + 0.2;
        const reach = curR * (f % 2 === 0 ? 1.02 : 0.78);
        ctx.strokeStyle = f % 2 === 0 ? g.color : g.secondaryColor;
        ctx.lineWidth = (f % 2 === 0 ? 3.8 : 2.4) * fade;
        ctx.globalAlpha = fade * 0.88;
        ctx.beginPath();
        ctx.moveTo(Math.cos(fa) * 8, Math.sin(fa) * 8);
        ctx.lineTo(Math.cos(fa + 0.11) * (reach * 0.45), Math.sin(fa + 0.11) * (reach * 0.45));
        ctx.lineTo(Math.cos(fa - 0.09) * (reach * 0.76), Math.sin(fa - 0.09) * (reach * 0.76));
        ctx.lineTo(Math.cos(fa + 0.04) * reach, Math.sin(fa + 0.04) * reach);
        ctx.stroke();
      }

      // Outer supersonic shockwave front
      ctx.strokeStyle = g.secondaryColor;
      ctx.lineWidth = 5.5 * fade;
      ctx.globalAlpha = fade * 0.95;
      ctx.beginPath();
      ctx.arc(0, 0, curR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = g.color;
      ctx.lineWidth = 3.2 * fade;
      ctx.globalAlpha = fade * 0.78;
      ctx.beginPath();
      ctx.arc(0, 0, curR * 0.72, 0, Math.PI * 2);
      ctx.stroke();
    } else if (g.kind === 'brawler_stance_ring') {
      // Human Street Fighter / Survivor's Instinct: Crisp octagonal brawler footwork ring!
      const easeOut = 1 - Math.pow(1 - p, 2.5);
      const r = g.radius * (0.35 + 0.68 * easeOut);
      ctx.translate(g.x, g.y);
      ctx.scale(1, 0.72);
      ctx.globalCompositeOperation = 'lighter';

      ctx.strokeStyle = g.color;
      ctx.lineWidth = 3.0 * fade;
      ctx.globalAlpha = fade * 0.86;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const ka = (k * Math.PI) / 4 + p * 0.35;
        const kx = Math.cos(ka) * r;
        const ky = Math.sin(ka) * r;
        if (k === 0) ctx.moveTo(kx, ky);
        else ctx.lineTo(kx, ky);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = g.secondaryColor;
      ctx.lineWidth = 1.8 * fade;
      ctx.globalAlpha = fade * 0.7;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
      ctx.stroke();
    } else if (g.kind === 'oma_blitz_streak') {
      // Human One Man Army: High-velocity galvanized steel & orange blitz-zip line between enemies!
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.globalAlpha = fade * 0.75;
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 10 * fade;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x2, g.y2);
      ctx.stroke();

      ctx.globalAlpha = fade * 0.96;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.2 * fade;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x2, g.y2);
      ctx.stroke();

      // Percussive 4-point spark star at arrival point
      const sr = 15 * fade;
      ctx.fillStyle = g.secondaryColor;
      ctx.beginPath();
      for (let s = 0; s < 8; s++) {
        const sa = (s * Math.PI) / 4;
        const rad = s % 2 === 0 ? sr : sr * 0.25;
        const sx = g.x2 + Math.cos(sa) * rad;
        const sy = g.y2 + Math.sin(sa) * rad;
        if (s === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
    } else if (g.kind === 'tiger_crush_crater') {
      // Tigerkin Crushing Paw / Predator's Pounce: Heavy beastkin ground fracture crater!
      const easeOut = 1 - Math.pow(1 - p, 3);
      ctx.translate(g.x, g.y);
      ctx.scale(1, 0.72);

      // Deep dark earthen depression
      ctx.globalAlpha = fade * 0.55;
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(0, 0, g.radius * 0.48, 0, Math.PI * 2);
      ctx.fill();

      // Jagged golden fissure cracks
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 2.4 * fade;
      ctx.globalAlpha = fade * 0.88;
      for (let c = 0; c < 8; c++) {
        const ca = (c * Math.PI) / 4 + g.angle;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ca) * 6, Math.sin(ca) * 6);
        ctx.lineTo(Math.cos(ca + 0.1) * (g.radius * 0.55), Math.sin(ca + 0.1) * (g.radius * 0.55));
        ctx.lineTo(Math.cos(ca - 0.08) * (g.radius * 0.95), Math.sin(ca - 0.08) * (g.radius * 0.95));
        ctx.stroke();
      }

      // Outward concussive amber shockwave ring
      ctx.strokeStyle = g.secondaryColor;
      ctx.lineWidth = 3.4 * fade;
      ctx.globalAlpha = fade * 0.92;
      ctx.beginPath();
      ctx.arc(0, 0, g.radius * (0.2 + 0.88 * easeOut), 0, Math.PI * 2);
      ctx.stroke();
    } else if (g.kind === 'heavenly_tiger_run') {
      // Heavenly Tiger: Glowing celestial tiger footprint craters
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade * 0.85;

      // Celestial golden paw print
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14 * fade, 10 * fade, 0, 0, Math.PI * 2);
      ctx.fill();

      for (let t = -1.5; t <= 1.5; t += 1.0) {
        ctx.beginPath();
        ctx.arc(t * 7 * fade, -13 * fade, 3.2 * fade, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (g.kind === 'apex_shockwave_ring') {
      // Apex Devastation: Concentric golden tectonic shockwaves expanding across the crypt
      const easeOut = 1 - Math.pow(1 - p, 2.5);
      const r = g.radius * (0.15 + 0.88 * easeOut);
      ctx.translate(g.x, g.y);
      ctx.scale(1, 0.72);

      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 4.2 * fade;
      ctx.globalAlpha = fade * 0.94;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = g.secondaryColor;
      ctx.lineWidth = 2.2 * fade;
      ctx.globalAlpha = fade * 0.75;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
      ctx.stroke();
    } else if (g.kind === 'tiger_roar_burst') {
      // Tiger's Roar: Concentric dashed sonic shockwave ring
      const easeOut = 1 - Math.pow(1 - p, 3);
      const r = g.radius * (0.2 + 0.85 * easeOut);
      ctx.translate(g.x, g.y);

      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 3.5 * fade;
      ctx.globalAlpha = fade * 0.88;
      ctx.setLineDash([14, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = g.secondaryColor;
      ctx.lineWidth = 1.8 * fade;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
      ctx.stroke();
    } else if (g.kind === 'savage_pursuit_track') {
      // Savage Pursuit: 4 parallel razor gouges torn through the dungeon floor
      const dx = g.x2 - g.x;
      const dy = g.y2 - g.y;
      const len = Math.hypot(dx, dy);
      if (len > 4) {
        const nx = -dy / len;
        const ny = dx / len;
        ctx.lineCap = 'round';
        for (let k = -1.5; k <= 1.5; k += 1.0) {
          const off = k * 7;
          const sx = g.x + nx * off;
          const sy = g.y + ny * off;
          const ex = g.x2 + nx * off;
          const ey = g.y2 + ny * off;

          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = fade * 0.6;
          ctx.strokeStyle = '#1c1917';
          ctx.lineWidth = 4.2;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = fade * 0.88;
          ctx.strokeStyle = k === -0.5 || k === 0.5 ? g.color : g.secondaryColor;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}

function drawSpectralRifts(
  ctx: CanvasRenderingContext2D,
  rifts: SpectralRiftZone[],
  cullL: number,
  cullR: number,
  cullT: number,
  cullB: number,
  time: number
) {
  for (let i = 0; i < rifts.length; i++) {
    const rift = rifts[i];
    if (!rift.active) continue;
    const pad = rift.radius + 60;
    if (
      rift.x + pad < cullL ||
      rift.x - pad > cullR ||
      rift.y + pad < cullT ||
      rift.y - pad > cullB
    ) {
      continue;
    }

    ctx.save();
    ctx.translate(rift.x, rift.y);

    if (!rift.detonated) {
      // Phase 1: Swirling Abyssal Rift continuously pulling enemies into its singularity!
      const p = Math.min(1, rift.age / Math.max(0.01, rift.pullDuration));
      const openScale = Math.min(1, rift.age / 0.22);
      const r = rift.radius * openScale;
      const tension = 0.82 + p * 0.18;

      // Deep abyssal void basin
      ctx.globalAlpha = 0.58 * openScale;
      ctx.fillStyle = '#09071a';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.96, r * 0.74, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = 'lighter';

      // Outer rotating astral runic boundary
      ctx.save();
      ctx.scale(1, 0.76);
      ctx.rotate(-time * (1.4 + p * 2.2));
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 2.8;
      ctx.globalAlpha = 0.78;
      ctx.setLineDash([16, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 5 inward-spiraling spectral vortex arms pulling energy into the singularity
      for (let arm = 0; arm < 5; arm++) {
        const baseA = (arm * Math.PI * 2) / 5 + time * (2.6 + p * 2.4);
        ctx.strokeStyle = arm % 2 === 0 ? '#2dd4bf' : '#c084fc';
        ctx.lineWidth = 2.6;
        ctx.globalAlpha = 0.72;
        ctx.beginPath();
        for (let st = 0; st <= 10; st++) {
          const u = st / 10;
          const rad = r * (1 - u * 0.88);
          const spiralA = baseA + u * 2.1;
          const vx = Math.cos(spiralA) * rad;
          const vy = Math.sin(spiralA) * rad;
          if (st === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.stroke();
      }

      // Collapsing gravity ring showing imminent detonation timing
      const collapseR = r * (1 - ((rift.age * 2.4) % 1));
      ctx.strokeStyle = '#5eead4';
      ctx.lineWidth = 2.2;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.arc(0, 0, collapseR, 0, Math.PI * 2);
      ctx.stroke();

      // Glowing core singularity swelling as climax nears
      ctx.fillStyle = p > 0.75 ? '#f0abfc' : '#818cf8';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(0, 0, (14 + p * 22) * tension, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 6 + p * 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // Phase 2: Post-detonation fading astral rift scar & lingering starlight ring
      const postAge = rift.age - rift.pullDuration;
      const postDur = Math.max(0.05, rift.maxAge - rift.pullDuration);
      const fade = Math.max(0, 1 - postAge / postDur);
      const r = rift.radius * (0.95 + (1 - fade) * 0.25);

      ctx.globalCompositeOperation = 'lighter';
      ctx.save();
      ctx.scale(1, 0.78);
      ctx.globalAlpha = fade * 0.42;
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = fade * 0.92;
      ctx.strokeStyle = '#5eead4';
      ctx.lineWidth = 4.2 * fade;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.06, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }
}

function drawSoulDrainTethers(
  ctx: CanvasRenderingContext2D,
  tethers: SoulDrainTether[],
  enemies: EnemyEntity[],
  toX: number,
  toY: number,
  time: number
) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  for (let i = 0; i < tethers.length; i++) {
    const t = tethers[i];
    if (!t.active) continue;

    let fromX = t.fromX;
    let fromY = t.fromY;
    for (let eIdx = 0; eIdx < enemies.length; eIdx++) {
      const en = enemies[eIdx];
      if (en.id === t.enemyId && en.hp > 0) {
        fromX = en.x;
        fromY = en.y - 12;
        break;
      }
    }

    const fade = Math.min(1, Math.min(t.age / 0.14, (t.maxAge - t.age) / 0.22));
    if (fade <= 0.02) continue;

    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / len;
    const ny = dx / len;

    // Latch halo on drained enemy
    ctx.globalAlpha = fade * 0.75;
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(fromX, fromY, 13 + Math.sin(time * 14 + i) * 2.5, 0, Math.PI * 2);
    ctx.stroke();

    // Dual undulating ethereal spirit tendrils (indigo + mint-teal)
    for (let strand = 0; strand < 2; strand++) {
      const sign = strand === 0 ? 1 : -1;
      ctx.strokeStyle = strand === 0 ? '#2dd4bf' : '#a855f7';
      ctx.lineWidth = strand === 0 ? 3.2 : 2.4;
      ctx.globalAlpha = fade * (strand === 0 ? 0.9 : 0.7);
      ctx.beginPath();
      const segs = 10;
      for (let s = 0; s <= segs; s++) {
        const u = s / segs;
        const env = Math.sin(u * Math.PI);
        const wave = Math.sin(u * Math.PI * 3 - time * 15 + i) * 11 * env * sign;
        const px = fromX + dx * u + nx * wave;
        const py = fromY + dy * u + ny * wave;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // 3 luminous soul-force beads flowing from target directly into Ghost's body
    for (let b = 0; b < 3; b++) {
      const u = (time * 1.9 + b * 0.33 + i * 0.17) % 1;
      const env = Math.sin(u * Math.PI);
      const wave = Math.sin(u * Math.PI * 3 - time * 15 + i) * 11 * env;
      const bx = fromX + dx * u + nx * wave;
      const by = fromY + dy * u + ny * wave;
      ctx.globalAlpha = fade * 0.95;
      ctx.fillStyle = b === 0 ? '#ffffff' : '#99f6e4';
      ctx.beginPath();
      ctx.arc(bx, by, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawOrbitingSpirits(
  ctx: CanvasRenderingContext2D,
  spirits: OrbitingSpirit[],
  time: number
) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < spirits.length; i++) {
    const sp = spirits[i];
    if (!sp.active) continue;
    const fade = Math.min(1, (sp.maxAge - sp.age) / 0.25);
    if (fade <= 0.02) continue;

    // Flowing tapered ectoplasm ribbon tail
    if (sp.trail.length >= 2) {
      for (let t = 0; t < sp.trail.length - 1; t++) {
        const p0 = sp.trail[t];
        const p1 = sp.trail[t + 1];
        const ratio = (t + 1) / sp.trail.length;
        ctx.strokeStyle = i % 2 === 0 ? '#5eead4' : '#818cf8';
        ctx.lineWidth = 6.5 * ratio;
        ctx.lineCap = 'round';
        ctx.globalAlpha = fade * ratio * 0.52;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }

    // Cute wandering spirit head + tiny glowing eyes
    ctx.save();
    ctx.translate(sp.x, sp.y);
    const pulse = 1 + Math.sin(time * 14 + i) * 0.12;
    ctx.scale(pulse, pulse);

    ctx.globalAlpha = fade * 0.45;
    ctx.fillStyle = i % 2 === 0 ? '#2dd4bf' : '#a855f7';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = fade * 0.95;
    ctx.fillStyle = '#e0e7ff';
    ctx.beginPath();
    ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.arc(-2, -0.5, 1.2, 0, Math.PI * 2);
    ctx.arc(2, -0.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawEternalNightmareRealm(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  viewW: number,
  viewH: number,
  player: PlayerRenderState,
  time: number
) {
  const fade = Math.min(1, player.nightmareTimer / 0.6);
  const left = camX - viewW / 2 - 40;
  const top = camY - viewH / 2 - 40;
  const w = viewW + 80;
  const h = viewH + 80;

  ctx.save();
  // Atmospheric twilight-indigo realm veil across the battlefield
  ctx.fillStyle = `rgba(12, 10, 34, ${0.38 * fade})`;
  ctx.fillRect(left, top, w, h);

  // Astral sanctuary ring surrounding the Ghost
  ctx.globalCompositeOperation = 'lighter';
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.strokeStyle = `rgba(129, 140, 248, ${0.42 * fade})`;
  ctx.lineWidth = 2.4;
  ctx.setLineDash([18, 12]);
  ctx.beginPath();
  ctx.ellipse(0, 0, 235, 175, time * 0.25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Eerie glowing apparition eyes peering from the darkness realm periphery!
  for (let i = 0; i < 6; i++) {
    const blink = Math.sin(time * 2.6 + i * 1.7);
    if (blink < -0.2) continue;
    const ang = (i * Math.PI) / 3 + time * 0.22;
    const ex = player.x + Math.cos(ang) * 255;
    const ey = player.y + Math.sin(ang) * 165;
    ctx.globalAlpha = fade * Math.min(1, (blink + 0.2) * 0.85) * 0.65;
    ctx.fillStyle = i % 2 === 0 ? '#c084fc' : '#2dd4bf';
    ctx.beginPath();
    ctx.ellipse(ex - 5, ey, 3.2, 1.8, -0.2, 0, Math.PI * 2);
    ctx.ellipse(ex + 5, ey, 3.2, 1.8, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawLifeSiphonBeams(
  ctx: CanvasRenderingContext2D,
  beams: LifeSiphonBeam[],
  toX: number,
  toY: number,
  time: number
) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  for (let i = 0; i < beams.length; i++) {
    const b = beams[i];
    if (!b.active) continue;
    const p = b.age / b.maxAge;
    const alpha = Math.sin(p * Math.PI);
    if (alpha <= 0.02) continue;

    const mx = (b.fromX + toX) * 0.5;
    const my = (b.fromY + toY) * 0.5;
    const dx = toX - b.fromX;
    const dy = toY - b.fromY;
    const len = Math.max(1, Math.hypot(dx, dy));
    const sway = Math.sin(time * 16 + i * 2.1) * Math.min(34, len * 0.24);
    const cx = mx + (-dy / len) * sway;
    const cy = my + (dx / len) * sway - 18;

    // Outer necrotic-violet siphon aura
    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 7 * alpha;
    ctx.beginPath();
    ctx.moveTo(b.fromX, b.fromY);
    ctx.quadraticCurveTo(cx, cy, toX, toY);
    ctx.stroke();

    // Inner bright emerald vitality stream
    ctx.globalAlpha = alpha * 0.95;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 3 * alpha;
    ctx.beginPath();
    ctx.moveTo(b.fromX, b.fromY);
    ctx.quadraticCurveTo(cx, cy, toX, toY);
    ctx.stroke();

    // Traveling vitality essence bead along quadratic Bezier curve
    const t = Math.min(1, p * 1.15);
    const inv = 1 - t;
    const bx = inv * inv * b.fromX + 2 * inv * t * cx + t * t * toX;
    const by = inv * inv * b.fromY + 2 * inv * t * cy + t * t * toY;
    ctx.fillStyle = '#dcfce7';
    ctx.beginPath();
    ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draws a cohesive, silky-smooth tapered moon-crescent arc using pure Canvas 2D geometry
 * (zero per-frame gradient allocations, needle-tapered tips, soft outer bloom + luminous edge).
 */
function drawSilkyCrescentArc(
  ctx: CanvasRenderingContext2D,
  radius: number,
  startAng: number,
  endAng: number,
  bellyThickness: number,
  coreColor: string,
  glowColor: string,
  alpha: number
) {
  if (alpha <= 0.01 || radius <= 4 || endAng - startAng <= 0.05) return;
  const mid = (startAng + endAng) * 0.5;
  const cosM = Math.cos(mid);
  const sinM = Math.sin(mid);

  // 1. Soft outer velvet bloom crescent
  const outerShift = bellyThickness * 1.28;
  const innerR1 = Math.max(4, radius - outerShift * 0.32);
  ctx.fillStyle = glowColor;
  ctx.globalAlpha = alpha * 0.36;
  ctx.beginPath();
  ctx.arc(0, 0, radius + 2, startAng, endAng, false);
  ctx.arc(-cosM * outerShift, -sinM * outerShift, innerR1, endAng, startAng, true);
  ctx.closePath();
  ctx.fill();

  // 2. Main cohesive crescent body
  const midShift = bellyThickness * 0.86;
  const innerR2 = Math.max(4, radius - midShift * 0.28);
  ctx.fillStyle = glowColor;
  ctx.globalAlpha = alpha * 0.72;
  ctx.beginPath();
  ctx.arc(0, 0, radius, startAng + 0.03, endAng - 0.03, false);
  ctx.arc(-cosM * midShift, -sinM * midShift, innerR2, endAng - 0.03, startAng + 0.03, true);
  ctx.closePath();
  ctx.fill();

  // 3. Silky ivory-white leading razor rim
  const rimSpan = (endAng - startAng) * 0.42;
  const rimShift = Math.max(2.5, bellyThickness * 0.38);
  ctx.fillStyle = coreColor;
  ctx.globalAlpha = alpha * 0.92;
  ctx.beginPath();
  ctx.arc(0, 0, radius + 0.5, mid - rimSpan, mid + rimSpan, false);
  ctx.arc(-cosM * rimShift, -sinM * rimShift, Math.max(4, radius - rimShift * 0.22), mid + rimSpan, mid - rimSpan, true);
  ctx.closePath();
  ctx.fill();
}

function drawSlashWaves(ctx: CanvasRenderingContext2D, waves: SlashWaveEffect[]) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  for (let i = 0; i < waves.length; i++) {
    const w = waves[i];
    if (!w.active) continue;
    const p = Math.min(1, w.age / w.maxAge);
    const ease = Math.sin(p * Math.PI * 0.5);
    const fade = Math.max(0, Math.cos(p * Math.PI * 0.5));

    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(w.angle);

    if (w.kind === 'triple_claw' || w.kind === 'minion_claw') {
      // Zombie venomous claw slashes
      const count = w.kind === 'minion_claw' ? 2 : 3;
      const spacing = w.kind === 'minion_claw' ? 5.5 : 8.5;
      const rBase = w.radius * (0.78 + 0.22 * ease);
      const fullSpan = w.arcSpan;
      const head = (-0.46 + 0.92 * ease) * fullSpan * w.direction;
      const tail = head - fullSpan * 0.72 * w.direction;
      const a0 = Math.min(head, tail);
      const a1 = Math.max(head, tail);

      for (let c = 0; c < count; c++) {
        const offset = (c - (count - 1) * 0.5) * spacing;
        const r = Math.max(8, rBase + offset * 0.45);
        ctx.save();
        ctx.translate(0, offset * 0.65);

        ctx.globalAlpha = fade * 0.62;
        ctx.strokeStyle = w.secondaryColor;
        ctx.lineWidth = (w.kind === 'minion_claw' ? 4.0 : 5.8) * fade;
        ctx.beginPath();
        ctx.arc(0, 0, r, a0, a1);
        ctx.stroke();

        ctx.globalAlpha = fade * 0.94;
        ctx.strokeStyle = w.primaryColor;
        ctx.lineWidth = (w.kind === 'minion_claw' ? 1.8 : 2.5) * fade;
        ctx.beginPath();
        ctx.arc(0, 0, r, a0 + 0.05, a1 - 0.05);
        ctx.stroke();
        ctx.restore();
      }
    } else if (w.kind === 'cross_claw') {
      // Zombie Rotting Claw finisher & Flesh Ripper cross-rend
      const reach = w.radius * (0.74 + 0.28 * ease);
      for (let arm = -1; arm <= 1; arm += 2) {
        ctx.save();
        ctx.rotate(arm * 0.38);
        drawSilkyCrescentArc(
          ctx,
          reach * 0.92,
          -0.68,
          0.68,
          15 * fade,
          '#ecfccb',
          w.secondaryColor,
          fade * 0.9
        );
        ctx.restore();
      }
    } else if (w.kind === 'feral_slash') {
      // Ghoul Basic 1/2, Rending Claws & Blood Frenzy:
      // Single cohesive, silky-smooth sweeping crimson moon-crescent (zero multi-line clutter!)
      const r = w.radius * (0.76 + 0.24 * ease);
      const centerShift = (-0.28 + 0.56 * ease) * w.arcSpan * w.direction;
      const halfSpan = w.arcSpan * (0.46 - 0.08 * p);
      drawSilkyCrescentArc(
        ctx,
        r,
        centerShift - halfSpan,
        centerShift + halfSpan,
        16 * (0.55 + 0.45 * fade),
        w.primaryColor,
        w.secondaryColor,
        fade * 0.92
      );
    } else if (w.kind === 'twin_rend') {
      // Ghoul Basic 3, Feral Pounce & Carnage Unleashed:
      // Two graceful converging crescent blades sweeping inward smoothly!
      const r = w.radius * (0.74 + 0.26 * ease);
      for (let side = -1; side <= 1; side += 2) {
        ctx.save();
        ctx.rotate(side * (0.36 - 0.22 * ease));
        drawSilkyCrescentArc(
          ctx,
          r,
          -0.64,
          0.64,
          14 * (0.55 + 0.45 * fade),
          w.primaryColor,
          w.secondaryColor,
          fade * 0.85
        );
        ctx.restore();
      }
    } else if (w.kind === 'rending_finale' || w.kind === 'shadow_ambush') {
      // Ghoul Rending Claws Finale / Shadow Stalker Ambush / King of the Hunt Execution:
      // Majestic wide crimson-rose crescent wave with a soft central dusk flare!
      const r = w.radius * (0.74 + 0.28 * ease);
      const halfSpan = w.kind === 'shadow_ambush' ? 0.92 : 0.85;
      drawSilkyCrescentArc(
        ctx,
        r,
        -halfSpan,
        halfSpan,
        24 * (0.5 + 0.5 * fade),
        w.primaryColor,
        w.secondaryColor,
        fade * 0.95
      );
      // Subtle inner echo crescent for lush depth
      drawSilkyCrescentArc(
        ctx,
        r * 0.72,
        -halfSpan * 0.72,
        halfSpan * 0.72,
        12 * fade,
        '#ffe4e6',
        '#fb7185',
        fade * 0.65
      );
    } else if (w.kind === 'feral_whirl') {
      // Ghoul Basic 4, Predator's Leap Follow-Up & Apex Predator Cast:
      // Smooth 360° silk-ribbon vortex of two chasing tapered crescents!
      const r = w.radius * (0.78 + 0.22 * ease);
      const spin = ease * Math.PI * 1.45 * w.direction;
      for (let petal = 0; petal < 2; petal++) {
        ctx.save();
        ctx.rotate(spin + petal * Math.PI);
        drawSilkyCrescentArc(
          ctx,
          r * (petal === 0 ? 1.0 : 0.86),
          -0.88,
          0.88,
          17 * (0.5 + 0.5 * fade),
          w.primaryColor,
          petal === 0 ? w.secondaryColor : '#fb7185',
          fade * 0.86
        );
        ctx.restore();
      }
    } else if (w.kind === 'tiger_savage_slash') {
      // Tigerkin Basic 1 (Savage Claw): 4 razor-curved golden-amber beastkin talon arcs
      const reach = w.radius * (0.8 + 0.2 * ease);
      const shift = (-0.2 + 0.4 * ease) * w.arcSpan * w.direction;
      const half = w.arcSpan * 0.45;
      const count = 4;
      const spacing = 7;
      for (let c = 0; c < count; c++) {
        const off = (c - (count - 1) * 0.5) * spacing;
        const r = Math.max(10, reach + off * 0.5);
        ctx.save();
        ctx.translate(0, off * 0.4);
        drawSilkyCrescentArc(
          ctx,
          r,
          shift - half,
          shift + half,
          (c === 1 || c === 2 ? 14 : 10) * fade,
          c === 1 || c === 2 ? '#ffffff' : w.primaryColor,
          w.secondaryColor,
          fade * 0.95
        );
        ctx.restore();
      }
    } else if (w.kind === 'tiger_cross_rend') {
      // Tigerkin Basic 2 (Tiger's Rend): Devastating double cross-slash with golden core
      const reach = w.radius * (0.76 + 0.24 * ease);
      for (let arm = -1; arm <= 1; arm += 2) {
        ctx.save();
        ctx.rotate(arm * (0.42 - 0.15 * ease));
        drawSilkyCrescentArc(
          ctx,
          reach,
          -0.78,
          0.78,
          18 * (0.55 + 0.45 * fade),
          '#ffffff',
          w.primaryColor,
          fade * 0.95
        );
        drawSilkyCrescentArc(
          ctx,
          reach * 0.85,
          -0.55,
          0.55,
          10 * fade,
          w.secondaryColor,
          '#ea580c',
          fade * 0.8
        );
        ctx.restore();
      }
    } else if (w.kind === 'tiger_rend_crescent') {
      // Tiger's Rend forward crescent wave visual
      const reach = w.radius * (0.78 + 0.22 * ease);
      drawSilkyCrescentArc(
        ctx,
        reach,
        -0.85,
        0.85,
        22 * fade,
        '#ffffff',
        w.primaryColor,
        fade * 0.96
      );
    } else if (w.kind === 'rending_flurry_slash') {
      // Rending Flurry multi-hit rapid shredding claws
      const reach = w.radius * (0.8 + 0.2 * ease);
      const angleOffset = w.direction * 0.25;
      drawSilkyCrescentArc(
        ctx,
        reach,
        -0.65 + angleOffset,
        0.65 + angleOffset,
        16 * fade,
        '#fffbeb',
        w.primaryColor,
        fade * 0.94
      );
    } else if (w.kind === 'crushing_paw_shock') {
      // Crushing Paw ground shockwave
      const reach = w.radius * (0.6 + 0.4 * ease);
      drawSilkyCrescentArc(
        ctx,
        reach,
        -1.3,
        1.3,
        26 * fade,
        '#ffffff',
        w.primaryColor,
        fade * 0.9
      );
    } else if (w.kind === 'apex_claw_fissure') {
      // Apex Devastation colossal shockwave burst
      const reach = w.radius * (0.5 + 0.5 * ease);
      for (let ring = 0; ring < 3; ring++) {
        const rr = reach * (1 - ring * 0.18);
        ctx.strokeStyle = ring === 0 ? '#ffffff' : ring === 1 ? '#fbbf24' : '#ea580c';
        ctx.lineWidth = (4.5 - ring * 1.2) * fade;
        ctx.globalAlpha = fade * 0.9;
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // Smooth tapered crescent weapon wave for Skeleton, Bone Colossus, Crypt Rattler & Boss
      const r = w.radius * (0.78 + 0.24 * ease);
      const shift = (-0.22 + 0.44 * ease) * w.arcSpan * w.direction;
      const half = w.arcSpan * 0.48;
      const belly = w.kind === 'boss_cleave' ? 22 : w.kind === 'enemy_slash' ? 12 : 16;
      drawSilkyCrescentArc(
        ctx,
        r,
        shift - half,
        shift + half,
        belly * (0.55 + 0.45 * fade),
        w.primaryColor,
        w.secondaryColor,
        fade * 0.92
      );
    }

    ctx.restore();
  }

  ctx.restore();
}

function drawWorldFloorsAndWalls(
  ctx: CanvasRenderingContext2D,
  map: WorldMap,
  cullL: number,
  cullR: number,
  cullT: number,
  cullB: number,
  time: number
) {
  ctx.fillStyle = map.isGuild ? '#3b281e' : '#1e2533';
  for (const r of map.walkableRects) {
    if (r.x + r.w + 28 < cullL || r.x - 28 > cullR || r.y + r.h + 28 < cullT || r.y - 28 > cullB) continue;
    ctx.fillRect(r.x - 18, r.y - 22, r.w + 36, r.h + 40);
  }

  ctx.fillStyle = map.isGuild ? '#523829' : '#2d3748';
  for (const r of map.walkableRects) {
    if (r.x + r.w + 24 < cullL || r.x - 24 > cullR || r.y + r.h + 24 < cullT || r.y - 24 > cullB) continue;
    ctx.fillRect(r.x - 14, r.y - 18, r.w + 28, r.h + 32);
  }

  ctx.fillStyle = map.isGuild ? '#6c4932' : '#18202c';
  for (const r of map.walkableRects) {
    if (r.x + r.w < cullL || r.x > cullR || r.y + r.h < cullT || r.y > cullB) continue;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  for (const r of map.walkableRects) {
    if (r.x + r.w < cullL || r.x > cullR || r.y + r.h < cullT || r.y > cullB) continue;
    if (map.isGuild) {
      const plankH = 28;
      ctx.strokeStyle = 'rgba(34, 20, 12, 0.35)';
      ctx.lineWidth = 1.5;
      const startY = Math.max(r.y, Math.floor(cullT / plankH) * plankH);
      const endY = Math.min(r.y + r.h, cullB);
      ctx.beginPath();
      for (let py = startY; py <= endY; py += plankH) {
        if (py < r.y) continue;
        ctx.moveTo(r.x, py);
        ctx.lineTo(r.x + r.w, py);
      }
      ctx.stroke();
    } else {
      const tile = 48;
      const sx = Math.max(r.x, Math.floor(cullL / tile) * tile);
      const ex = Math.min(r.x + r.w, cullR);
      const sy = Math.max(r.y, Math.floor(cullT / tile) * tile);
      const ey = Math.min(r.y + r.h, cullB);

      ctx.strokeStyle = 'rgba(11, 15, 23, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = sx; x <= ex; x += tile) {
        if (x < r.x) continue;
        ctx.moveTo(x, r.y);
        ctx.lineTo(x, r.y + r.h);
      }
      for (let y = sy; y <= ey; y += tile) {
        if (y < r.y) continue;
        ctx.moveTo(r.x, y);
        ctx.lineTo(r.x + r.w, y);
      }
      ctx.stroke();

      ctx.fillStyle = 'rgba(52, 118, 90, 0.22)';
      ctx.beginPath();
      for (let x = sx; x < ex; x += tile * 2) {
        for (let y = sy; y < ey; y += tile * 2) {
          if (x < r.x || y < r.y || x + tile > r.x + r.w || y + tile > r.y + r.h) continue;
          const hash = ((x * 73856093) ^ (y * 19349663)) & 15;
          if (hash === 3) {
            ctx.arc(x + 14, y + 16, 4.5, 0, Math.PI * 2);
            ctx.arc(x + 20, y + 18, 3, 0, Math.PI * 2);
          }
        }
      }
      ctx.fill();
    }
  }

  for (const rm of map.rooms) {
    if (rm.kind === 'boss') {
      const cx = rm.x + rm.w * 0.5;
      const cy = rm.y + rm.h * 0.5;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time * 0.12);
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.14)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 165, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 120, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawProp(ctx: CanvasRenderingContext2D, prop: WorldProp, time: number) {
  const { x, y, w, h, kind } = prop;
  if (kind === 'rug') {
    ctx.save();
    ctx.fillStyle = '#7c2d25';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = '#e09f5a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x + 10, y + 10, w - 20, h - 20, 8);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(253, 230, 138, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x + 22, y + 22, w - 44, h - 44, 5);
    ctx.stroke();
    ctx.restore();
  } else if (kind === 'hearth') {
    ctx.fillStyle = '#474340';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.fillStyle = '#292320';
    ctx.beginPath();
    ctx.roundRect(x + 24, y + 16, w - 48, h - 18, 10);
    ctx.fill();
    const flicker = Math.sin(time * 11) * 3 + Math.cos(time * 17) * 2;
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h - 12, 22 + flicker * 0.4, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h - 10, 12 - flicker * 0.25, Math.PI, 0);
    ctx.fill();
  } else if (kind === 'bookshelf') {
    ctx.fillStyle = '#432818';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    const colors = ['#b91c1c', '#0f766e', '#d97706', '#4338ca', '#15803d'];
    for (let bx = x + 10; bx < x + w - 16; bx += 12) {
      ctx.fillStyle = colors[(bx * 7) % colors.length];
      ctx.fillRect(bx, y + 10, 9, h - 20);
    }
  } else if (kind === 'counter') {
    ctx.fillStyle = '#4e3220';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.fillStyle = '#6f482f';
    ctx.beginPath();
    ctx.roundRect(x + 5, y + 5, w - 10, h - 14, 5);
    ctx.fill();
  } else if (kind === 'skill_shrine') {
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2 + 8, 24, 0, Math.PI * 2);
    ctx.fill();
    const hover = Math.sin(time * 3.2) * 4;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2 - 4 + hover);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.beginPath();
    ctx.roundRect(-20, -17, 40, 34, 9);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(-14, -11, 28, 22, 4);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-10, -8, 9, 16);
    ctx.fillRect(1, -8, 9, 16);
    ctx.restore();
    drawWorldLabel(ctx, x + w / 2, y - 14, 'Skill Tome', '#bae6fd');
  } else if (kind === 'door_dungeon') {
    ctx.save();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(x - 8, y, w + 16, h + 12, 12);
    ctx.fill();
    const grad = ctx.createLinearGradient(x, y, x, y + h + 18);
    grad.addColorStop(0, '#0ea5e9');
    grad.addColorStop(1, 'rgba(14, 165, 233, 0.05)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x + 6, y + 6, w - 12, h + 6, 8);
    ctx.fill();
    ctx.restore();
    drawWorldLabel(ctx, x + w / 2, y - 8, 'Dungeon Door', '#7dd3fc');
  } else if (kind === 'pillar') {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 2, w * 0.55, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(x, y - 12, w, h + 12, 8);
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.roundRect(x + 4, y - 12, w - 8, 18, 6);
    ctx.fill();
  } else if (kind === 'torch') {
    ctx.fillStyle = '#57534e';
    ctx.beginPath();
    ctx.arc(x + 10, y + 10, 6, 0, Math.PI * 2);
    ctx.fill();
    const fl = Math.sin(time * 13 + x) * 1.6;
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(x + 10, y + 8, 5 + fl * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(x + 10, y + 8, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'chest') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h, w * 0.55, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = prop.opened ? '#44403c' : '#854d0e';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = prop.opened ? '#78716c' : '#facc15';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
    if (!prop.opened) {
      drawWorldLabel(ctx, x + w / 2, y - 12, 'Reliquary Chest', '#fde047');
    }
  } else if (kind === 'portal_next' || kind === 'portal_guild') {
    drawPortalProp(ctx, prop, time);
  } else if (kind === 'blessing_statue') {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const isBlessed = Boolean(prop.opened);

    // Stone altar shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(cx, y + h - 4, w * 0.58, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // 1. Tiered stone foundation plinth
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + h - 22, w - 4, 18, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(x + 8, y + h - 34, w - 16, 16, 4);
    ctx.fill();
    ctx.stroke();

    // 2. Ornate engraved pedestal shaft
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.roundRect(x + 14, y + 16, w - 28, h - 46, 6);
    ctx.fill();
    ctx.stroke();

    // Carved glowing runic runes on shaft
    ctx.save();
    if (!isBlessed) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx, y + 24);
      ctx.lineTo(cx, y + h - 42);
      ctx.moveTo(cx - 6, y + 30);
      ctx.lineTo(cx + 6, y + 34);
      ctx.moveTo(cx - 5, y + 42);
      ctx.lineTo(cx + 5, y + 40);
      ctx.stroke();
    }
    ctx.restore();

    // 3. Floating Ethereal Divine Relic / Statue Idol
    const hover = Math.sin(time * 3.4) * 4.5;
    const idolY = y + 10 + hover;

    // Radiant celestial glow behind idol
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glowAlpha = isBlessed ? 0.28 : 0.45 + Math.sin(time * 5) * 0.15;
    ctx.fillStyle = isBlessed ? 'rgba(251, 191, 36, 0.3)' : 'rgba(56, 189, 248, 0.45)';
    ctx.beginPath();
    ctx.arc(cx, idolY, 26, 0, Math.PI * 2);
    ctx.fill();

    // Counter-rotating blessing rune halo
    if (!isBlessed) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.ellipse(cx, idolY, 20, 8, time * 2.2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(cx, idolY, 20, 8, -time * 2.2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Winged Ancient Relic Idol Vessel
    ctx.save();
    ctx.translate(cx, idolY);

    // Left & Right Celestial Angelic Wings
    ctx.fillStyle = isBlessed ? '#d97706' : '#0284c7';
    ctx.strokeStyle = isBlessed ? '#fde68a' : '#e0f2fe';
    ctx.lineWidth = 1.6;

    // Left wing
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.quadraticCurveTo(-18, -16, -24, -4);
    ctx.quadraticCurveTo(-15, 6, -5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right wing
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.quadraticCurveTo(18, -16, 24, -4);
    ctx.quadraticCurveTo(15, 6, 5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Center radiant relic core
    ctx.fillStyle = isBlessed ? '#f59e0b' : '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(8, 0);
    ctx.lineTo(0, 12);
    ctx.lineTo(-8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Inner sacred star
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    drawWorldLabel(
      ctx,
      cx,
      y - 14,
      isBlessed ? 'Ancient Statue (Blessed)' : 'Ancient Statue of Blessing',
      isBlessed ? '#a8a29e' : '#fde047'
    );
  }
}

function drawPortalRunestone(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  scale: number,
  runeColor: string,
  pulse: number
) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(scale, scale);

  // Carved obsidian/slate floating monolith
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(6.2, -3.5);
  ctx.lineTo(4.8, 8.5);
  ctx.lineTo(-4.8, 8.5);
  ctx.lineTo(-6.2, -3.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Top highlight facet
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(6.2, -3.5);
  ctx.lineTo(0, -1);
  ctx.lineTo(-6.2, -3.5);
  ctx.closePath();
  ctx.fill();

  // Glowing etched arcane rune
  ctx.strokeStyle = runeColor;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.72 + pulse * 0.28;
  ctx.beginPath();
  ctx.moveTo(0, -5.5);
  ctx.lineTo(0, 5.2);
  ctx.moveTo(-2.8, -1.6);
  ctx.lineTo(2.8, 1.4);
  ctx.moveTo(2.6, -2.2);
  ctx.lineTo(-2.4, 2.2);
  ctx.stroke();

  ctx.restore();
}

function drawPortalProp(ctx: CanvasRenderingContext2D, prop: WorldProp, time: number) {
  const cx = prop.x + prop.w * 0.5;
  const cy = prop.y + prop.h * 0.5;
  const isNext = prop.kind === 'portal_next';
  const charge = Math.max(0, Math.min(1, prop.chargeProgress || 0));

  // Birth awakening choreography (0 -> 0.95s after boss defeat)
  const hasSpawn = typeof prop.spawnTime === 'number' && prop.spawnTime > 0;
  const age = hasSpawn ? Math.max(0, time - (prop.spawnTime as number)) : 10;
  const sealRaw = Math.min(1, age / 0.52);
  const sealEase = 1 - Math.pow(1 - sealRaw, 3);
  const riftRaw = age < 0.12 ? 0 : Math.min(1, (age - 0.12) / 0.65);
  const riftBack =
    riftRaw >= 1
      ? 1
      : 1 + 1.45 * Math.pow(riftRaw - 1, 3) + 0.45 * Math.pow(riftRaw - 1, 2);
  const stoneRise = age < 0.22 ? 0 : 1 - Math.pow(1 - Math.min(1, (age - 0.22) / 0.65), 3);

  // Cohesive theme palettes: Abyssal Eldritch Rift (Next Dungeon) vs Sanctuary Hearth-Gate (Lobby)
  const primary = isNext ? '#38bdf8' : '#f59e0b';
  const secondary = isNext ? '#a855f7' : '#fb7185';
  const rimGlow = isNext ? '#e0f2fe' : '#fef08a';
  const coreDark = isNext ? '#070b1e' : '#1c0c04';
  const coreMid = isNext ? '#1e1b4b' : '#78350f';
  const labelColor = isNext ? '#7dd3fc' : '#fde68a';

  const spinDir = isNext ? 1 : -1;
  const speedBoost = 1 + charge * 0.9;
  const phase = time * speedBoost;
  const pulse = 0.5 + 0.5 * Math.sin(time * 4.2 + (isNext ? 0 : 1.7));

  const baseY = cy + 16;
  const sealRx = Math.max(4, (44 + charge * 5) * sealEase);

  // 1. Perspective Arcane Floor Seal & Ground Illumination
  ctx.save();
  ctx.translate(cx, baseY);
  ctx.scale(1, 0.56);

  // Soft ambient floor shadow under the dimensional anchor
  ctx.fillStyle = 'rgba(0, 0, 0, 0.46)';
  ctx.beginPath();
  ctx.arc(0, 4, Math.max(2, sealRx * 1.08), 0, Math.PI * 2);
  ctx.fill();

  // Additive ground light pool
  ctx.globalCompositeOperation = 'lighter';
  const floorGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, Math.max(4, sealRx * 1.38));
  floorGrad.addColorStop(0, isNext ? 'rgba(56, 189, 248, 0.44)' : 'rgba(245, 158, 11, 0.44)');
  floorGrad.addColorStop(0.55, isNext ? 'rgba(168, 85, 247, 0.22)' : 'rgba(251, 113, 133, 0.2)');
  floorGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = floorGrad;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(4, sealRx * 1.38), 0, Math.PI * 2);
  ctx.fill();

  // Periodic outward floor shockwave ripple
  const rippleCycle = (time * 0.68 + (isNext ? 0 : 0.5)) % 1;
  const rippleRad = Math.max(2, sealRx * (0.45 + rippleCycle * 0.88));
  ctx.strokeStyle = primary;
  ctx.globalAlpha = (1 - rippleCycle) * 0.52 * sealEase;
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.arc(0, 0, rippleRad, 0, Math.PI * 2);
  ctx.stroke();

  // Awakening shockwave burst during birth
  if (age < 0.85) {
    const birthP = age / 0.85;
    const birthR = Math.max(2, 16 + birthP * 86);
    ctx.strokeStyle = rimGlow;
    ctx.globalAlpha = (1 - birthP) * 0.85;
    ctx.lineWidth = 3.2 * (1 - birthP * 0.6);
    ctx.beginPath();
    ctx.arc(0, 0, birthR, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Outer rotating runic circle
  ctx.save();
  ctx.rotate(phase * 0.72 * spinDir);
  ctx.globalAlpha = (0.68 + pulse * 0.22) * sealEase;
  ctx.strokeStyle = primary;
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.arc(0, 0, sealRx, 0, Math.PI * 2 * sealRaw);
  ctx.stroke();

  // 8 Arcane rune notches around outer ring
  if (sealRaw > 0.35) {
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = rimGlow;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const c = Math.cos(a);
      const s = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(c * (sealRx - 5), s * (sealRx - 5));
      ctx.lineTo(c * (sealRx + 3.5), s * (sealRx + 3.5));
      ctx.stroke();
    }
  }
  ctx.restore();

  // Inner counter-rotating sacred star seal
  if (sealRaw > 0.2) {
    ctx.save();
    ctx.rotate(-phase * 1.15 * spinDir);
    const innerR = Math.max(2, sealRx * 0.72);
    ctx.globalAlpha = 0.58 * sealEase;
    ctx.strokeStyle = secondary;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, innerR, 0, Math.PI * 2);
    ctx.stroke();

    // Inscribed 6-point arcane star (two interlaced triangles)
    ctx.globalAlpha = 0.45 * sealEase;
    ctx.strokeStyle = primary;
    for (let tri = 0; tri < 2; tri++) {
      const offset = tri * (Math.PI / 3);
      ctx.beginPath();
      for (let v = 0; v < 3; v++) {
        const va = offset + (v * Math.PI * 2) / 3;
        const vx = Math.cos(va) * innerR;
        const vy = Math.sin(va) * innerR;
        if (v === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  // Step-In Warp Resonance Progress Ring
  if (charge > 0.01) {
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = rimGlow;
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.arc(0, 0, sealRx + 6, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * charge);
    ctx.stroke();
  }

  ctx.restore();

  // 2. Back-Half Orbiting Carved Runestones (2.5D behind vortex)
  const orbitRx = 38 + charge * 4;
  const orbitRy = 15;
  if (stoneRise > 0.02) {
    for (let i = 0; i < 4; i++) {
      const oa = time * 1.25 * spinDir + (i * Math.PI) / 2;
      if (Math.sin(oa) < 0) {
        const sx = cx + Math.cos(oa) * orbitRx * stoneRise;
        const bob = Math.sin(time * 3.4 + i * 1.6) * 4.5;
        const sy = baseY - 18 * stoneRise + Math.sin(oa) * orbitRy + bob;
        drawPortalRunestone(ctx, sx, sy, 0.86 * stoneRise, primary, pulse);
      }
    }
  }

  // 3. Standing Elliptical Dimensional Vortex Aperture
  const vortexCx = cx;
  const vortexCy = cy - 8 + Math.sin(time * 2.6) * 2.2;
  const apertureH = Math.max(4, 36 * Math.min(1, age / 0.35));
  const apertureW = Math.max(2.2, (25 + charge * 3.5) * Math.max(0.06, riftBack));

  ctx.save();
  ctx.translate(vortexCx, vortexCy);

  // Outer volumetric aura halo
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const auraR = Math.max(6, apertureH * 1.48);
  const auraGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, auraR);
  auraGrad.addColorStop(0, isNext ? 'rgba(56, 189, 248, 0.42)' : 'rgba(251, 191, 36, 0.42)');
  auraGrad.addColorStop(0.5, isNext ? 'rgba(168, 85, 247, 0.2)' : 'rgba(245, 158, 11, 0.2)');
  auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.max(4, apertureW * 1.65), auraR, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Deep Event-Horizon Core (elliptical clip/scale space)
  ctx.save();
  ctx.scale(apertureW / apertureH, 1);

  const coreGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, apertureH);
  coreGrad.addColorStop(0, coreDark);
  coreGrad.addColorStop(0.52, coreMid);
  coreGrad.addColorStop(0.86, secondary);
  coreGrad.addColorStop(1, primary);
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(0, 0, apertureH, 0, Math.PI * 2);
  ctx.fill();

  // 6 Rotating Curved Vortex Spiral Ribbons pulling into the event horizon
  if (riftRaw > 0.15) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const armSpin = phase * 2.35 * spinDir;
    for (let a = 0; a < 6; a++) {
      const baseAng = armSpin + (a * Math.PI) / 3;
      const outerX = Math.cos(baseAng) * (apertureH * 0.94);
      const outerY = Math.sin(baseAng) * (apertureH * 0.94);
      const ctrlAng = baseAng + 0.92 * spinDir;
      const ctrlX = Math.cos(ctrlAng) * (apertureH * 0.54);
      const ctrlY = Math.sin(ctrlAng) * (apertureH * 0.54);
      const innerAng = baseAng + 1.85 * spinDir;
      const innerX = Math.cos(innerAng) * (apertureH * 0.12);
      const innerY = Math.sin(innerAng) * (apertureH * 0.12);

      ctx.strokeStyle = a % 2 === 0 ? primary : secondary;
      ctx.globalAlpha = 0.56 + 0.24 * Math.sin(time * 5 + a);
      ctx.lineWidth = a % 2 === 0 ? 3.0 : 2.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(outerX, outerY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, innerX, innerY);
      ctx.stroke();
    }

    // Inner counter-swirling starlight ring
    ctx.strokeStyle = rimGlow;
    ctx.globalAlpha = 0.65 + pulse * 0.25;
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      Math.max(1.5, apertureH * (0.34 + 0.05 * Math.sin(time * 6))),
      -armSpin * 1.3,
      -armSpin * 1.3 + Math.PI * 1.35
    );
    ctx.stroke();

    // Central singularity star-flash
    const singR = Math.max(1.5, (5.5 + pulse * 3.5 + charge * 4) * riftRaw);
    ctx.fillStyle = rimGlow;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(0, 0, singR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Luminous Dimensional Gateway Rim + Crackling Energy Arcs
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = primary;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(0, 0, apertureH, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = rimGlow;
  ctx.globalAlpha = 0.88;
  ctx.lineWidth = 1.6;
  for (let r = 0; r < 3; r++) {
    const arcStart = phase * 2.9 * spinDir + (r * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.arc(0, 0, apertureH + 1.5, arcStart, arcStart + 0.72);
    ctx.stroke();
  }

  ctx.restore(); // end elliptical scale
  ctx.restore(); // end vortex translate

  // 4. Deterministic Zero-Allocation Rising Dimensional Motes
  if (sealEase > 0.3) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let m = 0; m < 10; m++) {
      const mPhase = (time * (0.58 + (m % 3) * 0.14) + m * 0.618034) % 1;
      const mAngle = mPhase * Math.PI * 3.2 * spinDir + m * 1.9;
      const spread = (1 - mPhase * 0.45) * 32 * sealEase;
      const mx = cx + Math.cos(mAngle) * spread;
      const my = baseY + 4 - mPhase * 76;
      const mSize = Math.max(0.8, (1 - mPhase) * (m % 2 === 0 ? 3.2 : 2.3));

      ctx.globalAlpha = Math.sin(mPhase * Math.PI) * 0.92;
      ctx.fillStyle = m % 3 === 0 ? rimGlow : m % 2 === 0 ? primary : secondary;
      ctx.beginPath();
      ctx.arc(mx, my, mSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 5. Front-Half Orbiting Carved Runestones (2.5D in front of vortex)
  if (stoneRise > 0.02) {
    for (let i = 0; i < 4; i++) {
      const oa = time * 1.25 * spinDir + (i * Math.PI) / 2;
      if (Math.sin(oa) >= 0) {
        const sx = cx + Math.cos(oa) * orbitRx * stoneRise;
        const bob = Math.sin(time * 3.4 + i * 1.6) * 4.5;
        const sy = baseY - 18 * stoneRise + Math.sin(oa) * orbitRy + bob;
        drawPortalRunestone(ctx, sx, sy, 1.02 * stoneRise, rimGlow, pulse);
      }
    }
  }

  // 6. Floating Destination Label above the Portal
  const labelText = prop.label || (isNext ? 'Next Dungeon' : 'Return to Lobby');
  const labelY = cy - 54 + Math.sin(time * 2.6) * 2;
  drawWorldLabel(ctx, cx, labelY, labelText, labelColor);
}


function drawWorldLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string) {
  ctx.save();
  ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(10, 12, 16, 0.72)';
  const tw = ctx.measureText(text).width + 14;
  ctx.beginPath();
  ctx.roundRect(x - tw / 2, y - 11, tw, 18, 5);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, x, y + 2);
  ctx.restore();
}

function drawAimIndicator(
  ctx: CanvasRenderingContext2D,
  player: PlayerRenderState,
  aim: AimState,
  time: number
) {
  if (!aim.skillId) return;
  const def = HERO_SKILLS[aim.skillId];
  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.strokeStyle = 'rgba(163, 230, 53, 0.26)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(0, 0, def.range, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  if (def.targeting === TargetingMode.CONE) {
    const half = def.radiusOrAngle / 2;
    ctx.fillStyle = 'rgba(103, 232, 249, 0.16)';
    ctx.strokeStyle = def.glowColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, def.range, aim.angle - half, aim.angle + half);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (def.targeting === TargetingMode.LINE) {
    ctx.rotate(aim.angle);
    const w = def.radiusOrAngle;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.strokeStyle = def.glowColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -w / 2);
    ctx.lineTo(def.range - 22, -w / 2);
    ctx.lineTo(def.range - 22, -w * 0.85);
    ctx.lineTo(def.range, 0);
    ctx.lineTo(def.range - 22, w * 0.85);
    ctx.lineTo(def.range - 22, w / 2);
    ctx.lineTo(0, w / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (def.targeting === TargetingMode.GROUND_AOE) {
    const dist = aim.isManual ? aim.distanceRatio * def.range : def.range * 0.65;
    const tx = Math.cos(aim.angle) * dist;
    const ty = Math.sin(aim.angle) * dist;
    ctx.fillStyle = 'rgba(74, 222, 128, 0.16)';
    ctx.strokeStyle = def.glowColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(tx, ty, def.radiusOrAngle, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(tx, ty, 12 + Math.sin(time * 8) * 3, 0, Math.PI * 2);
    ctx.stroke();
  } else if (def.targeting === TargetingMode.SELF) {
    ctx.fillStyle = 'rgba(132, 204, 22, 0.12)';
    ctx.strokeStyle = def.glowColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, def.range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function drawBoneStormVortex(ctx: CanvasRenderingContext2D, player: PlayerRenderState, time: number) {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.strokeStyle = 'rgba(103, 232, 249, 0.32)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 125, time * 5, time * 5 + Math.PI * 1.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 94, -time * 6, -time * 6 + Math.PI * 1.3);
  ctx.stroke();

  for (let i = 0; i < 10; i++) {
    const ang = time * 6.8 + (i * Math.PI * 2) / 10;
    const r = i % 2 === 0 ? 114 : 84;
    const bx = Math.cos(ang) * r;
    const by = Math.sin(ang) * r;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(ang + Math.PI / 2);
    ctx.fillStyle = '#ecfeff';
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(0, -3.5);
    ctx.lineTo(9, 0);
    ctx.lineTo(0, 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Cute Chibi Skeleton Character (Cute head, chibi body, two stubby feet, NO ARMS)
 */
function drawChibiSkeletonBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  walkPhase: number,
  scale: number,
  eyeColor: string,
  isGhost: boolean,
  scarfColor = '#9a3412',
  crownColor: string | null = null,
  hitFlash = 0,
  attackLunge = 0,
  attackTwist = 0,
  attackSquash = 0
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const isMoving = Math.abs(Math.sin(walkPhase)) > 0.01;
  const bob = isMoving ? Math.abs(Math.sin(walkPhase * 2)) * -3.2 : Math.sin(performance.now() * 0.004) * -1.4;
  const footSwing = Math.sin(walkPhase) * 5.5 + attackTwist * 3.8;

  if (!isGhost) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.ellipse(Math.cos(facing) * attackLunge * 2.5, 13, 15 + attackLunge * 2, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const boneBase = hitFlash > 0 ? '#ffffff' : isGhost ? '#67e8f9' : '#f5f0e6';
  const boneShade = hitFlash > 0 ? '#ffffff' : isGhost ? '#22d3ee' : '#d6cbb9';

  // Two cute little stubs for feet (strictly no arms), stepping dynamically into attacks!
  ctx.fillStyle = boneShade;
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.ellipse(
    -6 + footSwing * 0.35 - attackLunge * 1.4,
    9 - Math.max(0, footSwing * 0.45),
    4.2,
    5.2,
    -attackTwist * 0.12,
    0,
    Math.PI * 2
  );
  ctx.fill();
  if (!isGhost) ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(
    6 - footSwing * 0.35 + attackLunge * 1.8,
    9 - Math.max(0, -footSwing * 0.45),
    4.2,
    5.2,
    attackTwist * 0.12,
    0,
    Math.PI * 2
  );
  ctx.fill();
  if (!isGhost) ctx.stroke();

  ctx.save();
  ctx.translate(
    Math.cos(facing) * attackLunge * 5.2,
    bob + Math.sin(facing) * attackLunge * 2.8 - attackLunge * 1.2
  );
  ctx.rotate(attackTwist * 0.13 + Math.cos(facing) * attackLunge * 0.08);
  ctx.scale(1 + attackSquash, 1 - attackSquash * 0.8);

  // Chibi torso
  ctx.fillStyle = '#292524';
  ctx.beginPath();
  ctx.roundRect(-8.5, -5, 17, 13, 6);
  ctx.fill();
  if (!isGhost) ctx.stroke();

  ctx.strokeStyle = boneBase;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-5.5, -1);
  ctx.lineTo(5.5, -1);
  ctx.moveTo(-4.8, 3);
  ctx.lineTo(4.8, 3);
  ctx.moveTo(0, -3);
  ctx.lineTo(0, 5.5);
  ctx.stroke();

  if (!isGhost && scarfColor) {
    ctx.fillStyle = scarfColor;
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.8;
    const tailDir = -Math.cos(facing);
    const scarfWhip = Math.sin(walkPhase) * 2 - attackTwist * 4.5;
    ctx.beginPath();
    ctx.moveTo(tailDir * 5, -5);
    ctx.quadraticCurveTo(tailDir * (15 + attackLunge * 4), -3 + scarfWhip, tailDir * (13 + attackLunge * 3), 4);
    ctx.lineTo(tailDir * 6, 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(-9.5, -8.5, 19, 5.8, 3);
    ctx.fill();
    ctx.stroke();
  }

  // Cute round chibi skull head
  const lookX = Math.cos(facing) * (2.8 + attackLunge * 1.4);
  const lookY = Math.sin(facing) * (1.8 + attackLunge * 0.8);

  ctx.fillStyle = boneBase;
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, -19, 14.5, 0, Math.PI * 2);
  ctx.fill();
  if (!isGhost) ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(-6.5, -8.5, 13, 4.5, 2.2);
  ctx.fill();
  if (!isGhost) ctx.stroke();

  if (!isGhost && hitFlash <= 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(-4.5, -25, 5.5, 3.2, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.ellipse(-5.2 + lookX * 0.55, -18.2 + lookY * 0.45, 3.9, 4.3, 0, 0, Math.PI * 2);
  ctx.ellipse(5.2 + lookX * 0.55, -18.2 + lookY * 0.45, 3.9, 4.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.arc(-5.2 + lookX * 0.85, -18.2 + lookY * 0.65, 1.8, 0, Math.PI * 2);
  ctx.arc(5.2 + lookX * 0.85, -18.2 + lookY * 0.65, 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#27272a';
  ctx.beginPath();
  ctx.moveTo(lookX * 0.6, -15.2 + lookY * 0.4);
  ctx.lineTo(-1.6 + lookX * 0.6, -12.6 + lookY * 0.4);
  ctx.lineTo(1.6 + lookX * 0.6, -12.6 + lookY * 0.4);
  ctx.closePath();
  ctx.fill();

  if (crownColor) {
    ctx.fillStyle = crownColor;
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-10, -30);
    ctx.lineTo(-8, -39);
    ctx.lineTo(-3, -33);
    ctx.lineTo(0, -42);
    ctx.lineTo(3, -33);
    ctx.lineTo(8, -39);
    ctx.lineTo(10, -30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
  ctx.restore();
}

/**
 * Cute Chibi Zombie Character (Same exact style: cute head, chibi body, two stubby feet, NO ARMS!)
 */
function drawChibiZombieBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  walkPhase: number,
  scale: number,
  isGhost: boolean,
  isAbomination: boolean,
  hitFlash = 0,
  attackLunge = 0,
  attackTwist = 0,
  attackSquash = 0
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const isMoving = Math.abs(Math.sin(walkPhase)) > 0.01;
  const bob = isMoving ? Math.abs(Math.sin(walkPhase * 2)) * -3.0 : Math.sin(performance.now() * 0.0038) * -1.4;
  const footSwing = Math.sin(walkPhase) * 5.2 + attackTwist * 3.8;

  if (!isGhost) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(Math.cos(facing) * attackLunge * 2.5, 13, 15.5 + attackLunge * 2.2, 6.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const skinBase = hitFlash > 0 ? '#ffffff' : isGhost ? '#86efac' : isAbomination ? '#65a30d' : '#86efac';
  const skinShade = hitFlash > 0 ? '#ffffff' : isGhost ? '#4ade80' : '#4d7c0f';

  // Two cute little stubby zombie feet (NO ARMS!), planting into heavy swings!
  ctx.fillStyle = skinShade;
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.ellipse(
    -6 + footSwing * 0.35 - attackLunge * 1.5,
    9 - Math.max(0, footSwing * 0.45),
    4.4,
    5.2,
    -attackTwist * 0.14,
    0,
    Math.PI * 2
  );
  ctx.fill();
  if (!isGhost) ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(
    6 - footSwing * 0.35 + attackLunge * 1.9,
    9 - Math.max(0, -footSwing * 0.45),
    4.4,
    5.2,
    attackTwist * 0.14,
    0,
    Math.PI * 2
  );
  ctx.fill();
  if (!isGhost) ctx.stroke();

  ctx.save();
  ctx.translate(
    Math.cos(facing) * attackLunge * 5.6,
    bob + Math.sin(facing) * attackLunge * 3.0 - attackLunge * 1.2
  );
  ctx.rotate(attackTwist * 0.15 + Math.cos(facing) * attackLunge * 0.09);
  ctx.scale(1 + attackSquash, 1 - attackSquash * 0.82);

  // Chibi patchwork undead tunic / body (no arms)
  ctx.fillStyle = hitFlash > 0 ? '#ffffff' : '#3b2547';
  ctx.beginPath();
  ctx.roundRect(-9.2, -5, 18.4, 13.5, 6.5);
  ctx.fill();
  if (!isGhost) ctx.stroke();

  // Cute stitched belly seam
  if (!isGhost && hitFlash <= 0) {
    ctx.strokeStyle = '#a3e635';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.lineTo(0, 6);
    ctx.moveTo(-3, 0);
    ctx.lineTo(3, 0);
    ctx.moveTo(-3, 3.5);
    ctx.lineTo(3, 3.5);
    ctx.stroke();
  }

  // Cozy tattered necrotic scarf
  if (!isGhost) {
    ctx.fillStyle = isAbomination ? '#7e22ce' : '#581c87';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.8;
    const tailDir = -Math.cos(facing);
    ctx.beginPath();
    ctx.moveTo(tailDir * 5, -5);
    ctx.quadraticCurveTo(tailDir * 15, -2 + Math.sin(walkPhase) * 2, tailDir * 13, 4.5);
    ctx.lineTo(tailDir * 6, 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(-10, -8.5, 20, 5.8, 3);
    ctx.fill();
    ctx.stroke();
  }

  // Cute oversized round Zombie head
  const lookX = Math.cos(facing) * 2.8;
  const lookY = Math.sin(facing) * 1.8;

  ctx.fillStyle = skinBase;
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, -19, 14.8, 0, Math.PI * 2);
  ctx.fill();
  if (!isGhost) ctx.stroke();

  // Cute darker green undead patch + forehead stitch
  if (!isGhost && hitFlash <= 0) {
    ctx.fillStyle = 'rgba(77, 124, 15, 0.35)';
    ctx.beginPath();
    ctx.arc(6.5, -24, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-7, -26);
    ctx.lineTo(-1, -24);
    ctx.moveTo(-5.5, -27.5);
    ctx.lineTo(-6.5, -24);
    ctx.moveTo(-2.5, -26.5);
    ctx.lineTo(-3.5, -23);
    ctx.stroke();
  }

  // Big expressive dark eye sockets + glowing lime/amber pupils
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.ellipse(-5.2 + lookX * 0.55, -18 + lookY * 0.45, 3.8, 4.2, 0, 0, Math.PI * 2);
  ctx.ellipse(5.2 + lookX * 0.55, -18 + lookY * 0.45, 4.1, 4.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isAbomination ? '#fde047' : '#d9f99d';
  ctx.beginPath();
  ctx.arc(-5.2 + lookX * 0.85, -18 + lookY * 0.65, 1.8, 0, Math.PI * 2);
  ctx.arc(5.2 + lookX * 0.85, -18 + lookY * 0.65, 2.0, 0, Math.PI * 2);
  ctx.fill();

  // Cute little snaggletooth mouth
  if (!isGhost) {
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-4 + lookX * 0.5, -11.5 + lookY * 0.3);
    ctx.lineTo(4 + lookX * 0.5, -11.5 + lookY * 0.3);
    ctx.stroke();

    ctx.fillStyle = '#fefce8';
    ctx.fillRect(1 + lookX * 0.5, -13.8 + lookY * 0.3, 2.6, 2.4);
  }

  // Abomination bone horns!
  if (isAbomination) {
    ctx.fillStyle = '#d9f99d';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-11, -28);
    ctx.lineTo(-16, -38);
    ctx.lineTo(-6, -32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(11, -28);
    ctx.lineTo(16, -38);
    ctx.lineTo(6, -32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
  ctx.restore();
}

/**
 * Cute Chibi Ghoul – Feral Stalker Character
 * (Same cozy style: cute oversized head, chibi torso, two stubby feet, NO ARMS,
 * swept-back feral predator ears, glowing crimson slit eyes, fang grin, tattered crimson cloak!)
 */
function drawChibiGhoulBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  walkPhase: number,
  scale: number,
  isGhost: boolean,
  isApex: boolean,
  hitFlash = 0,
  airborneHeight = 0,
  attackLunge = 0,
  attackTwist = 0,
  attackSquash = 0
) {
  ctx.save();
  ctx.translate(x, y);

  // Ground shadow stays anchored on dungeon floor and shifts dynamically with agile predator lunges!
  if (!isGhost) {
    const shadowScale = Math.max(0.45, 1 - airborneHeight / 130);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(
      Math.cos(facing) * attackLunge * 3 * scale,
      13 * scale,
      (15 + attackLunge * 2.5) * scale * shadowScale,
      6.5 * scale * shadowScale,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.translate(0, -airborneHeight);
  ctx.scale(scale, scale);

  const isMoving = Math.abs(Math.sin(walkPhase)) > 0.01;
  const bob = isMoving
    ? Math.abs(Math.sin(walkPhase * 2.2)) * -3.5
    : Math.sin(performance.now() * 0.0052) * -1.5;
  const footSwing = Math.sin(walkPhase) * 6.2 + attackTwist * 4.4;

  const skinBase =
    hitFlash > 0 ? '#ffffff' : isGhost ? '#fb7185' : isApex ? '#94a3b8' : '#cbd5e1';
  const skinShade =
    hitFlash > 0 ? '#ffffff' : isGhost ? '#e11d48' : '#64748b';

  // Two cute little stubby predator feet (strictly NO ARMS!), pivoting fluidly with claw combos!
  ctx.fillStyle = skinShade;
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.ellipse(
    -6.2 + footSwing * 0.4 - attackLunge * 1.6,
    9 - Math.max(0, footSwing * 0.48),
    4.2,
    5.2,
    -0.1 - attackTwist * 0.14,
    0,
    Math.PI * 2
  );
  ctx.fill();
  if (!isGhost) ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(
    6.2 - footSwing * 0.4 + attackLunge * 2.0,
    9 - Math.max(0, -footSwing * 0.48),
    4.2,
    5.2,
    0.1 + attackTwist * 0.14,
    0,
    Math.PI * 2
  );
  ctx.fill();
  if (!isGhost) ctx.stroke();

  ctx.save();
  // Fluid forward predator crouch & dynamic swing lean/twist!
  ctx.translate(
    Math.cos(facing) * (1.6 + attackLunge * 5.8),
    bob + Math.sin(facing) * attackLunge * 3.2 - attackLunge * 1.4
  );
  ctx.rotate(attackTwist * 0.16 + Math.cos(facing) * attackLunge * 0.1);
  ctx.scale(1 + attackSquash, 1 - attackSquash * 0.82);

  // Apex Predator dorsal blood-spines!
  if (isApex && !isGhost) {
    ctx.fillStyle = '#e11d48';
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1.5;
    const tailDir = -Math.cos(facing);
    for (let s = 0; s < 3; s++) {
      const sy = -7 + s * 4.5;
      ctx.beginPath();
      ctx.moveTo(tailDir * 6, sy - 2);
      ctx.lineTo(tailDir * (15 - s * 1.5), sy - 5);
      ctx.lineTo(tailDir * 7, sy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // Agile chibi obsidian stalker vest / torso (no arms)
  ctx.fillStyle = hitFlash > 0 ? '#ffffff' : '#1e1b24';
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-8.8, -5, 17.6, 13.2, 6.2);
  ctx.fill();
  if (!isGhost) ctx.stroke();

  // Crimson hunter X-straps across chibi chest
  if (!isGhost && hitFlash <= 0) {
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(-5.5, -2.5);
    ctx.lineTo(5.5, 5.5);
    ctx.moveTo(5.5, -2.5);
    ctx.lineTo(-5.5, 5.5);
    ctx.stroke();
  }

  // Tattered blood-crimson stalker scarf fluttering smoothly with movement & swings
  if (!isGhost) {
    ctx.fillStyle = isApex ? '#be123c' : '#881337';
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1.8;
    const tailDir = -Math.cos(facing);
    const scarfFlow = Math.sin(walkPhase * 1.3) * 2.8 - attackTwist * 5.0;
    ctx.beginPath();
    ctx.moveTo(tailDir * 5, -5.5);
    ctx.quadraticCurveTo(tailDir * (18 + attackLunge * 4.5), -4 + scarfFlow, tailDir * (15 + attackLunge * 3.5), 4.5);
    ctx.lineTo(tailDir * 10, 1.5);
    ctx.lineTo(tailDir * 13, 6);
    ctx.lineTo(tailDir * 5.5, 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(-9.8, -8.5, 19.6, 5.6, 3);
    ctx.fill();
    ctx.stroke();
  }

  const lookX = Math.cos(facing) * (3.1 + attackLunge * 1.4);
  const lookY = Math.sin(facing) * (1.9 + attackLunge * 0.8);

  // Swept-back pointed feral Ghoul ears!
  const earLen = isApex ? 24 : 19;
  ctx.fillStyle = skinBase;
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-11, -22);
  ctx.lineTo(-earLen, -29);
  ctx.lineTo(-8, -14);
  ctx.closePath();
  ctx.fill();
  if (!isGhost) ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(11, -22);
  ctx.lineTo(earLen, -29);
  ctx.lineTo(8, -14);
  ctx.closePath();
  ctx.fill();
  if (!isGhost) ctx.stroke();

  // Cute oversized pale-slate chibi Ghoul head
  ctx.fillStyle = skinBase;
  ctx.beginPath();
  ctx.arc(0, -19, 14.5, 0, Math.PI * 2);
  ctx.fill();
  if (!isGhost) ctx.stroke();

  // Subtle feral forehead crest / brow markings
  if (!isGhost && hitFlash <= 0) {
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-7 + lookX * 0.4, -23.5 + lookY * 0.3);
    ctx.lineTo(-2.5 + lookX * 0.4, -21.5 + lookY * 0.3);
    ctx.moveTo(7 + lookX * 0.4, -23.5 + lookY * 0.3);
    ctx.lineTo(2.5 + lookX * 0.4, -21.5 + lookY * 0.3);
    ctx.stroke();
  }

  // Sharp expressive dark eye sockets + glowing crimson predator slit eyes!
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.ellipse(-5.3 + lookX * 0.55, -18.2 + lookY * 0.45, 4.1, 3.6, -0.18, 0, Math.PI * 2);
  ctx.ellipse(5.3 + lookX * 0.55, -18.2 + lookY * 0.45, 4.1, 3.6, 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isApex ? '#fde047' : '#f43f5e';
  ctx.beginPath();
  ctx.ellipse(-5.3 + lookX * 0.85, -18.2 + lookY * 0.65, 1.3, 2.7, 0, 0, Math.PI * 2);
  ctx.ellipse(5.3 + lookX * 0.85, -18.2 + lookY * 0.65, 1.3, 2.7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cute jagged predator fang grin
  if (!isGhost) {
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1.7;
    const mx = lookX * 0.55;
    const my = -11.6 + lookY * 0.35;
    ctx.beginPath();
    ctx.moveTo(-4.8 + mx, my - 0.5);
    ctx.lineTo(4.8 + mx, my - 0.5);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(-3.8 + mx, my - 0.5);
    ctx.lineTo(-2.5 + mx, my + 2.6);
    ctx.lineTo(-1.2 + mx, my - 0.5);
    ctx.moveTo(1.2 + mx, my - 0.5);
    ctx.lineTo(2.5 + mx, my + 2.6);
    ctx.lineTo(3.8 + mx, my - 0.5);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
  ctx.restore();
}

/**
 * Cute Chibi Ghost Character
 * (Same cozy style: cute oversized round head with floating curled spirit wisp crest,
 * cozy tattered astral cloak torso, strictly NO ARMS, and two cute translucent stubby feet!)
 */
function drawChibiGhostBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  walkPhase: number,
  scale: number,
  isAfterimage: boolean,
  isNightmare: boolean,
  hitFlash = 0,
  phantomMistTimer = 0,
  attackLunge = 0,
  attackTwist = 0,
  attackSquash = 0
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const nowSec = performance.now() * 0.001;
  // Phantom Dash Transformation: Ghost dissolves into a fleeting, billowing astral mist cloud!
  if (phantomMistTimer > 0 && !isAfterimage) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const a = nowSec * 9 + (i * Math.PI) / 3;
      const mx = Math.cos(a) * 11 - Math.cos(facing) * (i * 3);
      const my = -10 + Math.sin(a * 1.3) * 8;
      ctx.globalAlpha = 0.36;
      ctx.fillStyle = i % 2 === 0 ? '#5eead4' : '#818cf8';
      ctx.beginPath();
      ctx.arc(mx, my, 12 - i * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    // Glowing spectral eyes shining from within the fleeting mist!
    const lx = Math.cos(facing) * 4;
    const ly = Math.sin(facing) * 2.5;
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#e0e7ff';
    ctx.beginPath();
    ctx.ellipse(-4.5 + lx, -13 + ly, 2.6, 3.2, 0, 0, Math.PI * 2);
    ctx.ellipse(4.5 + lx, -13 + ly, 2.6, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    return;
  }

  const isMoving = Math.abs(Math.sin(walkPhase)) > 0.01;
  const floatBob = isMoving
    ? Math.sin(walkPhase * 1.6) * -3.0 - 2.2
    : Math.sin(nowSec * 3.8) * -2.8 - 2.0;
  const footSwing = Math.sin(walkPhase) * 4.8 + attackTwist * 3.2;

  // Soft hovering ectoplasm floor halo instead of heavy physical shadow
  if (!isAfterimage) {
    ctx.fillStyle = isNightmare ? 'rgba(139, 92, 246, 0.28)' : 'rgba(94, 234, 212, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 12.5, 15.5, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const headFill = hitFlash > 0 ? '#ffffff' : isAfterimage ? '#818cf8' : '#eef2ff';
  const footFill = hitFlash > 0 ? '#ffffff' : isAfterimage ? '#5eead4' : '#a5b4fc';

  // Two cute little translucent stubby spectral feet (strictly NO ARMS!)
  ctx.save();
  ctx.globalAlpha = isAfterimage ? 0.55 : 0.86;
  ctx.fillStyle = footFill;
  ctx.strokeStyle = '#1e1b4b';
  ctx.lineWidth = 1.9;

  ctx.beginPath();
  ctx.ellipse(
    -5.8 + footSwing * 0.35,
    8.5 + floatBob * 0.35 - Math.max(0, footSwing * 0.35),
    4.0,
    4.9,
    -0.08,
    0,
    Math.PI * 2
  );
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(
    5.8 - footSwing * 0.35,
    8.5 + floatBob * 0.35 - Math.max(0, -footSwing * 0.35),
    4.0,
    4.9,
    0.08,
    0,
    Math.PI * 2
  );
  ctx.fill();
  if (!isAfterimage) ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(
    Math.cos(facing) * attackLunge * 4.2,
    floatBob + Math.sin(facing) * attackLunge * 2.4
  );
  ctx.rotate(attackTwist * 0.12 + Math.cos(facing) * attackLunge * 0.06);
  ctx.scale(1 + attackSquash, 1 - attackSquash * 0.8);

  // Chibi tattered astral shroud/cloak torso (no arms!) with scalloped ghostly hem
  ctx.fillStyle = hitFlash > 0 ? '#ffffff' : isNightmare ? '#3b0764' : '#312e81';
  ctx.strokeStyle = '#1e1b4b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8.5, -5.5);
  ctx.lineTo(8.5, -5.5);
  ctx.quadraticCurveTo(10.5, 2, 9.5, 8);
  ctx.lineTo(4.5, 5.8);
  ctx.lineTo(0, 8.6);
  ctx.lineTo(-4.5, 5.8);
  ctx.lineTo(-9.5, 8);
  ctx.quadraticCurveTo(-10.5, 2, -8.5, -5.5);
  ctx.closePath();
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  // Glowing ectoplasm soul-gem clasp on chibi chest
  if (!isAfterimage && hitFlash <= 0) {
    ctx.fillStyle = isNightmare ? '#e879f9' : '#2dd4bf';
    ctx.beginPath();
    ctx.moveTo(0, -2.5);
    ctx.lineTo(3.2, 1);
    ctx.lineTo(0, 4.5);
    ctx.lineTo(-3.2, 1);
    ctx.closePath();
    ctx.fill();
  }

  // Fluttering translucent spirit tail-scarf
  if (!isAfterimage) {
    const tailDir = -Math.cos(facing);
    const wave = Math.sin(nowSec * 6.5) * 2.5 - attackTwist * 3.5;
    ctx.fillStyle = isNightmare ? '#7e22ce' : '#4f46e5';
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(tailDir * 5, -5.5);
    ctx.quadraticCurveTo(tailDir * 17, -3.5 + wave, tailDir * 15, 4.5);
    ctx.lineTo(tailDir * 6, 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(-9.6, -8.5, 19.2, 5.4, 3);
    ctx.fill();
    ctx.stroke();
  }

  // Cute oversized round chibi Ghost head + adorable curled spirit wisp tip on top!
  const lookX = Math.cos(facing) * 3.0;
  const lookY = Math.sin(facing) * 1.8;
  const wispSway = Math.sin(nowSec * 5.2) * 2.6;

  ctx.fillStyle = headFill;
  ctx.strokeStyle = '#1e1b4b';
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.arc(0, -19, 14.5, 0, Math.PI * 2);
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  // Cute floating curled ghost-tail crest atop head!
  ctx.beginPath();
  ctx.moveTo(-4.5, -31.5);
  ctx.quadraticCurveTo(wispSway, -39.5, 5.5 + wispSway * 0.6, -35.5);
  ctx.quadraticCurveTo(3.5, -31.5, 4.2, -31);
  ctx.closePath();
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  // Soft pastel spirit cheek blushes
  if (!isAfterimage && hitFlash <= 0) {
    ctx.fillStyle = 'rgba(129, 140, 248, 0.35)';
    ctx.beginPath();
    ctx.ellipse(-8.5 + lookX * 0.4, -14.5 + lookY * 0.3, 2.8, 1.6, 0, 0, Math.PI * 2);
    ctx.ellipse(8.5 + lookX * 0.4, -14.5 + lookY * 0.3, 2.8, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Big expressive dark-indigo eye sockets + luminous cyan/violet starlight pupils
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.ellipse(-5.1 + lookX * 0.55, -18.4 + lookY * 0.45, 3.8, 4.4, 0, 0, Math.PI * 2);
  ctx.ellipse(5.1 + lookX * 0.55, -18.4 + lookY * 0.45, 3.8, 4.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isNightmare ? '#e879f9' : '#5eead4';
  ctx.beginPath();
  ctx.arc(-5.1 + lookX * 0.85, -18.4 + lookY * 0.65, 1.9, 0, Math.PI * 2);
  ctx.arc(5.1 + lookX * 0.85, -18.4 + lookY * 0.65, 1.9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-5.8 + lookX * 0.85, -19.5 + lookY * 0.65, 0.9, 0, Math.PI * 2);
  ctx.arc(4.4 + lookX * 0.85, -19.5 + lookY * 0.65, 0.9, 0, Math.PI * 2);
  ctx.fill();

  // Cute spooky little 'o' wisp mouth!
  if (!isAfterimage) {
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.ellipse(lookX * 0.55, -12.2 + lookY * 0.35, 2.1, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  ctx.restore();
}

/**
 * 60fps Chibi Eaglekin Sky Marksman Body + Integrated Aerodynamic Wings (No detached weapon!)
 */
function drawChibiEaglekinBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  walkPhase: number,
  scale: number,
  isAfterimage = false,
  hitFlash = 0,
  airborneHeight = 0,
  wingFlapTimer = 0,
  attackLunge = 0,
  attackTwist = 0,
  attackSquash = 0,
  celestialBarrageTimer = 0,
  rainOfFeathersTimer = 0,
  wrathSkyTimer = 0
) {
  ctx.save();
  ctx.translate(x, y - airborneHeight);
  ctx.scale(scale, scale);

  const nowSec = performance.now() * 0.001;
  const isMoving = Math.abs(Math.sin(walkPhase)) > 0.01;
  const isAirborne = airborneHeight > 2;
  const bob = isAirborne
    ? Math.sin(nowSec * 14) * 3.5
    : isMoving
      ? Math.sin(walkPhase * 2) * -2.2
      : Math.sin(nowSec * 3.6) * -1.2;

  const footSwing = isAirborne ? 0 : Math.sin(walkPhase) * 4.6 + attackTwist * 2.8;

  // Ground shadow when not an afterimage
  if (!isAfterimage) {
    ctx.save();
    ctx.translate(0, airborneHeight);
    const shadowScale = isAirborne ? Math.max(0.4, 1 - airborneHeight / 60) : 1.0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.ellipse(0, 11, 14 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Talon colors
  const talonBase = hitFlash > 0 ? '#ffffff' : '#f59e0b';
  const talonShade = hitFlash > 0 ? '#ffffff' : '#d97706';

  // Two cute little raptor talons/feet (NO ARMS!)
  ctx.fillStyle = talonBase;
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 1.8;

  // Left Talon
  ctx.beginPath();
  ctx.ellipse(-5 + footSwing * 0.35, 9.5 - Math.max(0, footSwing * 0.4), 4.2, 3.2, -0.1, 0, Math.PI * 2);
  ctx.fill();
  if (!isAfterimage) ctx.stroke();
  ctx.fillStyle = talonShade;
  ctx.beginPath();
  ctx.moveTo(-7 + footSwing * 0.35, 11);
  ctx.lineTo(-5 + footSwing * 0.35, 13);
  ctx.lineTo(-3 + footSwing * 0.35, 11);
  ctx.fill();

  // Right Talon
  ctx.fillStyle = talonBase;
  ctx.beginPath();
  ctx.ellipse(5 - footSwing * 0.35, 9.5 - Math.max(0, -footSwing * 0.4), 4.2, 3.2, 0.1, 0, Math.PI * 2);
  ctx.fill();
  if (!isAfterimage) ctx.stroke();
  ctx.fillStyle = talonShade;
  ctx.beginPath();
  ctx.moveTo(3 - footSwing * 0.35, 11);
  ctx.lineTo(5 - footSwing * 0.35, 13);
  ctx.lineTo(7 - footSwing * 0.35, 11);
  ctx.fill();

  // Upper Body pivot
  ctx.save();
  ctx.translate(
    Math.cos(facing) * attackLunge * 4.5,
    bob + Math.sin(facing) * attackLunge * 2.2
  );
  ctx.rotate(attackTwist * 0.18);
  if (attackSquash !== 0) {
    ctx.scale(1 + attackSquash * 0.14, 1 - attackSquash * 0.14);
  }

  // Feather plumage colors
  const primaryPlumage = hitFlash > 0 ? '#ffffff' : '#0284c7'; // Sky-blue / cerulean
  const darkCoverts = hitFlash > 0 ? '#ffffff' : '#0369a1';    // Deeper azure
  const chestPlumage = hitFlash > 0 ? '#ffffff' : '#f0f9ff';   // Crisp cloud white
  const beakColor = hitFlash > 0 ? '#ffffff' : '#fbbf24';      // Golden beak
  const eyeColor = hitFlash > 0 ? '#ffffff' : '#fde047';       // Eagle eye gold

  // --- CELESTIAL BARRAGE SPECTRAL WINGS (4 giant glowing wings behind the character) ---
  if (celestialBarrageTimer > 0 && !isAfterimage) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const spectralWave = Math.sin(nowSec * 16) * 0.15;
    for (let sw = 0; sw < 4; sw++) {
      const side = sw < 2 ? -1 : 1;
      const tier = sw % 2;
      const wingAng = side * (0.85 + tier * 0.4 + spectralWave);
      ctx.save();
      ctx.translate(side * 8, -10 - tier * 6);
      ctx.rotate(wingAng);
      ctx.fillStyle = sw % 2 === 0 ? 'rgba(56, 189, 248, 0.55)' : 'rgba(224, 242, 254, 0.45)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * 18, -26, side * 36, -34);
      ctx.quadraticCurveTo(side * 28, -14, side * 22, -4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // --- INTEGRATED FEATHERED WINGS (Attached to shoulders/back) ---
  const isFlapping = wingFlapTimer > 0;
  const flapCycle = isFlapping ? Math.sin(wingFlapTimer * 30) : 0;
  const idleFlap = isAirborne
    ? Math.sin(nowSec * 22) * 0.52
    : isMoving
      ? Math.sin(walkPhase * 2) * 0.14
      : Math.sin(nowSec * 3.6) * 0.08;

  const wingBaseAngle = (isFlapping ? flapCycle * 0.65 : 0) + idleFlap;
  const wingExtension = (isAirborne ? 1.35 : 1.0) + (isFlapping ? 0.25 : 0);

  // Left Wing
  ctx.save();
  ctx.translate(-7, -8);
  ctx.rotate(-0.35 - wingBaseAngle);
  ctx.scale(wingExtension, wingExtension);

  ctx.fillStyle = darkCoverts;
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-14, -14, -28, -6);
  ctx.lineTo(-24, 2);
  ctx.lineTo(-14, 8);
  ctx.closePath();
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  ctx.fillStyle = primaryPlumage;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-11, -11, -22, -2);
  ctx.lineTo(-18, 5);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  ctx.fillStyle = '#bae6fd';
  ctx.beginPath();
  ctx.moveTo(-22, -2);
  ctx.lineTo(-27, -5);
  ctx.lineTo(-24, 1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Right Wing
  ctx.save();
  ctx.translate(7, -8);
  ctx.rotate(0.35 + wingBaseAngle);
  ctx.scale(wingExtension, wingExtension);

  ctx.fillStyle = darkCoverts;
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(14, -14, 28, -6);
  ctx.lineTo(24, 2);
  ctx.lineTo(14, 8);
  ctx.closePath();
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  ctx.fillStyle = primaryPlumage;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(11, -11, 22, -2);
  ctx.lineTo(18, 5);
  ctx.lineTo(10, 8);
  ctx.closePath();
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  ctx.fillStyle = '#bae6fd';
  ctx.beginPath();
  ctx.moveTo(22, -2);
  ctx.lineTo(27, -5);
  ctx.lineTo(24, 1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Tail Feathers
  ctx.fillStyle = darkCoverts;
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-5, 4);
  ctx.lineTo(0, 15);
  ctx.lineTo(5, 4);
  ctx.closePath();
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  // Armless Chibi Body
  ctx.fillStyle = primaryPlumage;
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.roundRect(-8.5, -9, 17, 18, 7);
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  // Downy Cloud-White Chest Plumage
  ctx.fillStyle = chestPlumage;
  ctx.beginPath();
  ctx.moveTo(-5, -6);
  ctx.quadraticCurveTo(0, -2, 5, -6);
  ctx.lineTo(4, 3);
  ctx.quadraticCurveTo(0, 8, -4, 3);
  ctx.closePath();
  ctx.fill();

  // Round Chibi Avian Head
  ctx.fillStyle = primaryPlumage;
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.arc(0, -16, 12, 0, Math.PI * 2);
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  // Crown Crest atop head
  ctx.fillStyle = darkCoverts;
  ctx.beginPath();
  ctx.moveTo(-4, -26);
  ctx.quadraticCurveTo(0, -33, 4, -26);
  ctx.lineTo(1, -22);
  ctx.lineTo(-2, -22);
  ctx.closePath();
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.moveTo(-1.5, -24);
  ctx.lineTo(0, -29);
  ctx.lineTo(1.5, -24);
  ctx.closePath();
  ctx.fill();

  const lookX = Math.cos(facing) * 3.5;
  const lookY = Math.sin(facing) * 2.2;

  // Sharp Golden Eagle Eyes
  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.ellipse(-4.5 + lookX * 0.7, -16 + lookY * 0.5, 3.2, 4.0, 0, 0, Math.PI * 2);
  ctx.ellipse(4.5 + lookX * 0.7, -16 + lookY * 0.5, 3.2, 4.0, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.ellipse(-4.2 + lookX * 0.9, -16 + lookY * 0.6, 1.4, 2.8, 0, 0, Math.PI * 2);
  ctx.ellipse(4.8 + lookX * 0.9, -16 + lookY * 0.6, 1.4, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-5 + lookX * 0.8, -17.5 + lookY * 0.5, 1.1, 0, Math.PI * 2);
  ctx.arc(4 + lookX * 0.8, -17.5 + lookY * 0.5, 1.1, 0, Math.PI * 2);
  ctx.fill();

  // Curved Raptor Beak
  ctx.fillStyle = beakColor;
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(lookX, -13.5 + lookY);
  ctx.lineTo(lookX + 4.5, -11.5 + lookY);
  ctx.quadraticCurveTo(lookX + 1.5, -7 + lookY, lookX - 1.5, -9 + lookY);
  ctx.lineTo(lookX - 4.5, -11.5 + lookY);
  ctx.closePath();
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  ctx.restore();
  ctx.restore();
}

/**
 * Cute Chibi Tigerkin – Feral Berserker (Wildborn Tribes)
 * Cozy chibi Beastkin design: cute round tiger head, warm orange tiger fur with dark stripes,
 * iconic 王 (King) forehead rune stripe, round tiger ears with dark rims & cream tufts,
 * glowing golden-amber feline slit eyes, fierce cute fang grin, fluffy striped tail swaying dynamically,
 * rugged leather Beastkin vest with sabertooth necklace, and two cute stubby paws (NO ARMS)!
 */
function drawChibiTigerkinBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  walkPhase: number,
  scale: number,
  isAfterimage = false,
  isKingOfBeasts = false,
  hitFlash = 0,
  airborneHeight = 0,
  attackLunge = 0,
  attackTwist = 0,
  attackSquash = 0
) {
  ctx.save();
  ctx.translate(x, y - airborneHeight);
  ctx.scale(scale, scale);

  const nowSec = performance.now() * 0.001;
  const isMoving = Math.abs(Math.sin(walkPhase)) > 0.01;
  const isAirborne = airborneHeight > 2;
  const bob = isAirborne
    ? Math.sin(nowSec * 16) * 3.8
    : isMoving
      ? Math.sin(walkPhase * 2.2) * -3.4
      : Math.sin(nowSec * 4.2) * -1.4;

  const footSwing = isAirborne ? 0 : Math.sin(walkPhase) * 6.0 + attackTwist * 4.2;

  // Ground shadow when not an afterimage
  if (!isAfterimage) {
    ctx.save();
    ctx.translate(0, airborneHeight);
    const shadowScale = isAirborne ? Math.max(0.4, 1 - airborneHeight / 70) : 1.0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(
      Math.cos(facing) * attackLunge * 2.6,
      13,
      (16 + attackLunge * 2) * shadowScale,
      6.5 * shadowScale,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  // Fur base colors
  const furOrange = hitFlash > 0 ? '#ffffff' : isAfterimage ? '#fb923c' : isKingOfBeasts ? '#fbbf24' : '#f97316';
  const furDark = hitFlash > 0 ? '#ffffff' : isAfterimage ? '#ea580c' : isKingOfBeasts ? '#f59e0b' : '#c2410c';
  const furCream = hitFlash > 0 ? '#ffffff' : isAfterimage ? '#fef3c7' : '#fffbeb';
  const stripeColor = hitFlash > 0 ? '#ffffff' : isAfterimage ? '#7c2d12' : '#1c1917';
  const pawPadColor = hitFlash > 0 ? '#ffffff' : '#f43f5e';

  // Two cute stubby tiger paws/feet (NO ARMS!)
  ctx.fillStyle = furDark;
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 1.9;

  // Left Paw
  ctx.beginPath();
  ctx.ellipse(-6 + footSwing * 0.38 - attackLunge * 1.5, 9.5 - Math.max(0, footSwing * 0.44), 4.6, 5.4, -0.1, 0, Math.PI * 2);
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  // Right Paw
  ctx.beginPath();
  ctx.ellipse(6 - footSwing * 0.38 + attackLunge * 1.9, 9.5 - Math.max(0, -footSwing * 0.44), 4.6, 5.4, 0.1, 0, Math.PI * 2);
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  // Cute pinkish-coral paw pads under feet
  if (!isAfterimage && hitFlash <= 0) {
    ctx.fillStyle = pawPadColor;
    ctx.beginPath();
    ctx.arc(-6 + footSwing * 0.38 - attackLunge * 1.5, 12 - Math.max(0, footSwing * 0.44), 1.8, 0, Math.PI * 2);
    ctx.arc(6 - footSwing * 0.38 + attackLunge * 1.9, 12 - Math.max(0, -footSwing * 0.44), 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(
    Math.cos(facing) * attackLunge * 5.0,
    bob + Math.sin(facing) * attackLunge * 2.8
  );
  ctx.rotate(attackTwist * 0.16 + Math.cos(facing) * attackLunge * 0.09);
  if (attackSquash !== 0) {
    ctx.scale(1 + attackSquash * 0.18, 1 - attackSquash * 0.18);
  }

  // Fluffy Animated Tiger Tail arching behind!
  if (!isAfterimage) {
    const tailDir = -Math.cos(facing);
    const tailWag = Math.sin(nowSec * 5.5 + walkPhase) * 4.5 - attackTwist * 6;
    ctx.strokeStyle = furOrange;
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tailDir * 6, 2);
    ctx.quadraticCurveTo(tailDir * (19 + attackLunge * 3), -2 + tailWag, tailDir * (18 + attackLunge * 2.5), -14 + tailWag * 0.6);
    ctx.stroke();

    // Dark stripes on tail
    ctx.strokeStyle = stripeColor;
    ctx.lineWidth = 3.6;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(tailDir * 8, 0);
    ctx.quadraticCurveTo(tailDir * (18 + attackLunge * 3), -2 + tailWag, tailDir * (18 + attackLunge * 2.5), -14 + tailWag * 0.6);
    ctx.stroke();
    ctx.setLineDash([]);

    // Cream tail tip
    ctx.fillStyle = furCream;
    ctx.beginPath();
    ctx.arc(tailDir * (18 + attackLunge * 2.5), -14 + tailWag * 0.6, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Chibi Torso - Rugged Beastkin Warrior Leather Vest (NO ARMS)
  ctx.fillStyle = hitFlash > 0 ? '#ffffff' : isAfterimage ? '#b45309' : '#78350f';
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.roundRect(-9.0, -5.2, 18.0, 13.0, 5.8);
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  // Cream fur chest tuft visible down the center of the vest
  if (!isAfterimage && hitFlash <= 0) {
    ctx.fillStyle = furCream;
    ctx.beginPath();
    ctx.moveTo(-3, -5);
    ctx.lineTo(3, -5);
    ctx.lineTo(2, 4);
    ctx.lineTo(0, 7);
    ctx.lineTo(-2, 4);
    ctx.closePath();
    ctx.fill();

    // Sabertooth fang necklace around neck
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, -6, 6.5, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(-1.8, -4.5);
    ctx.lineTo(0, 0);
    ctx.lineTo(1.8, -4.5);
    ctx.closePath();
    ctx.fill();
  }

  const lookX = Math.cos(facing) * (3.0 + attackLunge * 1.2);
  const lookY = Math.sin(facing) * (1.8 + attackLunge * 0.6);

  // Cute rounded tiger ears!
  for (const side of [-1, 1]) {
    const ex = side * 11;
    const ey = -24;
    ctx.fillStyle = stripeColor;
    ctx.beginPath();
    ctx.arc(ex, ey, 6.2, 0, Math.PI * 2);
    ctx.fill();
    if (!isAfterimage) ctx.stroke();

    ctx.fillStyle = furOrange;
    ctx.beginPath();
    ctx.arc(ex, ey, 4.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = furCream;
    ctx.beginPath();
    ctx.arc(ex + side * 0.8, ey + 0.6, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cute oversized round chibi Tiger head
  ctx.fillStyle = furOrange;
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, -19, 14.8, 0, Math.PI * 2);
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  // Cheek fur tufts (fluffy feline cheeks)
  if (!isAfterimage && hitFlash <= 0) {
    ctx.fillStyle = furOrange;
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-14, -18);
    ctx.lineTo(-18, -16);
    ctx.lineTo(-14, -13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(14, -18);
    ctx.lineTo(18, -16);
    ctx.lineTo(14, -13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Cream-white feline muzzle & cheeks
  if (!isAfterimage && hitFlash <= 0) {
    ctx.fillStyle = furCream;
    ctx.beginPath();
    ctx.ellipse(lookX * 0.55, -14.2 + lookY * 0.35, 7.8, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Iconic 王 (King) Tiger Forehead Rune & Cheek Stripes!
  if (!isAfterimage && hitFlash <= 0) {
    ctx.strokeStyle = stripeColor;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';

    const fx = lookX * 0.45;
    const fy = -26 + lookY * 0.3;
    ctx.beginPath();
    ctx.moveTo(fx - 4.5, fy - 4);
    ctx.lineTo(fx + 4.5, fy - 4);
    ctx.moveTo(fx - 3.5, fy - 1);
    ctx.lineTo(fx + 3.5, fy - 1);
    ctx.moveTo(fx - 5.0, fy + 2);
    ctx.lineTo(fx + 5.0, fy + 2);
    ctx.moveTo(fx, fy - 4);
    ctx.lineTo(fx, fy + 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-13 + lookX * 0.3, -20 + lookY * 0.2);
    ctx.lineTo(-8 + lookX * 0.3, -19 + lookY * 0.2);
    ctx.moveTo(-13 + lookX * 0.3, -16 + lookY * 0.2);
    ctx.lineTo(-9 + lookX * 0.3, -15.5 + lookY * 0.2);
    ctx.moveTo(13 + lookX * 0.3, -20 + lookY * 0.2);
    ctx.lineTo(8 + lookX * 0.3, -19 + lookY * 0.2);
    ctx.moveTo(13 + lookX * 0.3, -16 + lookY * 0.2);
    ctx.lineTo(9 + lookX * 0.3, -15.5 + lookY * 0.2);
    ctx.stroke();
  }

  // Cute little dark pink/terracotta tiger nose
  if (!isAfterimage && hitFlash <= 0) {
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(-2.2 + lookX * 0.6, -16.5 + lookY * 0.4);
    ctx.lineTo(2.2 + lookX * 0.6, -16.5 + lookY * 0.4);
    ctx.lineTo(lookX * 0.6, -14.2 + lookY * 0.4);
    ctx.closePath();
    ctx.fill();
  }

  // Fierce Glowing Golden-Amber Feline Eyes + Slit Pupils!
  const eyeColor = isKingOfBeasts ? '#fde047' : '#fbbf24';
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.ellipse(-5.5 + lookX * 0.55, -19 + lookY * 0.45, 3.8, 4.3, 0, 0, Math.PI * 2);
  ctx.ellipse(5.5 + lookX * 0.55, -19 + lookY * 0.45, 3.8, 4.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.arc(-5.5 + lookX * 0.75, -19 + lookY * 0.55, 2.6, 0, Math.PI * 2);
  ctx.arc(5.5 + lookX * 0.75, -19 + lookY * 0.55, 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.ellipse(-5.5 + lookX * 0.85, -19 + lookY * 0.55, 0.9, 2.4, 0, 0, Math.PI * 2);
  ctx.ellipse(5.5 + lookX * 0.85, -19 + lookY * 0.55, 0.9, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-6.2 + lookX * 0.75, -20.2 + lookY * 0.55, 1.1, 0, Math.PI * 2);
  ctx.arc(4.8 + lookX * 0.75, -20.2 + lookY * 0.55, 1.1, 0, Math.PI * 2);
  ctx.fill();

  // Cute tiger fang grin!
  if (!isAfterimage) {
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.7;
    const mx = lookX * 0.55;
    const my = -12.2 + lookY * 0.35;
    ctx.beginPath();
    ctx.moveTo(-4 + mx, my);
    ctx.quadraticCurveTo(0 + mx, my + 1.2, 4 + mx, my);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-3.2 + mx, my);
    ctx.lineTo(-2.2 + mx, my + 3.0);
    ctx.lineTo(-1.2 + mx, my);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(1.2 + mx, my);
    ctx.lineTo(2.2 + mx, my + 3.0);
    ctx.lineTo(3.2 + mx, my);
    ctx.closePath();
    ctx.fill();
  }

  // King of Beasts Blazing Tiger Crown & Raging Golden Aura
  if (isKingOfBeasts && !isAfterimage) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(251, 191, 36, 0.32)';
    ctx.beginPath();
    ctx.arc(0, -20, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-8, -32);
    ctx.lineTo(-15, -44);
    ctx.lineTo(-3, -36);
    ctx.moveTo(8, -32);
    ctx.lineTo(15, -44);
    ctx.lineTo(3, -36);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

function drawHeroAndEffects(ctx: CanvasRenderingContext2D, player: PlayerRenderState, time: number) {
  if (player.isDowned) {
    drawRevivalCircle(ctx, player.x, player.y, player.reviveProgress || 0, time);
    ctx.save();
    ctx.globalAlpha = 0.52 + Math.sin(time * 5) * 0.14;
    if (player.heroId === 'human') {
      drawChibiHumanBody(ctx, player.x, player.y + 6, player.facing, 0, 0.88, false, false, 0, 0, 0, 0, 0);
    } else if (player.heroId === 'ghost') {
      drawChibiGhostBody(ctx, player.x, player.y + 6, player.facing, 0, 0.88, false, false, 0, 0, 0, 0, 0);
    } else if (player.heroId === 'ghoul') {
      drawChibiGhoulBody(ctx, player.x, player.y + 6, player.facing, 0, 0.88, false, false, 0, 0, 0, 0, 0);
    } else if (player.heroId === 'zombie') {
      drawChibiZombieBody(ctx, player.x, player.y + 6, player.facing, 0, 0.88, false, false, 0, 0, 0, 0);
    } else if (player.heroId === 'eaglekin') {
      drawChibiEaglekinBody(ctx, player.x, player.y + 6, player.facing, 0, 0.88, false);
    } else if (player.heroId === 'tigerkin') {
      drawChibiTigerkinBody(ctx, player.x, player.y + 6, player.facing, 0, 0.88, false, false, 0, 0, 0, 0, 0);
    } else {
      drawChibiSkeletonBody(ctx, player.x, player.y + 6, player.facing, 0, 0.88, '#67e8f9', false, '#9a3412', null, 0, 0, 0, 0);
    }
    ctx.restore();
    return;
  }

  const isKingOfBeasts = (player.kingOfBeastsTimer || 0) > 0;
  const isTransformed = player.colossusTimer > 0 || isKingOfBeasts;
  const heroScale = isKingOfBeasts ? 1.55 : isTransformed ? (player.heroId === 'ghoul' ? 1.6 : 1.72) : 1.0;

  if (isTransformed) {
    ctx.save();
    ctx.translate(player.x, player.y + 8);
    if (player.heroId === 'ghoul') {
      // Apex Predator: Pulsing Blood-Moon Hunter Ring & Obsidian Mist!
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(225, 29, 72, 0.24)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 44 + Math.sin(time * 12) * 4, 19, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, 38, 16, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#fda4af';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.ellipse(0, 0, 46, 20, -time * 1.1, 0, Math.PI * 2);
      ctx.stroke();
    } else if (player.heroId === 'zombie') {
      // Abomination Form: Seething mutagenic purple-lime shock aura + toxic spikes!
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(132, 204, 22, 0.22)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 44 + Math.sin(time * 9) * 4, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#a3e635';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 38, 17, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.ellipse(0, 0, 46, 21, time * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 35, 16, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Ghoul Blood Frenzy Aura: Soft, eye-pleasing crimson floor pulse & gentle rising embers
  if (player.heroId === 'ghoul' && player.bloodFrenzyTimer > 0) {
    ctx.save();
    ctx.translate(player.x, player.y + 7);
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.5 + Math.sin(time * 7.5) * 0.25;
    ctx.fillStyle = `rgba(244, 63, 94, ${0.14 + pulse * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, (30 + pulse * 4) * heroScale, 13 * heroScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(251, 113, 133, ${0.42 + Math.min(0.35, player.frenzyStacks * 0.035)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, (28 + pulse * 3) * heroScale, 12 * heroScale, 0, 0, Math.PI * 2);
    ctx.stroke();

    for (let m = 0; m < 3; m++) {
      const cyc = (time * 1.4 + m * 0.33) % 1;
      const mx = Math.cos(m * 2.1 + time * 2.4) * (20 * heroScale);
      const my = -cyc * (34 * heroScale);
      ctx.globalAlpha = Math.sin(cyc * Math.PI) * 0.72;
      ctx.fillStyle = m === 0 ? '#ffe4e6' : '#fb7185';
      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Zombie Undying Flesh Regeneration Aura (Floor Pulse)
  if (player.undyingTimer > 0) {
    ctx.save();
    ctx.translate(player.x, player.y + 6);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(34, 197, 94, 0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 32 + Math.sin(time * 6) * 3, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(74, 222, 128, 0.85)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28 + Math.sin(time * 7) * 3, 12.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

    // Human Survivor's Instinct (Passive 2): Tactical orange-steel awareness compass when surrounded!
  if (player.heroId === 'human' && player.instinctSurrounded) {
    ctx.save();
    ctx.translate(player.x, player.y + 8);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.58)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.ellipse(0, 0, 31, 13.5, time * 1.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let d = 0; d < 4; d++) {
      const da = time * 1.8 + (d * Math.PI) / 2;
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.arc(Math.cos(da) * 31, Math.sin(da) * 13.5, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Human Last Stand / One Man Army Combat Grit Auras
  if (player.heroId === 'human' && (player.lastStandTimer > 0 || player.oneManArmyTimer > 0)) {
    ctx.save();
    ctx.translate(player.x, player.y + 8);
    ctx.globalCompositeOperation = 'lighter';
    const isOMA = player.oneManArmyTimer > 0;
    const pulse = 0.5 + Math.sin(time * 14) * 0.25;
    ctx.fillStyle = isOMA ? 'rgba(251, 146, 60, 0.22)' : 'rgba(249, 115, 22, 0.24)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 36 + pulse * 4, 15.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isOMA ? '#ffffff' : '#fde047';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 32 + pulse * 3, 13.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (player.heroId === 'human') {
    drawChibiHumanBody(
      ctx,
      player.x,
      player.y,
      player.facing,
      player.walkPhase,
      heroScale,
      false,
      player.lastStandTimer > 0 || player.oneManArmyTimer > 0,
      player.hitFlash,
      player.kneeStrikeTimer,
      player.attackLunge,
      player.attackTwist,
      player.attackSquash
    );
  } else if (player.heroId === 'ghost') {
    ctx.save();
    // Ethereal Body shimmer when Ghost phase-evades an incoming physical strike!
    if (player.etherealShimmerTimer > 0) {
      ctx.globalAlpha = 0.45 + Math.sin(time * 28) * 0.2;
    } else {
      ctx.globalAlpha = 0.94;
    }
    drawChibiGhostBody(
      ctx,
      player.x,
      player.y,
      player.facing,
      player.walkPhase,
      heroScale,
      false,
      player.nightmareTimer > 0,
      player.hitFlash,
      player.phantomMistTimer,
      player.attackLunge,
      player.attackTwist,
      player.attackSquash
    );
    ctx.restore();

    // Restless Spirit Passive: Orbiting starlight-teal motes showing intensified spiritual energy!
    if (player.restlessStacks > 0 && player.phantomMistTimer <= 0) {
      ctx.save();
      ctx.translate(player.x, player.y - 12);
      ctx.globalCompositeOperation = 'lighter';
      for (let s = 0; s < player.restlessStacks; s++) {
        const ang = time * 4.4 + (s * Math.PI * 2) / player.restlessStacks;
        const rx = Math.cos(ang) * 26;
        const ry = Math.sin(ang) * 14;
        ctx.fillStyle = s % 2 === 0 ? '#5eead4' : '#c7d2fe';
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(rx, ry, 3.0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  } else if (player.heroId === 'ghoul') {
    ctx.save();
    if (player.stealthTimer > 0) {
      // Shadow Stalker vanish shroud: semi-translucent shadow wraith + swirling obsidian wisps!
      ctx.globalAlpha = 0.36 + Math.sin(time * 18) * 0.08;
    }
    drawChibiGhoulBody(
      ctx,
      player.x,
      player.y,
      player.facing,
      player.walkPhase,
      heroScale,
      false,
      isTransformed,
      player.hitFlash,
      player.airborneHeight,
      player.attackLunge,
      player.attackTwist,
      player.attackSquash
    );
    ctx.restore();

    if (player.stealthTimer > 0 || player.ambushReady) {
      ctx.save();
      ctx.translate(player.x, player.y - 12 * heroScale - player.airborneHeight);
      for (let s = 0; s < 4; s++) {
        const sa = time * 5.2 + (s * Math.PI) / 2;
        ctx.fillStyle = s % 2 === 0 ? 'rgba(15, 23, 42, 0.7)' : 'rgba(225, 29, 72, 0.55)';
        ctx.beginPath();
        ctx.arc(Math.cos(sa) * 20, Math.sin(sa * 1.4) * 11, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  } else if (player.heroId === 'zombie') {
    drawChibiZombieBody(
      ctx,
      player.x,
      player.y,
      player.facing,
      player.walkPhase,
      heroScale,
      false,
      isTransformed,
      player.hitFlash,
      player.attackLunge,
      player.attackTwist,
      player.attackSquash
    );
  } else if (player.heroId === 'eaglekin') {
    drawChibiEaglekinBody(
      ctx,
      player.x,
      player.y,
      player.facing,
      player.walkPhase,
      heroScale,
      false,
      player.hitFlash,
      player.airborneHeight || 0,
      player.wingFlapTimer || 0,
      player.attackLunge,
      player.attackTwist,
      player.attackSquash,
      player.celestialBarrageTimer || 0,
      player.rainOfFeathersTimer || 0,
      player.wrathSkyTimer || 0
    );
  } else if (player.heroId === 'tigerkin') {
    drawChibiTigerkinBody(
      ctx,
      player.x,
      player.y,
      player.facing,
      player.walkPhase,
      heroScale,
      false,
      (player.kingOfBeastsTimer || 0) > 0,
      player.hitFlash,
      player.airborneHeight || 0,
      player.attackLunge,
      player.attackTwist,
      player.attackSquash
    );
  } else {
    drawChibiSkeletonBody(
      ctx,
      player.x,
      player.y,
      player.facing,
      player.walkPhase,
      heroScale,
      isTransformed ? '#fde047' : '#67e8f9',
      false,
      '#9a3412',
      isTransformed ? '#fbbf24' : null,
      player.hitFlash,
      player.attackLunge,
      player.attackTwist,
      player.attackSquash
    );
  }

  // Zombie Undying Flesh Double-Helix Regeneration Strands + Rising '+' Vitality Crosses
  if (player.undyingTimer > 0) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.globalCompositeOperation = 'lighter';

    for (let strand = 0; strand < 2; strand++) {
      ctx.strokeStyle = strand === 0 ? '#4ade80' : '#a3e635';
      ctx.lineWidth = 2.4;
      ctx.globalAlpha = 0.78;
      ctx.beginPath();
      for (let step = 0; step <= 10; step++) {
        const frac = step / 10;
        const ang = time * 6.5 + frac * Math.PI * 2.2 + strand * Math.PI;
        const hx = Math.cos(ang) * (22 * heroScale);
        const hy = 8 - frac * (42 * heroScale) + Math.sin(ang) * 4;
        if (step === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.stroke();
    }

    // 4 rising emerald '+' regeneration crosses
    ctx.fillStyle = '#bbf7d0';
    for (let c = 0; c < 4; c++) {
      const cyc = (time * 1.45 + c * 0.25) % 1;
      const cx = Math.cos(c * 1.9 + time * 1.8) * (20 * heroScale);
      const cy = 4 - cyc * (48 * heroScale);
      ctx.globalAlpha = Math.sin(cyc * Math.PI) * 0.95;
      ctx.fillRect(cx - 1.3, cy - 4.5, 2.6, 9);
      ctx.fillRect(cx - 4.5, cy - 1.3, 9, 2.6);
    }
    ctx.restore();
  }

  // Abomination Form Rising Toxic Steam & Mutagenic Sparks around body
  if (isTransformed && player.heroId === 'zombie') {
    ctx.save();
    ctx.translate(player.x, player.y - 16 * heroScale);
    ctx.globalCompositeOperation = 'lighter';
    for (let m = 0; m < 4; m++) {
      const ma = time * 3.4 + (m * Math.PI) / 2;
      const mx = Math.cos(ma) * 34;
      const my = Math.sin(ma * 1.5) * 18;
      ctx.fillStyle = m % 2 === 0 ? '#a3e635' : '#c084fc';
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.arc(mx, my, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Orbiting Shield: Ribcage Shield (Skeleton) or Hardened Sinew Plates (Zombie)
  if (player.ribShieldTimer > 0 || player.shield > 0 || (player.heroId === 'zombie' && player.undyingTimer > 0)) {
    ctx.save();
    ctx.translate(player.x, player.y - 10 * heroScale - player.airborneHeight);
    const count = 6;
    for (let i = 0; i < count; i++) {
      const ang = time * 3.8 + (i * Math.PI * 2) / count;
      const rx = Math.cos(ang) * (36 * heroScale);
      const ry = Math.sin(ang) * (22 * heroScale);
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(ang + Math.PI / 2);
      ctx.strokeStyle =
        player.heroId === 'ghost'
          ? '#818cf8'
          : player.heroId === 'ghoul'
            ? '#fb7185'
            : player.heroId === 'zombie'
              ? '#4ade80'
              : '#fde68a';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, 9, -0.9, 0.9);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
}

function drawRevivalCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
  time: number
) {
  ctx.save();
  ctx.translate(x, y + 8);

  // Outer glowing pulse ring
  const pulse = Math.sin(time * 6) * 3;
  ctx.strokeStyle = 'rgba(251, 146, 60, 0.45)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 52 + pulse, 24 + pulse * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Gentle rotating dashed spirit runes
  ctx.save();
  ctx.rotate(time * 0.6);
  ctx.strokeStyle = 'rgba(253, 186, 116, 0.35)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.ellipse(0, 0, 44, 20, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Revive channel progress arc
  if (progress > 0) {
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(0, 0, 52, 24, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();

    // Healing spark particles
    for (let s = 0; s < 3; s++) {
      const sa = time * 8 + (s * Math.PI * 2) / 3;
      const srX = Math.cos(sa) * 38;
      const srY = Math.sin(sa) * 18 - 8;
      ctx.fillStyle = '#86efac';
      ctx.beginPath();
      ctx.arc(srX, srY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Floating status indicator
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = progress > 0 ? '#4ade80' : '#fb923c';
  ctx.fillText(
    progress > 0 ? `REVIVING ${Math.round(progress * 100)}%` : 'DOWNED · HOLD NEAR',
    0,
    -34
  );

  ctx.restore();
}

function drawPlayerNameBadge(
  ctx: CanvasRenderingContext2D,
  name: string,
  heroId: HeroId,
  hp: number,
  maxHp: number,
  shield: number,
  x: number,
  y: number,
  isDowned: boolean,
  disconnected = false
) {
  ctx.save();
  ctx.translate(x, y - 44);

  // Badge plate
  const badgeW = 80;
  const badgeH = 16;
  ctx.fillStyle = isDowned
    ? 'rgba(69, 10, 10, 0.88)'
    : disconnected
      ? 'rgba(30, 41, 59, 0.8)'
      : 'rgba(15, 23, 42, 0.8)';
  ctx.beginPath();
  ctx.roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 6);
  ctx.fill();

  ctx.strokeStyle = isDowned
    ? 'rgba(239, 68, 68, 0.65)'
    : heroId === 'tigerkin'
      ? 'rgba(245, 158, 11, 0.65)'
      : heroId === 'eaglekin'
        ? 'rgba(56, 189, 248, 0.55)'
        : heroId === 'human'
          ? 'rgba(251, 146, 60, 0.55)'
          : heroId === 'ghost'
            ? 'rgba(129, 140, 248, 0.55)'
            : heroId === 'ghoul'
              ? 'rgba(251, 113, 133, 0.55)'
              : heroId === 'zombie'
                ? 'rgba(163, 230, 53, 0.55)'
                : 'rgba(103, 232, 249, 0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Name text
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isDowned ? '#fca5a5' : disconnected ? '#cbd5e1' : '#f8fafc';
  const label = disconnected ? `${name.slice(0, 7)}…` : name.slice(0, 11);
  ctx.fillText(label, 0, 0);

  // Mini health + shield bar under badge if alive
  if (!isDowned) {
    const barW = 48;
    const hpRatio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
    const shieldRatio = Math.max(0, Math.min(1, shield / Math.max(1, maxHp)));
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(-barW / 2, 10, barW, 3.5);

    ctx.fillStyle = hpRatio > 0.35 ? '#22c55e' : '#ef4444';
    ctx.fillRect(-barW / 2, 10, barW * hpRatio, 3.5);

    if (shieldRatio > 0) {
      ctx.fillStyle = 'rgba(253, 224, 71, 0.85)';
      ctx.fillRect(-barW / 2, 10, barW * shieldRatio, 3.5);
    }
  }

  ctx.restore();
}

function drawRemotePlayerAndEffects(
  ctx: CanvasRenderingContext2D,
  p: RemotePlayerRenderState,
  time: number
) {
  if (p.isDowned) {
    drawHeroAndEffects(ctx, p, time);
    drawPlayerNameBadge(ctx, p.name, p.heroId, p.hp, p.maxHp, p.shield, p.x, p.y, true, p.disconnected);
    return;
  }

  ctx.save();
  if (p.disconnected) {
    ctx.globalAlpha = 0.55;
  }
  if (p.possessingTimer <= 0) {
    drawHeroAndEffects(ctx, p, time);
  }
  ctx.restore();

  const badgeOffsetY = p.colossusTimer > 0 ? p.y - 18 : p.y - (p.airborneHeight || 0);
  drawPlayerNameBadge(
    ctx,
    p.name,
    p.heroId,
    p.hp,
    p.maxHp,
    p.shield,
    p.x,
    badgeOffsetY,
    false,
    p.disconnected
  );
}

function renderSingleSwordRibbonPass(ctx: CanvasRenderingContext2D, pts: SwordTrailPoint[]) {
  if (pts.length < 2) return;
  pts.sort((a, b) => b.age - a.age);

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    // Prevent dashes/blinks from stretching long lines across the room
    const distSq = (p1.tipX - p0.tipX) ** 2 + (p1.tipY - p0.tipY) ** 2;
    if (distSq > 86 * 86) continue;

    const r0 = Math.max(0, 1 - p0.age / p0.maxAge);
    const r1 = Math.max(0, 1 - p1.age / p1.maxAge);
    if (r1 <= 0) continue;

    // Smoothly taper ribbon thickness toward 0 at tail so ribbons look like flowing silk
    const w0 = Math.pow(r0, 0.75);
    const w1 = Math.pow(r1, 0.75);
    const b0x = p0.tipX + (p0.baseX - p0.tipX) * w0;
    const b0y = p0.tipY + (p0.baseY - p0.tipY) * w0;
    const b1x = p1.tipX + (p1.baseX - p1.tipX) * w1;
    const b1y = p1.tipY + (p1.baseY - p1.tipY) * w1;

    ctx.fillStyle = p1.glowColor;
    ctx.globalAlpha = r1 * (p1.isSkillTrail ? 0.44 : 0.28);
    ctx.beginPath();
    ctx.moveTo(b0x, b0y);
    ctx.lineTo(p0.tipX, p0.tipY);
    ctx.lineTo(p1.tipX, p1.tipY);
    ctx.lineTo(b1x, b1y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = p1.color;
    ctx.lineCap = 'round';
    ctx.globalAlpha = r1 * (p1.isSkillTrail ? 0.76 : 0.56);
    ctx.lineWidth = (p1.isSkillTrail ? 2.6 : 1.7) * Math.sqrt(r1);
    ctx.beginPath();
    ctx.moveTo(p0.tipX, p0.tipY);
    ctx.lineTo(p1.tipX, p1.tipY);
    ctx.stroke();
  }
}

function drawSwordRibbonTrail(ctx: CanvasRenderingContext2D, trail: SwordTrailPoint[]) {
  scratchTrailPts.length = 0;
  scratchTrailOffhand.length = 0;
  for (let i = 0; i < trail.length; i++) {
    const pt = trail[i];
    if (!pt.active) continue;
    if (pt.hand === 1) {
      scratchTrailOffhand.push(pt);
    } else {
      scratchTrailPts.push(pt);
    }
  }
  if (scratchTrailPts.length < 2 && scratchTrailOffhand.length < 2) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  renderSingleSwordRibbonPass(ctx, scratchTrailPts);
  renderSingleSwordRibbonPass(ctx, scratchTrailOffhand);
  ctx.restore();
}

function drawSingleGhoulFeralClaw(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  scale: number,
  glowColor: string,
  glowIntensity: number,
  isApex: boolean,
  ambushReady: boolean,
  mirror: 1 | -1
) {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 20, 8.5 * scale, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(angle);
  ctx.scale(scale, scale * mirror);

  if (glowIntensity > 0.08 || ambushReady) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(0.65, (ambushReady ? 0.55 : glowIntensity * 0.38));
    ctx.fillStyle = ambushReady ? '#e11d48' : glowColor;
    ctx.beginPath();
    ctx.ellipse(16, 0, isApex ? 28 : 22, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Obsidian knuckle-guard crescent
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#fda4af';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-4, -9);
  ctx.quadraticCurveTo(7, 0, -4, 9);
  ctx.quadraticCurveTo(1, 0, -4, -9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Blood-ruby predator core
  ctx.fillStyle = isApex ? '#fde047' : '#f43f5e';
  ctx.beginPath();
  ctx.arc(2, 0, 2.8, 0, Math.PI * 2);
  ctx.fill();

  // 3 elongated razor-curved obsidian-crimson predator talons!
  const bladeLen = isApex ? 42 : 33;
  const offsets = [-6.2, 0, 6.2];
  for (let i = 0; i < 3; i++) {
    const oy = offsets[i];
    const tipL = i === 1 ? bladeLen : bladeLen - 7;
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(3, oy - 2.2);
    ctx.quadraticCurveTo(tipL * 0.55, oy - 5.2, tipL, oy + 2.6);
    ctx.quadraticCurveTo(tipL * 0.52, oy + 0.8, 3, oy + 2.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Razor crimson-silver cutting edge
    ctx.strokeStyle = i === 1 ? '#ffe4e6' : '#fb7185';
    ctx.lineWidth = i === 1 ? 1.8 : 1.4;
    ctx.beginPath();
    ctx.moveTo(8, oy - 1.8);
    ctx.quadraticCurveTo(tipL * 0.56, oy - 4.0, tipL - 1, oy + 2.2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSingleTigerkinClaw(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  scale: number,
  glowColor: string,
  glowIntensity: number,
  isKing: boolean,
  momentumStacks: number,
  mirror: 1 | -1
) {
  ctx.save();
  ctx.translate(x, y);

  // Soft ambient ground shadow underneath the floating claw
  ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
  ctx.beginPath();
  ctx.ellipse(0, 19, 9 * scale, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(angle);
  ctx.scale(scale, scale * mirror);

  // Feral Amber Beast Glow / King of Beasts blazing solar corona
  if (glowIntensity > 0.05 || isKing || momentumStacks > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const auraAlpha = isKing ? 0.65 : Math.min(0.55, 0.15 + momentumStacks * 0.08 + glowIntensity * 0.35);
    ctx.globalAlpha = auraAlpha;
    const clawGlow = ctx.createRadialGradient(16, 0, 2, 16, 0, isKing ? 36 : 26);
    clawGlow.addColorStop(0, '#fef08a');
    clawGlow.addColorStop(0.5, '#f59e0b');
    clawGlow.addColorStop(1, 'rgba(234, 88, 12, 0)');
    ctx.fillStyle = clawGlow;
    ctx.beginPath();
    ctx.ellipse(16, 0, isKing ? 34 : 26, isKing ? 16 : 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Beastkin Brass Tiger-Jaw Gauntlet Plate (sturdy knuckle guard with carved feline fangs)
  ctx.fillStyle = '#78350f';
  ctx.strokeStyle = isKing ? '#fef08a' : '#d97706';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-6, -11);
  ctx.quadraticCurveTo(8, 0, -6, 11);
  ctx.quadraticCurveTo(2, 0, -6, -11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Brass gauntlet fang inlays
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.moveTo(-2, -7); ctx.lineTo(3, -7); ctx.lineTo(0, -3); ctx.closePath();
  ctx.moveTo(-2, 7); ctx.lineTo(3, 7); ctx.lineTo(0, 3); ctx.closePath();
  ctx.fill();

  // Pulsing Amber Tiger-Eye core gem
  ctx.fillStyle = isKing ? '#fef08a' : '#f59e0b';
  ctx.beginPath();
  ctx.arc(2.5, 0, isKing ? 3.8 : 3.0, 0, Math.PI * 2);
  ctx.fill();
  // Feral slit pupil
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.ellipse(2.5, 0, 0.9, isKing ? 3.0 : 2.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 4 Broad, Razor-Curved Golden Feline Talons!
  const talonLen = isKing ? 44 : 34;
  const talonOffsets = [-7.5, -2.5, 2.5, 7.5];
  for (let i = 0; i < 4; i++) {
    const oy = talonOffsets[i];
    // Center claws are slightly longer, outer claws curve dynamically
    const isCenter = i === 1 || i === 2;
    const curLen = isCenter ? talonLen : talonLen - 6;
    const curveD = oy * 0.35;

    // Heavy amber-bronze talon core
    ctx.fillStyle = isKing ? '#fbbf24' : '#d97706';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(3, oy - 2.0);
    ctx.quadraticCurveTo(curLen * 0.52, oy - 4.5 + curveD, curLen, oy + 2.5 + curveD);
    ctx.quadraticCurveTo(curLen * 0.50, oy + 1.2 + curveD, 3, oy + 2.0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Razor golden-white cutting edge
    ctx.strokeStyle = isKing ? '#ffffff' : (isCenter ? '#fef08a' : '#fbbf24');
    ctx.lineWidth = isCenter ? 1.8 : 1.4;
    ctx.beginPath();
    ctx.moveTo(7, oy - 1.6);
    ctx.quadraticCurveTo(curLen * 0.55, oy - 3.5 + curveD, curLen - 1, oy + 2.2 + curveD);
    ctx.stroke();
  }

  ctx.restore();
}

function drawGhostSoulLanternAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  swayAngle: number,
  scale: number,
  glowColor: string,
  glowIntensity: number,
  isNightmare: boolean,
  time: number
) {
  ctx.save();
  ctx.translate(x, y);

  // Soft ectoplasm floor glow under floating lantern
  ctx.fillStyle = 'rgba(94, 234, 212, 0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 24, 9 * scale, 3.8, 0, 0, Math.PI * 2);
  ctx.fill();

  const sway = Math.sin(time * 4.2) * 0.12 + swayAngle * 0.35;
  ctx.rotate(sway);
  ctx.scale(scale, scale);

  const flameOuter = isNightmare ? '#c084fc' : '#2dd4bf';
  const flameInner = '#e0e7ff';

  // GPU-friendly additive astral halo around lantern
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(0.68, 0.28 + glowIntensity * 0.32);
  ctx.fillStyle = glowColor;
  ctx.beginPath();
  ctx.arc(0, 2, 18, 0, Math.PI * 2);
  ctx.fill();

  // Channeling rune ring when casting or firing homing wisps!
  if (glowIntensity > 0.45) {
    ctx.strokeStyle = '#5eead4';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 2, 16, 7.5, time * 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Top suspension ring
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, -13.5, 3.2, 0, Math.PI * 2);
  ctx.stroke();

  // Pointed wrought-iron astral lantern roof
  ctx.fillStyle = '#1e1b4b';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(9.5, -4.5);
  ctx.lineTo(-9.5, -4.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Translucent crystal chamber housing flickering soul flame
  ctx.fillStyle = 'rgba(49, 46, 129, 0.55)';
  ctx.beginPath();
  ctx.moveTo(-7.5, -4.5);
  ctx.lineTo(7.5, -4.5);
  ctx.lineTo(5.8, 9.5);
  ctx.lineTo(-5.8, 9.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Flickering Will-o'-Wisp Soul Flame inside the cage!
  const flicker = Math.sin(time * 16) * 1.4;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = flameOuter;
  ctx.beginPath();
  ctx.moveTo(0, -3.5 + flicker * 0.5);
  ctx.quadraticCurveTo(5.2, 2.5, 0, 8.2);
  ctx.quadraticCurveTo(-5.2, 2.5, 0, -3.5 + flicker * 0.5);
  ctx.fill();

  ctx.fillStyle = flameInner;
  ctx.beginPath();
  ctx.arc(0, 3.2, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Bottom lantern base + hanging spirit chime crystal
  ctx.fillStyle = '#1e1b4b';
  ctx.strokeStyle = '#94a3b8';
  ctx.beginPath();
  ctx.roundRect(-6.5, 9.5, 13, 3.2, 1.5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#5eead4';
  ctx.beginPath();
  ctx.moveTo(0, 13);
  ctx.lineTo(2.6, 16.8);
  ctx.lineTo(0, 20.5);
  ctx.lineTo(-2.6, 16.8);
  ctx.closePath();
  ctx.fill();

  // 2 tiny orbiting spirit sparks around the lantern
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let m = 0; m < 2; m++) {
    const ma = time * 5.2 + m * Math.PI;
    const mx = Math.cos(ma) * 14;
    const my = 2 + Math.sin(ma * 1.5) * 7;
    ctx.fillStyle = m === 0 ? '#5eead4' : '#c7d2fe';
    ctx.beginPath();
    ctx.arc(mx, my, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();
}

function drawFloatingGhostLantern(
  ctx: CanvasRenderingContext2D,
  player: PlayerRenderState,
  time: number
) {
  drawGhostSoulLanternAt(
    ctx,
    player.swordX,
    player.swordY - player.airborneHeight,
    player.swordAngle,
    player.swordScale,
    player.swordGlowColor,
    player.swordGlowIntensity,
    player.nightmareTimer > 0,
    time
  );
}

/**
 * Cute Chibi Human – Pipe Brawler
 * Cozy oversized round head, messy chestnut street-survivor hair, cute cross-bandage,
 * rugged slate-olive survivor jacket + orange hoodie scarf, two stubby steel-toe boots
 * (with dynamic chibi knee-strike animation!), and strictly NO ARMS!
 */
function drawChibiHumanBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  walkPhase: number,
  scale: number,
  isAfterimage: boolean,
  isEmpowered: boolean,
  hitFlash = 0,
  kneeStrikeTimer = 0,
  attackLunge = 0,
  attackTwist = 0,
  attackSquash = 0
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const isMoving = Math.abs(Math.sin(walkPhase)) > 0.01;
  const idleBreath = Math.sin(performance.now() * 0.0042) * 1.0;
  const bob = isMoving ? Math.abs(Math.sin(walkPhase)) * -3.2 : idleBreath;
  const footSwing = Math.sin(walkPhase) * 6.0 + attackTwist * 3.8;

  if (!isAfterimage) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.beginPath();
    ctx.ellipse(0, 12.5, 16, 6.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const bootFill = hitFlash > 0 ? '#ffffff' : isAfterimage ? '#fb923c' : '#451a03';
  const skinFill = hitFlash > 0 ? '#ffffff' : isAfterimage ? '#fdba74' : '#fed7aa';

  // Two cute stubby survivor boots (strictly NO ARMS! Right boot thrusts forward during Street Fighter knee strike!)
  const kneeBoost = kneeStrikeTimer > 0 ? Math.sin(Math.min(1, kneeStrikeTimer / 0.18) * Math.PI) : 0;
  const kneeX = Math.cos(facing) * kneeBoost * 11;
  const kneeY = -kneeBoost * 7 + Math.sin(facing) * kneeBoost * 4;

  ctx.fillStyle = bootFill;
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 2;

  // Left stubby boot
  ctx.beginPath();
  ctx.ellipse(
    -6.2 + footSwing * 0.45,
    9.2 - Math.max(0, footSwing * 0.45),
    4.6,
    5.4,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  // Right stubby boot (doubles as Street Fighter knee-smash!)
  ctx.beginPath();
  ctx.ellipse(
    6.2 - footSwing * 0.45 + kneeX,
    9.2 - Math.max(0, -footSwing * 0.45) + kneeY,
    4.6 + kneeBoost * 1.2,
    5.4 + kneeBoost * 0.8,
    kneeBoost * 0.35,
    0,
    Math.PI * 2
  );
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  // Steel-toe cap highlights on boots
  if (!isAfterimage && hitFlash <= 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(-6.2 + footSwing * 0.45, 11.2 - Math.max(0, footSwing * 0.45), 2.1, 0, Math.PI * 2);
    ctx.arc(6.2 - footSwing * 0.45 + kneeX, 11.2 - Math.max(0, -footSwing * 0.45) + kneeY, 2.1 + kneeBoost * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(
    Math.cos(facing) * attackLunge * 5.2,
    bob + Math.sin(facing) * attackLunge * 3.0 - kneeBoost * 2.5
  );
  ctx.rotate(attackTwist * 0.14 + Math.cos(facing) * attackLunge * 0.08);
  ctx.scale(1 + attackSquash, 1 - attackSquash * 0.85);

  // Rugged Chibi Street-Survivor Jacket Torso (NO ARMS!)
  ctx.fillStyle = hitFlash > 0 ? '#ffffff' : isAfterimage ? '#fb923c' : '#334155';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-9.2, -5.8, 18.4, 13.4, 5.5);
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  // Warm orange inner hoodie zip stripe + utility belt buckle
  if (!isAfterimage && hitFlash <= 0) {
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(-2.4, -5, 4.8, 11.5);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-8.6, 3.2, 17.2, 2.8);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-2.2, 2.9, 4.4, 3.4);
  }

  // Cozy fluttering survivor hoodie-scarf collar
  if (!isAfterimage) {
    const tailDir = -Math.cos(facing);
    ctx.fillStyle = isEmpowered ? '#f97316' : '#c2410c';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(tailDir * 5, -5.5);
    ctx.quadraticCurveTo(tailDir * 16.5, -3.5 - attackTwist * 3, tailDir * 14.5, 4.5);
    ctx.lineTo(tailDir * 6, 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(-9.8, -8.4, 19.6, 5.4, 3);
    ctx.fill();
    ctx.stroke();
  }

  // Cute oversized round chibi Human head
  const lookX = Math.cos(facing) * 3.0;
  const lookY = Math.sin(facing) * 1.8;

  ctx.fillStyle = skinFill;
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, -19, 14.5, 0, Math.PI * 2);
  ctx.fill();
  if (!isAfterimage) ctx.stroke();

  // Messy chestnut/umber spiky street-brawler hair cap & bangs!
  if (!isAfterimage) {
    ctx.fillStyle = hitFlash > 0 ? '#ffffff' : '#451a03';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.arc(0, -20.5, 14.9, Math.PI * 0.94, Math.PI * 2.06);
    // Spiky survivor bangs across forehead
    ctx.lineTo(13.5, -20);
    ctx.lineTo(9.5, -23.5);
    ctx.lineTo(6.2, -19.8);
    ctx.lineTo(1.8, -24.2);
    ctx.lineTo(-2.4, -19.5);
    ctx.lineTo(-7.2, -24.0);
    ctx.lineTo(-11.2, -20.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cute spiky hair cowlick tuft on top!
    ctx.beginPath();
    ctx.moveTo(-3, -33.5);
    ctx.lineTo(1.5, -39.5);
    ctx.lineTo(4.5, -34.2);
    ctx.lineTo(8.5, -37.5);
    ctx.lineTo(6.5, -32.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Warm rosy cheeks + scrappy survivor cross-bandage on cheek!
  if (!isAfterimage && hitFlash <= 0) {
    ctx.fillStyle = 'rgba(249, 115, 22, 0.28)';
    ctx.beginPath();
    ctx.ellipse(-8.6 + lookX * 0.35, -14.2 + lookY * 0.3, 2.7, 1.5, 0, 0, Math.PI * 2);
    ctx.ellipse(8.6 + lookX * 0.35, -14.2 + lookY * 0.3, 2.7, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cute white adhesive strip bandage on upper-left cheek/temple
    ctx.save();
    ctx.translate(-8.2 + lookX * 0.35, -21.8 + lookY * 0.25);
    ctx.rotate(-0.35);
    ctx.fillStyle = '#fef3c7';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.roundRect(-3.6, -1.6, 7.2, 3.2, 1);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Determined chibi survivor eyes + crisp catchlights!
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.ellipse(-5.1 + lookX * 0.55, -17.6 + lookY * 0.45, 3.2, 3.7, 0, 0, Math.PI * 2);
  ctx.ellipse(5.1 + lookX * 0.55, -17.6 + lookY * 0.45, 3.2, 3.7, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isEmpowered && !isAfterimage) {
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(-5.1 + lookX * 0.75, -17.3 + lookY * 0.55, 1.8, 0, Math.PI * 2);
    ctx.arc(5.1 + lookX * 0.75, -17.3 + lookY * 0.55, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-5.9 + lookX * 0.75, -18.8 + lookY * 0.55, 1.15, 0, Math.PI * 2);
  ctx.arc(4.3 + lookX * 0.75, -18.8 + lookY * 0.55, 1.15, 0, Math.PI * 2);
  ctx.fill();

  // Determined furrowed eyebrows & confident street-brawler smirk!
  if (!isAfterimage) {
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7.8 + lookX * 0.5, -22.2 + lookY * 0.4);
    ctx.lineTo(-2.6 + lookX * 0.5, -21.0 + lookY * 0.4);
    ctx.moveTo(7.8 + lookX * 0.5, -22.2 + lookY * 0.4);
    ctx.lineTo(2.6 + lookX * 0.5, -21.0 + lookY * 0.4);
    ctx.stroke();

    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(-2.8 + lookX * 0.5, -11.8 + lookY * 0.35);
    ctx.quadraticCurveTo(0.5 + lookX * 0.5, -10.5 + lookY * 0.35, 3.6 + lookX * 0.5, -12.4 + lookY * 0.35);
    ctx.stroke();
  }

  ctx.restore();
  ctx.restore();
}

function drawSteelPipeGraphic(
  ctx: CanvasRenderingContext2D,
  glowColor: string,
  glowIntensity: number,
  twoHandGrit: boolean
) {
  if (glowIntensity > 0.08) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(0.52, glowIntensity * 0.34);
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.ellipse(16, 0, 28, 9.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Threaded rear pommel cap
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(-15, -3.8, 4.5, 7.6, 1.5);
  ctx.fill();
  ctx.stroke();

  // Main battered galvanized steel pipe shaft
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.roundRect(-11, -3.2, 43, 6.4, 1.5);
  ctx.fill();
  ctx.stroke();

  // Metallic top highlight + weathered rust patch for authentic scrap-pipe character
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-10, -2.2, 41, 1.8);
  ctx.fillStyle = '#9a3412';
  ctx.fillRect(10, 0.4, 7.5, 1.8);
  ctx.fillRect(22, -1.2, 4.5, 1.6);

  // Wrapped athletic street-fighter grip tape near handle
  ctx.fillStyle = '#d97706';
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 1.2;
  ctx.fillRect(-9.5, -3.5, 13.5, 7.0);
  ctx.strokeRect(-9.5, -3.5, 13.5, 7.0);
  ctx.beginPath();
  ctx.moveTo(-5.5, -3.5);
  ctx.lineTo(-3.5, 3.5);
  ctx.moveTo(-1.0, -3.5);
  ctx.lineTo(1.0, 3.5);
  ctx.stroke();

  // Heavy cast-iron plumber T-joint collar & threaded battering head at tip!
  ctx.fillStyle = '#64748b';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.roundRect(27, -6.2, 9.5, 12.4, 2);
  ctx.fill();
  ctx.stroke();

  // Flanged pipe collar rim + hollow dark bore opening
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(28.5, -5.0, 6.5, 2.2);
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(36.2, 0, 1.4, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Two-point golden grit rings on grip during Last Stand ("grips the old pipe with both hands")
  if (twoHandGrit) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(-6.5, 0, 2.8, 6.5, 0, 0, Math.PI * 2);
    ctx.ellipse(0.5, 0, 2.8, 6.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPipeStrikeEffects(ctx: CanvasRenderingContext2D, strikes: PipeStrikeEffect[]) {
  for (let i = 0; i < strikes.length; i++) {
    const s = strikes[i];
    if (!s.active) continue;
    const p = Math.min(1, s.age / s.maxAge);
    const fade = Math.pow(Math.max(0, 1 - p), 1.35);
    const easeOut = 1 - Math.pow(1 - p, 3);

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    if (s.kind === 'basic_jab') {
      // Human Basic Hit 1 & 2: Ultra-smooth, high-velocity curved steel pipe swing slash arc!
      // Perfectly aligned with the swinging weapon trajectory (forehand side=1, backhand side=-1)
      const reach = s.radius * (0.82 + 0.22 * easeOut);
      const side = s.direction;
      const arcSpan = 2.15; // ~123° wide sweeping arc matching pipe swing span
      const headAngle = (-0.5 + 1.0 * easeOut) * arcSpan * side;
      const tailAngle = headAngle - 0.78 * arcSpan * side;
      const a0 = Math.min(headAngle, tailAngle);
      const a1 = Math.max(headAngle, tailAngle);

      // 1. Soft glowing amber-orange kinetic sweep trail
      drawSilkyCrescentArc(
        ctx,
        reach * 1.02,
        a0 - 0.04,
        a1 + 0.04,
        18 * (0.55 + 0.45 * fade),
        s.primaryColor,
        '#ea580c',
        fade * 0.45
      );

      // 2. High-speed white/chrome pipe swing cutting crescent
      drawSilkyCrescentArc(
        ctx,
        reach,
        a0,
        a1,
        13 * (0.6 + 0.4 * fade),
        '#ffffff',
        s.primaryColor,
        fade * 0.95
      );

      // 3. Concentric curved steel speed arcs following the pipe's rotational path
      const arcWidth = 2.4 * fade;
      ctx.lineWidth = arcWidth;
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = fade * 0.88;
      ctx.beginPath();
      ctx.arc(0, 0, reach * 0.94, a0 + 0.05, a1 - 0.05);
      ctx.stroke();

      ctx.lineWidth = 1.6 * fade;
      ctx.strokeStyle = s.secondaryColor;
      ctx.globalAlpha = fade * 0.72;
      ctx.beginPath();
      ctx.arc(0, 0, reach * 1.04, a0 + 0.1, a1 - 0.02);
      ctx.stroke();

      // 4. Centrifugal tangential friction sparks along the sweeping arc
      const sparkCount = 4;
      for (let k = 0; k < sparkCount; k++) {
        const sparkT = k / (sparkCount - 1);
        const sparkAng = a0 + sparkT * (a1 - a0);
        const sr = reach * (0.95 + 0.08 * Math.sin(k * 2.1));
        const sx = Math.cos(sparkAng) * sr;
        const sy = Math.sin(sparkAng) * sr;
        const tangA = sparkAng + (Math.PI * 0.5) * side + 0.22 * Math.sin(k * 3.4);
        const sLen = (7 + 6 * (1 - sparkT)) * fade;
        ctx.strokeStyle = k === 0 ? '#ffffff' : s.primaryColor;
        ctx.lineWidth = (k === 0 ? 2.2 : 1.5) * fade;
        ctx.globalAlpha = fade * (0.6 + 0.4 * (1 - sparkT));
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(tangA) * sLen, sy + Math.sin(tangA) * sLen);
        ctx.stroke();
      }

      // 5. Brilliant metallic impact glint at the sweeping pipe head
      const hx = Math.cos(headAngle) * reach;
      const hy = Math.sin(headAngle) * reach;
      const starR = (13 + 7 * easeOut) * fade;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = fade * 0.95;
      ctx.beginPath();
      for (let v = 0; v < 8; v++) {
        const va = (v * Math.PI) / 4 + headAngle;
        const vr = v % 2 === 0 ? starR : starR * 0.28;
        const vx = hx + Math.cos(va) * vr;
        const vy = hy + Math.sin(va) * vr;
        if (v === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
      ctx.fill();

      // Small high-energy flash disc at pipe head
      ctx.fillStyle = s.primaryColor;
      ctx.globalAlpha = fade * 0.82;
      ctx.beginPath();
      ctx.arc(hx, hy, starR * 0.45, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.kind === 'basic_batter') {
      // Human Basic Hit 3: Massive Roundhouse Cleave!
      // A crushing, wide-angle 230° heavy industrial crescent sweep with outer shockwave ripples
      const reach = s.radius * (0.82 + 0.26 * easeOut);
      const arcSpan = Math.PI * 1.32; // ~237° heavy cleave
      const headAngle = (-0.5 + 1.0 * easeOut) * arcSpan;
      const tailAngle = headAngle - 0.92 * arcSpan;
      const a0 = Math.min(headAngle, tailAngle);
      const a1 = Math.max(headAngle, tailAngle);

      // 1. Heavy fiery outer blast crescent
      drawSilkyCrescentArc(
        ctx,
        reach * 1.06,
        a0 - 0.06,
        a1 + 0.06,
        24 * (0.6 + 0.4 * fade),
        s.primaryColor,
        '#ea580c',
        fade * 0.55
      );

      // 2. Main crushing chrome-orange heavy crescent
      drawSilkyCrescentArc(
        ctx,
        reach,
        a0,
        a1,
        18 * (0.65 + 0.35 * fade),
        '#fff7ed',
        s.primaryColor,
        fade * 0.96
      );

      // 3. Inner high-heat white cutting arc
      drawSilkyCrescentArc(
        ctx,
        reach * 0.88,
        a0 + 0.08,
        a1 - 0.08,
        9 * fade,
        '#ffffff',
        '#fdba74',
        fade * 0.8
      );

      // 4. Double concentric shockwave ripples curving along the circumference
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.2 * fade;
      ctx.globalAlpha = fade * 0.9;
      ctx.beginPath();
      ctx.arc(0, 0, reach * 0.96, a0 + 0.04, a1 - 0.04);
      ctx.stroke();

      ctx.strokeStyle = s.primaryColor;
      ctx.lineWidth = 2.0 * fade;
      ctx.globalAlpha = fade * 0.75;
      ctx.beginPath();
      ctx.arc(0, 0, reach * 1.1, a0 + 0.12, a1);
      ctx.stroke();

      // 5. Heavy centrifugal sparks along the wide roundhouse perimeter
      const sparkCount = 6;
      for (let k = 0; k < sparkCount; k++) {
        const st = k / (sparkCount - 1);
        const sa = a0 + st * (a1 - a0);
        const sr = reach * (0.94 + 0.12 * Math.sin(k * 1.9));
        const sx = Math.cos(sa) * sr;
        const sy = Math.sin(sa) * sr;
        const tangA = sa + Math.PI * 0.5 + 0.3 * Math.sin(k * 2.8);
        const sLen = (9 + 8 * (1 - st)) * fade;
        ctx.strokeStyle = k % 2 === 0 ? '#ffffff' : s.primaryColor;
        ctx.lineWidth = (k % 2 === 0 ? 2.6 : 1.8) * fade;
        ctx.globalAlpha = fade * 0.85;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(tangA) * sLen, sy + Math.sin(tangA) * sLen);
        ctx.stroke();
      }

      // 6. Crushing 8-point heavy metallic clang star at focal point
      const fx = Math.cos(headAngle * 0.7) * reach;
      const fy = Math.sin(headAngle * 0.7) * reach;
      const burstR = (18 + 12 * easeOut) * fade;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = fade * 0.95;
      ctx.beginPath();
      for (let v = 0; v < 16; v++) {
        const va = (v * Math.PI) / 8 + headAngle;
        const vr = v % 2 === 0 ? burstR : burstR * 0.24;
        const vx = fx + Math.cos(va) * vr;
        const vy = fy + Math.sin(va) * vr;
        if (v === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
      ctx.fill();

      // Inner flash disc
      ctx.fillStyle = '#f97316';
      ctx.globalAlpha = fade * 0.85;
      ctx.beginPath();
      ctx.arc(fx, fy, burstR * 0.42, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.kind === 'pipe_swing_cone') {
      // Normal 1 (Pipe Swing): Wide horizontal knockback pressure fan + flying wind-chevrons!
      const reach = s.radius * (0.42 + 0.62 * easeOut);
      const halfSpan = Math.PI * 0.36;

      // Polygonal faceted air-blast fan (straight segments emphasizing industrial blunt force)
      ctx.globalAlpha = fade * 0.28;
      ctx.fillStyle = s.primaryColor;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      for (let st = 0; st <= 6; st++) {
        const a = -halfSpan + (st / 6) * halfSpan * 2;
        ctx.lineTo(Math.cos(a) * reach, Math.sin(a) * reach);
      }
      ctx.closePath();
      ctx.fill();

      // Radial kinetic knockback speed-rays + outer V-chevrons pushing enemies back!
      for (let r = -2; r <= 2; r++) {
        const ra = r * 0.25;
        const rLen = reach * (r === 0 ? 1.06 : 0.95);
        ctx.strokeStyle = r % 2 === 0 ? '#ffffff' : s.secondaryColor;
        ctx.lineWidth = (r === 0 ? 3.6 : 2.4) * fade;
        ctx.globalAlpha = fade * 0.9;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ra) * 24, Math.sin(ra) * 24);
        ctx.lineTo(Math.cos(ra) * rLen, Math.sin(ra) * rLen);
        ctx.stroke();

        // Outward knockback arrow-chevron at ray tip
        const tx = Math.cos(ra) * rLen;
        const ty = Math.sin(ra) * rLen;
        ctx.strokeStyle = s.primaryColor;
        ctx.lineWidth = 2.8 * fade;
        ctx.beginPath();
        ctx.moveTo(tx - Math.cos(ra - 0.5) * 12, ty - Math.sin(ra - 0.5) * 12);
        ctx.lineTo(tx, ty);
        ctx.lineTo(tx - Math.cos(ra + 0.5) * 12, ty - Math.sin(ra + 0.5) * 12);
        ctx.stroke();
      }
    } else if (s.kind === 'headcracker_anvil') {
      // Normal 2 (Headcracker): Overhead vertical guillotine drop-streaks + skull-cracking concussion burst!
      ctx.rotate(-s.angle); // World-upright vertical overhead smash!
      const dropH = s.radius * (1.15 - 0.55 * easeOut);

      // Vertical downward steel drop-columns
      ctx.globalAlpha = fade * 0.42;
      ctx.fillStyle = s.primaryColor;
      ctx.fillRect(-16 * fade, -dropH, 32 * fade, dropH);

      ctx.globalAlpha = fade * 0.95;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4.2 * fade;
      ctx.beginPath();
      ctx.moveTo(0, -dropH - 18);
      ctx.lineTo(0, 4);
      ctx.stroke();

      ctx.strokeStyle = s.secondaryColor;
      ctx.lineWidth = 2.4 * fade;
      ctx.beginPath();
      ctx.moveTo(-11, -dropH * 0.85);
      ctx.lineTo(-11, -2);
      ctx.moveTo(11, -dropH * 0.85);
      ctx.lineTo(11, -2);
      ctx.stroke();

      // Blinding 8-point concussion star at impact point!
      const burstR = (26 + 18 * easeOut) * fade;
      ctx.fillStyle = s.secondaryColor;
      ctx.beginPath();
      for (let k = 0; k < 16; k++) {
        const ka = (k * Math.PI) / 8;
        const kr = k % 2 === 0 ? burstR : burstR * 0.25;
        const kx = Math.cos(ka) * kr;
        const ky = Math.sin(ka) * kr * 0.72;
        if (k === 0) ctx.moveTo(kx, ky);
        else ctx.lineTo(kx, ky);
      }
      ctx.closePath();
      ctx.fill();
    } else if (s.kind === 'knee_burst') {
      // Normal 5 Beat 3 (Street Fighter Knee Strike): Punchy close-range V-shockwave + compression diamond!
      const reach = s.radius * (0.4 + 0.65 * easeOut);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4.0 * fade;
      ctx.globalAlpha = fade * 0.95;
      ctx.beginPath();
      ctx.moveTo(8, -22 * easeOut);
      ctx.lineTo(reach, 0);
      ctx.lineTo(8, 22 * easeOut);
      ctx.stroke();

      ctx.fillStyle = s.primaryColor;
      ctx.globalAlpha = fade * 0.75;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(reach * 0.65, -13 * fade);
      ctx.lineTo(reach * 1.05, 0);
      ctx.lineTo(reach * 0.65, 13 * fade);
      ctx.closePath();
      ctx.fill();
    } else if (s.kind === 'street_sweep' || s.kind === 'oma_tornado') {
      // Street Fighter 360° Finisher / One Man Army Tornado Spin: Faceted polygonal steel cyclone + tangential spark jets!
      const isTornado = s.kind === 'oma_tornado';
      const sides = isTornado ? 12 : 8;
      const curR = s.radius * (0.38 + 0.66 * easeOut);

      for (let ring = 0; ring < (isTornado ? 3 : 2); ring++) {
        const rr = curR * (1 - ring * 0.24);
        const rot = p * (isTornado ? 7.5 : 4.2) * (ring % 2 === 0 ? 1 : -1);
        ctx.strokeStyle = ring === 0 ? '#ffffff' : ring === 1 ? s.primaryColor : s.secondaryColor;
        ctx.lineWidth = (4.2 - ring * 1.1) * fade;
        ctx.globalAlpha = fade * (0.94 - ring * 0.18);
        ctx.beginPath();
        for (let k = 0; k < sides; k++) {
          const ka = rot + (k * Math.PI * 2) / sides;
          const kx = Math.cos(ka) * rr;
          const ky = Math.sin(ka) * rr * 0.78;
          if (k === 0) ctx.moveTo(kx, ky);
          else ctx.lineTo(kx, ky);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // Tangential flying weld-spark streaks shooting off the spinning pipe!
      for (let j = 0; j < sides; j++) {
        const ja = p * 5 + (j * Math.PI * 2) / sides;
        const jx = Math.cos(ja) * curR;
        const jy = Math.sin(ja) * curR * 0.78;
        const tx = jx - Math.sin(ja) * 24;
        const ty = jy + Math.cos(ja) * 18;
        ctx.strokeStyle = j % 2 === 0 ? s.primaryColor : '#fef08a';
        ctx.lineWidth = 2.4 * fade;
        ctx.globalAlpha = fade * 0.85;
        ctx.beginPath();
        ctx.moveTo(jx, jy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
    } else if (s.kind === 'last_stand_cleave') {
      // Ultimate 1 (Last Stand Wide Desperate Swings): Enormous 200° faceted golden-steel shock-wall!
      const reach = s.radius * (0.45 + 0.6 * easeOut);
      const halfSpan = Math.PI * 0.54;

      ctx.globalAlpha = fade * 0.34;
      ctx.fillStyle = s.primaryColor;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      for (let st = 0; st <= 8; st++) {
        const a = -halfSpan + (st / 8) * halfSpan * 2;
        ctx.lineTo(Math.cos(a) * reach, Math.sin(a) * reach);
      }
      ctx.closePath();
      ctx.fill();

      // Double faceted shock-front polygon edge
      for (let layer = 0; layer < 2; layer++) {
        const lr = reach * (layer === 0 ? 1 : 0.76);
        ctx.strokeStyle = layer === 0 ? '#ffffff' : s.secondaryColor;
        ctx.lineWidth = (layer === 0 ? 4.6 : 2.8) * fade;
        ctx.globalAlpha = fade * 0.94;
        ctx.beginPath();
        for (let st = 0; st <= 8; st++) {
          const a = -halfSpan + (st / 8) * halfSpan * 2;
          const lx = Math.cos(a) * lr;
          const ly = Math.sin(a) * lr;
          if (st === 0) ctx.moveTo(lx, ly);
          else ctx.lineTo(lx, ly);
        }
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

function drawScrapDebris(
  ctx: CanvasRenderingContext2D,
  debrisList: ScrapDebrisPiece[],
  time: number
) {
  for (let i = 0; i < debrisList.length; i++) {
    const d = debrisList[i];
    if (!d.active) continue;

    ctx.save();
    // Draw high-speed kinetic motion trail when orbiting or hurling!
    if (d.trail.length > 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (let t = 0; t < d.trail.length - 1; t++) {
        const p0 = d.trail[t];
        const p1 = d.trail[t + 1];
        const ratio = (t + 1) / d.trail.length;
        ctx.strokeStyle = d.state === 'hurl' ? '#fb923c' : '#94a3b8';
        ctx.globalAlpha = ratio * (d.state === 'hurl' ? 0.72 : 0.42);
        ctx.lineWidth = ratio * (d.state === 'hurl' ? 6.5 : 4.0);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.translate(d.x, d.y);
    // Subtle ground shadow while orbiting
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 6, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(d.spin + time * 0.2);

    if (d.state === 'hurl') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(251, 146, 60, 0.38)';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;

    if (d.shape === 'gear') {
      // Toothed industrial scrap gear
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      for (let g = 0; g < 12; g++) {
        const ga = (g * Math.PI) / 6;
        const gr = g % 2 === 0 ? 8.5 : 6.0;
        const gx = Math.cos(ga) * gr;
        const gy = Math.sin(ga) * gr;
        if (g === 0) ctx.moveTo(gx, gy);
        else ctx.lineTo(gx, gy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (d.shape === 'rebar') {
      // Bent jagged iron rebar rod with orange rust glint
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-9, -3);
      ctx.lineTo(2, -1);
      ctx.lineTo(9, 4);
      ctx.stroke();
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-6, -2.5);
      ctx.lineTo(6, 2.5);
      ctx.stroke();
    } else if (d.shape === 'plate') {
      // Riveted diamond scrap-metal plate
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(-8, -5);
      ctx.lineTo(7, -6);
      ctx.lineTo(9, 5);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-5, -2.5, 2, 2);
      ctx.fillRect(3, 1.5, 2, 2);
    } else if (d.shape === 'bolt') {
      // Heavy hexagonal industrial nut/bolt
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      for (let h = 0; h < 6; h++) {
        const ha = (h * Math.PI) / 3;
        const hx = Math.cos(ha) * 6.8;
        const hy = Math.sin(ha) * 6.8;
        if (h === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Cracked dungeon flagstone chunk
      ctx.fillStyle = '#78716c';
      ctx.beginPath();
      ctx.moveTo(-7, -4);
      ctx.lineTo(1, -8);
      ctx.lineTo(8, -2);
      ctx.lineTo(5, 7);
      ctx.lineTo(-6, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawFloatingHeroWeapon(ctx: CanvasRenderingContext2D, player: PlayerRenderState, time: number) {
  if (player.heroId === 'eaglekin') return;

  if (player.heroId === 'human') {
    if (player.pipeThrown) return;
    ctx.save();
    ctx.translate(player.swordX, player.swordY - player.airborneHeight);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.beginPath();
    ctx.ellipse(0, 22, 10 * player.swordScale, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(player.swordAngle);
    ctx.scale(player.swordScale, player.swordScale);
    drawSteelPipeGraphic(
      ctx,
      player.swordGlowColor,
      player.swordGlowIntensity,
      player.lastStandTimer > 0
    );
    ctx.restore();
    return;
  }

  if (player.heroId === 'ghost') {
    if (player.phantomMistTimer > 0) return;
    drawFloatingGhostLantern(ctx, player, time);
    return;
  }

  if (player.heroId === 'ghoul') {
    const isApex = player.colossusTimer > 0;
    const airLift = player.airborneHeight;
    drawSingleGhoulFeralClaw(
      ctx,
      player.offhandX,
      player.offhandY - airLift,
      player.offhandAngle,
      player.swordScale,
      player.swordGlowColor,
      player.swordGlowIntensity,
      isApex,
      player.ambushReady,
      -1
    );
    drawSingleGhoulFeralClaw(
      ctx,
      player.swordX,
      player.swordY - airLift,
      player.swordAngle,
      player.swordScale,
      player.swordGlowColor,
      player.swordGlowIntensity,
      isApex,
      player.ambushReady,
      1
    );
    return;
  }

  if (player.heroId === 'tigerkin') {
    const isKing = (player.kingOfBeastsTimer || 0) > 0;
    const airLift = player.airborneHeight;
    const momentum = player.feralMomentumStacks || 0;
    drawSingleTigerkinClaw(
      ctx,
      player.offhandX,
      player.offhandY - airLift,
      player.offhandAngle,
      player.swordScale,
      player.swordGlowColor || '#f59e0b',
      player.swordGlowIntensity,
      isKing,
      momentum,
      -1
    );
    drawSingleTigerkinClaw(
      ctx,
      player.swordX,
      player.swordY - airLift,
      player.swordAngle,
      player.swordScale,
      player.swordGlowColor || '#f59e0b',
      player.swordGlowIntensity,
      isKing,
      momentum,
      1
    );
    return;
  }

  ctx.save();
  ctx.translate(player.swordX, player.swordY - player.airborneHeight);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
  ctx.beginPath();
  ctx.ellipse(0, 22, 10 * player.swordScale, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(player.swordAngle);
  ctx.scale(player.swordScale, player.swordScale);

  // GPU-friendly additive aura instead of expensive ctx.shadowBlur!
  if (player.swordGlowIntensity > 0.08) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(0.55, player.swordGlowIntensity * 0.36);
    ctx.fillStyle = player.swordGlowColor;
    ctx.beginPath();
    ctx.ellipse(18, 0, 26, player.heroId === 'zombie' ? 15 : 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (player.heroId === 'zombie') {
    // Floating Rotting Claws (Necrotic Gauntlet Crescent + 3 Curved Venomous Talons)
    ctx.fillStyle = '#3b2547';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, 9.5, -Math.PI * 0.68, Math.PI * 0.68);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Dripping plague gem on gauntlet back
    ctx.fillStyle = '#a3e635';
    ctx.beginPath();
    ctx.arc(1, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();

    const clawOffsets = [-7.5, 0, 7.5];
    for (let i = 0; i < clawOffsets.length; i++) {
      const cy = clawOffsets[i];
      const len = i === 1 ? 36 : 29;
      ctx.fillStyle = '#ecfccb';
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(5, cy - 2.7);
      ctx.quadraticCurveTo(19, cy - 4.4, len, cy + (i - 1) * 2.4);
      ctx.quadraticCurveTo(19, cy + 1.9, 5, cy + 2.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing venomous edge along talon tip
      ctx.strokeStyle = player.colossusTimer > 0 ? '#c084fc' : '#84cc16';
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(14, cy - 1);
      ctx.lineTo(len - 2, cy + (i - 1) * 2.0);
      ctx.stroke();
    }
  } else if (player.isScytheForm) {
    // Reaper's Judgment Spectral Scythe
    ctx.strokeStyle = '#e9d5ff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(48, 0);
    ctx.stroke();

    ctx.fillStyle = '#c084fc';
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(42, -2);
    ctx.quadraticCurveTo(54, 28, 12, 46);
    ctx.quadraticCurveTo(34, 18, 34, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Floating Sharpened Bone Sword
    ctx.fillStyle = '#e7e5e4';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(-11, -2.2, 3, 0, Math.PI * 2);
    ctx.arc(-11, 2.2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#78350f';
    ctx.fillRect(-9, -2.5, 9, 5);
    ctx.strokeRect(-9, -2.5, 9, 5);

    ctx.fillStyle = '#d6d3d1';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(5, -4);
    ctx.lineTo(5, 4);
    ctx.lineTo(0, 9);
    ctx.lineTo(-2, 5);
    ctx.lineTo(-2, -5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(4, -5);
    ctx.lineTo(20, -5.5);
    ctx.lineTo(23, -3.5);
    ctx.lineTo(27, -5.2);
    ctx.lineTo(40, 0);
    ctx.lineTo(26, 5.2);
    ctx.lineTo(4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const pulse = 0.75 + Math.sin(time * 7) * 0.25;
    ctx.strokeStyle = player.swordGlowIntensity > 0.2 ? player.swordGlowColor : `rgba(103, 232, 249, ${pulse})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(31, 0);
    ctx.stroke();
  }

  ctx.restore();
}

function drawMinion(ctx: CanvasRenderingContext2D, m: AlliedMinion, time: number) {
  // Grave-rise emergence animation when freshly summoned!
  const isRising = m.spawnTimer > 0;
  const riseProg = isRising ? Math.max(0, 1 - m.spawnTimer / 0.35) : 1;
  const riseOffsetY = (1 - riseProg) * 18;
  const bodyScale = 0.76 * (0.55 + 0.45 * riseProg);

  // Forward frenzy lunge during attack animation!
  let lungeX = 0;
  let lungeY = 0;
  let atkProgress = 0;
  const isAttacking = m.attackAnimTimer > 0;
  if (isAttacking) {
    atkProgress = 1 - m.attackAnimTimer / Math.max(0.01, m.attackAnimDuration);
    const lungeDist = Math.sin(atkProgress * Math.PI) * 9;
    lungeX = Math.cos(m.facing) * lungeDist;
    lungeY = Math.sin(m.facing) * lungeDist;
  }

  const drawX = m.x + lungeX;
  const drawY = m.y + riseOffsetY + lungeY;

  // Emerging dirt/necrotic/spectral ring while materializing
  if (isRising) {
    ctx.save();
    ctx.translate(m.x, m.y + 8);
    ctx.strokeStyle =
      m.style === 'ghost' ? '#a855f7' : m.style === 'zombie' ? '#a3e635' : '#4ade80';
    ctx.globalAlpha = 1 - riseProg;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18 * riseProg + 4, 8 * riseProg + 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (m.style === 'ghost') {
    // Eternal Nightmare Apparition Summon: Spooky twilight-hooded Chibi Ghost Wraith!
    ctx.save();
    ctx.globalAlpha = 0.88;
    drawChibiGhostBody(ctx, drawX, drawY, m.facing, m.walkPhase, bodyScale * 1.05, false, true, 0, 0);
    ctx.restore();
  } else if (m.style === 'zombie') {
    drawChibiZombieBody(ctx, drawX, drawY, m.facing, m.walkPhase, bodyScale, false, false, 0);

    // Frenzy glowing eyes flash during attack lunge!
    if (isAttacking) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#bef264';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(drawX + Math.cos(m.facing) * 4, drawY - 14 * bodyScale, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else {
    drawChibiSkeletonBody(ctx, drawX, drawY, m.facing, m.walkPhase, bodyScale, '#4ade80', false, '#15803d', null, 0);
  }

  // Independent Floating Minion Weapon with dedicated swipe choreography!
  let orbitAng = m.facing + 0.72 * m.comboSide;
  let orbitRadius = 18;
  let weaponRot = m.facing + 0.25 * m.comboSide;
  let weaponScale = 0.92;

  if (isAttacking) {
    const ease = 1 - Math.pow(1 - atkProgress, 3);
    const sweep = (-1.45 + ease * 2.9) * m.comboSide;
    orbitAng = m.facing + sweep;
    orbitRadius = 23 + Math.sin(atkProgress * Math.PI) * 7;
    weaponRot = orbitAng + 0.35 * m.comboSide;
    weaponScale = 1.22;
  }

  const wx = drawX + Math.cos(orbitAng) * orbitRadius;
  const wy = drawY - 8 + Math.sin(orbitAng) * (orbitRadius * 0.72) + Math.sin(time * 6 + m.id) * 1.8;

  ctx.save();
  ctx.translate(wx, wy);
  ctx.rotate(weaponRot);
  ctx.scale(weaponScale, weaponScale);

  if (m.style === 'ghost') {
    // Floating Spectral Crescent Sickle for Eternal Nightmare Apparitions!
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(192, 132, 252, 0.38)';
    ctx.beginPath();
    ctx.arc(8, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#c7d2fe';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();

    ctx.fillStyle = '#a855f7';
    ctx.strokeStyle = '#e0e7ff';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(9, 0, 9.5, -Math.PI * 0.75, Math.PI * 0.55);
    ctx.arc(6.5, 0, 6.8, Math.PI * 0.55, -Math.PI * 0.75, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (m.style === 'zombie') {
    // Floating Twin Venomous Zombie Claws for Summoned Undead!
    if (isAttacking) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(163, 230, 53, 0.45)';
      ctx.beginPath();
      ctx.ellipse(9, 0, 14, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = '#4c1d95';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 5.5, -Math.PI * 0.65, Math.PI * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    for (let t = -1; t <= 1; t += 2) {
      const cy = t * 3.6;
      ctx.fillStyle = '#ecfccb';
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(3, cy - 2);
      ctx.quadraticCurveTo(11, cy - 3.2, 20, cy + t * 1.5);
      ctx.quadraticCurveTo(11, cy + 1.2, 3, cy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#84cc16';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(8, cy - 0.5);
      ctx.lineTo(18.5, cy + t * 1.2);
      ctx.stroke();
    }
  } else {
    // Floating Spectral Bone Dagger for Army of Bones Skeleton Minion
    ctx.fillStyle = '#ecfdf5';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-5, -3.2);
    ctx.lineTo(17, 0);
    ctx.lineTo(-5, 3.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(12, 0);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEnemyTelegraph(ctx: CanvasRenderingContext2D, e: EnemyEntity) {
  const ratio = Math.min(1, Math.max(0, 1 - e.windupTimer / Math.max(0.01, e.windupDuration)));
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.windupType === 'slam' || e.windupType === 'nova' || e.windupType === 'whirlwind') {
    const isNova = e.windupType === 'nova';
    const isWhirlwind = e.windupType === 'whirlwind';
    const rad = isBossKind(e.kind) ? 140 : isWhirlwind ? e.radius + 58 : 78;
    ctx.strokeStyle = isNova
      ? 'rgba(251, 113, 133, 0.85)'
      : isWhirlwind
        ? 'rgba(244, 63, 94, 0.85)'
        : 'rgba(249, 115, 22, 0.82)';
    ctx.fillStyle = `rgba(239, 68, 68, ${0.09 + ratio * 0.18})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, rad * ratio, 0, Math.PI * 2);
    ctx.stroke();

    if (isWhirlwind) {
      // Rotating blade warning ticks around circle
      for (let w = 0; w < 4; w++) {
        const wa = (w * Math.PI) / 2 + ratio * Math.PI;
        ctx.beginPath();
        ctx.moveTo(Math.cos(wa) * (rad - 8), Math.sin(wa) * (rad - 8));
        ctx.lineTo(Math.cos(wa) * rad, Math.sin(wa) * rad);
        ctx.stroke();
      }
    }
  } else if (e.windupType === 'slash') {
    // Melee slash cone telegraph!
    const reach = e.radius + 52;
    const halfCone = 0.72;
    ctx.rotate(e.windupAngle);
    ctx.fillStyle = `rgba(244, 63, 94, ${0.1 + ratio * 0.2})`;
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.78)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, reach, -halfCone, halfCone);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(251, 113, 133, 0.25)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, reach * ratio, -halfCone, halfCone);
    ctx.closePath();
    ctx.fill();
  } else if (e.windupType === 'thrust') {
    // Rapid piercing lunge line
    const len = 115;
    const halfW = 12;
    ctx.rotate(e.windupAngle);
    ctx.fillStyle = `rgba(244, 63, 94, ${0.12 + ratio * 0.2})`;
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(0, -halfW, len * ratio, halfW * 2);
    ctx.fill();
    ctx.strokeRect(0, -halfW, len, halfW * 2);
  } else if (e.windupType === 'shoot') {
    // Narrowing venom sightline
    const len = 285;
    const halfW = Math.max(2, (1 - ratio) * 11);
    ctx.rotate(e.windupAngle);
    ctx.fillStyle = `rgba(163, 230, 53, ${0.12 + ratio * 0.22})`;
    ctx.fillRect(14, -halfW, len, halfW * 2);

    ctx.strokeStyle = `rgba(190, 242, 100, ${0.45 + ratio * 0.5})`;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(len, 0);
    ctx.stroke();
  } else if (e.windupType === 'volley') {
    // Triple arrow spread volley
    const len = 260;
    ctx.rotate(e.windupAngle);
    ctx.strokeStyle = `rgba(190, 242, 100, ${0.45 + ratio * 0.45})`;
    ctx.lineWidth = 1.8;
    ctx.setLineDash([6, 5]);
    for (const ang of [-0.32, 0, 0.32]) {
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
      ctx.stroke();
    }
  } else if (e.windupType === 'poison_lob') {
    // Lobbed venom mortar landing circle at distance
    const dist = 145;
    const tx = Math.cos(e.windupAngle) * dist;
    const ty = Math.sin(e.windupAngle) * dist;
    ctx.strokeStyle = 'rgba(163, 230, 53, 0.85)';
    ctx.fillStyle = `rgba(132, 204, 22, ${0.1 + ratio * 0.22})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tx, ty, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tx, ty, 48 * ratio, 0, Math.PI * 2);
    ctx.stroke();
  } else if (e.windupType === 'shockwave_line') {
    // Long seismic crack lane
    const len = 230;
    const halfW = 18;
    ctx.rotate(e.windupAngle);
    ctx.fillStyle = `rgba(249, 115, 22, ${0.12 + ratio * 0.22})`;
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(0, -halfW, len, halfW * 2);
    ctx.fill();
    ctx.stroke();
  } else if (e.windupType === 'dash' || e.windupType === 'charge') {
    const len = e.windupType === 'charge' ? 175 : 225;
    ctx.rotate(e.windupAngle);
    ctx.fillStyle = `rgba(244, 63, 94, ${0.14 + ratio * 0.22})`;
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.82)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(0, -16, len, 32);
    ctx.fill();
    ctx.stroke();

    // Charge chevron inside lane
    const cx = len * ratio;
    ctx.beginPath();
    ctx.moveTo(cx - 12, -11);
    ctx.lineTo(cx + 4, 0);
    ctx.lineTo(cx - 12, 11);
    ctx.stroke();
  } else if (e.windupType === 'pounce') {
    // Feral pounce impact reticle
    const pDist = 120;
    const px = Math.cos(e.windupAngle) * pDist;
    const py = Math.sin(e.windupAngle) * pDist;
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.9)';
    ctx.fillStyle = `rgba(239, 68, 68, ${0.12 + ratio * 0.24})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(px, py, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (e.windupType === 'spell') {
    // Mystical spell ring
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.fillStyle = `rgba(14, 165, 233, ${0.1 + ratio * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 64, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (e.windupType === 'cross_slash') {
    // Twin X-Rend Cleave + Forward Crescent Beam Telegraph
    const reach = isBossKind(e.kind) ? 115 : 78;
    ctx.rotate(e.windupAngle);
    ctx.fillStyle = `rgba(225, 29, 72, ${0.12 + ratio * 0.22})`;
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.88)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, reach, -0.82, 0.82);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Crisscrossing X-blade warning lines
    ctx.strokeStyle = `rgba(254, 226, 226, ${0.45 + ratio * 0.5})`;
    ctx.beginPath();
    ctx.moveTo(14, -reach * 0.45);
    ctx.lineTo(reach * 0.95, reach * 0.45);
    ctx.moveTo(14, reach * 0.45);
    ctx.lineTo(reach * 0.95, -reach * 0.45);
    ctx.stroke();
  } else if (e.windupType === 'frost_nova') {
    // Chilling Frost Nova Ring + 6 Crystalline Ray Spokes
    const rad = isBossKind(e.kind) ? 140 : 96;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.88)';
    ctx.fillStyle = `rgba(56, 189, 248, ${0.1 + ratio * 0.2})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, rad * ratio, 0, Math.PI * 2);
    ctx.stroke();
    for (let k = 0; k < 6; k++) {
      const ka = e.windupAngle + (k * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ka) * 16, Math.sin(ka) * 16);
      ctx.lineTo(Math.cos(ka) * rad, Math.sin(ka) * rad);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: EnemyEntity, time: number, isGhoulHero = false) {
  if (e.kind === EnemyKind.TRAINING_DUMMY) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const wobble = e.hitFlash > 0 ? Math.sin(time * 45) * 0.16 : 0;
    ctx.rotate(wobble);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 18, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#78350f';
    ctx.fillRect(-4, -8, 8, 22);

    ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.poisonTimer > 0 ? '#84cc16' : '#d97706';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-11, -12, 22, 18, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.poisonTimer > 0 ? '#a3e635' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(0, -24, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.arc(-4, -24, 2, 0, Math.PI * 2);
    ctx.arc(4, -24, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawWorldLabel(ctx, e.x, e.y - 46, 'Practice Dummy', '#fcd34d');
    return;
  }

  let scale = 0.95;
  let eyeColor = '#fb7185';
  let scarfColor = '#4c1d95';
  let crown: string | null = null;

  if (e.kind === EnemyKind.ARCHER) {
    scale = 0.9;
    eyeColor = '#a3e635';
    scarfColor = '#365314';
  } else if (e.kind === EnemyKind.BRUTE) {
    scale = 1.28;
    eyeColor = '#f97316';
    scarfColor = '#7f1d1d';
  } else if (e.kind === EnemyKind.NECROMANCER) {
    scale = 1.02;
    eyeColor = '#38bdf8';
    scarfColor = '#581c87';
    crown = '#c084fc';
  } else if (e.kind === EnemyKind.GRAVE_KNIGHT) {
    scale = 1.2;
    eyeColor = '#f43f5e';
    scarfColor = '#1e293b';
    crown = '#94a3b8';
  } else if (e.kind === EnemyKind.PLAGUE_STALKER) {
    scale = 0.92;
    eyeColor = '#a3e635';
    scarfColor = '#14532d';
  } else if (e.kind === EnemyKind.BOSS_WARDEN) {
    scale = 1.82;
    eyeColor = '#f43f5e';
    scarfColor = '#581c87';
    crown = '#f59e0b';
  } else if (isMiniHeroKind(e.kind)) {
    scale = 0.74;
    // Exact original Undead Legion hero colors
    if (e.kind === EnemyKind.MINI_SKELETON) {
      eyeColor = '#67e8f9';
      scarfColor = '#9a3412';
    } else if (e.kind === EnemyKind.MINI_ZOMBIE) {
      eyeColor = '#d9f99d';
      scarfColor = '#581c87';
    } else if (e.kind === EnemyKind.MINI_GHOUL) {
      eyeColor = '#f43f5e';
      scarfColor = '#881337';
    } else {
      eyeColor = '#5eead4';
      scarfColor = '#312e81';
    }
  } else if (isUndeadLegionBoss(e.kind)) {
    const isBossTransformed = (e.bossTransformTimer || 0) > 0;
    scale = isBossTransformed ? 2.15 : 1.78;
    // Exact original Undead Legion hero appearance (crown/transformation only active during Ultimate!)
    if (e.kind === EnemyKind.BOSS_LEGION_SKELETON) {
      eyeColor = isBossTransformed ? '#fde047' : '#67e8f9';
      scarfColor = '#9a3412';
      crown = isBossTransformed ? '#fbbf24' : null;
    } else if (e.kind === EnemyKind.BOSS_LEGION_ZOMBIE) {
      eyeColor = '#d9f99d';
      scarfColor = '#581c87';
      crown = null;
    } else if (e.kind === EnemyKind.BOSS_LEGION_GHOUL) {
      eyeColor = '#f43f5e';
      scarfColor = '#881337';
      crown = null;
    } else {
      eyeColor = '#5eead4';
      scarfColor = '#312e81';
      crown = null;
    }
  }

  const isWindingUp = e.windupTimer > 0;
  const windProg = isWindingUp
    ? Math.min(1, Math.max(0, 1 - e.windupTimer / Math.max(0.01, e.windupDuration)))
    : 0;
  const isStriking = e.attackAnimTimer > 0;
  const strikeProg = isStriking
    ? Math.min(1, Math.max(0, 1 - e.attackAnimTimer / Math.max(0.01, e.attackAnimDuration)))
    : 0;
  const strikeEase = 1 - Math.pow(1 - strikeProg, 3);

  // Subtle body anticipation coil & forward attack lunge!
  let bodyOffX = 0;
  let bodyOffY = 0;
  const aimAng = isWindingUp || isStriking ? e.windupAngle : e.facing;
  if (isWindingUp) {
    const pullBack = e.kind === EnemyKind.ARCHER ? -3 : -5 * windProg;
    bodyOffX = Math.cos(aimAng) * pullBack;
    bodyOffY = Math.sin(aimAng) * pullBack;
  } else if (isStriking) {
    const lunge = (e.kind === EnemyKind.ARCHER ? -4 : 10 * scale) * Math.sin(strikeProg * Math.PI);
    bodyOffX = Math.cos(aimAng) * lunge;
    bodyOffY = Math.sin(aimAng) * lunge;
  }

  const drawX = e.x + bodyOffX;
  const drawY = e.y + bodyOffY;

  // Ghoul Feral Instinct Passive: Pulsing crimson heartbeat ring under vulnerable (<45% HP) prey!
  const isVulnerable = e.hp > 0 && e.hp / e.maxHp <= 0.45;
  if (isGhoulHero && isVulnerable) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const beat = 0.5 + Math.abs(Math.sin(time * 7)) * 0.5;
    ctx.strokeStyle = `rgba(244, 63, 94, ${0.45 + beat * 0.45})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(drawX, drawY + 12 * scale, (21 + beat * 4) * scale, (8.5 + beat * 1.5) * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Ghoul King of the Hunt Ultimate: Rotating Crimson Prey Reticle!
  if (e.preyMarkTimer > 0) {
    ctx.save();
    ctx.translate(drawX, drawY - 12 * scale);
    ctx.rotate(time * 3.2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2.2;
    const mr = 22 * scale;
    ctx.beginPath();
    ctx.arc(0, 0, mr, 0, Math.PI * 2);
    ctx.stroke();
    for (let q = 0; q < 4; q++) {
      const qa = (q * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(qa) * (mr - 5), Math.sin(qa) * (mr - 5));
      ctx.lineTo(Math.cos(qa) * (mr + 5), Math.sin(qa) * (mr + 5));
      ctx.stroke();
    }
    ctx.restore();
  }

  // Ghost Haunted Possession: Spectral aura, puppet control strings, & glowing ghost eyes above host!
  if (e.possessedTimer > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(139, 92, 246, 0.28)';
    ctx.strokeStyle = '#5eead4';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(drawX, drawY + 12 * scale, 24 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Slowed slime mire ring at feet
  if (e.slowTimer > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(132, 204, 22, 0.2)';
    ctx.strokeStyle = 'rgba(163, 230, 53, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(drawX, drawY + 12 * scale, 19 * scale, 7.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  const fearShakeX = e.fearTimer > 0 ? Math.sin(time * 42 + e.id) * 2.2 : 0;

  const isBossTransformed = isUndeadLegionBoss(e.kind) && (e.bossTransformTimer || 0) > 0;
  const isBossBuffed = isUndeadLegionBoss(e.kind) && (e.bossBuffTimer || 0) > 0;
  const bossStealthTimer = isUndeadLegionBoss(e.kind) ? e.bossStealthTimer || 0 : 0;

  // Undead Legion Boss Corrupted Floor Sigil & Authentic Hero Transformation / Buff Floor Auras
  if (isUndeadLegionBoss(e.kind)) {
    ctx.save();
    ctx.translate(drawX, drawY + 14 * scale);
    ctx.rotate(time * 0.9);
    ctx.globalCompositeOperation = 'lighter';
    const bossGlow = 0.42 + Math.sin(time * 4.5) * 0.22;
    ctx.strokeStyle =
      e.kind === EnemyKind.BOSS_LEGION_ZOMBIE
        ? `rgba(132, 204, 22, ${bossGlow})`
        : e.kind === EnemyKind.BOSS_LEGION_GHOUL
          ? `rgba(244, 63, 94, ${bossGlow})`
          : e.kind === EnemyKind.BOSS_LEGION_GHOST
            ? `rgba(94, 234, 212, ${bossGlow})`
            : `rgba(103, 232, 249, ${bossGlow})`;
    ctx.lineWidth = 2.6;
    const br = 30 * scale;
    ctx.beginPath();
    ctx.arc(0, 0, br, 0, Math.PI * 2);
    ctx.stroke();

    for (let r = 0; r < 8; r++) {
      const ra = (r * Math.PI) / 4;
      const rx = Math.cos(ra) * br;
      const ry = Math.sin(ra) * br;
      ctx.beginPath();
      ctx.moveTo(rx - 4, ry - 4);
      ctx.lineTo(rx + 4, ry + 4);
      ctx.moveTo(rx + 4, ry - 4);
      ctx.lineTo(rx - 4, ry + 4);
      ctx.stroke();
    }
    ctx.restore();

    // Original Hero Transformation Floor Auras (Bone Colossus, Abomination Form, Apex Predator)
    if (isBossTransformed) {
      ctx.save();
      ctx.translate(drawX, drawY + 8 * scale);
      ctx.scale(scale, scale);
      ctx.globalCompositeOperation = 'lighter';
      if (e.kind === EnemyKind.BOSS_LEGION_GHOUL) {
        ctx.fillStyle = 'rgba(225, 29, 72, 0.24)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 44 + Math.sin(time * 12) * 4, 19, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.ellipse(0, 0, 38, 16, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.kind === EnemyKind.BOSS_LEGION_ZOMBIE) {
        ctx.fillStyle = 'rgba(132, 204, 22, 0.22)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 44 + Math.sin(time * 9) * 4, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#a3e635';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.ellipse(0, 0, 38, 17, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.kind === EnemyKind.BOSS_LEGION_SKELETON) {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 35, 16, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Ghoul Blood Frenzy Floor Pulse & Rising Embers
    if (e.kind === EnemyKind.BOSS_LEGION_GHOUL && isBossBuffed) {
      ctx.save();
      ctx.translate(drawX, drawY + 7 * scale);
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.5 + Math.sin(time * 7.5) * 0.25;
      ctx.fillStyle = `rgba(244, 63, 94, ${0.16 + pulse * 0.08})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, (30 + pulse * 4) * scale, 13 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let m = 0; m < 3; m++) {
        const cyc = (time * 1.4 + m * 0.33) % 1;
        const mx = Math.cos(m * 2.1 + time * 2.4) * (20 * scale);
        const my = -cyc * (34 * scale);
        ctx.globalAlpha = Math.sin(cyc * Math.PI) * 0.72;
        ctx.fillStyle = m === 0 ? '#ffe4e6' : '#fb7185';
        ctx.beginPath();
        ctx.arc(mx, my, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Zombie Undying Flesh Regeneration Floor Ring
    if (e.kind === EnemyKind.BOSS_LEGION_ZOMBIE && isBossBuffed) {
      ctx.save();
      ctx.translate(drawX, drawY + 6 * scale);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(34, 197, 94, 0.18)';
      ctx.beginPath();
      ctx.ellipse(0, 0, (32 + Math.sin(time * 6) * 3) * scale, 14 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.85)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, (28 + Math.sin(time * 7) * 3) * scale, 12.5 * scale, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (e.kind === EnemyKind.MINI_ZOMBIE || e.kind === EnemyKind.BOSS_LEGION_ZOMBIE) {
    drawChibiZombieBody(
      ctx,
      drawX + fearShakeX,
      drawY,
      aimAng,
      e.walkPhase,
      scale,
      false,
      isBossTransformed,
      e.hitFlash
    );
  } else if (
    e.kind === EnemyKind.MINI_GHOUL ||
    e.kind === EnemyKind.BOSS_LEGION_GHOUL ||
    e.kind === EnemyKind.PLAGUE_STALKER
  ) {
    ctx.save();
    if (e.kind === EnemyKind.BOSS_LEGION_GHOUL && bossStealthTimer > 0) {
      ctx.globalAlpha = 0.36 + Math.sin(time * 18) * 0.08;
    }
    drawChibiGhoulBody(
      ctx,
      drawX + fearShakeX,
      drawY,
      aimAng,
      e.walkPhase,
      scale,
      false,
      isBossTransformed,
      e.hitFlash
    );
    ctx.restore();

    if (e.kind === EnemyKind.BOSS_LEGION_GHOUL && bossStealthTimer > 0) {
      ctx.save();
      ctx.translate(drawX, drawY - 12 * scale);
      for (let s = 0; s < 4; s++) {
        const sa = time * 5.2 + (s * Math.PI) / 2;
        ctx.fillStyle = s % 2 === 0 ? 'rgba(15, 23, 42, 0.7)' : 'rgba(225, 29, 72, 0.55)';
        ctx.beginPath();
        ctx.arc(Math.cos(sa) * 20 * scale, Math.sin(sa * 1.4) * 11 * scale, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  } else if (e.kind === EnemyKind.MINI_GHOST || e.kind === EnemyKind.BOSS_LEGION_GHOST) {
    ctx.save();
    ctx.globalAlpha = 0.94;
    drawChibiGhostBody(
      ctx,
      drawX + fearShakeX,
      drawY,
      aimAng,
      e.walkPhase,
      scale,
      false,
      isBossTransformed,
      e.hitFlash,
      bossStealthTimer
    );
    ctx.restore();

    // Restless Spirit Passive: Orbiting starlight-teal motes when spiritual energy intensifies!
    if (e.kind === EnemyKind.BOSS_LEGION_GHOST && isBossBuffed && bossStealthTimer <= 0) {
      ctx.save();
      ctx.translate(drawX, drawY - 12 * scale);
      ctx.globalCompositeOperation = 'lighter';
      for (let s = 0; s < 3; s++) {
        const ang = time * 4.4 + (s * Math.PI * 2) / 3;
        const rx = Math.cos(ang) * 26 * scale;
        const ry = Math.sin(ang) * 14 * scale;
        ctx.fillStyle = s % 2 === 0 ? '#5eead4' : '#c7d2fe';
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(rx, ry, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  } else if (e.kind === EnemyKind.BOSS_LEGION_HUMAN) {
    drawChibiHumanBody(
      ctx,
      drawX + fearShakeX,
      drawY,
      aimAng,
      e.walkPhase,
      scale,
      false,
      false,
      e.hitFlash
    );
  } else if (e.kind === EnemyKind.BOSS_LEGION_EAGLEKIN) {
    drawChibiEaglekinBody(
      ctx,
      drawX + fearShakeX,
      drawY,
      aimAng,
      e.walkPhase,
      scale,
      false,
      e.hitFlash,
      0
    );
  } else if (e.kind === EnemyKind.BOSS_LEGION_TIGERKIN) {
    drawChibiTigerkinBody(
      ctx,
      drawX + fearShakeX,
      drawY,
      aimAng,
      e.walkPhase,
      scale,
      false,
      isBossTransformed,
      e.hitFlash,
      0,
      0,
      0,
      0
    );
  } else {
    const isLegionOrMiniSkel =
      e.kind === EnemyKind.BOSS_LEGION_SKELETON || e.kind === EnemyKind.MINI_SKELETON;
    drawChibiSkeletonBody(
      ctx,
      drawX + fearShakeX,
      drawY,
      aimAng,
      e.walkPhase,
      scale,
      e.possessedTimer > 0
        ? '#2dd4bf'
        : e.fearTimer > 0
          ? '#e879f9'
          : !isLegionOrMiniSkel && isWindingUp && windProg > 0.65
            ? '#fef08a'
            : eyeColor,
      false,
      e.possessedTimer > 0 ? '#4f46e5' : scarfColor,
      crown,
      e.hitFlash
    );
  }

  // Authentic Hero Post-Body Overlays (Undying Flesh Helix, Abomination Sparks, Ribcage Shield Orbiting Bones)
  if (e.kind === EnemyKind.BOSS_LEGION_ZOMBIE && isBossBuffed) {
    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.globalCompositeOperation = 'lighter';
    for (let strand = 0; strand < 2; strand++) {
      ctx.strokeStyle = strand === 0 ? '#4ade80' : '#a3e635';
      ctx.lineWidth = 2.4;
      ctx.globalAlpha = 0.78;
      ctx.beginPath();
      for (let step = 0; step <= 10; step++) {
        const frac = step / 10;
        const ang = time * 6.5 + frac * Math.PI * 2.2 + strand * Math.PI;
        const hx = Math.cos(ang) * (22 * scale);
        const hy = 8 - frac * (42 * scale) + Math.sin(ang) * 4;
        if (step === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#bbf7d0';
    for (let c = 0; c < 4; c++) {
      const cyc = (time * 1.45 + c * 0.25) % 1;
      const cx = Math.cos(c * 1.9 + time * 1.8) * (20 * scale);
      const cy = 4 - cyc * (48 * scale);
      ctx.globalAlpha = Math.sin(cyc * Math.PI) * 0.95;
      ctx.fillRect(cx - 1.5, cy - 5, 3, 10);
      ctx.fillRect(cx - 5, cy - 1.5, 10, 3);
    }
    ctx.restore();
  }

  if (e.kind === EnemyKind.BOSS_LEGION_ZOMBIE && isBossTransformed) {
    ctx.save();
    ctx.translate(drawX, drawY - 16 * scale);
    ctx.globalCompositeOperation = 'lighter';
    for (let m = 0; m < 4; m++) {
      const ma = time * 3.4 + (m * Math.PI) / 2;
      ctx.fillStyle = m % 2 === 0 ? '#a3e635' : '#c084fc';
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.arc(Math.cos(ma) * 28 * scale, Math.sin(ma * 1.5) * 15 * scale, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (
    (e.kind === EnemyKind.BOSS_LEGION_SKELETON && ((e.shieldHp || 0) > 0 || isBossBuffed)) ||
    (e.kind === EnemyKind.BOSS_LEGION_ZOMBIE && isBossBuffed)
  ) {
    ctx.save();
    ctx.translate(drawX, drawY - 10 * scale);
    const count = 6;
    for (let i = 0; i < count; i++) {
      const ang = time * 3.8 + (i * Math.PI * 2) / count;
      const rx = Math.cos(ang) * (34 * scale);
      const ry = Math.sin(ang) * (20 * scale);
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(ang + Math.PI / 2);
      ctx.strokeStyle = e.kind === EnemyKind.BOSS_LEGION_ZOMBIE ? '#4ade80' : '#fde68a';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, 9, -0.9, 0.9);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // Ghost Haunted Possession Overhead Puppet Crossbar & Glowing Spirit Mask!
  if (e.possessedTimer > 0) {
    ctx.save();
    ctx.translate(drawX, drawY - 44 * scale + Math.sin(time * 7) * 3);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, -6);
    ctx.lineTo(14, -6);
    ctx.moveTo(-9, -6);
    ctx.lineTo(-5, 10);
    ctx.moveTo(9, -6);
    ctx.lineTo(5, 10);
    ctx.stroke();

    ctx.fillStyle = '#5eead4';
    ctx.beginPath();
    ctx.arc(-4.5, 1, 2.2, 0, Math.PI * 2);
    ctx.arc(4.5, 1, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (e.fearTimer > 0) {
    // Ghost Wailing Scream / Eternal Nightmare Fear Indicator above fleeing enemy!
    ctx.save();
    ctx.translate(drawX + fearShakeX, drawY - 40 * scale + Math.sin(time * 16) * 2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#e879f9';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, 8, Math.PI * 0.15, Math.PI * 0.85, true);
    ctx.stroke();
    ctx.fillStyle = '#5eead4';
    ctx.fillRect(-5, -8, 2.4, 6);
    ctx.fillRect(2.6, -8, 2.4, 6);
    ctx.beginPath();
    ctx.arc(-3.8, 0.5, 1.4, 0, Math.PI * 2);
    ctx.arc(3.8, 0.5, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (e.staggerTimer > 0) {
    // Human Headcracker / Improvised Fighter Concussion Stagger: 3 orbiting golden stars!
    ctx.save();
    ctx.translate(drawX, drawY - 40 * scale);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14 * scale, 5.5 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();

    for (let st = 0; st < 3; st++) {
      const sa = time * 8.5 + (st * Math.PI * 2) / 3;
      const sx = Math.cos(sa) * 14 * scale;
      const sy = Math.sin(sa) * 5.5 * scale;
      ctx.fillStyle = st === 0 ? '#ffffff' : '#fde047';
      ctx.beginPath();
      for (let v = 0; v < 8; v++) {
        const va = (v * Math.PI) / 4 + time * 4;
        const vr = v % 2 === 0 ? 4.2 : 1.5;
        const px = sx + Math.cos(va) * vr;
        const py = sy + Math.sin(va) * vr;
        if (v === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Infected / Poisoned visual plague bubbles & skull spore mark above head
  if (e.poisonTimer > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let b = 0; b < 4; b++) {
      const bp = (time * 2.3 + b * 0.25 + e.id) % 1;
      const bx = drawX + Math.sin(time * 4.5 + b * 1.9) * (12 * scale);
      const by = drawY - 26 * scale - bp * 18;
      ctx.globalAlpha = (1 - bp) * 0.9;
      ctx.fillStyle = b % 2 === 0 ? '#a3e635' : '#c084fc';
      ctx.beginPath();
      ctx.arc(bx, by, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // =========================================================================
  // 3-PHASE INDEPENDENT FLOATING ENEMY WEAPON CHOREOGRAPHY (60fps)
  // =========================================================================
  const hover = Math.sin(time * 5 + e.id) * 2.5;
  let wx = drawX + Math.cos(aimAng + 0.78) * (24 * scale);
  let wy = drawY - 10 * scale + Math.sin(aimAng + 0.78) * (15 * scale) + hover;
  let wRot = aimAng + 0.22;
  let wScale = scale;
  let glowAlpha = 0;
  let glowColor = '#fb7185';

  if (e.kind === EnemyKind.ARCHER) {
    glowColor = '#a3e635';
    if (isWindingUp) {
      // Swing recurve bow directly in front and draw string taut!
      wx = drawX + Math.cos(aimAng) * (22 * scale);
      wy = drawY - 9 * scale + Math.sin(aimAng) * (16 * scale);
      wRot = aimAng;
      wScale = scale * 1.1;
      glowAlpha = windProg * 0.55;
    } else if (isStriking) {
      // Snap release recoil!
      const recoil = Math.sin(strikeProg * Math.PI) * 5;
      wx = drawX + Math.cos(aimAng) * ((22 - recoil) * scale);
      wy = drawY - 9 * scale + Math.sin(aimAng) * ((16 - recoil) * scale);
      wRot = aimAng;
      wScale = scale * 1.08;
    }

    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(wRot);
    ctx.scale(wScale, wScale);

    if (glowAlpha > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = glowColor;
      ctx.globalAlpha = glowAlpha;
      ctx.beginPath();
      ctx.arc(6, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Recurve Bone Bow limbs (flexing further back during windProg!)
    const bend = isWindingUp ? windProg * 4.5 : 0;
    const stringPull = isWindingUp ? -2 - windProg * 11 : isStriking ? 4 * (1 - strikeProg) : -1;

    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2 - bend * 0.5, -14);
    ctx.quadraticCurveTo(9, 0, -2 - bend * 0.5, 14);
    ctx.stroke();

    ctx.strokeStyle = '#f5f5f4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-2 - bend * 0.5, -14);
    ctx.quadraticCurveTo(9, 0, -2 - bend * 0.5, 14);
    ctx.stroke();

    // Elastic bowstring pulled back into V-shape!
    ctx.strokeStyle = '#d6d3d1';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-2 - bend * 0.5, -13.5);
    ctx.lineTo(stringPull, 0);
    ctx.lineTo(-2 - bend * 0.5, 13.5);
    ctx.stroke();

    // Nocked glowing venom arrow during windup!
    if (isWindingUp) {
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(stringPull, 0);
      ctx.lineTo(stringPull + 21, 0);
      ctx.stroke();

      ctx.fillStyle = '#bef264';
      ctx.beginPath();
      ctx.moveTo(stringPull + 25, 0);
      ctx.lineTo(stringPull + 17, -4);
      ctx.lineTo(stringPull + 17, 4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  } else if (e.kind === EnemyKind.BRUTE) {
    // Skullguard Brute: Heavy Spiked Bone Greathammer!
    glowColor = '#f97316';
    if (isWindingUp) {
      // Hoist greathammer high above skull, trembling with molten orange fury!
      const jitter = Math.sin(time * 50) * 2 * windProg;
      wx = drawX - Math.cos(aimAng) * (8 * scale) + jitter;
      wy = drawY - (26 + windProg * 16) * scale;
      wRot = -Math.PI * 0.65 - windProg * 0.35;
      wScale = scale * (1.05 + windProg * 0.16);
      glowAlpha = windProg * 0.65;
    } else if (isStriking) {
      // Violent downward smash into ground in front of Brute!
      const smashReach = 28 * strikeEase;
      wx = drawX + Math.cos(aimAng) * (smashReach * scale);
      wy = drawY + (-28 + 38 * strikeEase) * scale + Math.sin(aimAng) * (smashReach * 0.65 * scale);
      wRot = aimAng + (-1.4 + strikeEase * 1.65);
      wScale = scale * 1.24;
      glowAlpha = (1 - strikeProg) * 0.7;
    }

    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(wRot);
    ctx.scale(wScale, wScale);

    if (glowAlpha > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = glowColor;
      ctx.globalAlpha = glowAlpha;
      ctx.beginPath();
      ctx.arc(17, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Iron-bound bone shaft
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.6;
    ctx.fillRect(-10, -2.5, 24, 5);
    ctx.strokeRect(-10, -2.5, 24, 5);

    // Massive spiked skull-crusher hammerhead
    ctx.fillStyle = '#e7e5e4';
    ctx.beginPath();
    ctx.roundRect(11, -11, 13, 22, 3);
    ctx.fill();
    ctx.stroke();

    // Glowing molten rune core + front spike
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(17.5, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#d6d3d1';
    ctx.beginPath();
    ctx.moveTo(24, -4);
    ctx.lineTo(30, 0);
    ctx.lineTo(24, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  } else if (e.kind === EnemyKind.BOSS_WARDEN) {
    // High Warden Ossian: Ornate Royal Crimson-Gold Halberd!
    glowColor = '#f43f5e';
    if (isWindingUp) {
      if (e.windupType === 'slam') {
        const jitter = Math.sin(time * 55) * 2.5 * windProg;
        wx = drawX + jitter;
        wy = drawY - (28 + windProg * 18) * scale;
        wRot = -Math.PI * 0.55 - windProg * 0.3;
      } else if (e.windupType === 'nova') {
        const spin = windProg * Math.PI * 3;
        wx = drawX + Math.cos(spin) * (28 * scale);
        wy = drawY - 12 * scale + Math.sin(spin) * (18 * scale);
        wRot = spin + Math.PI * 0.5;
      } else {
        // 'dash': Couch halberd back like a royal lance!
        wx = drawX - Math.cos(aimAng) * (16 * windProg * scale);
        wy = drawY - 10 * scale - Math.sin(aimAng) * (12 * windProg * scale);
        wRot = aimAng;
      }
      wScale = scale * 1.15;
      glowAlpha = windProg * 0.7;
    } else if (isStriking) {
      if (e.windupType === 'nova') {
        const spin = strikeEase * Math.PI * 4;
        wx = drawX + Math.cos(spin) * (36 * scale);
        wy = drawY - 10 * scale + Math.sin(spin) * (24 * scale);
        wRot = spin + Math.PI * 0.55;
      } else if (e.windupType === 'dash') {
        wx = drawX + Math.cos(aimAng) * (34 * scale);
        wy = drawY - 8 * scale + Math.sin(aimAng) * (24 * scale);
        wRot = aimAng;
      } else {
        const sweep = -1.65 + strikeEase * 3.3;
        const orb = aimAng + sweep;
        wx = drawX + Math.cos(orb) * (34 * scale);
        wy = drawY - 8 * scale + Math.sin(orb) * (24 * scale);
        wRot = orb + 0.35;
      }
      wScale = scale * 1.28;
      glowAlpha = (1 - strikeProg) * 0.8;
    }

    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(wRot);
    ctx.scale(wScale, wScale);

    if (glowAlpha > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = glowColor;
      ctx.globalAlpha = glowAlpha;
      ctx.beginPath();
      ctx.ellipse(20, 0, 22, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Gilded polearm shaft
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(30, 0);
    ctx.stroke();

    // Crimson crescent axe-blade + spear tip
    ctx.fillStyle = '#f43f5e';
    ctx.strokeStyle = '#fef2f2';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(12, -16);
    ctx.quadraticCurveTo(26, -8, 22, -2);
    ctx.lineTo(36, 0);
    ctx.lineTo(22, 2);
    ctx.quadraticCurveTo(26, 8, 12, 16);
    ctx.lineTo(17, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  } else if (e.kind === EnemyKind.NECROMANCER) {
    // Graveyard Necromancer: Dark Skull Staff with Orbiting Cyan-Violet Soul Orb
    glowColor = '#c084fc';
    if (isWindingUp) {
      wx = drawX + Math.cos(aimAng) * (20 * scale);
      wy = drawY - (18 + windProg * 12) * scale + Math.sin(aimAng) * (12 * scale);
      wRot = -Math.PI * 0.45;
      wScale = scale * (1.08 + windProg * 0.14);
      glowAlpha = 0.35 + windProg * 0.55;
    } else if (isStriking) {
      wx = drawX + Math.cos(aimAng) * (26 * scale);
      wy = drawY - 12 * scale + Math.sin(aimAng) * (18 * scale);
      wRot = aimAng;
      wScale = scale * 1.18;
      glowAlpha = 0.75 * (1 - strikeProg);
    }

    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(wRot);
    ctx.scale(wScale, wScale);

    ctx.strokeStyle = '#312e81';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(18, 0);
    ctx.stroke();

    // Skull headpiece + soul gem
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(19, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = isWindingUp ? '#38bdf8' : '#c084fc';
    ctx.globalAlpha = 0.65 + glowAlpha * 0.35;
    ctx.beginPath();
    ctx.arc(24, 0, 5 + Math.sin(time * 9) * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  } else if (e.kind === EnemyKind.GRAVE_KNIGHT) {
    // Fallen Grave Knight: Dark Runed Claymore + Offhand Iron Heater Shield
    const shAng = aimAng - 0.95;
    const shX = drawX + Math.cos(shAng) * (19 * scale);
    const shY = drawY - 8 * scale + Math.sin(shAng) * (13 * scale);
    ctx.save();
    ctx.translate(shX, shY);
    ctx.rotate(aimAng);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-4, -9);
    ctx.lineTo(5, -7);
    ctx.lineTo(7, 0);
    ctx.lineTo(5, 7);
    ctx.lineTo(-4, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    glowColor = '#f43f5e';
    if (isWindingUp) {
      const cockAng = aimAng - 1.5 * windProg - 0.45;
      wx = drawX + Math.cos(cockAng) * (25 * scale);
      wy = drawY - 11 * scale + Math.sin(cockAng) * (17 * scale);
      wRot = cockAng - 0.45;
      wScale = scale * 1.12;
      glowAlpha = windProg * 0.6;
    } else if (isStriking) {
      const sweep = -1.75 + strikeEase * 3.5;
      const orb = aimAng + sweep;
      wx = drawX + Math.cos(orb) * (32 * scale);
      wy = drawY - 9 * scale + Math.sin(orb) * (22 * scale);
      wRot = orb + 0.35;
      wScale = scale * 1.26;
      glowAlpha = (1 - strikeProg) * 0.75;
    }

    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(wRot);
    ctx.scale(wScale, wScale);
    if (glowAlpha > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = glowColor;
      ctx.globalAlpha = glowAlpha;
      ctx.beginPath();
      ctx.ellipse(15, 0, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-8, -2, 7, 4);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-2, -6.5, 3, 13);
    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(1, -4);
    ctx.lineTo(24, -2.5);
    ctx.lineTo(30, 0);
    ctx.lineTo(24, 2.5);
    ctx.lineTo(1, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(23, 0);
    ctx.stroke();
    ctx.restore();
  } else if (e.kind === EnemyKind.MINI_GHOST || e.kind === EnemyKind.BOSS_LEGION_GHOST) {
    // Ghost Mini & Corrupted Ghost Boss: Exact Original Floating Soul Lantern Catalyst!
    if (bossStealthTimer <= 0) {
      const lanternFloat = Math.sin(time * 6.5 + e.id) * 3.5;
      wx = drawX + Math.cos(aimAng + 0.65) * (24 * scale);
      wy = drawY - 12 * scale + Math.sin(aimAng + 0.65) * (15 * scale) + lanternFloat;
      let lanternGlowInt = 0.35;
      if (isWindingUp || isStriking) {
        wx = drawX + Math.cos(aimAng) * (25 * scale);
        wy = drawY - 12 * scale + Math.sin(aimAng) * (16 * scale);
        wScale = scale * 1.12;
        lanternGlowInt = 0.85;
      }
      drawGhostSoulLanternAt(
        ctx,
        wx,
        wy,
        isWindingUp || isStriking ? aimAng * 0.25 : 0,
        wScale * 0.92,
        isBossTransformed ? '#c084fc' : '#5eead4',
        lanternGlowInt,
        isBossTransformed,
        time
      );
    }
  } else if (e.kind === EnemyKind.MINI_ZOMBIE || e.kind === EnemyKind.BOSS_LEGION_ZOMBIE) {
    // Zombie Mini & Corrupted Zombie Boss: Exact Original Floating Necrotic Gauntlet Rotting Claws!
    glowColor = isBossTransformed ? '#c084fc' : '#84cc16';
    if (isWindingUp) {
      const cockAng = aimAng - 1.35 * windProg - 0.4;
      wx = drawX + Math.cos(cockAng) * (24 * scale);
      wy = drawY - 9 * scale + Math.sin(cockAng) * (16 * scale);
      wRot = cockAng;
      wScale = scale * 1.08;
      glowAlpha = windProg * 0.6;
    } else if (isStriking) {
      const sweep = -1.6 + strikeEase * 3.2;
      const orb = aimAng + sweep;
      wx = drawX + Math.cos(orb) * (30 * scale);
      wy = drawY - 8 * scale + Math.sin(orb) * (20 * scale);
      wRot = orb;
      wScale = scale * 1.18;
      glowAlpha = (1 - strikeProg) * 0.7;
    }
    ctx.save();
    ctx.translate(wx, wy);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.beginPath();
    ctx.ellipse(0, 22, 10 * wScale, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(wRot);
    ctx.scale(wScale * 0.92, wScale * 0.92);

    if (glowAlpha > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.55, glowAlpha * 0.5);
      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.ellipse(18, 0, 26, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = '#3b2547';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, 9.5, -Math.PI * 0.68, Math.PI * 0.68);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#a3e635';
    ctx.beginPath();
    ctx.arc(1, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();

    const clawOffsets = [-7.5, 0, 7.5];
    for (let i = 0; i < clawOffsets.length; i++) {
      const cy = clawOffsets[i];
      const len = i === 1 ? 36 : 29;
      ctx.fillStyle = '#ecfccb';
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(5, cy - 2.7);
      ctx.quadraticCurveTo(19, cy - 4.4, len, cy + (i - 1) * 2.4);
      ctx.quadraticCurveTo(19, cy + 1.9, 5, cy + 2.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = isBossTransformed ? '#c084fc' : '#84cc16';
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(14, cy - 1);
      ctx.lineTo(len - 2, cy + (i - 1) * 2.0);
      ctx.stroke();
    }
    ctx.restore();
  } else if (e.kind === EnemyKind.MINI_GHOUL || e.kind === EnemyKind.BOSS_LEGION_GHOUL) {
    // Ghoul Mini & Corrupted Ghoul Boss: Exact Original Dual Left & Right Feral Talons!
    glowColor = '#f43f5e';
    let mainX = drawX + Math.cos(aimAng + 0.72) * (24 * scale);
    let mainY = drawY - 10 * scale + Math.sin(aimAng + 0.72) * (15 * scale) + hover;
    let mainRot = aimAng + 0.28;
    let offX = drawX + Math.cos(aimAng - 0.72) * (24 * scale);
    let offY = drawY - 10 * scale + Math.sin(aimAng - 0.72) * (15 * scale) - hover;
    let offRot = aimAng - 0.28;
    let clawGlow = isBossBuffed ? 0.65 : 0.2;

    if (isWindingUp) {
      const cockR = aimAng + 0.85 + windProg * 0.55;
      const cockL = aimAng - 0.85 - windProg * 0.55;
      mainX = drawX + Math.cos(cockR) * (24 * scale);
      mainY = drawY - 10 * scale + Math.sin(cockR) * (16 * scale);
      mainRot = cockR;
      offX = drawX + Math.cos(cockL) * (24 * scale);
      offY = drawY - 10 * scale + Math.sin(cockL) * (16 * scale);
      offRot = cockL;
      wScale = scale * 1.08;
      clawGlow = 0.4 + windProg * 0.5;
    } else if (isStriking) {
      const sweep = 1.35 - strikeEase * 2.7;
      const orbR = aimAng + sweep;
      const orbL = aimAng - sweep;
      mainX = drawX + Math.cos(orbR) * (30 * scale);
      mainY = drawY - 8 * scale + Math.sin(orbR) * (20 * scale);
      mainRot = orbR;
      offX = drawX + Math.cos(orbL) * (30 * scale);
      offY = drawY - 8 * scale + Math.sin(orbL) * (20 * scale);
      offRot = orbL;
      wScale = scale * 1.18;
      clawGlow = 0.85 * (1 - strikeProg * 0.5);
    }

    drawSingleGhoulFeralClaw(
      ctx,
      offX,
      offY,
      offRot,
      wScale * 0.9,
      glowColor,
      clawGlow,
      isBossTransformed,
      bossStealthTimer > 0,
      -1
    );
    drawSingleGhoulFeralClaw(
      ctx,
      mainX,
      mainY,
      mainRot,
      wScale * 0.9,
      glowColor,
      clawGlow,
      isBossTransformed,
      bossStealthTimer > 0,
      1
    );
  } else if (e.kind === EnemyKind.PLAGUE_STALKER) {
    // Plague Stalker: Venomous Stalker Claws
    glowColor = '#a3e635';
    if (isWindingUp) {
      const cockAng = aimAng - 1.45 * windProg - 0.45;
      wx = drawX + Math.cos(cockAng) * (23 * scale);
      wy = drawY - 9 * scale + Math.sin(cockAng) * (16 * scale);
      wRot = cockAng;
      wScale = scale * 1.12;
    } else if (isStriking) {
      const sweep = -1.75 + strikeEase * 3.5;
      const orb = aimAng + sweep;
      wx = drawX + Math.cos(orb) * (30 * scale);
      wy = drawY - 8 * scale + Math.sin(orb) * (21 * scale);
      wRot = orb;
      wScale = scale * 1.25;
    }
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(wRot);
    ctx.scale(wScale, wScale);
    ctx.strokeStyle = '#a3e635';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    for (const cy of [-4, 0, 4]) {
      ctx.beginPath();
      ctx.moveTo(-2, cy);
      ctx.quadraticCurveTo(9, cy * 1.15 - 1.5, 19, cy * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  } else if (e.kind === EnemyKind.BOSS_LEGION_HUMAN) {
    // Corrupted Human Boss: Heavy Galvanized Steel Pipe Weapon
    glowColor = '#fb923c';
    if (isWindingUp) {
      const cockAng = aimAng - 1.45 * windProg - 0.45;
      wx = drawX + Math.cos(cockAng) * (24 * scale);
      wy = drawY - 9 * scale + Math.sin(cockAng) * (16 * scale);
      wRot = cockAng;
      wScale = scale * 1.1;
      glowAlpha = windProg * 0.6;
    } else if (isStriking) {
      const sweep = -1.7 + strikeEase * 3.4;
      const orb = aimAng + sweep;
      wx = drawX + Math.cos(orb) * (31 * scale);
      wy = drawY - 8 * scale + Math.sin(orb) * (20 * scale);
      wRot = orb;
      wScale = scale * 1.2;
      glowAlpha = (1 - strikeProg) * 0.7;
    }
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(wRot);
    ctx.scale(wScale, wScale);
    drawSteelPipeGraphic(ctx, glowColor, 1.0, false);
    ctx.restore();
  } else if (e.kind === EnemyKind.BOSS_LEGION_EAGLEKIN) {
    // Corrupted Eaglekin Boss: Radiant Celestial Sky Feather Bow
    glowColor = '#38bdf8';
    if (isWindingUp) {
      const cockAng = aimAng - 1.2 * windProg;
      wx = drawX + Math.cos(cockAng) * (25 * scale);
      wy = drawY - 10 * scale + Math.sin(cockAng) * (15 * scale);
      wRot = cockAng;
      wScale = scale * 1.1;
      glowAlpha = windProg * 0.7;
    } else if (isStriking) {
      wx = drawX + Math.cos(aimAng) * (28 * scale);
      wy = drawY - 8 * scale + Math.sin(aimAng) * (18 * scale);
      wRot = aimAng;
      wScale = scale * 1.18;
      glowAlpha = (1 - strikeProg) * 0.8;
    }
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(wRot);
    ctx.scale(wScale, wScale);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 16, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(-6, 0);
    ctx.lineTo(0, 14);
    ctx.stroke();
    ctx.restore();
  } else if (e.kind === EnemyKind.BOSS_LEGION_TIGERKIN) {
    // Corrupted Tigerkin Boss: Twin Savage Tiger Talons
    glowColor = '#f59e0b';
    if (isWindingUp) {
      const cockAng = aimAng - 1.5 * windProg;
      wx = drawX + Math.cos(cockAng) * (26 * scale);
      wy = drawY - 9 * scale + Math.sin(cockAng) * (16 * scale);
      wRot = cockAng;
      wScale = scale * 1.12;
      glowAlpha = windProg * 0.65;
    } else if (isStriking) {
      const sweep = -1.8 + strikeEase * 3.6;
      const orb = aimAng + sweep;
      wx = drawX + Math.cos(orb) * (32 * scale);
      wy = drawY - 8 * scale + Math.sin(orb) * (22 * scale);
      wRot = orb;
      wScale = scale * 1.25;
      glowAlpha = (1 - strikeProg) * 0.75;
    }
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(wRot);
    ctx.scale(wScale, wScale);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.8;
    for (const cy of [-5, 0, 5]) {
      ctx.beginPath();
      ctx.moveTo(-4, cy);
      ctx.quadraticCurveTo(8, cy * 1.2 - 2, 22, cy * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  } else if (e.kind === EnemyKind.MINI_SKELETON || e.kind === EnemyKind.BOSS_LEGION_SKELETON) {
    // Skeleton Mini & Corrupted Skeleton Boss: Exact Original Floating Sharpened Bone Sword (+ Reaper's Judgment Scythe!)
    const isScythe = e.kind === EnemyKind.BOSS_LEGION_SKELETON && (e.bossScytheTimer || 0) > 0;
    glowColor = isScythe ? '#c084fc' : isBossTransformed ? '#fde047' : '#fb923c';
    if (isWindingUp) {
      const cockAng = aimAng - 1.55 * windProg - 0.5;
      wx = drawX + Math.cos(cockAng) * (25 * scale);
      wy = drawY - 10 * scale + Math.sin(cockAng) * (17 * scale);
      wRot = cockAng - 0.45;
      wScale = scale * 1.08;
      glowAlpha = windProg * 0.6;
    } else if (isStriking) {
      const sweep = -1.85 + strikeEase * 3.65;
      const orb = aimAng + sweep;
      wx = drawX + Math.cos(orb) * (32 * scale);
      wy = drawY - 9 * scale + Math.sin(orb) * (22 * scale);
      wRot = orb + 0.38;
      wScale = scale * 1.2;
      glowAlpha = (1 - strikeProg) * 0.75;
    }
    ctx.save();
    ctx.translate(wx, wy);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.beginPath();
    ctx.ellipse(0, 22, 10 * wScale, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(wRot);
    ctx.scale(wScale * 0.88, wScale * 0.88);

    if (glowAlpha > 0.08 || isScythe) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.55, isScythe ? 0.5 : glowAlpha * 0.45);
      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.ellipse(18, 0, 26, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (isScythe) {
      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(48, 0);
      ctx.stroke();

      ctx.fillStyle = '#c084fc';
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(42, -2);
      ctx.quadraticCurveTo(54, 28, 12, 46);
      ctx.quadraticCurveTo(34, 18, 34, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = '#e7e5e4';
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(-11, -2.2, 3, 0, Math.PI * 2);
      ctx.arc(-11, 2.2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#78350f';
      ctx.fillRect(-9, -2.5, 9, 5);
      ctx.strokeRect(-9, -2.5, 9, 5);

      ctx.fillStyle = '#d6d3d1';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(5, -4);
      ctx.lineTo(5, 4);
      ctx.lineTo(0, 9);
      ctx.lineTo(-2, 5);
      ctx.lineTo(-2, -5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(4, -5);
      ctx.lineTo(20, -5.5);
      ctx.lineTo(23, -3.5);
      ctx.lineTo(27, -5.2);
      ctx.lineTo(40, 0);
      ctx.lineTo(26, 5.2);
      ctx.lineTo(4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const pulse = 0.75 + Math.sin(time * 7) * 0.25;
      ctx.strokeStyle = glowAlpha > 0.2 ? glowColor : `rgba(103, 232, 249, ${pulse})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(31, 0);
      ctx.stroke();
    }
    ctx.restore();
  } else {
    // Crypt Rattler: Jagged Curved Bone Scimitar with 210° whip-slash!
    glowColor = '#fb7185';
    if (isWindingUp) {
      // Cock scimitar far back behind shoulder with menacing glint!
      const cockAng = aimAng - 1.55 * windProg - 0.5;
      wx = drawX + Math.cos(cockAng) * (25 * scale);
      wy = drawY - 10 * scale + Math.sin(cockAng) * (17 * scale);
      wRot = cockAng - 0.5;
      wScale = scale * 1.08;
      glowAlpha = windProg * 0.55;
    } else if (isStriking) {
      // Whip 210° across front in an ultra-smooth arc!
      const sweep = -1.85 + strikeEase * 3.65;
      const orb = aimAng + sweep;
      wx = drawX + Math.cos(orb) * (31 * scale);
      wy = drawY - 9 * scale + Math.sin(orb) * (22 * scale);
      wRot = orb + 0.42;
      wScale = scale * 1.24;
      glowAlpha = (1 - strikeProg) * 0.65;
    }

    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(wRot);
    ctx.scale(wScale, wScale);

    if (glowAlpha > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = glowColor;
      ctx.globalAlpha = glowAlpha;
      ctx.beginPath();
      ctx.ellipse(12, 0, 16, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Bone hilt
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-7, -2, 6, 4);

    // Curved jagged bone scimitar blade
    ctx.fillStyle = '#f1f5f9';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-1, -4.2);
    ctx.quadraticCurveTo(13, -6.5, 24, -1);
    ctx.lineTo(18, 4.2);
    ctx.lineTo(-1, 3.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Crimson edge highlight
    ctx.strokeStyle = '#fb7185';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(4, -2.5);
    ctx.lineTo(21, -0.8);
    ctx.stroke();

    ctx.restore();
  }

  // Protective Bone/Iron Ward Shield Ring when shieldHp > 0
  if ((e.shieldHp || 0) > 0) {
    ctx.save();
    ctx.translate(drawX, drawY - 12 * scale);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.72)';
    ctx.fillStyle = 'rgba(253, 224, 71, 0.09)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.rotate(time * 1.4);
    ctx.beginPath();
    ctx.arc(0, 0, 23 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  if (!isBossKind(e.kind) && (e.hp < e.maxHp || (e.shieldHp || 0) > 0)) {
    const bw = 38 * scale;
    const bx = drawX - bw / 2;
    const by = drawY - 39 * scale;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
    ctx.fillStyle = e.poisonTimer > 0 ? '#84cc16' : '#ef4444';
    ctx.fillRect(bx, by, bw * Math.max(0, Math.min(1, e.hp / e.maxHp)), 4);
    if ((e.shieldHp || 0) > 0) {
      const shFrac = Math.min(1, (e.shieldHp || 0) / Math.max(1, e.maxShieldHp || e.maxHp * 0.4));
      ctx.fillStyle = '#fde047';
      ctx.fillRect(bx, by, bw * shFrac, 2.2);
    }
  }

  // Overhead Corrupted [Name] Boss Nameplate
  if (isUndeadLegionBoss(e.kind)) {
    ctx.save();
    ctx.translate(drawX, drawY - 46 * scale);
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)';
    ctx.lineWidth = 3.5;

    ctx.font = '900 12px sans-serif';
    const bossTitle = (e.name || 'Corrupted Boss').toUpperCase();
    ctx.strokeText(bossTitle, 0, -4);
    ctx.fillStyle = '#fde047';
    ctx.fillText(bossTitle, 0, -4);

    ctx.font = 'bold 9px sans-serif';
    ctx.lineWidth = 2.8;
    ctx.strokeText('UNDEAD LEGION', 0, -16);
    ctx.fillStyle = '#f87171';
    ctx.fillText('UNDEAD LEGION', 0, -16);
    ctx.restore();
  }

  // Eaglekin Hunter's Mark target crosshairs and eye reticle
  if (e.huntersMarkTimer && e.huntersMarkTimer > 0) {
    ctx.save();
    ctx.translate(drawX, drawY - (e.kind === EnemyKind.BOSS_WARDEN ? 54 : 44) * scale);
    const pulse = Math.sin(time * 6.5) * 2;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, 11 + pulse, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshairs
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -16 - pulse); ctx.lineTo(0, -7);
    ctx.moveTo(0, 7); ctx.lineTo(0, 16 + pulse);
    ctx.moveTo(-16 - pulse, 0); ctx.lineTo(-7, 0);
    ctx.moveTo(7, 0); ctx.lineTo(16 + pulse, 0);
    ctx.stroke();

    // Golden Eagle Eye glyph in center
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPickupOrb(ctx: CanvasRenderingContext2D, orb: PickupOrb, time: number) {
  const pulse = Math.sin(time * 7 + orb.x) * 2;
  ctx.save();
  ctx.translate(orb.x, orb.y + pulse * 0.6);
  if (orb.kind === 'boss_essence') {
    // Radiant Golden Boss Essence with pulsating celestial star & aura rings
    const glowRad = 16 + Math.sin(time * 4) * 3;
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, glowRad);
    grad.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
    grad.addColorStop(0.4, 'rgba(251, 191, 36, 0.65)');
    grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, glowRad, 0, Math.PI * 2);
    ctx.fill();

    // Rotating 8-point celestial star
    ctx.save();
    ctx.rotate(time * 1.8);
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    for (let p = 0; p < 8; p++) {
      const ang = (p * Math.PI) / 4;
      const r = p % 2 === 0 ? 10 : 4.5;
      if (p === 0) ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
      else ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Central radiant crystal core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Floating text label
    ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'center';
    ctx.fillText('ESSENCE', 0, -14);
  } else if (orb.kind === 'equipment') {
    // Radiant Amber Relic Chest / Artifact Orb with sacred floating runes
    const glowRad = 17 + Math.sin(time * 5) * 3;
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, glowRad);
    grad.addColorStop(0, 'rgba(251, 191, 36, 0.95)');
    grad.addColorStop(0.45, 'rgba(245, 158, 11, 0.65)');
    grad.addColorStop(1, 'rgba(217, 119, 6, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, glowRad, 0, Math.PI * 2);
    ctx.fill();

    // Ornate Relic Jewel / Chest Glyph
    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-7, -6, 14, 12, 3);
    ctx.fill();
    ctx.stroke();

    // Central Glowing Gem
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Floating text label
    ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.fillText('RELIC', 0, -14);
  } else if (orb.kind === 'xp') {
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (orb.kind === 'heal') {
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.roundRect(-5, -5, 10, 10, 3);
    ctx.fill();
  } else {
    ctx.fillStyle = '#fef3c7';
    ctx.rotate(time * 2.5);
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(0, -4);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, time: number) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);

  if (p.kind === 'bone_spear') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.36)';
    ctx.beginPath();
    ctx.ellipse(4, 0, 32, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-24, -4);
    ctx.lineTo(14, -5);
    ctx.lineTo(30, 0);
    ctx.lineTo(14, 5);
    ctx.lineTo(-24, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (p.kind === 'dark_wave') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.arc(-18, 0, 46, -0.82, 0.82);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = '#e879f9';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.arc(-18, 0, 46, -0.78, 0.78);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(-16, 0, 46, -0.7, 0.7);
    ctx.stroke();
  } else if (p.kind === 'crimson_rend_wave') {
    // Ghoul Rending Claws Final Strike: Silky cohesive crimson moon-crescent wave!
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawSilkyCrescentArc(ctx, 38, -0.78, 0.78, 17, '#fff1f2', '#f43f5e', 0.92);
    ctx.restore();
  } else if (p.kind === 'life_leech_orb') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(74, 222, 128, 0.42)';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dcfce7';
    ctx.beginPath();
    ctx.arc(1.5, -1.5, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'ghost_wisp') {
    // Ghost Ranged Homing Basic Attack: Luminous Will-o'-Wisp with undulating ectoplasm tail!
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Undulating 5-segment ectoplasm ribbon tail behind the homing wisp
    ctx.lineCap = 'round';
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 6.5;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let s = 1; s <= 5; s++) {
      const tx = -s * 5.2;
      const ty = Math.sin(time * 24 - s * 0.95) * (s * 1.05);
      ctx.lineTo(tx, ty);
    }
    ctx.stroke();

    ctx.strokeStyle = '#e0e7ff';
    ctx.lineWidth = 2.6;
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.moveTo(2, 0);
    for (let s = 1; s <= 4; s++) {
      const tx = -s * 4.5;
      const ty = Math.sin(time * 24 - s * 0.95) * (s * 0.85);
      ctx.lineTo(tx, ty);
    }
    ctx.stroke();

    // Glowing teardrop Will-o'-Wisp spirit head
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#5eead4';
    ctx.beginPath();
    ctx.arc(2, 0, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.96;
    ctx.fillStyle = '#eef2ff';
    ctx.beginPath();
    ctx.arc(3, 0, 5.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (p.kind === 'ghost_soul_orb') {
    // Ghost 3rd-Hit Ranged Homing Finisher: Dual-Ringed Astral Soul Sphere!
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    ctx.fillStyle = 'rgba(129, 140, 248, 0.4)';
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();

    // Counter-rotating starlight rune rings
    ctx.strokeStyle = '#5eead4';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 5.5, time * 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#c084fc';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 5.5, -time * 8 + 1.1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#e0e7ff';
    ctx.beginPath();
    ctx.arc(0, 0, 7.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (p.kind === 'spectral_bolt') {
    // Ghost Normal Skill 1 (Spectral Bolt): Concentrated piercing spiritual energy lance with helix rings!
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    ctx.fillStyle = 'rgba(99, 102, 241, 0.36)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 36, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dual counter-spiraling spiritual helix strands
    for (let h = 0; h < 2; h++) {
      const sign = h === 0 ? 1 : -1;
      ctx.strokeStyle = h === 0 ? '#2dd4bf' : '#c084fc';
      ctx.lineWidth = 2.6;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      for (let st = 0; st <= 8; st++) {
        const u = st / 8;
        const hx = -28 + u * 52;
        const hy = Math.sin(u * Math.PI * 2.5 - time * 20) * 6.5 * sign * (1 - u * 0.45);
        if (st === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.stroke();
    }

    // Concentrated starlight core lance
    ctx.globalAlpha = 0.96;
    ctx.fillStyle = '#eef2ff';
    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.lineTo(8, -5.2);
    ctx.lineTo(-26, -1.8);
    ctx.lineTo(-26, 1.8);
    ctx.lineTo(8, 5.2);
    ctx.closePath();
    ctx.fill();

    // Vertical astral compression ring near spearhead
    ctx.strokeStyle = '#5eead4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(6, 0, 4.5, 11.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (p.kind === 'thrown_pipe') {
    // Human Skill 4 (Improvised Throw): Actual old metal pipe whirling end-over-end & bouncing back!
    ctx.rotate(-p.angle); // Switch to world-space spin
    const spin = p.spinAngle ?? time * 24;

    // High-speed kinetic steel motion-blur disc + spark ring (distinct whirling turbine look)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = p.returning ? '#fb923c' : '#cbd5e1';
    ctx.lineWidth = 3.2;
    ctx.globalAlpha = 0.65;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, 24, spin, spin + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    ctx.rotate(spin);
    ctx.translate(-11, 0);
    drawSteelPipeGraphic(ctx, p.returning ? '#fb923c' : '#38bdf8', 0.85, false);
  } else if (p.kind === 'homing_splinter') {
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.moveTo(-9, -3);
    ctx.lineTo(10, 0);
    ctx.lineTo(-9, 3);
    ctx.closePath();
    ctx.fill();
  } else if (p.kind === 'enemy_arrow') {
    // Marrow Archer fletched bone arrow with glowing venomous broadhead!
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(163, 230, 53, 0.38)';
    ctx.beginPath();
    ctx.ellipse(8, 0, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Fletching feathers
    ctx.fillStyle = '#65a30d';
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(-18, -4.5);
    ctx.lineTo(-10, -1.5);
    ctx.lineTo(-10, 1.5);
    ctx.lineTo(-18, 4.5);
    ctx.closePath();
    ctx.fill();

    // Bone shaft
    ctx.strokeStyle = '#e7e5e4';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();

    // Venomous broadhead
    ctx.fillStyle = '#bef264';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(7, -4.5);
    ctx.lineTo(9, 0);
    ctx.lineTo(7, 4.5);
    ctx.closePath();
  } else if (p.kind === 'feather_shot') {
    // Eaglekin Normal Basic Attack: Sharp aerodynamic feather in straight line
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.38)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Aerodynamic feather vane & quill shaft
    ctx.fillStyle = '#0284c7';
    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.quadraticCurveTo(2, -6, -14, -3);
    ctx.lineTo(-18, 0);
    ctx.lineTo(-14, 3);
    ctx.quadraticCurveTo(2, 6, 14, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // White central quill shaft
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(13, 0);
    ctx.stroke();
  } else if (p.kind === 'double_feather') {
    // Eaglekin Enhanced Basic Attack: Piercing twin sharpened feather
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(14, 165, 233, 0.44)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#0369a1';
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.quadraticCurveTo(4, -6.5, -13, -3.5);
    ctx.lineTo(-19, 0);
    ctx.lineTo(-13, 3.5);
    ctx.quadraticCurveTo(4, 6.5, 16, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-17, 0);
    ctx.lineTo(15, 0);
    ctx.stroke();
  } else if (p.kind === 'piercing_feather') {
    // Eaglekin Skill 1 (Piercing Volley) & 3rd Attack: Supersonic piercing sky-feather
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.48)';
    ctx.beginPath();
    ctx.ellipse(2, 0, 26, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Supersonic shockwave ring
    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 4, 11, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#0284c7';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.quadraticCurveTo(6, -7.5, -18, -4);
    ctx.lineTo(-24, 0);
    ctx.lineTo(-18, 4);
    ctx.quadraticCurveTo(6, 7.5, 22, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#f0f9ff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(21, 0);
    ctx.stroke();
  } else if (p.kind === 'homing_feather') {
    // Eaglekin Skill 2 (Homing Feathers): Enchanted curved seeking feather
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(6, 182, 212, 0.45)';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    // Tracking wind spiral
    ctx.strokeStyle = '#a5f3fc';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let st = 0; st <= 6; st++) {
      const u = st / 6;
      const sx = -16 + u * 24;
      const sy = Math.sin(u * Math.PI * 2 - time * 20) * 4.5 * (1 - u * 0.4);
      if (st === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#0891b2';
    ctx.strokeStyle = '#cffafe';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.quadraticCurveTo(2, -6, -12, -2.5);
    ctx.lineTo(-16, 0);
    ctx.lineTo(-12, 2.5);
    ctx.quadraticCurveTo(2, 6, 14, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (p.kind === 'final_feather') {
    // Eaglekin Ultimate 3 (Final Horizon): Gigantic enchanted battlefield-piercing sky arrow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(8, 0, 4, 8, 0, 36);
    grad.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
    grad.addColorStop(0.4, 'rgba(56, 189, 248, 0.6)');
    grad.addColorStop(1, 'rgba(2, 132, 199, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(4, 0, 46, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outer sonic compression rings
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(-6, 0, 7, 24, 0, 0, Math.PI * 2);
    ctx.ellipse(-20, 0, 8, 30, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#0284c7';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(38, 0);
    ctx.quadraticCurveTo(12, -14, -28, -8);
    ctx.lineTo(-38, 0);
    ctx.lineTo(-28, 8);
    ctx.quadraticCurveTo(12, 14, 38, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-34, 0);
    ctx.lineTo(36, 0);
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(8, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'tiger_rend_wave') {
    // Crescent shockwave arc unleashed by Tiger's Rend double claw slash!
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const waveGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 36);
    waveGrad.addColorStop(0, '#fef08a');
    waveGrad.addColorStop(0.45, '#f59e0b');
    waveGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');
    ctx.fillStyle = waveGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 32, -Math.PI * 0.42, Math.PI * 0.42);
    ctx.arc(-8, 0, 20, Math.PI * 0.42, -Math.PI * 0.42, true);
    ctx.closePath();
    ctx.fill();

    // Sharp outer razor shockwave crescent
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(0, 0, 30, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();

    // Hot white-hot inner energy arc
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(2, 0, 28, -Math.PI * 0.32, Math.PI * 0.32);
    ctx.stroke();
    ctx.restore();
  } else if (p.kind === 'heavenly_tiger_beast') {
    // Summoned spectral giant celestial tiger charging across the battlefield!
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Radiant celestial aura
    const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, 68);
    glow.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
    glow.addColorStop(0.5, 'rgba(245, 158, 11, 0.3)');
    glow.addColorStop(1, 'rgba(217, 119, 6, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, Math.PI * 2);
    ctx.fill();

    // Spectral beast body silhouette
    ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(42, -6);
    ctx.lineTo(34, -20);
    ctx.lineTo(24, -14);
    ctx.quadraticCurveTo(0, -26, -34, -18);
    ctx.quadraticCurveTo(-52, 0, -42, 18);
    ctx.quadraticCurveTo(-16, 22, 18, 18);
    ctx.lineTo(32, 16);
    ctx.lineTo(38, 6);
    ctx.lineTo(46, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Forehead '王' (King) rune in burning divine white-gold
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(22, -10); ctx.lineTo(30, -10);
    ctx.moveTo(23, -6); ctx.lineTo(29, -6);
    ctx.moveTo(21, -2); ctx.lineTo(31, -2);
    ctx.moveTo(26, -11); ctx.lineTo(26, -1);
    ctx.stroke();

    // Piercing celestial amber eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(32, -8, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.ellipse(32, -8, 1.2, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Roaring sabertooth fangs
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(38, 2);
    ctx.lineTo(35, 11);
    ctx.lineTo(33, 4);
    ctx.closePath();
    ctx.fill();

    // Swirling ethereal wind trails trailing behind
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.6)';
    ctx.lineWidth = 2;
    for (let w = 0; w < 4; w++) {
      const trailY = -12 + w * 9;
      ctx.beginPath();
      ctx.moveTo(-20, trailY);
      ctx.quadraticCurveTo(-45, trailY + Math.sin(time * 8 + w) * 6, -75 - w * 8, trailY - 2);
      ctx.stroke();
    }
    ctx.restore();
  } else {
    // High Warden Ossian 'boss_shard' spinning crimson crystal!
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(244, 63, 94, 0.38)';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.rotate(time * 6);
    ctx.fillStyle = '#fb7185';
    ctx.strokeStyle = '#fef2f2';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(0, -6);
    ctx.lineTo(-12, 0);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  cullL: number,
  cullR: number,
  cullT: number,
  cullB: number
) {
  ctx.save();
  let currentGlow: boolean | null = null;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!p.active) continue;
    if (p.x < cullL || p.x > cullR || p.y < cullT || p.y > cullB) continue;

    const t = p.age / p.maxAge;
    const alpha = Math.max(0, 1 - t);
    const sz = p.size + (p.endSize - p.size) * t;

    if (currentGlow !== p.glow) {
      currentGlow = p.glow;
      ctx.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
    }
    ctx.globalAlpha = alpha;

    if (p.shape === 'circle') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, sz), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.shape === 'ring') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5 * alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, sz), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      if (p.shape === 'spark') {
        ctx.beginPath();
        ctx.moveTo(-sz * 1.8, 0);
        ctx.lineTo(0, -sz * 0.55);
        ctx.lineTo(sz * 1.8, 0);
        ctx.lineTo(0, sz * 0.55);
        ctx.closePath();
        ctx.fill();
      } else if (p.shape === 'bone') {
        ctx.fillRect(-sz, -sz * 0.38, sz * 2, sz * 0.76);
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

function cullTopOr(val: number): number {
  return val;
}

function drawAmbientGlows(
  ctx: CanvasRenderingContext2D,
  map: WorldMap,
  cullL: number,
  cullR: number,
  cullT: number,
  cullB: number,
  time: number
) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const prop of map.props) {
    if (prop.kind !== 'hearth' && prop.kind !== 'torch') continue;
    const gx = prop.x + prop.w / 2;
    const gy = prop.y + prop.h / 2;
    const rad = prop.kind === 'hearth' ? 210 + Math.sin(time * 6) * 8 : 95 + Math.sin(time * 8 + gx) * 5;
    if (gx + rad < cullL || gx - rad > cullR || gy + rad < cullT || gy - rad > cullB) continue;

    const grad = ctx.createRadialGradient(gx, gy, 4, gx, gy, rad);
    grad.addColorStop(0, prop.kind === 'hearth' ? 'rgba(251, 146, 60, 0.22)' : 'rgba(251, 146, 60, 0.14)');
    grad.addColorStop(1, 'rgba(251, 146, 60, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(gx, gy, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFloatingTexts(ctx: CanvasRenderingContext2D, texts: FloatingText[]) {
  ctx.save();
  ctx.textAlign = 'center';
  for (let i = 0; i < texts.length; i++) {
    const ft = texts[i];
    if (!ft.active) continue;
    const t = ft.age / ft.maxAge;
    ctx.globalAlpha = Math.max(0, 1 - t * t);
    ctx.font = ft.isCrit
      ? '700 17px "JetBrains Mono", monospace'
      : '600 13px "JetBrains Mono", monospace';
    ctx.fillStyle = '#09090b';
    ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.restore();
}
