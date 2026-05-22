import { describe, it, expect, vi } from "vitest";
import { srsKey, quality } from "@/hooks/useSRS";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

describe("srsKey", () => {
  it("el mismo input siempre produce el mismo hash (determinismo)", () => {
    const a = srsKey(["concepto", "definición"]);
    const b = srsKey(["concepto", "definición"]);
    expect(a).toBe(b);
  });

  it("filtra null y undefined del array de partes", () => {
    expect(srsKey([null, undefined, "hola"])).toBe(srsKey(["hola"]));
  });

  it("es case-insensitive: 'A' y 'a' producen el mismo hash", () => {
    expect(srsKey(["Concepto"])).toBe(srsKey(["concepto"]));
  });

  it("array vacío retorna string que empieza con 'k_'", () => {
    expect(srsKey([])).toMatch(/^k_/);
  });

  it("array de nulls retorna el mismo resultado que array vacío", () => {
    expect(srsKey([null, undefined])).toBe(srsKey([]));
  });

  it("inputs distintos producen hashes distintos", () => {
    expect(srsKey(["a"])).not.toBe(srsKey(["b"]));
  });

  it("el orden de las partes afecta el resultado", () => {
    expect(srsKey(["a", "b"])).not.toBe(srsKey(["b", "a"]));
  });
});

describe("quality (SM-2)", () => {
  it("incorrecto con attempts >= 2 → 0 (falló de verdad)", () => {
    expect(quality({ correct: false, attempts: 2 })).toBe(0);
    expect(quality({ correct: false, attempts: 3 })).toBe(0);
  });

  it("incorrecto con attempts = 1 → 2 (un intento)", () => {
    expect(quality({ correct: false, attempts: 1 })).toBe(2);
  });

  it("incorrecto sin attempts explícito → 2 (default attempts=1)", () => {
    expect(quality({ correct: false })).toBe(2);
  });

  it("correcto con hadHint = true → 3", () => {
    expect(quality({ correct: true, hadHint: true })).toBe(3);
  });

  it("correcto con attempts > 1 → 3", () => {
    expect(quality({ correct: true, attempts: 2 })).toBe(3);
  });

  it("correcto con hadHint y attempts > 1 → 3 (hadHint tiene prioridad)", () => {
    expect(quality({ correct: true, hadHint: true, attempts: 2, timeMs: 1000 })).toBe(3);
  });

  it("correcto con timeMs < 4000 → 5 (respuesta rápida)", () => {
    expect(quality({ correct: true, timeMs: 3999 })).toBe(5);
    expect(quality({ correct: true, timeMs: 1000 })).toBe(5);
  });

  it("timeMs = 0 es falsy en JS → se trata como sin tiempo medido → 4", () => {
    // `if (timeMs && timeMs < 4000)` → 0 es falsy, no entra en la rama rápida
    expect(quality({ correct: true, timeMs: 0 })).toBe(4);
  });

  it("boundary crítico: timeMs = 4000 → 4 (no menor que 4000)", () => {
    expect(quality({ correct: true, timeMs: 4000 })).toBe(4);
  });

  it("correcto sin hint, un intento, sin timeMs → 4 (default)", () => {
    expect(quality({ correct: true })).toBe(4);
  });

  it("correcto con timeMs > 4000 → 4", () => {
    expect(quality({ correct: true, timeMs: 5000 })).toBe(4);
  });
});
