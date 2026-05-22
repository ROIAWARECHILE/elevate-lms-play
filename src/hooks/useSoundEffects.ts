import { useCallback, useEffect } from "react";
import { audioEngine } from "@/lib/audioEngine";

export function useSoundEffects() {
  // Preload buffers once (no-op if already loaded)
  useEffect(() => {
    audioEngine.preload();
  }, []);

  const playCorrect = useCallback(() => audioEngine.play("correct"), []);
  const playWrong = useCallback(() => audioEngine.play("wrong"), []);
  const playXp = useCallback(() => audioEngine.play("xp"), []);
  const playModuleComplete = useCallback(() => audioEngine.play("moduleComplete"), []);
  const playQuizPass = useCallback(() => audioEngine.play("quizPass"), []);
  const playQuizFail = useCallback(() => audioEngine.play("quizFail"), []);

  return { playCorrect, playWrong, playXp, playModuleComplete, playQuizPass, playQuizFail };
}
