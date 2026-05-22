import { describe, it, expect, vi, afterEach } from "vitest";
import { getLocalDate, getYesterdayLocal } from "@/lib/gamification";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(() => ({ update: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() })) },
}));

afterEach(() => {
  vi.useRealTimers();
});

describe("getLocalDate", () => {
  it("retorna formato YYYY-MM-DD para una fecha específica", () => {
    const d = new Date(2025, 5, 15); // 15 junio 2025
    expect(getLocalDate(d)).toBe("2025-06-15");
  });

  it("aplica padding de dos dígitos al mes de enero", () => {
    const d = new Date(2025, 0, 1); // 1 enero
    expect(getLocalDate(d)).toBe("2025-01-01");
  });

  it("aplica padding de dos dígitos al día menor a 10", () => {
    const d = new Date(2025, 2, 5); // 5 marzo
    expect(getLocalDate(d)).toBe("2025-03-05");
  });

  it("sin argumento usa la fecha actual", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 10, 20)); // 20 nov 2025
    expect(getLocalDate()).toBe("2025-11-20");
  });

  it("maneja correctamente diciembre (mes 12)", () => {
    const d = new Date(2025, 11, 31); // 31 dic
    expect(getLocalDate(d)).toBe("2025-12-31");
  });
});

describe("getYesterdayLocal", () => {
  it("retorna la fecha de ayer en formato YYYY-MM-DD", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 15)); // 15 junio
    expect(getYesterdayLocal()).toBe("2025-06-14");
  });

  it("maneja cambio de mes: 1 de marzo → 28 de febrero (año no bisiesto)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 1)); // 1 marzo 2025
    expect(getYesterdayLocal()).toBe("2025-02-28");
  });

  it("maneja año bisiesto: 1 de marzo → 29 de febrero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 2, 1)); // 1 marzo 2024 (bisiesto)
    expect(getYesterdayLocal()).toBe("2024-02-29");
  });

  it("maneja cambio de año: 1 de enero → 31 de diciembre del año anterior", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 1)); // 1 enero 2025
    expect(getYesterdayLocal()).toBe("2024-12-31");
  });
});
