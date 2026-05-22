/**
 * AudioEngine — reproduce archivos MP3 generados con ElevenLabs.
 * Carga cada sonido como AudioBuffer y lo reproduce a través del
 * chain maestro (compresor + ganancia). Si un archivo falla al
 * cargar, cae automáticamente a la síntesis procedural original.
 */

// ─── Mapa de archivos por clave ───────────────────────────────────────────────

const SOUND_FILES: Record<string, string> = {
  correct:        "/sounds/correct.mp3",
  wrong:          "/sounds/wrong.mp3",
  xp:             "/sounds/xp.mp3",
  moduleComplete: "/sounds/module-complete.mp3",
  quizPass:       "/sounds/quiz-pass.mp3",
  quizFail:       "/sounds/quiz-fail.mp3",
};

// ─── Engine ───────────────────────────────────────────────────────────────────

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private reverbBuffer: AudioBuffer | null = null;

  /** AudioBuffers decodificados desde los MP3 de ElevenLabs */
  private buffers = new Map<string, AudioBuffer>();
  /** Claves que ya intentamos cargar (exitosa o fallida) para no reintentar */
  private loaded = new Set<string>();

  // ─── Contexto Web Audio ───────────────────────────────────────────────────

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.setupMaster(this.ctx);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  private setupMaster(ctx: AudioContext) {
    this.masterCompressor = ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.value = -14;
    this.masterCompressor.knee.value = 8;
    this.masterCompressor.ratio.value = 4;
    this.masterCompressor.attack.value = 0.003;
    this.masterCompressor.release.value = 0.18;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.82;

    this.masterCompressor.connect(this.masterGain);
    this.masterGain.connect(ctx.destination);

    this.reverbBuffer = this.buildReverb(ctx, 0.6, 2.8);
  }

  private buildReverb(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const buf = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buf;
  }

  private createReverb(): ConvolverNode {
    const ctx = this.ensureContext();
    const conv = ctx.createConvolver();
    conv.buffer = this.reverbBuffer;
    return conv;
  }

  private getOutput(ctx: AudioContext): AudioNode {
    return this.masterCompressor ?? ctx.destination;
  }

  // ─── Carga de archivos ────────────────────────────────────────────────────

  private async loadFile(key: string): Promise<void> {
    if (this.loaded.has(key)) return;
    this.loaded.add(key);

    const url = SOUND_FILES[key];
    if (!url) return;

    try {
      const ctx = this.ensureContext();
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.buffers.set(key, audioBuffer);
    } catch (err) {
      // Silencioso: la síntesis procedural actuará como fallback
      console.warn(`[AudioEngine] No se pudo cargar "${key}", usando síntesis: ${err}`);
    }
  }

  /** Pre-carga todos los archivos MP3. Llamar una vez al montar la app. */
  async preload(): Promise<void> {
    try {
      this.ensureContext();
    } catch (_) {
      return;
    }
    await Promise.all(Object.keys(SOUND_FILES).map((k) => this.loadFile(k)));
  }

  // ─── Reproducción ─────────────────────────────────────────────────────────

  play(key: SoundKey): void {
    try {
      const ctx = this.ensureContext();
      const buf = this.buffers.get(key);

      if (buf) {
        this.playBuffer(ctx, buf);
      } else {
        // Fallback procedural mientras el archivo carga o si falló
        this.loadFile(key); // intenta cargar en background
        PROCEDURAL_SOUNDS[key]?.(ctx, this.getOutput(ctx), (wet) => {
          const conv = this.createReverb();
          return conv;
        });
      }
    } catch (_) {}
  }

  private playBuffer(ctx: AudioContext, buf: AudioBuffer): void {
    const src = ctx.createBufferSource();
    src.buffer = buf;

    // Leve ganancia de normalización
    const gain = ctx.createGain();
    gain.gain.value = 0.9;

    src.connect(gain);
    gain.connect(this.getOutput(ctx));
    src.start(ctx.currentTime);
  }
}

// ─── Síntesis procedural (fallback) ──────────────────────────────────────────

type ReverbFactory = (wet: number) => ConvolverNode;

