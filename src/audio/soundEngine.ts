class SoundEngine {
  private ctx: AudioContext | null = null;
  private volume = 0.65;

  public setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
  }

  private ensureContext(): AudioContext | null {
    if (this.volume <= 0.01) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock() {
    this.ensureContext();
  }

  public playSlash(pitch = 1) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Crisp airy sword whoosh using filtered noise + triangle sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(95 * pitch, now + 0.11);

    gain.gain.setValueAtTime(0.14 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playHit(isCrit = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isCrit ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(isCrit ? 620 : 230, now);
    osc.frequency.exponentialRampToValueAtTime(isCrit ? 180 : 85, now + (isCrit ? 0.15 : 0.08));

    gain.gain.setValueAtTime((isCrit ? 0.18 : 0.11) * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isCrit ? 0.16 : 0.09));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
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
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Authentic hollow steel pipe ring (inharmonic metallic overtones + blunt thud)
    const partials = heavy ? [145, 582, 1140, 1790] : [175, 690, 1315];
    partials.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      const dur = idx === 0 ? (heavy ? 0.14 : 0.09) : (heavy ? 0.24 : 0.16);
      osc.frequency.setValueAtTime(freq * pitch, now);
      if (idx === 0) {
        osc.frequency.exponentialRampToValueAtTime(52 * pitch, now + dur);
      } else {
        osc.frequency.exponentialRampToValueAtTime(freq * 0.96 * pitch, now + dur);
      }
      const amp = (idx === 0 ? 0.15 : heavy ? 0.095 : 0.068) * this.volume;
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.01);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    });
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
}

export const soundEngine = new SoundEngine();
