import { useCallback } from "react";

const playAudio = (src: string, volume = 0.6) => {
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.play().catch((err) => {
      console.warn("[SoundFX] Play blocked:", err.message);
    });
  } catch (err) {
    console.error("[SoundFX] Error:", err);
  }
};

export function useSoundEffects() {
  const playCorrect = useCallback(() => playAudio("/sounds/respuesta_correcta.wav", 0.5), []);
  const playWrong = useCallback(() => playAudio("/sounds/respuesta_incorrecta.wav", 0.5), []);
  const playXp = useCallback(() => playAudio("/sounds/gana_experiencia.wav", 0.6), []);
  const playModuleComplete = useCallback(() => playAudio("/sounds/completa_modulo.wav", 0.7), []);

  return { playCorrect, playWrong, playXp, playModuleComplete };
}
