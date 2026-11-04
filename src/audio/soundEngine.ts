class SoundEngine {
  private ctx: AudioContext | null = null;
  private volume = 0.65;

  private lastSlashMs = 0;
  private lastHitMs = 0;
  private lastClangMs = 0;

  private clampFreq(f: number, fallback = 220): number {
    if (!Number.isFinite(f)) return fallback;
    return Math.max(24, Math.min(12000, f));
  }

  public setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.65));
  }

  private ensureContext(): AudioContext | null {
    if (this.volume <= 0.01) return null;
    try {
      if (!this.ctx && typeof window !== 'undefined') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public unlock() {
    this.ensureContext();
  }

  public playSlash(pitch = 1) {
    const nowMs = performance.now();
    if (nowMs - this.lastSlashMs < 18) return;
    this.lastSlashMs = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const safePitch = Number.isFinite(pitch) ? Math.max(0.4, Math.min(2.5, pitch)) : 1;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(this.clampFreq(360 * safePitch), now);
      osc.frequency.exponentialRampToValueAtTime(this.clampFreq(95 * safePitch), now + 0.11);

      gain.gain.setValueAtTime(Math.max(0.002, 0.14 * this.volume), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // ignore transient audio node error
    }
  }

  public playHit(isCrit = false) {
    const nowMs = performance.now();
    if (nowMs - this.lastHitMs < 18) return;
    this.lastHitMs = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isCrit ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(isCrit ? 620 : 230, now);
      osc.frequency.exponentialRampToValueAtTime(isCrit ? 180 : 85, now + (isCrit ? 0.15 : 0.08));

      gain.gain.setValueAtTime(Math.max(0.002, (isCrit ? 0.18 : 0.11) * this.volume), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isCrit ? 0.16 : 0.09));

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.17);
    } catch {
      // ignore transient audio node error
    }
  }

  public playSkill(type: 'spear' | 'shield' | 'rush' | 'storm' | 'ultimate') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'spear') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.18);
      gain.gain.setValueAtTime(0.14 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'shield') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(540, now + 0.22);
      gain.gain.setValueAtTime(0.15 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    } else if (type === 'rush') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.exponentialRampToValueAtTime(690, now + 0.16);
      gain.gain.setValueAtTime(0.16 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.19);
    } else if (type === 'storm') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.linearRampToValueAtTime(480, now + 0.28);
      gain.gain.setValueAtTime(0.14 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.31);
    } else {
      // Ultimate chord
      [220, 330, 440].forEach((freq, idx) => {
        const uOsc = ctx.createOscillator();
        const uGain = ctx.createGain();
        uOsc.type = idx === 2 ? 'triangle' : 'sawtooth';
        uOsc.frequency.setValueAtTime(freq, now);
        uOsc.frequency.exponentialRampToValueAtTime(freq * 1.45, now + 0.38);
        uGain.gain.setValueAtTime(0.09 * this.volume, now);
        uGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        uOsc.connect(uGain);
        uGain.connect(ctx.destination);
        uOsc.start(now);
        uOsc.stop(now + 0.44);
      });
    }
  }

  public playPickup() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);
    gain.gain.setValueAtTime(0.09 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playGhostWisp(pitch = 1) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(540 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(860 * pitch, now + 0.09);
    gain.gain.setValueAtTime(0.11 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playWail() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [390, 585].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 1.38, now + 0.14);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.68, now + 0.36);
      gain.gain.setValueAtTime(0.11 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    });
  }

  public playUiTap() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(460, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.05);
    gain.gain.setValueAtTime(0.08 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playPipeSwing(pitch = 1) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Low blunt air-displacement whoosh of a heavy steel pipe
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(215 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(68 * pitch, now + 0.13);

    gain.gain.setValueAtTime(0.16 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playPipeClang(pitch = 1, heavy = false) {
    const nowMs = performance.now();
    if (nowMs - this.lastClangMs < 20) return;
    this.lastClangMs = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const safePitch = Number.isFinite(pitch) ? Math.max(0.4, Math.min(2.4, pitch)) : 1;

      const partials = heavy ? [145, 582, 1140, 1790] : [175, 690, 1315];
      partials.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        const dur = idx === 0 ? (heavy ? 0.14 : 0.09) : heavy ? 0.24 : 0.16;
        osc.frequency.setValueAtTime(this.clampFreq(freq * safePitch), now);
        if (idx === 0) {
          osc.frequency.exponentialRampToValueAtTime(this.clampFreq(52 * safePitch), now + dur);
        } else {
          osc.frequency.exponentialRampToValueAtTime(
            this.clampFreq(freq * 0.96 * safePitch),
            now + dur
          );
        }
        const amp = Math.max(0.002, (idx === 0 ? 0.15 : heavy ? 0.095 : 0.068) * this.volume);
        gain.gain.setValueAtTime(amp, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.01);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + dur + 0.02);
      });
    } catch {
      // ignore
    }
  }

  public playFeatherShoot(pitch = 1, heavy = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // High aerodynamic quill whistle & bowstring snap
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = heavy ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime((heavy ? 720 : 980) * pitch, now);
    osc.frequency.exponentialRampToValueAtTime((heavy ? 220 : 340) * pitch, now + (heavy ? 0.14 : 0.09));

    gain.gain.setValueAtTime((heavy ? 0.17 : 0.12) * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.15 : 0.1));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (heavy ? 0.16 : 0.11));
  }

  public playWingFlap(pitch = 1) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Soft, deep aerodynamic wing displacement
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(55 * pitch, now + 0.14);

    gain.gain.setValueAtTime(0.18 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playSkyScreech(pitch = 1) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Resonant raptor sky cry with harmonics
    [540, 1080].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * pitch, now);
      osc.frequency.exponentialRampToValueAtTime((freq * 0.45) * pitch, now + 0.32);

      gain.gain.setValueAtTime((idx === 0 ? 0.14 : 0.08) * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    });
  }

  public playFeralClaw(pitch = 1, heavy = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Razor-sharp predator claw slash through flesh and air
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = heavy ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime((heavy ? 440 : 580) * pitch, now);
    osc.frequency.exponentialRampToValueAtTime((heavy ? 110 : 160) * pitch, now + (heavy ? 0.16 : 0.11));

    gain.gain.setValueAtTime((heavy ? 0.2 : 0.15) * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.17 : 0.12));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (heavy ? 0.18 : 0.13));
  }

  public playTigerRoar(pitch = 1) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Primal feline apex roar with low guttural rumble & reverberating chest growl
    [140, 280, 420].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq * pitch, now);
      osc.frequency.exponentialRampToValueAtTime((freq * 0.6) * pitch, now + 0.42);

      gain.gain.setValueAtTime((idx === 0 ? 0.22 : 0.12) * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.46);
    });
  }

  public playPortalSpawn() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Shimmering dimensional rift opening chord
      [293.66, 440, 587.33, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        const delay = idx * 0.055;
        osc.frequency.setValueAtTime(this.clampFreq(freq * 0.72), now + delay);
        osc.frequency.exponentialRampToValueAtTime(this.clampFreq(freq * 1.18), now + delay + 0.42);
        gain.gain.setValueAtTime(0.001, now + delay);
        gain.gain.linearRampToValueAtTime(Math.max(0.002, 0.11 * this.volume), now + delay + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.52);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.55);
      });
    } catch {
      // ignore
    }
  }

  public playPortalWarp(isLobby = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const base = isLobby ? [329.63, 493.88, 659.25] : [261.63, 392.0, 523.25];
      base.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === 2 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(this.clampFreq(freq), now);
        osc.frequency.exponentialRampToValueAtTime(this.clampFreq(freq * 1.85), now + 0.34);
        gain.gain.setValueAtTime(Math.max(0.002, 0.12 * this.volume), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
      });
    } catch {
      // ignore
    }
  }
}

export const soundEngine = new SoundEngine();
