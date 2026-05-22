import { describe, it, expect } from "vitest";
import {
  sanitizeBlock,
  lessonMeetsMinimum,
  auditCourseClient,
  MIN_BLOCKS_BY_TYPE,
} from "@/lib/courseQuality";

// ─── sanitizeBlock ────────────────────────────────────────────────────────────

describe("sanitizeBlock — reading", () => {
  it("heading con text válido → retorna el bloque", () => {
    const b = { type: "heading", text: "Título" };
    expect(sanitizeBlock("reading", b)).toEqual(b);
  });

  it("heading con text vacío → null", () => {
    expect(sanitizeBlock("reading", { type: "heading", text: "" })).toBeNull();
  });

  it("paragraph con text → retorna", () => {
    expect(sanitizeBlock("reading", { type: "paragraph", text: "Texto" })).toBeTruthy();
  });

  it("divider sin campos adicionales → retorna (no requiere text)", () => {
    expect(sanitizeBlock("reading", { type: "divider" })).toBeTruthy();
  });

  it("image con url → retorna; sin url → null", () => {
    expect(sanitizeBlock("reading", { type: "image", url: "https://x.com/img.png" })).toBeTruthy();
    expect(sanitizeBlock("reading", { type: "image", url: "" })).toBeNull();
  });

  it("code con code string → retorna; sin code → null", () => {
    expect(sanitizeBlock("reading", { type: "code", code: "console.log()" })).toBeTruthy();
    expect(sanitizeBlock("reading", { type: "code", code: "" })).toBeNull();
  });

  it("bloque de tipo 'term' en reading → null (tipo incorrecto para este runner)", () => {
    expect(sanitizeBlock("reading", { type: "term", term: "x", definition: "y" })).toBeNull();
  });
});

describe("sanitizeBlock — concept", () => {
  it("term con term y definition → retorna", () => {
    expect(sanitizeBlock("concept", { type: "term", term: "AI", definition: "Inteligencia Artificial" })).toBeTruthy();
  });

  it("term con definition vacía → null", () => {
    expect(sanitizeBlock("concept", { type: "term", term: "AI", definition: "" })).toBeNull();
  });

  it("term con term vacío → null", () => {
    expect(sanitizeBlock("concept", { type: "term", term: "", definition: "Def" })).toBeNull();
  });
});

describe("sanitizeBlock — flashcards", () => {
  it("flashcard con front y back → retorna", () => {
    expect(sanitizeBlock("flashcards", { type: "flashcard", front: "P", back: "R" })).toBeTruthy();
  });

  it("flashcard con back vacío → null", () => {
    expect(sanitizeBlock("flashcards", { type: "flashcard", front: "P", back: "" })).toBeNull();
  });
});

describe("sanitizeBlock — interactive_quiz: mc", () => {
  const validMc = {
    type: "mc",
    question: "¿Cuánto es 2+2?",
    options: ["3", "4", "5"],
    correct: "4",
  };

  it("mc válido con 3 opciones y correct incluido → retorna", () => {
    expect(sanitizeBlock("interactive_quiz", validMc)).toBeTruthy();
  });

  it("mc con correct NO en options → null", () => {
    expect(sanitizeBlock("interactive_quiz", { ...validMc, correct: "6" })).toBeNull();
  });

  it("mc con menos de 3 opciones → null", () => {
    expect(sanitizeBlock("interactive_quiz", { ...validMc, options: ["3", "4"] })).toBeNull();
  });

  it("mc sin pregunta → null", () => {
    expect(sanitizeBlock("interactive_quiz", { ...validMc, question: "" })).toBeNull();
  });
});

