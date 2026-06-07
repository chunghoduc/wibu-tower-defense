/**
 * Sfx — tiny procedural sound engine (Web Audio, no assets). Synthesizes short
 * blips/sweeps/noise for combat feedback. Per-type throttling keeps frequent
 * events (attacks/hits) from becoming a buzz. All calls are defensive no-ops if
 * Web Audio is unavailable or the context can't start.
 */
// Global audio config (shared across every Sfx instance + the music bed) so the
// settings menu controls all sound from one place. Volume is 0..1.
const audioConfig = { volume: 0.7, muted: false };
export function setAudioVolume(v: number): void { audioConfig.volume = Math.max(0, Math.min(1, v)); }
export function getAudioVolume(): number { return audioConfig.volume; }
export function setAudioMuted(m: boolean): void { audioConfig.muted = m; }
export function isAudioMuted(): boolean { return audioConfig.muted; }

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private last: Record<string, number> = {};

  /** Lazily create / resume the audio context (must follow a user gesture). */
  private ac(): AudioContext | null {
    if (audioConfig.muted) return null;
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
      } catch { return null; }
    }
    if (this.master) this.master.gain.value = 0.25 * audioConfig.volume; // live volume
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setMuted(m: boolean): void { audioConfig.muted = m; }
  toggleMute(): boolean { audioConfig.muted = !audioConfig.muted; return audioConfig.muted; }

  /** True if this sound type may play now (per-type rate limit). */
  private gate(key: string, minGapMs: number): boolean {
    const now = this.ctx ? this.ctx.currentTime * 1000 : performance.now();
    if ((this.last[key] ?? -1e9) + minGapMs > now) return false;
    this.last[key] = now;
    return true;
  }

  /** A single oscillator tone with an exp decay envelope (+ optional pitch sweep). */
  private tone(freq: number, dur: number, type: OscillatorType, gain: number, sweepTo?: number): void {
    const ac = this.ac(); if (!ac || !this.master) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  /** A short filtered-noise burst (impacts / hits). */
  private noise(dur: number, gain: number, freq = 1200): void {
    const ac = this.ac(); if (!ac || !this.master) return;
    const t = ac.currentTime;
    const n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource(); src.buffer = buf;
    const filt = ac.createBiquadFilter(); filt.type = "bandpass"; filt.frequency.value = freq;
    const g = ac.createGain(); g.gain.value = gain;
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  // ---- named sounds (throttled) -------------------------------------------
  attack(ranged: boolean): void { if (this.gate("atk", 55)) this.tone(ranged ? 620 : 340, 0.08, "square", 0.10, ranged ? 880 : 220); }
  hit(): void { if (this.gate("hit", 50)) this.noise(0.05, 0.10, 1500); }
  death(): void { if (this.gate("death", 40)) this.tone(300, 0.22, "sawtooth", 0.14, 90); }
  cast(): void { if (this.gate("cast", 70)) { this.tone(440, 0.30, "triangle", 0.16, 1320); this.tone(660, 0.30, "sine", 0.10, 1760); } }
  coin(): void { if (this.gate("coin", 60)) this.tone(1180, 0.10, "square", 0.08, 1560); }
  enemyHit(): void { if (this.gate("ehit", 70)) this.noise(0.06, 0.08, 700); }
  place(): void { this.tone(520, 0.12, "triangle", 0.18, 760); }
  click(): void { this.tone(660, 0.05, "square", 0.10); }
  win(): void { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, "triangle", 0.2), i * 110)); }
  lose(): void { [392, 311, 233].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, "sawtooth", 0.2), i * 150)); }
}

/**
 * Music — a gentle procedural ambient bed (no audio assets). A slow looping
 * chord progression of soft sine pads, scaled by the shared audio volume and
 * gated by the global mute. Singleton; the settings menu enables/disables it.
 */
export class Music {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private enabled = false;

  // A calm i–VI–III–VII style progression (A minor), one chord every ~4s.
  private static readonly CHORDS = [
    [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 329.6], [164.8, 207.7, 246.9],
  ];
  private step = 0;

  private ac(): AudioContext | null {
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
        this.gain = this.ctx.createGain();
        this.gain.connect(this.ctx.destination);
      } catch { return null; }
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private playChord(): void {
    const ac = this.ac(); if (!ac || !this.gain) return;
    this.gain.gain.value = (audioConfig.muted ? 0 : audioConfig.volume) * 0.06; // very soft bed
    const chord = Music.CHORDS[this.step % Music.CHORDS.length];
    this.step++;
    const t = ac.currentTime;
    for (const f of chord) {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 1.2);   // slow swell
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.8); // slow fade
      osc.connect(g); g.connect(this.gain);
      osc.start(t); osc.stop(t + 4);
    }
  }

  setEnabled(on: boolean): void { on ? this.start() : this.stop(); }
  isEnabled(): boolean { return this.enabled; }

  start(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.playChord();
    this.timer = setInterval(() => this.playChord(), 4000);
  }

  stop(): void {
    this.enabled = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}

/** Shared ambient-music singleton (one bed across all scenes). */
export const music = new Music();
