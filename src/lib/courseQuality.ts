// =====================================================================
// Course Quality (cliente) — espejo del módulo en supabase/functions/_shared.
// Mantener sincronizado: las reglas deben ser idénticas.
// =====================================================================

import type { LessonType, LessonBlock } from "@/lib/courseSchema";

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
  client_chat: 4,
};

const QUIZ_BLOCK_TYPES = [
  "mc", "true_false", "fill_blank", "match_pairs", "order_steps",
  "sort_into_buckets", "highlight_terms", "tap_to_complete",
];

function nonEmptyStr(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function sanitizeBlock(lessonType: string, raw: any): any | null {
  if (!raw || typeof raw !== "object" || !nonEmptyStr(raw.type)) return null;
  const t = raw.type;
  if (lessonType === "reading") {
    if (t === "heading" && nonEmptyStr(raw.text)) return raw;
    if (t === "paragraph" && nonEmptyStr(raw.text)) return raw;
    if (t === "callout" && nonEmptyStr(raw.text)) return raw;
    if (t === "quote" && nonEmptyStr(raw.text)) return raw;
    if (t === "code" && nonEmptyStr(raw.code)) return raw;
    if (t === "image" && nonEmptyStr(raw.url)) return raw;
    if (t === "divider") return raw;
    return null;
  }
  if (lessonType === "concept") {
    return t === "term" && nonEmptyStr(raw.term) && nonEmptyStr(raw.definition) ? raw : null;
  }
  if (lessonType === "flashcards") {
    return t === "flashcard" && nonEmptyStr(raw.front) && nonEmptyStr(raw.back) ? raw : null;
  }
  if (lessonType === "steps") {
    return t === "step" && nonEmptyStr(raw.title) && nonEmptyStr(raw.description) ? raw : null;
  }
  if (lessonType === "comparison") {
    if (t !== "comparison_table") return null;
    const headers = Array.isArray(raw.headers) ? raw.headers.filter(nonEmptyStr) : [];
    const rows = Array.isArray(raw.rows)
      ? raw.rows.filter((r: any) => nonEmptyStr(r?.label) && Array.isArray(r?.cells) && r.cells.some((c: any) => nonEmptyStr(c)))
      : [];
    return headers.length >= 2 && rows.length >= 2 ? raw : null;
  }
  if (lessonType === "case_study") {
    if (t === "scenario" && nonEmptyStr(raw.text)) return raw;
    if (t === "question" && nonEmptyStr(raw.text)) return raw;
    if (t === "reflection" && nonEmptyStr(raw.text)) return raw;
    return null;
  }
  if (lessonType === "sop_walkthrough") {
    return t === "sop_step" && nonEmptyStr(raw.title) && nonEmptyStr(raw.description) ? raw : null;
  }
  if (lessonType === "video_embed") {
    return t === "video" && nonEmptyStr(raw.url) ? raw : null;
  }
  if (lessonType === "client_chat") {
    if (t === "chat_setup") {
      return nonEmptyStr(raw.persona_name) && nonEmptyStr(raw.context) && nonEmptyStr(raw.objective) ? raw : null;
    }
    if (t === "chat_turn") {
      if (!nonEmptyStr(raw.client_message)) return null;
      const choices = Array.isArray(raw.choices)
        ? raw.choices.filter((c: any) => nonEmptyStr(c?.text) && nonEmptyStr(c?.quality) && nonEmptyStr(c?.feedback))
        : [];
      return choices.length >= 2 ? raw : null;
    }
    if (t === "chat_outcome") {
      return raw.messages && nonEmptyStr(raw.messages?.success) && nonEmptyStr(raw.messages?.partial) && nonEmptyStr(raw.messages?.failure) ? raw : null;
    }
    return null;
  }
  if (lessonType === "interactive_quiz") {
    if (!QUIZ_BLOCK_TYPES.includes(t)) return null;
    if (t === "mc") {
      const opts = Array.isArray(raw.options) ? raw.options.filter(nonEmptyStr) : [];
      return nonEmptyStr(raw.question) && opts.length >= 3 && nonEmptyStr(raw.correct) && opts.includes(raw.correct) ? raw : null;
    }
    if (t === "true_false") return nonEmptyStr(raw.question) && typeof raw.correct === "boolean" ? raw : null;
    if (t === "fill_blank") {
      if (!nonEmptyStr(raw.sentence) || !raw.sentence.includes("___")) return null;
      const ok = (Array.isArray(raw.correct) && raw.correct.every(nonEmptyStr)) || nonEmptyStr(raw.correct);
      return ok ? raw : null;
    }
    if (t === "match_pairs") {
      const pairs = Array.isArray(raw.pairs) ? raw.pairs.filter((p: any) => nonEmptyStr(p?.left) && nonEmptyStr(p?.right)) : [];
      return pairs.length >= 3 ? raw : null;
    }
    if (t === "order_steps") {
      const s = Array.isArray(raw.steps) ? raw.steps.filter(nonEmptyStr) : [];
      return s.length >= 3 ? raw : null;
    }
    if (t === "sort_into_buckets") {
      const buckets = Array.isArray(raw.buckets) ? raw.buckets.filter(nonEmptyStr) : [];
      const items = Array.isArray(raw.items) ? raw.items.filter((i: any) => nonEmptyStr(i?.text) && buckets.includes(i?.bucket)) : [];
      return buckets.length >= 2 && items.length >= 3 ? raw : null;
    }
    if (t === "highlight_terms") {
      const terms = Array.isArray(raw.terms) ? raw.terms.filter(nonEmptyStr) : [];
      return nonEmptyStr(raw.sentence) && terms.length > 0 ? raw : null;
    }
    if (t === "tap_to_complete") {
      const bank = Array.isArray(raw.bank) ? raw.bank.filter(nonEmptyStr) : [];
      const correct = Array.isArray(raw.correct) ? raw.correct.filter(nonEmptyStr) : [];
      return nonEmptyStr(raw.sentence) && raw.sentence.includes("___") && bank.length >= 3 && correct.length > 0 && correct.every((c: string) => bank.includes(c))
        ? raw
        : null;
    }
    return null;
  }
  return null;
}

export function sanitizeBlocksForLessonType(lessonType: string, blocks: any[]): any[] {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((b) => sanitizeBlock(lessonType, b)).filter(Boolean);
}

export function getRenderableBlockCount(lesson: { lesson_type?: string | null; content?: any }): number {
  const type = (lesson?.lesson_type as LessonType) || "reading";
  const blocks = Array.isArray(lesson?.content?.blocks) ? lesson.content.blocks : [];
  return sanitizeBlocksForLessonType(type, blocks).length;
}

export function lessonMeetsMinimum(lesson: { lesson_type?: string | null; content?: any }): boolean {
  const type = lesson?.lesson_type || "reading";
  const min = MIN_BLOCKS_BY_TYPE[type] ?? 1;
  return getRenderableBlockCount(lesson) >= min;
}

export function isValidQuizQuestion(q: any): boolean {
  if (!q || !nonEmptyStr(q.question_text)) return false;
  const opts = Array.isArray(q.options) ? q.options.filter(nonEmptyStr) : [];
  if (q.question_type === "true_false") return opts.length >= 2 && nonEmptyStr(q.correct_answer);
  return opts.length >= 2 && nonEmptyStr(q.correct_answer) && opts.includes(q.correct_answer);
}

export type CourseQualityIssue = { module: string; lesson?: string; reason: string };

export function auditCourseClient(modules: any[]): {
  status: "ready" | "needs_review" | "failed";
  issues: CourseQualityIssue[];
  validModules: number;
  totalModules: number;
  totalLessons: number;
  validLessons: number;
} {
  const issues: CourseQualityIssue[] = [];
  let validModules = 0;
  let totalLessons = 0;
  let validLessons = 0;
  for (const m of modules || []) {
    const lessons = m.lessons || [];
    let modValid = 0;
    for (const l of lessons) {
      totalLessons += 1;
      if (lessonMeetsMinimum(l)) {
        modValid += 1;
        validLessons += 1;
      } else {
        issues.push({ module: m.title, lesson: l.title, reason: "sin contenido renderizable" });
      }
    }
    if (modValid >= 1) validModules += 1;
    else issues.push({ module: m.title, reason: "módulo sin lecciones útiles" });
  }
  let status: "ready" | "needs_review" | "failed" = "ready";
  if (validModules === 0) status = "failed";
  else if (issues.length > 0) status = "needs_review";
  return { status, issues, validModules, totalModules: modules?.length || 0, totalLessons, validLessons };
}
