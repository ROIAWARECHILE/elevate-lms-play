import { useCallback, useEffect, useRef } from "react";

const SOUND_PATHS = {
  correct: "/sounds/respuesta_correcta.wav",
  wrong: "/sounds/respuesta_incorrecta.wav",
  xp: "/sounds/gana_experiencia.wav",
  moduleComplete: "/sounds/completa_modulo.wav",
} as const;

export function useSoundEffects() {
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  useEffect(() => {
    Object.entries(SOUND_PATHS).forEach(([key, src]) => {
      const audio = new Audio(src);
      audio.volume = key === "moduleComplete" ? 0.7 : key === "xp" ? 0.6 : 0.5;
      audio.load();
      audioRefs.current[key] = audio;
    });

    return () => {
      Object.values(audioRefs.current).forEach((a) => {
        if (a) {
          a.pause();
          a.src = "";
        }
      });
      audioRefs.current = {};
    };
  }, []);

  const play = useCallback((key: string) => {
    const audio = audioRefs.current[key];
    if (!audio) return;
    // Clone for overlapping plays, instant playback since source is cached
    const clone = audio.cloneNode(true) as HTMLAudioElement;
    clone.volume = audio.volume;
    clone.play().catch(() => {});
  }, []);

  const playCorrect = useCallback(() => play("correct"), [play]);
  const playWrong = useCallback(() => play("wrong"), [play]);
  const playXp = useCallback(() => play("xp"), [play]);
  const playModuleComplete = useCallback(() => play("moduleComplete"), [play]);

  return { playCorrect, playWrong, playXp, playModuleComplete };
}
