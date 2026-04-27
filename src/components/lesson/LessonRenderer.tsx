// =====================================================================
// Dispatcher: renderiza el contenido de una lección según su `lesson_type`.
// Es 100% retro-compatible: si lesson_type es null/undefined o "reading",
// usa el ReadingRunner igual que la versión anterior.
// =====================================================================

import { getLessonBlocks, type LessonType, type LessonBlock } from "@/lib/courseSchema";
import { ReadingRunner } from "./runners/ReadingRunner";
import { ConceptRunner } from "./runners/ConceptRunner";
import { FlashcardsRunner } from "./runners/FlashcardsRunner";
import { StepsRunner } from "./runners/StepsRunner";
import { ComparisonRunner } from "./runners/ComparisonRunner";
import { CaseStudyRunner } from "./runners/CaseStudyRunner";
import { InteractiveQuizRunner } from "./runners/InteractiveQuizRunner";
import { VideoRunner } from "./runners/VideoRunner";
import { SOPWalkthroughRunner } from "./runners/SOPWalkthroughRunner";

interface Props {
  lesson: { lesson_type?: string | null; content?: any };
}

export function LessonRenderer({ lesson }: Props) {
  const type = (lesson.lesson_type as LessonType) || "reading";
  const blocks = getLessonBlocks(lesson) as LessonBlock[];

  switch (type) {
    case "concept":
      return <ConceptRunner blocks={blocks.filter((b) => b.type === "term") as any} />;
    case "flashcards":
      return <FlashcardsRunner blocks={blocks.filter((b) => b.type === "flashcard") as any} />;
    case "steps":
      return <StepsRunner blocks={blocks.filter((b) => b.type === "step") as any} />;
    case "comparison": {
      const tableBlock = blocks.find((b) => b.type === "comparison_table") as any;
      return <ComparisonRunner block={tableBlock} />;
    }
    case "case_study":
      return (
        <CaseStudyRunner
          blocks={
            blocks.filter((b) =>
              b.type === "scenario" || b.type === "question" || b.type === "reflection"
            ) as any
          }
        />
      );
    case "interactive_quiz":
      return (
        <InteractiveQuizRunner
          blocks={
            blocks.filter((b) =>
              b.type === "mc" || b.type === "true_false" || b.type === "fill_blank" ||
              b.type === "match_pairs" || b.type === "order_steps" ||
              b.type === "sort_into_buckets" || b.type === "highlight_terms" ||
              b.type === "tap_to_complete"
            ) as any
          }
        />
      );
    case "sop_walkthrough":
      return (
        <SOPWalkthroughRunner
          blocks={blocks.filter((b) => b.type === "sop_step") as any}
        />
      );
    case "video_embed": {
      const v = blocks.find((b) => b.type === "video") as any;
      return <VideoRunner block={v} />;
    }
    case "reading":
    default:
      // Reading uses heading/paragraph/callout/quote/code/image/divider blocks.
      // Filter to only reading-shaped blocks for safety.
      return (
        <ReadingRunner
          blocks={
            blocks.filter((b) =>
              b.type === "heading" || b.type === "paragraph" || b.type === "callout" ||
              b.type === "quote" || b.type === "code" || b.type === "image" || b.type === "divider"
            ) as any
          }
          legacyText={lesson?.content?.text}
        />
      );
  }
}
