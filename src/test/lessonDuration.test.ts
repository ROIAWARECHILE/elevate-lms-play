import { describe, it, expect } from "vitest";
import { estimateLessonMinutes, isOverMicrolearning } from "@/lib/lessonDuration";

describe("estimateLessonMinutes", () => {
  it("lección null retorna 1 (mínimo clamped)", () => {
    expect(estimateLessonMinutes(null)).toBe(1);
  });

  it("lección sin bloques ni content.text retorna 1", () => {
    expect(estimateLessonMinutes({ lesson_type: "reading", content: {} })).toBe(1);
  });

  it("modo legacy: solo content.text con palabras → calcula correctamente", () => {
    // 200 palabras = 1 min exacto
    const text = Array(200).fill("palabra").join(" ");
    expect(estimateLessonMinutes({ content: { text } })).toBe(1);
  });

  it("modo legacy: content.text con 400 palabras → 2 min", () => {
    const text = Array(400).fill("x").join(" ");
    expect(estimateLessonMinutes({ content: { text } })).toBe(2);
  });

  it("bloque tipo video cuenta como 3 interactivos (1.5 min = ceil → 2)", () => {
    const lesson = {
      lesson_type: "video_embed",
      content: { blocks: [{ type: "video", url: "https://example.com" }] },
    };
    expect(estimateLessonMinutes(lesson)).toBe(2);
  });

  it("overflow: muchos quiz blocks → clamped a 10", () => {
    const blocks = Array(25).fill({ type: "mc" }); // 25 * 0.5 = 12.5 min → clamp a 10
    const lesson = { lesson_type: "interactive_quiz", content: { blocks } };
    expect(estimateLessonMinutes(lesson)).toBe(10);
  });

  it("overflow: muchos videos → clamped a 10", () => {
    const blocks = Array(10).fill({ type: "video", url: "x" }); // 10*3*0.5 = 15 → clamp a 10
    const lesson = { lesson_type: "video_embed", content: { blocks } };
    expect(estimateLessonMinutes(lesson)).toBe(10);
  });

  it("resultado siempre mínimo 1 aunque no haya contenido", () => {
    const lesson = { lesson_type: "reading", content: { blocks: [] } };
    expect(estimateLessonMinutes(lesson)).toBeGreaterThanOrEqual(1);
  });

  it("bloque mc cuenta como 0.5 min (1 bloque → ceil(0.5) = 1)", () => {
    const lesson = { lesson_type: "interactive_quiz", content: { blocks: [{ type: "mc" }] } };
    expect(estimateLessonMinutes(lesson)).toBe(1);
  });

  it("2 bloques quiz = 1 min exacto → no supera clamping", () => {
    const lesson = {
      lesson_type: "interactive_quiz",
      content: { blocks: [{ type: "mc" }, { type: "true_false" }] },
    };
    expect(estimateLessonMinutes(lesson)).toBe(1);
  });
});

describe("isOverMicrolearning", () => {
  it("lección de 4 min con maxMin=5 → false", () => {
    const blocks = Array(8).fill({ type: "mc" }); // 4 min
    const lesson = { lesson_type: "interactive_quiz", content: { blocks } };
    expect(isOverMicrolearning(lesson, 5)).toBe(false);
  });

  it("lección de 6 min con maxMin=5 → true", () => {
    const blocks = Array(12).fill({ type: "mc" }); // 6 min
    const lesson = { lesson_type: "interactive_quiz", content: { blocks } };
    expect(isOverMicrolearning(lesson, 5)).toBe(true);
  });

  it("boundary exacto: 5 min con maxMin=5 → false (no estrictamente mayor)", () => {
    const blocks = Array(10).fill({ type: "mc" }); // 5 min
    const lesson = { lesson_type: "interactive_quiz", content: { blocks } };
    expect(isOverMicrolearning(lesson, 5)).toBe(false);
  });

  it("maxMin por defecto es 5", () => {
    const lesson = { lesson_type: "reading", content: { blocks: [] } }; // 1 min
    expect(isOverMicrolearning(lesson)).toBe(false);
  });
});