describe("sanitizeBlock — interactive_quiz: fill_blank", () => {
  it("fill_blank con ___ en sentence → retorna", () => {
    const b = { type: "fill_blank", sentence: "La ___ es correcta", correct: "opción" };
    expect(sanitizeBlock("interactive_quiz", b)).toBeTruthy();
  });

  it("fill_blank sin ___ en sentence → null", () => {
    const b = { type: "fill_blank", sentence: "Sin hueco", correct: "nada" };
    expect(sanitizeBlock("interactive_quiz", b)).toBeNull();
  });
});

describe("sanitizeBlock — interactive_quiz: match_pairs", () => {
  const validPairs = {
    type: "match_pairs",
    pairs: [
      { left: "A", right: "1" },
      { left: "B", right: "2" },
      { left: "C", right: "3" },
    ],
  };

  it("match_pairs con 3 pares válidos → retorna", () => {
    expect(sanitizeBlock("interactive_quiz", validPairs)).toBeTruthy();
  });

  it("match_pairs con menos de 3 pares → null", () => {
    expect(sanitizeBlock("interactive_quiz", { ...validPairs, pairs: validPairs.pairs.slice(0, 2) })).toBeNull();
  });
});

describe("sanitizeBlock — interactive_quiz: tap_to_complete", () => {
  const valid = {
    type: "tap_to_complete",
    sentence: "El ___ es correcto",
    bank: ["valor", "error", "dato"],
    correct: ["valor"],
  };

  it("tap_to_complete válido → retorna", () => {
    expect(sanitizeBlock("interactive_quiz", valid)).toBeTruthy();
  });

  it("tap_to_complete con correct NO incluido en bank → null", () => {
    expect(sanitizeBlock("interactive_quiz", { ...valid, correct: ["ausente"] })).toBeNull();
  });

  it("tap_to_complete con bank < 3 palabras → null", () => {
    expect(sanitizeBlock("interactive_quiz", { ...valid, bank: ["valor", "error"] })).toBeNull();
  });
});

describe("sanitizeBlock — entradas inválidas", () => {
  it("bloque null → null", () => {
    expect(sanitizeBlock("reading", null)).toBeNull();
  });

  it("bloque sin type → null", () => {
    expect(sanitizeBlock("reading", { text: "algo" })).toBeNull();
  });

  it("bloque con type numérico → null", () => {
    expect(sanitizeBlock("reading", { type: 42 })).toBeNull();
  });
});

// ─── lessonMeetsMinimum ───────────────────────────────────────────────────────

describe("lessonMeetsMinimum", () => {
  it("reading con 2 bloques válidos → true (min=2)", () => {
    const lesson = {
      lesson_type: "reading",
      content: {
        blocks: [
          { type: "heading", text: "Título" },
          { type: "paragraph", text: "Texto" },
        ],
      },
    };
    expect(lessonMeetsMinimum(lesson)).toBe(true);
  });

  it("reading con 1 bloque válido → false (min=2)", () => {
    const lesson = {
      lesson_type: "reading",
      content: { blocks: [{ type: "paragraph", text: "Solo uno" }] },
    };
    expect(lessonMeetsMinimum(lesson)).toBe(false);
  });

  it("interactive_quiz con 4 bloques válidos → true (min=4)", () => {
    const blocks = Array(4).fill({
      type: "mc",
      question: "¿?",
      options: ["a", "b", "c"],
      correct: "a",
    });
    const lesson = { lesson_type: "interactive_quiz", content: { blocks } };
    expect(lessonMeetsMinimum(lesson)).toBe(true);
  });

  it("interactive_quiz con 3 bloques → false (min=4)", () => {
    const blocks = Array(3).fill({
      type: "mc",
      question: "¿?",
      options: ["a", "b", "c"],
      correct: "a",
    });
    const lesson = { lesson_type: "interactive_quiz", content: { blocks } };
    expect(lessonMeetsMinimum(lesson)).toBe(false);
  });

  it("video_embed con 1 bloque válido → true (min=1)", () => {
    const lesson = {
      lesson_type: "video_embed",
      content: { blocks: [{ type: "video", url: "https://youtube.com/x" }] },
    };
    expect(lessonMeetsMinimum(lesson)).toBe(true);
  });

  it("flashcards necesita mínimo " + MIN_BLOCKS_BY_TYPE.flashcards + " bloques", () => {
    const makeFlashcard = () => ({ type: "flashcard", front: "F", back: "B" });
    const enough = {
      lesson_type: "flashcards",
      content: { blocks: Array(MIN_BLOCKS_BY_TYPE.flashcards).fill(null).map(makeFlashcard) },
    };
    const notEnough = {
      lesson_type: "flashcards",
      content: { blocks: Array(MIN_BLOCKS_BY_TYPE.flashcards - 1).fill(null).map(makeFlashcard) },
    };
    expect(lessonMeetsMinimum(enough)).toBe(true);
    expect(lessonMeetsMinimum(notEnough)).toBe(false);
  });
});

