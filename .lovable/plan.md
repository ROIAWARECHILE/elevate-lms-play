

# Plan: Fix Organization Creation, Links & RLS Issues

## Issues Found

### 1. Onboarding: Can't Create Organization (Critical)
The `Onboarding.tsx` flow does 3 steps: insert company, update profile, upsert admin role. Step 3 fails because `user_roles` has an ALL RLS policy requiring `has_role(auth.uid(), 'admin')`. A new user only has `collaborator` role (from the `handle_new_user` trigger), so they can't insert the `admin` role for themselves. The company gets created but the user is never made admin.

**Fix:** Create a `SECURITY DEFINER` database function `create_company_for_user(name, slug)` that atomically: creates the company, updates the profile's `company_id`, deletes the collaborator role, and inserts the admin role. Called from the client as a single RPC.

### 2. JoinCompany: Can't Find Company by Slug (Critical)
The companies SELECT RLS policy is `id = get_user_company_id(auth.uid())` — a user can only see the company they already belong to. A new user trying to join via `/join/acme-corp` can't query the company by slug because they aren't in it yet.

**Fix:** Add a new SELECT RLS policy on `companies` allowing any authenticated user to look up a company by slug: `true` for SELECT (since company names are not sensitive, and users need the slug to join). Alternatively, a more restrictive policy that only allows `get_user_company_id(auth.uid()) IS NULL` users to read.

### 3. All Links Use `window.location.origin` (Wrong Domain)
Three places generate links using `window.location.origin`:
- `AdminSettings.tsx` line 85: invite link display
- `AdminUsers.tsx` line 92: copy invite link
- `Auth.tsx` line 44: email redirect URL

In preview mode, this generates `https://id-preview--xxx.lovable.app/join/slug` instead of the published domain `https://elevate-lms-play.lovable.app`. Invite links shared externally won't work.

**Fix:** Create a utility constant `APP_URL` in `src/lib/constants.ts` that uses `import.meta.env.VITE_APP_URL || window.location.origin`. Set `VITE_APP_URL=https://elevate-lms-play.lovable.app` in `.env`. Use this constant in all three files.

### 4. Auth Redirect Ignores `?redirect=` Param
`JoinCompany.tsx` redirects to `/auth?redirect=/join/slug` but `Auth.tsx` always navigates to `/app` on login (line 25, 29). The redirect param is never read.

**Fix:** Read `searchParams.get("redirect")` in `Auth.tsx` and navigate there instead of hardcoded `/app`.

## Implementation

### Step 1: Database Migration
Create function and RLS policy:
```sql
-- Function to atomically create company + assign admin role
CREATE OR REPLACE FUNCTION public.create_company_for_user(
  _name text, _slug text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _company_id uuid; _user_id uuid;
BEGIN
  _user_id := auth.uid();
  IF get_user_company_id(_user_id) IS NOT NULL THEN
    RAISE EXCEPTION 'User already belongs to a company';
  END IF;
  INSERT INTO companies (name, slug) VALUES (_name, _slug)
    RETURNING id INTO _company_id;
  UPDATE profiles SET company_id = _company_id WHERE id = _user_id;
  DELETE FROM user_roles WHERE user_id = _user_id;
  INSERT INTO user_roles (user_id, role) VALUES (_user_id, 'admin');
  RETURN _company_id;
END; $$;

-- Allow any authenticated user to view companies (for join flow)
CREATE POLICY "Anyone can view companies by slug"
  ON public.companies FOR SELECT TO authenticated
  USING (true);
```
Also drop the old restrictive SELECT policy `Users can view own company` since the new one is broader.

### Step 2: Create `src/lib/constants.ts`
```ts
export const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
```

### Step 3: Update `.env`
Add `VITE_APP_URL=https://elevate-lms-play.lovable.app`

### Step 4: Update `Onboarding.tsx`
Replace the 3-step insert/update/upsert with a single `supabase.rpc('create_company_for_user', { _name, _slug })`.

### Step 5: Update `Auth.tsx`
Read `redirect` search param. On auth state change or session check, navigate to `redirect || "/app"`.

### Step 6: Update link generation
Replace `window.location.origin` with `APP_URL` in `AdminSettings.tsx`, `AdminUsers.tsx`, and `Auth.tsx` (emailRedirectTo).

## Files

| File | Action |
|---|---|
| Migration SQL | Create function + RLS policy |
| `src/lib/constants.ts` | Create — APP_URL constant |
| `.env` | Add VITE_APP_URL |
| `src/pages/Onboarding.tsx` | Use RPC instead of 3-step flow |
| `src/pages/Auth.tsx` | Handle redirect param |
| `src/pages/admin/AdminSettings.tsx` | Use APP_URL |
| `src/pages/admin/AdminUsers.tsx` | Use APP_URL |
| `src/pages/JoinCompany.tsx` | Minor — works now with new RLS |

