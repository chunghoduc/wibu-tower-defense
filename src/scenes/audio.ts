/**
 * Sfx — tiny procedural sound engine (Web Audio, no assets). Synthesizes short
 * blips/sweeps/noise for combat feedback. Per-type throttling keeps frequent
 * events (attacks/hits) from becoming a buzz. All calls are defensive no-ops if
 * Web Audio is unavailable or the context can't start.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private last: Record<string, number> = {};
  private muted = false;

  /** Lazily create / resume the audio context (must follow a user gesture). */
  private ac(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.25;
        this.master.connect(this.ctx.destination);
      } catch { return null; }
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setMuted(m: boolean): void { this.muted = m; }
  toggleMute(): boolean { this.muted = !this.muted; return this.muted; }

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