// ─── auditCourseClient ────────────────────────────────────────────────────────

describe("auditCourseClient", () => {
  it("null como modules → protegido por || [], retorna status failed (0 módulos válidos)", () => {
    const result = auditCourseClient(null as any);
    expect(result.status).toBe("failed");
    expect(result.totalModules).toBe(0);
  });

  it("array vacío → status failed (sin módulos válidos)", () => {
    const result = auditCourseClient([]);
    expect(result.status).toBe("failed");
    expect(result.validModules).toBe(0);
  });

  it("módulo sin lecciones → issue 'módulo sin lecciones útiles'", () => {
    const result = auditCourseClient([{ title: "Módulo vacío", lessons: [] }]);
    expect(result.issues.some((i) => i.reason === "módulo sin lecciones útiles")).toBe(true);
  });

  it("módulo con 1 lección válida → validModules=1, status=ready", () => {
    const modules = [
      {
        title: "Módulo 1",
        lessons: [
          {
            title: "Lección 1",
            lesson_type: "reading",
            content: {
              blocks: [
                { type: "heading", text: "H" },
                { type: "paragraph", text: "P" },
              ],
            },
          },
        ],
      },
    ];
    const result = auditCourseClient(modules);
    expect(result.validModules).toBe(1);
    expect(result.status).toBe("ready");
    expect(result.issues).toHaveLength(0);
  });

  it("módulo con lección inválida + válida → needs_review", () => {
    const modules = [
      {
        title: "Módulo 1",
        lessons: [
          {
            title: "Inválida",
            lesson_type: "reading",
            content: { blocks: [{ type: "paragraph", text: "Solo uno" }] },
          },
          {
            title: "Válida",
            lesson_type: "reading",
            content: {
              blocks: [
                { type: "heading", text: "H" },
                { type: "paragraph", text: "P" },
              ],
            },
          },
        ],
      },
    ];
    const result = auditCourseClient(modules);
    expect(result.status).toBe("needs_review");
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.validModules).toBe(1);
  });

  it("todos los módulos con solo lecciones inválidas → status failed", () => {
    const modules = [
      {
        title: "Módulo A",
        lessons: [
          {
            title: "Sin contenido",
            lesson_type: "reading",
            content: { blocks: [] },
          },
        ],
      },
    ];
    const result = auditCourseClient(modules);
    expect(result.status).toBe("failed");
    expect(result.validModules).toBe(0);
  });

  it("conteo de totalLessons y validLessons es correcto", () => {
    const modules = [
      {
        title: "M1",
        lessons: [
          {
            title: "Válida",
            lesson_type: "reading",
            content: {
              blocks: [{ type: "heading", text: "H" }, { type: "paragraph", text: "P" }],
            },
          },
          {
            title: "Inválida",
            lesson_type: "reading",
            content: { blocks: [] },
          },
        ],
      },
    ];
    const result = auditCourseClient(modules);
    expect(result.totalLessons).toBe(2);
    expect(result.validLessons).toBe(1);
  });
});
