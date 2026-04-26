// Centralized confetti helpers built on canvas-confetti for 60fps celebrations.
import confetti from "canvas-confetti";

const KIBBO_COLORS = ["#FF7A29", "#1B3A5C", "#00D4FF", "#FFB800", "#42D672"];

export function fireBurst(opts: { x?: number; y?: number; particleCount?: number } = {}) {
  const { x = 0.5, y = 0.6, particleCount = 80 } = opts;
  confetti({
    particleCount,
    spread: 70,
    startVelocity: 45,
    origin: { x, y },
    colors: KIBBO_COLORS,
    scalar: 1,
  });
}

export function fireFromButton(button: HTMLElement | null, particleCount = 60) {
  if (!button) return fireBurst({ particleCount });
  const rect = button.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;
  fireBurst({ x, y, particleCount });
}

export function fireSchool() {
  // Heavier celebration for course completion / level up
  const duration = 2_000;
  const end = Date.now() + duration;
  const interval = window.setInterval(() => {
    if (Date.now() > end) {
      window.clearInterval(interval);
      return;
    }
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: KIBBO_COLORS,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: KIBBO_COLORS,
    });
  }, 200);
}

export function fireStars(button: HTMLElement | null) {
  const defaults = {
    spread: 360,
    ticks: 60,
    gravity: 0,
    decay: 0.94,
    startVelocity: 30,
    colors: KIBBO_COLORS,
    shapes: ["star" as const],
  };
  const origin = button
    ? (() => {
        const r = button.getBoundingClientRect();
        return { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight };
      })()
    : { x: 0.5, y: 0.5 };
  confetti({ ...defaults, particleCount: 40, scalar: 1.2, origin });
  confetti({ ...defaults, particleCount: 10, scalar: 0.75, origin });
}
