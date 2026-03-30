/**
 * Global Web Audio API singleton for instant SFX playback.
 * Buffers are decoded once and reused across the entire app lifecycle.
 */

const SOUND_CONFIG = {
  correct: { path: "/sounds/respuesta_correcta.wav", volume: 0.5 },
  wrong: { path: "/sounds/respuesta_incorrecta.wav", volume: 0.5 },
  xp: { path: "/sounds/gana_experiencia.wav", volume: 0.6 },
  moduleComplete: { path: "/sounds/completa_modulo.wav", volume: 0.7 },
} as const;

export type SoundKey = keyof typeof SOUND_CONFIG;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private buffers: Map<SoundKey, AudioBuffer> = new Map();
  private loaded = false;
  private loading = false;

  /** Resume/create AudioContext after user interaction */
  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /** Pre-load all sound buffers (call once) */
  async preload(): Promise<void> {
    if (this.loaded || this.loading) return;
    this.loading = true;

    const ctx = this.ensureContext();

    const entries = Object.entries(SOUND_CONFIG) as [SoundKey, typeof SOUND_CONFIG[SoundKey]][];

    await Promise.all(
      entries.map(async ([key, config]) => {
        try {
          const response = await fetch(config.path);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          this.buffers.set(key, audioBuffer);
        } catch (e) {
          console.warn(`[AudioEngine] Failed to load ${key}:`, e);
        }
      })
    );

    this.loaded = true;
    this.loading = false;
  }

  /** Play a sound instantly from pre-decoded buffer */
  play(key: SoundKey): void {
    const ctx = this.ensureContext();
    const buffer = this.buffers.get(key);
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = ctx.createGain();
    gainNode.gain.value = SOUND_CONFIG[key].volume;

    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start(0);
  }
}

// Singleton instance
export const audioEngine = new AudioEngine();