function synth(
  ctx: AudioContext,
  out: AudioNode,
  freq: number,
  t: number,
  opts: {
    type?: OscillatorType;
    vol?: number;
    attack?: number;
    decay?: number;
    sustain?: number;
    release?: number;
    duration?: number;
    detune?: number;
    freqEnd?: number;
  } = {},
): GainNode {
  const {
    type = "sine", vol = 0.4, attack = 0.008, decay = 0.12,
    sustain = 0.6, release = 0.18, duration = 0.35,
    detune = 0, freqEnd,
  } = opts;

  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (detune) o.detune.setValueAtTime(detune, t);
  if (freqEnd !== undefined) {
    o.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 0.001), t + duration);
  }
  const peak = vol, sus = vol * sustain, end = t + duration;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.linearRampToValueAtTime(sus, t + attack + decay);
  g.gain.setValueAtTime(sus, end - release);
  g.gain.exponentialRampToValueAtTime(0.0001, end + 0.01);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(end + 0.05);
  return g;
}

function noise(
  ctx: AudioContext, out: AudioNode, t: number, duration: number,
  vol: number, filterFreq = 2000, filterType: BiquadFilterType = "bandpass",
): void {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const filt = ctx.createBiquadFilter(); filt.type = filterType;
  filt.frequency.value = filterFreq; filt.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filt); filt.connect(g); g.connect(out);
  src.start(t); src.stop(t + duration);
}

function withReverb(
  ctx: AudioContext, mainOut: AudioNode, reverbFactory: ReverbFactory,
  wetLevel: number, fn: (dryOut: AudioNode) => void,
): void {
  const dry = ctx.createGain(); dry.gain.value = 1;
  const wet = ctx.createGain(); wet.gain.value = wetLevel;
  const conv = reverbFactory(wetLevel);
  dry.connect(mainOut); dry.connect(conv); conv.connect(wet); wet.connect(mainOut);
  fn(dry);
}

