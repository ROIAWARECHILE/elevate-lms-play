import { useCallback, useRef } from "react";
import correctSound from "@/assets/sounds/respuesta_correcta.wav";
import wrongSound from "@/assets/sounds/respuesta_incorrecta.wav";
import xpSound from "@/assets/sounds/gana_experiencia.wav";
import moduleCompleteSound from "@/assets/sounds/completa_modulo.wav";

const playAudio = (src: string, volume = 0.6) => {
  try {
    console.log("[SoundFX] Playing:", src);
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
  const playCorrect = useCallback(() => playAudio(correctSound, 0.5), []);
  const playWrong = useCallback(() => playAudio(wrongSound, 0.5), []);
  const playXp = useCallback(() => playAudio(xpSound, 0.6), []);
  const playModuleComplete = useCallback(() => playAudio(moduleCompleteSound, 0.7), []);

  return { playCorrect, playWrong, playXp, playModuleComplete };
}
