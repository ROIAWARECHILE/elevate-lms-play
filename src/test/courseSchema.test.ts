import { describe, it, expect } from "vitest";
import { getLessonTypeMeta, isLessonType, getLessonBlocks } from "@/lib/courseSchema";

describe("getLessonTypeMeta", () => {
  it("tipo válido 'reading' retorna su meta correcta", () => {
    const meta = getLessonTypeMeta("reading");
    expect(meta.label).toBe("Lectura");
    expect(meta.icon).toBe("BookOpen");
  });

  it("tipo válido 'concept' retorna su meta correcta", () => {
    const meta = getLessonTypeMeta("concept");
    expect(meta.label).toBe("Conceptos");
  });

  it("tipo válido 'interactive_quiz' retorna su meta correcta", () => {
    const meta = getLessonTypeMeta("interactive_quiz");
    expect(meta.label).toBe("Práctica");
  });

  it("null → fallback a reading", () => {
    const meta = getLessonTypeMeta(null);
    expect(meta.label).toBe("Lectura");
  });

  it("undefined → fallback a reading", () => {
    const meta = getLessonTypeMeta(undefined);
    expect(meta.label).toBe("Lectura");
  });

  it("tipo inválido → fallback a reading", () => {
    const meta = getLessonTypeMeta("inventado_xyz");
    expect(meta.label).toBe("Lectura");
  });
});

describe("isLessonType", () => {
  it("'reading' es un LessonType válido", () => {
    expect(isLessonType("reading")).toBe(true);
  });

  it("'interactive_quiz' es un LessonType válido", () => {
    expect(isLessonType("interactive_quiz")).toBe(true);
  });

  it("'sop_walkthrough' es un LessonType válido", () => {
    expect(isLessonType("sop_walkthrough")).toBe(true);
  });

  it("string inválido retorna false", () => {
    expect(isLessonType("invalido")).toBe(false);
  });

  it("null retorna false", () => {
    expect(isLessonType(null)).toBe(false);
  });

  it("undefined retorna false", () => {
    expect(isLessonType(undefined)).toBe(false);
  });

  it("número retorna false", () => {
    expect(isLessonType(42)).toBe(false);
  });

  it("objeto retorna false", () => {
    expect(isLessonType({ type: "reading" })).toBe(false);
  });
});

describe("getLessonBlocks", () => {
  it("lesson con content.blocks array → retorna el array", () => {
    const blocks = [{ type: "heading", text: "Hola" }];
    const lesson = { content: { blocks } };
    expect(getLessonBlocks(lesson)).toEqual(blocks);
  });

  it("lesson sin content → retorna []", () => {
    expect(getLessonBlocks({})).toEqual([]);
  });

  it("lesson con content sin blocks → retorna []", () => {
    expect(getLessonBlocks({ content: {} })).toEqual([]);
  });

  it("lesson con content.blocks = null → retorna []", () => {
    expect(getLessonBlocks({ content: { blocks: null } })).toEqual([]);
  });

  it("lesson con content.blocks = string (no array) → retorna []", () => {
    expect(getLessonBlocks({ content: { blocks: "texto" } })).toEqual([]);
  });

  it("lesson undefined → retorna [] sin crash", () => {
    expect(getLessonBlocks(undefined as any)).toEqual([]);
  });
});