const PROCEDURAL_SOUNDS: Record<string, (ctx: AudioContext, out: AudioNode, reverb: ReverbFactory) => void> = {
  correct(ctx, out, reverb) {
    withReverb(ctx, out, reverb, 0.18, (dry) => {
      const t = ctx.currentTime + 0.01;
      synth(ctx, dry, 523.25, t, { type: "sine", vol: 0.38, attack: 0.003, decay: 0.08, sustain: 0.5, release: 0.12, duration: 0.28 });
      synth(ctx, dry, 659.25, t + 0.08, { type: "sine", vol: 0.42, attack: 0.003, decay: 0.07, sustain: 0.5, release: 0.14, duration: 0.30 });
      synth(ctx, dry, 1046.5, t + 0.08, { type: "sine", vol: 0.12, attack: 0.004, decay: 0.10, sustain: 0.2, release: 0.10, duration: 0.22 });
      synth(ctx, dry, 659.25, t + 0.08, { type: "triangle", vol: 0.14, attack: 0.003, decay: 0.09, sustain: 0.3, release: 0.12, duration: 0.26, detune: 4 });
      noise(ctx, dry, t, 0.018, 0.06, 3500, "highpass");
      noise(ctx, dry, t + 0.08, 0.018, 0.07, 4000, "highpass");
    });
  },
  wrong(ctx, out, reverb) {
    withReverb(ctx, out, reverb, 0.10, (dry) => {
      const t = ctx.currentTime + 0.01;
      synth(ctx, dry, 293.66, t, { type: "triangle", vol: 0.35, attack: 0.005, decay: 0.14, sustain: 0.1, release: 0.08, duration: 0.22, freqEnd: 220 });
      synth(ctx, dry, 146.83, t, { type: "sine", vol: 0.18, attack: 0.006, decay: 0.12, sustain: 0.1, release: 0.08, duration: 0.20 });
      synth(ctx, dry, 246.94, t + 0.16, { type: "triangle", vol: 0.30, attack: 0.005, decay: 0.14, sustain: 0.1, release: 0.08, duration: 0.22, freqEnd: 185 });
      synth(ctx, dry, 123.47, t + 0.16, { type: "sine", vol: 0.15, attack: 0.006, decay: 0.12, sustain: 0.1, release: 0.08, duration: 0.20 });
      noise(ctx, dry, t, 0.06, 0.08, 280, "lowpass");
      noise(ctx, dry, t + 0.16, 0.06, 0.07, 280, "lowpass");
    });
  },
  xp(ctx, out, reverb) {
    withReverb(ctx, out, reverb, 0.24, (dry) => {
      const t = ctx.currentTime + 0.01;
      const notes = [{ f: 523.25, dt: 0.00, vol: 0.32 }, { f: 659.25, dt: 0.09, vol: 0.36 }, { f: 783.99, dt: 0.18, vol: 0.40 }];
      notes.forEach(({ f, dt, vol }) => {
        synth(ctx, dry, f, t + dt, { type: "sine", vol, attack: 0.004, decay: 0.10, sustain: 0.55, release: 0.16, duration: 0.34 });
        synth(ctx, dry, f, t + dt, { type: "triangle", vol: vol * 0.28, attack: 0.004, decay: 0.09, sustain: 0.4, release: 0.14, duration: 0.30, detune: 3 });
      });
      synth(ctx, dry, 1046.5, t + 0.22, { type: "sine", vol: 0.16, attack: 0.004, decay: 0.12, sustain: 0.3, release: 0.18, duration: 0.38 });
      notes.forEach(({ dt }) => noise(ctx, dry, t + dt, 0.016, 0.05, 4500, "highpass"));
    });
  },
  moduleComplete(ctx, out, reverb) {
    withReverb(ctx, out, reverb, 0.32, (dry) => {
      const t = ctx.currentTime + 0.01;
      [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => {
        const dt = i * 0.095;
        synth(ctx, dry, f, t + dt, { type: "sine", vol: 0.28 + i * 0.018, attack: 0.005, decay: 0.10, sustain: 0.5, release: 0.18, duration: 0.32 });
        synth(ctx, dry, f, t + dt, { type: "triangle", vol: 0.10, attack: 0.005, decay: 0.09, sustain: 0.4, release: 0.15, duration: 0.28, detune: -5 });
      });
      const finalT = t + 5 * 0.095 + 0.04;
      [261.63, 329.63, 392.0, 523.25, 659.25].forEach((f, i) => {
        synth(ctx, dry, f, finalT, { type: "sine", vol: 0.20 - i * 0.018, attack: 0.010, decay: 0.15, sustain: 0.7, release: 0.35, duration: 0.90 });
      });
      synth(ctx, dry, 1046.5, finalT, { type: "sine", vol: 0.14, attack: 0.008, decay: 0.12, sustain: 0.5, release: 0.30, duration: 0.85 });
      synth(ctx, dry, 65.41, finalT, { type: "sine", vol: 0.22, attack: 0.004, decay: 0.18, sustain: 0.1, release: 0.12, duration: 0.35 });
      noise(ctx, dry, finalT, 0.025, 0.10, 5000, "highpass");
    });
  },
  quizPass(ctx, out, reverb) {
    withReverb(ctx, out, reverb, 0.20, (dry) => {
      const t = ctx.currentTime + 0.01;
      [{ f: 523.25, dt: 0.00, vol: 0.30, dur: 0.28 }, { f: 659.25, dt: 0.10, vol: 0.34, dur: 0.30 }, { f: 783.99, dt: 0.20, vol: 0.38, dur: 0.45 }].forEach(({ f, dt, vol, dur }) => {
        synth(ctx, dry, f, t + dt, { type: "sine", vol, attack: 0.006, decay: 0.10, sustain: 0.55, release: 0.18, duration: dur });
        synth(ctx, dry, f, t + dt, { type: "triangle", vol: vol * 0.22, attack: 0.006, decay: 0.09, sustain: 0.4, release: 0.14, duration: dur - 0.04, detune: 3 });
      });
      noise(ctx, dry, t + 0.20, 0.015, 0.04, 4200, "highpass");
    });
  },
  quizFail(ctx, out, reverb) {
    withReverb(ctx, out, reverb, 0.12, (dry) => {
      const t = ctx.currentTime + 0.01;
      synth(ctx, dry, 329.63, t, { type: "triangle", vol: 0.28, attack: 0.008, decay: 0.12, sustain: 0.4, release: 0.16, duration: 0.30 });
      synth(ctx, dry, 293.66, t + 0.14, { type: "triangle", vol: 0.24, attack: 0.008, decay: 0.12, sustain: 0.35, release: 0.15, duration: 0.28, freqEnd: 261.63 });
      synth(ctx, dry, 261.63, t + 0.30, { type: "sine", vol: 0.22, attack: 0.010, decay: 0.14, sustain: 0.5, release: 0.22, duration: 0.50 });
      noise(ctx, dry, t, 0.04, 0.05, 300, "lowpass");
    });
  },
};

// ─── Exportaciones ────────────────────────────────────────────────────────────

export type SoundKey = keyof typeof SOUND_FILES;
export const audioEngine = new AudioEngine();
