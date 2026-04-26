// "G then X" sequential shortcuts (GitHub / Linear style) for quick navigation.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const ROUTES: Record<string, string> = {
  d: "/app",
  c: "/app/courses",
  r: "/app/leaderboard",
  p: "/app/profile",
};

export function useGoToShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    let waitingForG = false;
    let timer: number | null = null;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (!waitingForG && (e.key === "g" || e.key === "G")) {
        waitingForG = true;
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          waitingForG = false;
        }, 1200);
        return;
      }

      if (waitingForG) {
        const route = ROUTES[e.key.toLowerCase()];
        waitingForG = false;
        if (timer) window.clearTimeout(timer);
        if (route) {
          e.preventDefault();
          navigate(route);
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (timer) window.clearTimeout(timer);
    };
  }, [navigate]);
}
