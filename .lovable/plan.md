

# Plan: Fix Registration Role Choice & Admin Data Display

## Root Cause Analysis

### Issue 1: Role choice screen never appears after registration
In `Auth.tsx`, `supabase.auth.signUp()` auto-creates a session. The `onAuthStateChange` listener (line 27-31) fires immediately with the new session, and since `showRoleChoice` is still `false` at that point, it navigates to `/app`. Then `AppLayout` sees no `company_id` and redirects to `/onboarding` — skipping the "Soy empresa / Soy colaborador" choice entirely.

**Fix:** Prevent auto-navigation during registration. Only auto-redirect on `SIGNED_IN` event when the user is logging in (not registering). After successful signUp, show the role choice screen without the auth listener interfering.

### Issue 2: AppLayout redirects users without company_id to /onboarding
Line 29-31 in `AppLayout.tsx`: any user without `company_id` gets sent to `/onboarding` (company creation). But collaborators who haven't joined yet should go to `/join` instead. Currently there's no way to distinguish — both new companies and new collaborators land on onboarding.

**Fix:** Remove the forced redirect to `/onboarding` from `AppLayout`. Instead, handle routing in `Auth.tsx` post-registration based on role choice. Users who already have a session but no company should see the role choice screen again.

### Issue 3: Admin courses/invite code not displaying
The `AdminUsers.tsx` fetches company data and invite code correctly in the code. The likely issue is that after creating a company via RPC, the `refreshProfile` call updates the profile but the admin role query in `useAuth` may not reflect immediately due to caching or the `user_roles` RLS policy (the `Admins can manage roles` ALL policy checks `has_role(auth.uid(), 'admin')` — but the role was just assigned by the RPC, so the client query runs before the role is fully committed or cached).

**Fix:** Add a small delay or force re-fetch in `refreshProfile` to ensure roles are reloaded. Also ensure `fetchProfile` fetches roles correctly after company creation.

## Implementation

### Step 1: Fix Auth.tsx — Role choice race condition
- Track registration mode separately from auth state changes
- On `signUp` success, set `showRoleChoice = true` **before** the auth listener can redirect
- In the auth listener, skip navigation when `isRegister` is true and user just signed up
- Use a ref to avoid stale closure issues with `showRoleChoice`

### Step 2: Fix AppLayout.tsx — Smart redirect for users without company
- Change line 29-31: instead of always redirecting to `/onboarding`, show a choice screen or redirect based on whether the user has already chosen a path
- Alternative: keep the redirect but make it go to `/auth?choose=true` which shows the role picker

### Step 3: Fix Auth.tsx — Handle returning users without company
- If a user is already authenticated but has no `company_id`, show the role choice screen
- Read from `useAuth()` to check profile state

### Step 4: Ensure refreshProfile reloads roles
- In `useAuth.tsx`, make `refreshProfile` also re-fetch roles (it already does via `fetchProfile`)
- Add a small guard to ensure the data is fresh

## Files

| File | Action |
|---|---|
| `src/pages/Auth.tsx` | Fix race condition — use ref for showRoleChoice, prevent auth listener redirect during registration |
| `src/components/AppLayout.tsx` | Change no-company redirect to show role choice instead of forcing onboarding |
| `src/hooks/useAuth.tsx` | Minor — ensure refreshProfile fully reloads roles |

