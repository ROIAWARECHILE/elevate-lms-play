

# Plan: Flujo Completo Funcional + Gestión de Usuarios

## Issues Found

### 1. Lesson Content Not Rendering (Critical)
`LessonView.tsx` line 141 checks `lesson?.content?.text` but the seed data stores content as `{ blocks: [{type, text}] }`. Result: every lesson shows "Esta lección no tiene contenido todavía."

**Fix:** Render `content.blocks` array — map each block to heading/paragraph based on `type`.

### 2. QuizView Double-Counting Bug
In `handleNext` (line 92), `correctCount` already includes the current answer (set in `handleAnswer` line 82). But `finalCorrect` adds +1 again if correct. This double-counts the last answer.

**Fix:** At the last question, `correctCount` is already updated via `setCorrectCount` in `handleAnswer`. Since React batches state, by the time `handleNext` runs, `correctCount` may or may not reflect the update. The safest fix: track correct count via ref, or compute `finalCorrect` correctly without the conditional.

### 3. AdminUsers — Placeholder Only
Currently shows "Próximamente". Needs a real user management panel.

**Fix:** Build functional page with:
- Table of company users (from `profiles` + `user_roles`)
- Invite collaborator by email (Supabase `auth.admin` won't work client-side, so use an invite flow via edge function or simple "copy invite link")
- Toggle role between admin/collaborator
- Show user status (XP, level, last activity)

### 4. AdminSettings — Placeholder Only
Needs company name/logo editing.

**Fix:** Build form to update company name, slug, primary_color. Uses existing `companies` table + RLS update policy.

### 5. Onboarding Doesn't Redirect Properly
After creating a company, `Onboarding` navigates to `/app` but `AppLayout` doesn't check if user has a company. A user without a company can access `/app` directly and see broken data.

**Fix:** In `AppLayout`, if user is loaded and `profile.company_id` is null, redirect to `/onboarding`.

### 6. No Invite/Registration Flow for Collaborators
Currently, new users register via `/auth` and land in `/app` with no `company_id`. There's no way for admins to invite collaborators or for collaborators to join a company.

**Fix:** 
- Add invite link system: admin generates a link like `/join/{company_slug}`
- New page `JoinCompany.tsx`: user sees company name, clicks "Unirse", profile gets updated with `company_id`
- Admin can copy invite link from AdminUsers page

## Implementation Plan

### Step 1: Fix LessonView content rendering
Render `content.blocks` array with proper heading/paragraph styling.

### Step 2: Fix QuizView scoring
Use a local variable to track the final count instead of relying on async state.

### Step 3: AppLayout — redirect if no company
Check `profile?.company_id` after auth. If null, redirect to `/onboarding`.

### Step 4: Build AdminUsers page
- Fetch all profiles in company with their roles
- Table with: name, email (from user metadata), role, XP, level, last activity
- Button to copy invite link (`/join/{company_slug}`)
- Ability to change user role (admin/collaborator)

### Step 5: Build JoinCompany page
- Route: `/join/:companySlug`
- Fetch company by slug
- If user is logged in and has no company, update their profile with `company_id`
- If not logged in, redirect to `/auth?redirect=/join/:slug`

### Step 6: Build AdminSettings page
- Form: company name, primary color
- Updates `companies` table

### Files to create/modify

| File | Action |
|---|---|
| `src/pages/LessonView.tsx` | Fix content rendering |
| `src/pages/QuizView.tsx` | Fix score double-count |
| `src/components/AppLayout.tsx` | Add company_id check + redirect |
| `src/pages/admin/AdminUsers.tsx` | Full user management UI |
| `src/pages/admin/AdminSettings.tsx` | Company settings form |
| `src/pages/JoinCompany.tsx` | New — join company via invite link |
| `src/App.tsx` | Add `/join/:companySlug` route |

