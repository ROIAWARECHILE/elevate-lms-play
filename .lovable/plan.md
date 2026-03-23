

# Analysis: Issues Found in Kibbo

## Issues Identified

### 1. Broken Routes (404 errors in console)
The sidebar links to `/app/admin/users`, `/app/admin/analytics`, and `/app/admin/settings` but no routes exist for them in `App.tsx`. Console logs confirm `404 Error: User attempted to access non-existent route: /app/admin/users`.

**Fix:** Either add placeholder pages for these routes or remove the links from the sidebar.

### 2. QuizView Score Calculation Bug (Critical)
In `saveResult()` (line 93-96), the score calculation is broken:
```js
const finalScore = Math.round(((correctCount + (isCorrect ? 0 : 0)) / questions.length) * 100);
const actualCorrect = correctCount + (selectedAnswer === currentQuestion?.correct_answer ? 0 : 0);
```
The ternary expressions always evaluate to `0` regardless of correctness (`isCorrect ? 0 : 0`). The intent was to account for the last answer not yet being counted in `correctCount` due to React state batching, but the logic is wrong. It should be `isCorrect ? 1 : 0`.

Additionally, `saveResult()` is called in `handleNext()` before `setFinished(true)` takes effect, so `correctCount` may not include the last answer. The `isCorrect` variable references `selectedAnswer` and `currentQuestion` which are still from the current render -- but the `+ 0` makes it useless.

**Fix:** Change to `(isCorrect ? 1 : 0)` in both lines. Also, the final results screen uses `correctCount` directly, which may also be stale for the last question if the user got it right (since `setCorrectCount` is async).

### 3. Dashboard Shows Hardcoded Zeros
- Collaborator dashboard: "Cursos" stat is hardcoded to `0`, and "Cursos en progreso" always shows "No tienes cursos asignados".
- Admin dashboard: All stats (Users, Courses, Completion rate, Certificates) are hardcoded to `0`.

**Fix:** Fetch actual counts from Supabase (courses count, user_progress data, profiles count).

### 4. Profile Page Shows Hardcoded Zero for "Cursos completados"
Line 47 in Profile.tsx: `{ label: "Cursos completados", value: 0, ... }` is static.

**Fix:** Query `user_progress` to get actual completed courses count.

### 5. XP Level Progress Calculation Bug
In Profile.tsx line 10:
```js
const xpProgress = ((profile?.xp_total || 0) % 100) / xpForNextLevel * 100;
```
If `xpForNextLevel = level * 100 = 100`, and XP is e.g. 50, then `(50 % 100) / 100 * 100 = 50`. But for level 2, `xpForNextLevel = 200`, and XP 150 gives `(150 % 100) / 200 * 100 = 25%`. This doesn't make sense -- the modulo should be against `xpForNextLevel`, not 100.

**Fix:** Use a proper level-based XP calculation.

### 6. Walkthrough Overlay Blocks Interaction
The walkthrough overlay uses `box-shadow: 0 0 0 9999px rgba(0,0,0,0.55)` for the spotlight, but the spotlight div has `pointer-events-none`. The dark overlay behind it (`bg-foreground/60`) intercepts all clicks except the tooltip buttons. Elements highlighted by the spotlight cannot be clicked/interacted with during the walkthrough.

This is by design for most walkthroughs, but clicking the overlay dismisses it (`onClick={finish}`), which is fine.

### 7. Onboarding `user_roles` Upsert Missing Conflict Target
In Onboarding.tsx line 48, the upsert doesn't specify `onConflict`, which may fail:
```js
await supabase.from("user_roles").upsert({ user_id: user.id, role: "admin" as any });
```
The `user_roles` table has a unique constraint on `(user_id, role)`, so this should work for upserting. However, `as any` cast suggests a type mismatch issue.

### 8. Missing `company_id` Filter on Courses Queries
`Courses.tsx` fetches all published courses without filtering by `company_id`. RLS handles this, but the admin `AdminCourses.tsx` also fetches without a company filter -- RLS covers it, but no explicit filter means relying entirely on RLS.

### 9. No Duplicate Progress Protection
`LessonView.tsx` and `QuizView.tsx` insert into `user_progress` without checking if a record already exists for non-first completions. If a user reloads and completes again, duplicate XP could be awarded. LessonView checks `completed` state, but QuizView's `alreadyPassed` only checks on initial load.

---

## Proposed Plan

### Step 1: Fix broken routes
- Create placeholder pages for `/app/admin/users`, `/app/admin/analytics`, `/app/admin/settings`
- Register them in `App.tsx`

### Step 2: Fix QuizView score bug
- Change `(isCorrect ? 0 : 0)` to `(isCorrect ? 1 : 0)` in `saveResult()`
- Fix the final screen to show the correct count including the last answer

### Step 3: Add real data to Dashboard
- Collaborator: fetch assigned/in-progress courses count and display active courses
- Admin: fetch real counts for users, published courses

### Step 4: Fix Profile page
- Query completed courses count from `user_progress`
- Fix XP progress calculation

### Step 5: Fix Onboarding upsert
- Add `onConflict` to the upsert call

### Files to modify
| File | Change |
|---|---|
| `src/pages/QuizView.tsx` | Fix score calculation bug |
| `src/pages/Dashboard.tsx` | Fetch real stats from Supabase |
| `src/pages/Profile.tsx` | Fetch completed courses, fix XP calc |
| `src/pages/Onboarding.tsx` | Fix upsert conflict |
| `src/App.tsx` | Add missing admin routes |
| `src/pages/admin/AdminUsers.tsx` | Create placeholder |
| `src/pages/admin/AdminAnalytics.tsx` | Create placeholder |
| `src/pages/admin/AdminSettings.tsx` | Create placeholder |

