// =====================================================================
// Course Quality — fuente única de validación, sanitización y auditoría.
// Usado por las Edge Functions generate-course y regenerate-lesson.
// El espejo cliente vive en src/lib/courseQuality.ts (mantener sincronizados).
// =====================================================================

export type LessonType =
  | "reading" | "concept" | "flashcards" | "steps" | "comparison"
  | "case_study" | "interactive_quiz" | "video_embed" | "sop_walkthrough";

export const QUIZ_BLOCK_TYPES = [
  "mc", "true_false", "fill_blank", "match_pairs", "order_steps",
  "sort_into_buckets", "highlight_terms", "tap_to_complete",
] as const;

export const MIN_BLOCKS_BY_TYPE: Record<string, number> = {
  reading: 2,
  concept: 2,
  flashcards: 3,
  steps: 3,
  comparison: 1,
  case_study: 2,
  interactive_quiz: 4,
  sop_walkthrough: 3,
  video_embed: 1,
};

function nonEmptyStr(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Sanitiza un único bloque para un lesson_type. Devuelve null si no es válido/renderizable. */
export function sanitizeBlock(lessonType: string, raw: any): any | null {
  if (!raw || typeof raw !== "object" || !nonEmptyStr(raw.type)) return null;
  const t = raw.type;

  if (lessonType === "reading") {
    if (t === "heading" && nonEmptyStr(raw.text))
      return { type: "heading", text: raw.text.trim(), level: raw.level === 1 ? 1 : 2 };
    if (t === "paragraph" && nonEmptyStr(raw.text))
      return { type: "paragraph", text: raw.text.trim() };
    if (t === "callout" && nonEmptyStr(raw.text)) {
      const variant = ["info", "warning", "success", "tip"].includes(raw.variant) ? raw.variant : "info";
      const out: any = { type: "callout", variant, text: raw.text.trim() };
      if (nonEmptyStr(raw.title)) out.title = raw.title.trim();
      return out;
    }
    if (t === "quote" && nonEmptyStr(raw.text)) {
      const out: any = { type: "quote", text: raw.text.trim() };
      if (nonEmptyStr(raw.cite)) out.cite = raw.cite.trim();
      return out;
    }
    if (t === "code" && nonEmptyStr(raw.code))
      return { type: "code", language: nonEmptyStr(raw.language) ? raw.language.trim() : undefined, code: raw.code };
    if (t === "image" && nonEmptyStr(raw.url))
      return { type: "image", url: raw.url.trim(), alt: nonEmptyStr(raw.alt) ? raw.alt.trim() : undefined, caption: nonEmptyStr(raw.caption) ? raw.caption.trim() : undefined };
    if (t === "divider") return { type: "divider" };
    return null;
  }

  if (lessonType === "concept") {
    if (t !== "term") return null;
    if (!nonEmptyStr(raw.term) || !nonEmptyStr(raw.definition)) return null;
    const out: any = { type: "term", term: raw.term.trim(), definition: raw.definition.trim() };
    if (nonEmptyStr(raw.example)) out.example = raw.example.trim();
    return out;
  }

  if (lessonType === "flashcards") {
    if (t !== "flashcard") return null;
    if (!nonEmptyStr(raw.front) || !nonEmptyStr(raw.back)) return null;
    const out: any = { type: "flashcard", front: raw.front.trim(), back: raw.back.trim() };
    if (nonEmptyStr(raw.hint)) out.hint = raw.hint.trim();
    return out;
  }

  if (lessonType === "steps") {
    if (t !== "step") return null;
    if (!nonEmptyStr(raw.title) || !nonEmptyStr(raw.description)) return null;
    const out: any = {
      type: "step",
      n: typeof raw.n === "number" ? raw.n : 0,
      title: raw.title.trim(),
      description: raw.description.trim(),
    };
    if (nonEmptyStr(raw.tip)) out.tip = raw.tip.trim();
    return out;
  }

  if (lessonType === "comparison") {
    if (t !== "comparison_table") return null;
    const headers = Array.isArray(raw.headers) ? raw.headers.filter(nonEmptyStr).map((s: string) => s.trim()) : [];
    const rows = Array.isArray(raw.rows)
      ? raw.rows
          .map((r: any) => ({
            label: nonEmptyStr(r?.label) ? r.label.trim() : "",
            cells: Array.isArray(r?.cells) ? r.cells.map((c: any) => (typeof c === "string" ? c.trim() : "")) : [],
          }))
          .filter((r: any) => r.label && r.cells.length > 0 && r.cells.some((c: string) => c.length > 0))
      : [];
    if (headers.length < 2 || rows.length < 2) return null;
    return { type: "comparison_table", headers, rows };
  }

  if (lessonType === "case_study") {
    if (t === "scenario" && nonEmptyStr(raw.text)) {
      const out: any = { type: "scenario", text: raw.text.trim() };
      if (nonEmptyStr(raw.title)) out.title = raw.title.trim();
      return out;
    }
    if (t === "question" && nonEmptyStr(raw.text)) return { type: "question", text: raw.text.trim() };
    if (t === "reflection" && nonEmptyStr(raw.text)) return { type: "reflection", text: raw.text.trim() };
    return null;
  }

  if (lessonType === "sop_walkthrough") {
    if (t !== "sop_step") return null;
    if (!nonEmptyStr(raw.title) || !nonEmptyStr(raw.description)) return null;
    const out: any = {
      type: "sop_step",
      n: typeof raw.n === "number" ? raw.n : 0,
      title: raw.title.trim(),
      description: raw.description.trim(),
    };
    if (nonEmptyStr(raw.warning)) out.warning = raw.warning.trim();
    if (raw.must_check === true) out.must_check = true;
    return out;
  }

  if (lessonType === "video_embed") {
    if (t !== "video" || !nonEmptyStr(raw.url)) return null;
    const provider = ["youtube", "vimeo", "url"].includes(raw.provider) ? raw.provider : "url";
    return { type: "video", provider, url: raw.url.trim(), title: nonEmptyStr(raw.title) ? raw.title.trim() : undefined };
  }

  if (lessonType === "interactive_quiz") {
    if (!(QUIZ_BLOCK_TYPES as readonly string[]).includes(t)) return null;
    if (t === "mc") {
      const opts = Array.isArray(raw.options) ? raw.options.filter(nonEmptyStr).map((s: string) => s.trim()) : [];
      const correct = nonEmptyStr(raw.correct) ? raw.correct.trim() : "";
      if (!nonEmptyStr(raw.question) || opts.length < 3 || !correct || !opts.includes(correct)) return null;
      return { type: "mc", question: raw.question.trim(), options: opts, correct, explanation: nonEmptyStr(raw.explanation) ? raw.explanation.trim() : undefined };
    }
    if (t === "true_false") {
      if (!nonEmptyStr(raw.question) || typeof raw.correct !== "boolean") return null;
      return { type: "true_false", question: raw.question.trim(), correct: raw.correct, explanation: nonEmptyStr(raw.explanation) ? raw.explanation.trim() : undefined };
    }
    if (t === "fill_blank") {
      if (!nonEmptyStr(raw.sentence) || !raw.sentence.includes("___")) return null;
      let correct: string | string[] | null = null;
      if (Array.isArray(raw.correct) && raw.correct.every(nonEmptyStr)) correct = raw.correct.map((s: string) => s.trim());
      else if (nonEmptyStr(raw.correct)) correct = raw.correct.trim();
      if (!correct) return null;
      return { type: "fill_blank", sentence: raw.sentence.trim(), correct, explanation: nonEmptyStr(raw.explanation) ? raw.explanation.trim() : undefined };
    }
    if (t === "match_pairs") {
      const pairs = Array.isArray(raw.pairs)
        ? raw.pairs.filter((p: any) => nonEmptyStr(p?.left) && nonEmptyStr(p?.right))
                   .map((p: any) => ({ left: p.left.trim(), right: p.right.trim() }))
        : [];
      if (pairs.length < 3) return null;
      return { type: "match_pairs", pairs, explanation: nonEmptyStr(raw.explanation) ? raw.explanation.trim() : undefined };
    }
    if (t === "order_steps") {
      const steps = Array.isArray(raw.steps) ? raw.steps.filter(nonEmptyStr).map((s: string) => s.trim()) : [];
      if (steps.length < 3) return null;
      return { type: "order_steps", steps, explanation: nonEmptyStr(raw.explanation) ? raw.explanation.trim() : undefined };
    }
    if (t === "sort_into_buckets") {
      const buckets = Array.isArray(raw.buckets) ? raw.buckets.filter(nonEmptyStr).map((s: string) => s.trim()) : [];
      const items = Array.isArray(raw.items)
        ? raw.items.filter((it: any) => nonEmptyStr(it?.text) && nonEmptyStr(it?.bucket) && buckets.includes(it.bucket.trim()))
                   .map((it: any) => ({ text: it.text.trim(), bucket: it.bucket.trim() }))
        : [];
      if (buckets.length < 2 || items.length < 3) return null;
      return { type: "sort_into_buckets", buckets, items, explanation: nonEmptyStr(raw.explanation) ? raw.explanation.trim() : undefined };
    }
    if (t === "highlight_terms") {
      const terms = Array.isArray(raw.terms) ? raw.terms.filter(nonEmptyStr).map((s: string) => s.trim()) : [];
      if (!nonEmptyStr(raw.sentence) || terms.length === 0) return null;
      return {
        type: "highlight_terms",
        sentence: raw.sentence.trim(),
        terms,
        distractors: Array.isArray(raw.distractors) ? raw.distractors.filter(nonEmptyStr).map((s: string) => s.trim()) : [],
        explanation: nonEmptyStr(raw.explanation) ? raw.explanation.trim() : undefined,
      };
    }
    if (t === "tap_to_complete") {
      const bank = Array.isArray(raw.bank) ? raw.bank.filter(nonEmptyStr).map((s: string) => s.trim()) : [];
      const correct = Array.isArray(raw.correct) ? raw.correct.filter(nonEmptyStr).map((s: string) => s.trim()) : [];
      if (!nonEmptyStr(raw.sentence) || !raw.sentence.includes("___") || bank.length < 3 || correct.length === 0) return null;
      if (!correct.every((c: string) => bank.includes(c))) return null;
      return { type: "tap_to_complete", sentence: raw.sentence.trim(), bank, correct, explanation: nonEmptyStr(raw.explanation) ? raw.explanation.trim() : undefined };
    }
    return null;
  }

  return null;
}

/** Filtra y normaliza una lista de bloques. Solo devuelve los renderizables para el tipo. */
export function sanitizeBlocksForLessonType(lessonType: string, blocks: any[]): any[] {
  if (!Array.isArray(blocks)) return [];
  const out: any[] = [];
  for (const b of blocks) {
    const clean = sanitizeBlock(lessonType, b);
    if (clean) out.push(clean);
  }
  return out;
}

export function blocksMeetMinimum(lessonType: string, blocks: any[]): boolean {
  const min = MIN_BLOCKS_BY_TYPE[lessonType] ?? 1;
  return Array.isArray(blocks) && blocks.length >= min;
}

/** Cuenta bloques renderizables sobre el contenido ya guardado de una lección. */
export function getRenderableBlockCount(lesson: { lesson_type?: string | null; content?: any }): number {
  const type = lesson?.lesson_type || "reading";
  const blocks = Array.isArray(lesson?.content?.blocks) ? lesson.content.blocks : [];
  return sanitizeBlocksForLessonType(type, blocks).length;
}

/** Valida una pregunta de quiz (formato tabular questions/quizzes). */
export function isValidQuizQuestion(q: any): boolean {
  if (!q || typeof q !== "object") return false;
  if (!nonEmptyStr(q.question_text)) return false;
  const opts = Array.isArray(q.options) ? q.options.filter(nonEmptyStr) : [];
  if (q.question_type === "true_false") {
    return opts.length >= 2 && nonEmptyStr(q.correct_answer);
  }
  if (opts.length < 2) return false;
  if (!nonEmptyStr(q.correct_answer) || !opts.includes(q.correct_answer)) return false;
  return true;
}

export function filterValidQuizQuestions(questions: any[]): any[] {
  if (!Array.isArray(questions)) return [];
  return questions.filter(isValidQuizQuestion);
}

// ---------- Auditoría completa de un curso ----------

export type LessonAudit = {
  id: string;
  title: string;
  lesson_type: string;
  blockCount: number;
  validBlockCount: number;
  required: number;
  ok: boolean;
  reason?: string;
};

export type ModuleAudit = {
  id: string;
  title: string;
  lessons: LessonAudit[];
  validLessons: number;
  questions: number;
  validQuestions: number;
  hasValidQuiz: boolean;
  ok: boolean;
  reason?: string;
};

export type CourseAuditReport = {
  courseId: string;
  modules: ModuleAudit[];
  totalLessons: number;
  totalValidLessons: number;
  totalModules: number;
  validModules: number;
  qualityStatus: "ready" | "needs_review" | "failed";
  warnings: string[];
  errors: string[];
};

const MIN_VALID_LESSONS_PER_MODULE = 1;
const MIN_VALID_QUESTIONS_PER_QUIZ = 3;

export function auditCourse(input: {
  courseId: string;
  modules: { id: string; title: string }[];
  lessonsByModule: Record<string, { id: string; title: string; lesson_type?: string | null; content?: any }[]>;
  quizzesByModule: Record<string, { id: string; questions: any[] }[]>;
}): CourseAuditReport {
  const warnings: string[] = [];
  const errors: string[] = [];
  const modulesAudit: ModuleAudit[] = [];
  let totalLessons = 0;
  let totalValidLessons = 0;
  let validModules = 0;

  for (const mod of input.modules) {
    const lessons = input.lessonsByModule[mod.id] || [];
    const lessonAudits: LessonAudit[] = lessons.map((l) => {
      const type = l.lesson_type || "reading";
      const blocks = Array.isArray(l.content?.blocks) ? l.content.blocks : [];
      const valid = sanitizeBlocksForLessonType(type, blocks);
      const required = MIN_BLOCKS_BY_TYPE[type] ?? 1;
      const ok = valid.length >= required;
      return {
        id: l.id,
        title: l.title,
        lesson_type: type,
        blockCount: blocks.length,
        validBlockCount: valid.length,
        required,
        ok,
        reason: ok
          ? undefined
          : valid.length === 0
            ? "sin bloques renderizables"
            : `solo ${valid.length}/${required} bloques válidos`,
      };
    });

    const validCount = lessonAudits.filter((l) => l.ok).length;
    const quizzes = input.quizzesByModule[mod.id] || [];
    let totalQs = 0;
    let validQs = 0;
    for (const q of quizzes) {
      const qs = Array.isArray(q.questions) ? q.questions : [];
      totalQs += qs.length;
      validQs += filterValidQuizQuestions(qs).length;
    }
    const hasValidQuiz = validQs >= MIN_VALID_QUESTIONS_PER_QUIZ;
    const moduleOk = validCount >= MIN_VALID_LESSONS_PER_MODULE;

    if (!moduleOk) errors.push(`Módulo "${mod.title}" sin lecciones renderizables`);
    else {
      const broken = lessonAudits.filter((l) => !l.ok);
      for (const b of broken) warnings.push(`Lección "${b.title}" (${b.lesson_type}): ${b.reason}`);
      if (!hasValidQuiz && quizzes.length > 0)
        warnings.push(`Quiz del módulo "${mod.title}" tiene solo ${validQs} preguntas válidas`);
    }

    modulesAudit.push({
      id: mod.id,
      title: mod.title,
      lessons: lessonAudits,
      validLessons: validCount,
      questions: totalQs,
      validQuestions: validQs,
      hasValidQuiz,
      ok: moduleOk,
      reason: moduleOk ? undefined : "sin lecciones renderizables",
    });

    totalLessons += lessonAudits.length;
    totalValidLessons += validCount;
    if (moduleOk) validModules += 1;
  }

  let qualityStatus: CourseAuditReport["qualityStatus"];
  if (validModules === 0) qualityStatus = "failed";
  else if (warnings.length > 0 || validModules < input.modules.length) qualityStatus = "needs_review";
  else qualityStatus = "ready";

  return {
    courseId: input.courseId,
    modules: modulesAudit,
    totalLessons,
    totalValidLessons,
    totalModules: input.modules.length,
    validModules,
    qualityStatus,
    warnings,
    errors,
  };
}
