import { describe, it, expect } from "vitest";
import { MIN_BLOCKS_BY_TYPE } from "@/lib/courseQuality";

// Mirror of supabase/functions/_shared/course-quality.ts MIN_BLOCKS_BY_TYPE.
// This test catches any divergence between the two copies before it reaches production.
const SERVER_EXPECTED: Record<string, number> = {
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

describe("MIN_BLOCKS_BY_TYPE — sincronización cliente/servidor", () => {
  it("el cliente tiene exactamente los mismos tipos que el servidor", () => {
    expect(Object.keys(MIN_BLOCKS_BY_TYPE).sort()).toEqual(Object.keys(SERVER_EXPECTED).sort());
  });

  it("cada tipo tiene el mismo mínimo de bloques en cliente y servidor", () => {
    for (const [type, min] of Object.entries(SERVER_EXPECTED)) {
      expect(MIN_BLOCKS_BY_TYPE[type]).toBe(min);
    }
  });
});
