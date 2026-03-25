

# Plan: Fix Invitation System & Link Generation

## Current State Analysis

After reviewing the code and network requests, the `APP_URL` constant system is already correctly implemented. All files use `APP_URL` from `src/lib/constants.ts`, and `.env` has `VITE_APP_URL=https://elevate-lms-play.lovable.app`. No custom domain is registered beyond this published URL.

The main issues are in the **invitation/join flow**:

## Issues Found

### 1. JoinCompany Race Condition (Bug)
`JoinCompany.tsx` fetches the company from Supabase on mount, but the RLS policy `"Anyone can view companies"` is scoped to `TO authenticated`. If the user is not logged in (anon), the query returns nothing, briefly showing "Empresa no encontrada" before redirecting to `/auth`. After login and redirect back, the company query works, but the UX is broken for first-time visitors.

**Fix:** Add an RLS policy allowing `anon` users to SELECT companies (company names/slugs are not sensitive). Also restructure the component to defer the company fetch until auth state is known.

### 2. JoinCompany Doesn't Assign Collaborator Role on Join
When a user joins via invite link, only `company_id` is updated on the profile. The `collaborator` role was already assigned by the `handle_new_user` trigger at signup, so this works for new users. But if roles were modified or deleted, there's no guarantee. Best practice: create a `join_company_by_slug` RPC function (SECURITY DEFINER) that atomically updates company_id and ensures the collaborator role exists.

### 3. emailRedirectTo Doesn't Preserve Redirect Path
In `Auth.tsx`, `emailRedirectTo: APP_URL` sends the user to the root after email confirmation. If they were trying to join a company, the redirect context is lost.

**Fix:** Set `emailRedirectTo: \`${APP_URL}${redirectTo}\`` to preserve the intended destination.

## Implementation

### Step 1: Database Migration
```sql
-- Allow anon users to view companies (for join page before login)
CREATE POLICY "Anon can view companies"
  ON public.companies FOR SELECT TO anon
  USING (true);

-- Atomic join function with role safety
CREATE OR REPLACE FUNCTION public.join_company_by_slug(_slug text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _company_id uuid; _user_id uuid;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF get_user_company_id(_user_id) IS NOT NULL THEN
    RAISE EXCEPTION 'User already belongs to a company';
  END IF;
  SELECT id INTO _company_id FROM companies WHERE slug = _slug;
  IF _company_id IS NULL THEN RAISE EXCEPTION 'Company not found'; END IF;
  UPDATE profiles SET company_id = _company_id WHERE id = _user_id;
  -- Ensure collaborator role exists
  INSERT INTO user_roles (user_id, role)
  VALUES (_user_id, 'collaborator')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN _company_id;
END; $$;
```

### Step 2: Update `JoinCompany.tsx`
- Defer company fetch until auth state resolves
- Use `join_company_by_slug` RPC instead of raw profile update
- Show company info to unauthenticated users (now works with anon policy)
- Better error handling and loading states

### Step 3: Update `Auth.tsx`
- Set `emailRedirectTo: \`${APP_URL}${redirectTo}\`` to preserve join redirect

## Files

| File | Action |
|---|---|
| Migration SQL | Create anon policy + join_company_by_slug function |
| `src/pages/JoinCompany.tsx` | Refactor — use RPC, fix race condition |
| `src/pages/Auth.tsx` | Fix emailRedirectTo to include redirect path |

