import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Headphones, Play, Pause, RotateCcw, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";

interface Props {
  lessonId: string;
  lessonType: string;
}

type PlayerState = "idle" | "loading" | "ready" | "playing" | "paused" | "error";

const SPEEDS = [0.75, 1, 1.25, 1.5];

export function LessonAudioPlayer({ lessonId, lessonType }: Props) {
  const [state, setState] = useState<PlayerState>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(1); // 1x por defecto
  const [expanded, setExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);

  // No mostrar para lecciones de video
  if (lessonType === "video_embed") return null;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setProgress(audio.currentTime);
    rafRef.current = requestAnimationFrame(updateProgress);
  }, []);

  const stopRaf = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  useEffect(() => {
    return () => {
      stopRaf();
      audioRef.current?.pause();
    };
  }, []);

  const loadAudio = async () => {
    setState("loading");
    setError(null);
    setExpanded(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("generate-lesson-audio", {
        body: { lessonId },
      });
      if (fnErr || data?.error) throw new Error(data?.error || fnErr?.message || "Error al generar audio");

      const url = data.audioUrl;
      setAudioUrl(url);

      const audio = new Audio(url);
      audio.playbackRate = SPEEDS[speedIdx];
      audioRef.current = audio;

      audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
      audio.addEventListener("ended", () => {
        setState("paused");
        setProgress(0);
        audio.currentTime = 0;
        stopRaf();
      });

      await new Promise<void>((res, rej) => {
        audio.addEventListener("canplay", () => res(), { once: true });
        audio.addEventListener("error", () => rej(new Error("Error al cargar el audio")), { once: true });
        audio.load();
      });

      setState("ready");
    } catch (e: any) {
      setError(e.message);
      setState("error");
    }
  };

  const play = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play();
    setState("playing");
    rafRef.current = requestAnimationFrame(updateProgress);
  };

  const pause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setState("paused");
    stopRaf();
  };

  const seek = (val: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = val[0];
    setProgress(val[0]);
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  };

  const restart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setProgress(0);
    play();
  };

  const close = () => {
    pause();
    setExpanded(false);
    setState("idle");
    setAudioUrl(null);
    setProgress(0);
    setDuration(0);
    if (audioRef.current) {
      audioRef.current.src = "";
      audioRef.current = null;
    }
  };

  return (
    <div className="mb-6">
      <AnimatePresence mode="wait">
        {!expanded ? (
          <motion.div
            key="trigger"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground"
              onClick={loadAudio}
            >
              <Headphones className="w-4 h-4 text-primary" />
              Escuchar explicación
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="player"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-2">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Headphones className="w-4 h-4 text-primary" />
                  <span>Explicación en audio</span>
                  {state === "loading" && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Generando…
                    </span>
                  )}
                </div>
                <button
                  onClick={close}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Error */}
              {state === "error" && (
                <p className="text-xs text-destructive">{error}</p>
              )}

              {/* Controls */}
              {(state === "ready" || state === "playing" || state === "paused") && (
                <div className="space-y-2">
                  {/* Barra de progreso */}
                  <Slider
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={[progress]}
                    onValueChange={seek}
                    className="w-full"
                  />

                  <div className="flex items-center justify-between">
                    {/* Tiempo */}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatTime(progress)} / {formatTime(duration)}
                    </span>

                    {/* Controles centrales */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={restart}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Reiniciar"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      <button
                        onClick={state === "playing" ? pause : play}
                        className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
                      >
                        {state === "playing" ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5" />
                        )}
                      </button>

                      {/* Velocidad */}
                      <button
                        onClick={cycleSpeed}
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors w-9 text-center"
                      >
                        {SPEEDS[speedIdx]}x
                      </button>
                    </div>

                    {/* Spacer para centrar controles */}
                    <span className="text-xs text-muted-foreground opacity-0 tabular-nums">
                      {formatTime(duration)}
                    </span>
                  </div>
                </div>
              )}

              {/* Autoplay cuando esté listo */}
              {state === "ready" && (() => { play(); return null; })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
