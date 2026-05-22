// =====================================================================
// Course Studio — tipos centralizados de bloques y lecciones
// Toda lección tiene un `lesson_type` (default 'reading' para retro-compat)
// y un array `content.blocks` con bloques tipados que el dispatcher renderiza.
// =====================================================================

export type LessonType =
  | "reading"
  | "concept"
  | "flashcards"
  | "steps"
  | "comparison"
  | "case_study"
  | "interactive_quiz"
  | "video_embed"
  | "sop_walkthrough"
  | "client_chat";

// ---------- Bloques de cada tipo ----------

export type ReadingBlock =
  | { type: "heading"; text: string; level?: 1 | 2 | 3 }
  | { type: "paragraph"; text: string }
  | { type: "callout"; variant?: "info" | "warning" | "success" | "tip"; text: string; title?: string }
  | { type: "quote"; text: string; cite?: string }
  | { type: "code"; language?: string; code: string }
  | { type: "image"; url: string; alt?: string; caption?: string }
  | { type: "divider" };

export type ConceptBlock = {
  type: "term";
  term: string;
  definition: string;
  example?: string;
};

export type FlashcardBlock = {
  type: "flashcard";
  front: string;
  back: string;
  hint?: string;
};

export type StepBlock = {
  type: "step";
  n: number;
  title: string;
  description: string;
  tip?: string;
};

export type ComparisonBlock = {
  type: "comparison_table";
  headers: string[];
  rows: { label: string; cells: string[] }[];
};

export type CaseStudyBlock =
  | { type: "scenario"; text: string; title?: string }
  | { type: "question"; text: string }
  | { type: "reflection"; text: string };

// ---------- Bloques del Quiz interactivo (estilo Duolingo para adultos) ----------

export type InteractiveQuizBlock =
  | {
      type: "mc";
      question: string;
      options: string[];
      correct: string;
      explanation?: string;
    }
  | {
      type: "true_false";
      question: string;
      correct: boolean;
      explanation?: string;
    }
  | {
      type: "fill_blank";
      sentence: string; // usar ___ por cada hueco; admite múltiples
      correct: string | string[]; // string para 1 hueco, array para varios
      explanation?: string;
    }
  | {
      type: "match_pairs";
      pairs: { left: string; right: string }[];
      explanation?: string;
    }
  | {
      type: "order_steps";
      steps: string[]; // orden correcto
      explanation?: string;
    }
  | {
      type: "sort_into_buckets";
      buckets: string[]; // categorías
      items: { text: string; bucket: string }[]; // bucket = nombre exacto en buckets
      explanation?: string;
    }
  | {
      type: "highlight_terms";
      sentence: string;
      terms: string[]; // términos clave (palabras o frases) que deben marcarse
      distractors?: string[]; // otras palabras que NO deben marcarse
      explanation?: string;
    }
  | {
      type: "tap_to_complete";
      // Frase con huecos marcados con ___ (uno o varios).
      sentence: string;
      // Banco de palabras a tocar (incluye correctas + distractores).
      bank: string[];
      // Palabras correctas en orden de aparición.
      correct: string[];
      explanation?: string;
    };

// ---------- SOP walkthrough (procedimiento operativo paso a paso) ----------

export type SopStepBlock = {
  type: "sop_step";
  n: number;
  title: string;
  description: string;
  warning?: string;        // ⚠ riesgo / precaución
  image_url?: string;      // foto opcional
  must_check?: boolean;    // exige tildar antes de avanzar
};

export type VideoBlock = {
  type: "video";
  provider: "youtube" | "vimeo" | "url";
  url: string;
  title?: string;
};

// ---------- Chat con el Cliente (simulación de conversación) ----------

export type ChatSetupBlock = {
  type: "chat_setup";
  persona_name: string;
  persona_role: string;
  persona_mood: "neutral" | "frustrated" | "happy" | "confused" | "demanding";
  context: string;
  objective: string;
};

export type ChatTurnBlock = {
  type: "chat_turn";
  turn: number;
  client_message: string;
  choices: Array<{
    text: string;
    quality: "good" | "neutral" | "bad";
    score: number;
    feedback: string;
    client_reaction?: string;
  }>;
};

export type ChatOutcomeBlock = {
  type: "chat_outcome";
  max_score: number;
  thresholds: {
    success: number;
    partial: number;
  };
  messages: {
    success: string;
    partial: string;
    failure: string;
  };
  tips: string[];
};

export type ChatSimBlock = ChatSetupBlock | ChatTurnBlock | ChatOutcomeBlock;

export type LessonBlock =
  | ReadingBlock
  | ConceptBlock
  | FlashcardBlock
  | StepBlock
  | ComparisonBlock
  | CaseStudyBlock
  | InteractiveQuizBlock
  | VideoBlock
  | SopStepBlock
  | ChatSimBlock;

export interface LessonContent {
  blocks: LessonBlock[];
  text?: string;
}

// ---------- Helpers ----------

export const LESSON_TYPE_META: Record<
  LessonType,
  { label: string; icon: string; description: string }
> = {
  reading: { label: "Lectura", icon: "BookOpen", description: "Lección explicativa con secciones de texto" },
  concept: { label: "Conceptos", icon: "Lightbulb", description: "Glosario de términos y definiciones" },
  flashcards: { label: "Tarjetas", icon: "Layers", description: "Memorización tipo flashcard (frente / dorso)" },
  steps: { label: "Pasos", icon: "ListOrdered", description: "Procedimiento paso a paso" },
  comparison: { label: "Comparativa", icon: "Columns3", description: "Tabla comparativa de elementos" },
  case_study: { label: "Caso práctico", icon: "Briefcase", description: "Escenario aplicado con preguntas" },
  interactive_quiz: { label: "Práctica", icon: "Brain", description: "Mini-ejercicios interactivos tipo Duolingo" },
  video_embed: { label: "Video", icon: "Video", description: "Video externo embebido" },
  sop_walkthrough: { label: "Procedimiento", icon: "ClipboardCheck", description: "Paso a paso operativo con tildes obligatorias" },
  client_chat: { label: "Chat cliente", icon: "MessageSquare", description: "Simulación de conversación con un cliente" },
};

export function getLessonTypeMeta(type?: string | null) {
  const t = (type as LessonType) || "reading";
  return LESSON_TYPE_META[t] ?? LESSON_TYPE_META.reading;
}

export function isLessonType(v: unknown): v is LessonType {
  return typeof v === "string" && v in LESSON_TYPE_META;
}

export function getLessonBlocks(lesson: { content?: any }): LessonBlock[] {
  const blocks = lesson?.content?.blocks;
  if (Array.isArray(blocks)) return blocks as LessonBlock[];
  return [];
}
