# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run build:dev    # Dev-mode build
npm run lint         # ESLint
npm run preview      # Preview production build

# Tests (Vitest + jsdom)
npm run test         # Run all tests once
npm run test:watch   # Watch mode
```

Run a single test file:
```bash
npx vitest run src/test/courseSchema.test.ts
```

E2E tests use Playwright (`playwright.config.ts` via `lovable-agent-playwright-config`).

Path alias `@` maps to `src/` (configured in both `vite.config.ts` and `vitest.config.ts`).

## Architecture

**Kibbo** is a gamified corporate e-learning platform (Duolingo-style for companies). Multi-tenant: every user belongs to a `company`, identified by an `invite_code`.

### Stack

- React 18 + TypeScript + Vite (SWC)
- Tailwind CSS + shadcn/ui (Radix UI primitives in `src/components/ui/`)
- TanStack Query v5 for server state
- React Router v6
- Framer Motion for page transitions and animations
- `@dnd-kit` for drag-and-drop (course editor)
- Supabase (Postgres + Auth + Edge Functions)

### Routing (`src/App.tsx`)

- Public routes: `/`, `/auth`, `/forgot-password`, `/reset-password`, `/onboarding`, `/join`
- Protected routes: nested under `/app` via `<AppLayout>` which enforces auth
- Admin sub-routes: `/app/admin/*` (courses, users, analytics, settings, studio)
- Most page components are **lazy-loaded** (`React.lazy`)

### Auth (`src/hooks/useAuth.tsx`)

`AuthProvider` wraps the entire app. It exposes:
- `user`, `session`, `profile`, `roles`, `isAdmin`, `isPending`, `loading`
- `signOut()`, `refreshProfile()`

Roles (`"admin" | "collaborator"`) come from the `user_roles` table. `isAdmin` is checked throughout for admin-only UI. `isPending` means the user's `profiles.status === "pending"` (awaiting company approval).

On first login, if no profile exists, the RPC `ensure_user_profile` is called as a recovery mechanism.

### Layout (`src/components/AppLayout.tsx`)

- **Desktop**: collapsible sidebar (`AppSidebar`) + sticky top header with `Cmd/Ctrl+K` command palette trigger
- **Mobile**: bottom tab bar (`BottomTabBar`) replaces sidebar; main content gets `pb-20` padding
- `isPending` users see a blocking approval screen with real-time polling (Supabase Realtime + 6s interval)
- Page transitions use Framer Motion `AnimatePresence` keyed on `location.pathname`

### Lesson Content System (`src/lib/courseSchema.ts`)

Every lesson has a `lesson_type` and a `content.blocks` JSON array. The `LessonRenderer` (`src/components/lesson/LessonRenderer.tsx`) dispatches to a typed runner based on `lesson_type`.

**9 lesson types and their runners:**

| `lesson_type` | Runner | Key block types |
|---|---|---|
| `reading` | `ReadingRunner` | `heading`, `paragraph`, `callout`, `quote`, `code`, `image`, `divider` |
| `concept` | `ConceptRunner` | `term` |
| `flashcards` | `FlashcardsRunner` | `flashcard` |
| `steps` | `StepsRunner` | `step` |
| `comparison` | `ComparisonRunner` | `comparison_table` |
| `case_study` | `CaseStudyRunner` | `scenario`, `question`, `reflection` |
| `interactive_quiz` | `InteractiveQuizRunner` | `mc`, `true_false`, `fill_blank`, `match_pairs`, `order_steps`, `sort_into_buckets`, `highlight_terms`, `tap_to_complete` |
| `video_embed` | `VideoRunner` | `video` |
| `sop_walkthrough` | `SOPWalkthroughRunner` | `sop_step` |

Default/fallback is `reading` for backwards compatibility with old content.

### Course Quality — Critical Sync Constraint

`src/lib/courseQuality.ts` is a **client-side mirror** of `supabase/functions/_shared/course-quality.ts`. Both files must stay **identical** in their `MIN_BLOCKS_BY_TYPE` constants, `sanitizeBlock` logic, and validation rules. Changing one without the other will cause the admin UI to show different quality verdicts than the edge functions.

### Gamification (`src/lib/gamification.ts`, `src/lib/achievements.ts`)

- **XP + Level**: exponential curve `100 * N^1.4`. Updated via `updateStreakAndLevel()` after any progress event.
- **Streaks**: validated on auth load in `useAuth`; resets to 0 if last activity was >1 day ago.
- **Achievements**: evaluated client-side by `evaluateAchievements()` after progress events. Achievement criteria map 1:1 to fields in `UserStats` (e.g., `lessons_completed`, `streak_days`, `fast_quiz_passed`).
- **Daily quests**: table `daily_quests`, claimed per day.

### SRS — Spaced Repetition (`src/hooks/useSRS.ts`)

SM-2 algorithm. Items are stored in `srs_items` table. All SRS operations go through Supabase RPCs:
- `srs_enqueue` — add/upsert an item
- `srs_review(_item_id, _quality)` — record a review (quality 0–5)
- `srs_get_due(_limit, _course_id)` — fetch due items
- `srs_due_count` — count due items (polled every 60s)

Item types: `"concept" | "quiz_block" | "term" | "mistake"`. Keys are stable hashes via `srsKey()`.

`useSrsAutoSeed` seeds SRS items automatically when a lesson is completed, converting `term`, `flashcard`, and quiz blocks (`mc`, `true_false`, `fill_blank`, `match_pairs`, `order_steps`) into SRS cards. Only seeds once per lesson per mount (tracked via `useRef`).

### Other Notable Hooks

- `useMistakes` — persists wrong answers to `user_mistakes` table; `addMistake` shows a toast, `addMistakeSilent` is for silent auto-recording after repeated failures.
- `useSkillProfile` — reads `user_skill_profile` (mastery 0–1, difficulty preference). Returns a default "beginner" profile if the row doesn't exist yet.
- `useDictionaryAutoIndex` — on `concept` lessons, upserts `term` blocks into `course_dictionary` (keyed on `lesson_id, term`). Best-effort, silent on failure.
- `useGoToShortcuts` — registers keyboard shortcuts for in-app navigation.
- `useSoundEffects` — wraps `audioEngine` singleton for sound playback.

### Audio Engine (`src/lib/audioEngine.ts`)

Procedural synthesis via Web Audio API — **no audio files**. Single `audioEngine` singleton. Sound keys: `correct`, `wrong`, `xp`, `moduleComplete`, `quizPass`, `quizFail`. Used via `useSoundEffects` hook.

### Supabase Edge Functions (`supabase/functions/`)

| Function | Purpose |
|---|---|
| `generate-course` | AI-powered full course generation |
| `generate-lesson-audio` | TTS audio for lessons |
| `regenerate-lesson` | Regenerate a single lesson with AI |
| `repair-course` | Fix/validate course structure |
| `generate-study-guide` | AI study guide from course content |
| `fetch-source` | Fetch external URL content |
| `parse-source` | Parse uploaded source documents |
| `admin-delete-user` | Admin-only user deletion (JWT verified) |

Shared utilities in `supabase/functions/_shared/`.

### Key Database Tables

`profiles`, `companies`, `courses`, `modules`, `lessons`, `lesson_content_history`, `user_progress`, `user_quiz_results`, `user_mistakes`, `user_skill_profile`, `achievements`, `user_achievements`, `user_roles`, `srs_items`, `course_dictionary`, `daily_quests`, `course_sources`

Generated TypeScript types: `src/integrations/supabase/types.ts`. Supabase client: `src/integrations/supabase/client.ts`.

### Environment Variables

- `VITE_APP_URL` — overrides `window.location.origin` as the base URL (see `src/lib/constants.ts`)

### Tests (`src/test/`)

Vitest + jsdom. Test files: `courseSchema.test.ts`, `gamification.test.ts`, `srs.test.ts`, `lessonDuration.test.ts`, `courseQuality.test.ts`, `minBlocksSync.test.ts`, `example.test.ts`.
