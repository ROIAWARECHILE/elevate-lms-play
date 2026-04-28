-- Improve approve_user: idempotent, only acts on pending, scoped to admin's company
CREATE OR REPLACE FUNCTION public.approve_user(_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not admin'; END IF;
  UPDATE public.profiles
     SET status = 'active', updated_at = now()
   WHERE id = _target_user_id
     AND company_id = get_user_company_id(auth.uid())
     AND status = 'pending';
END;
$function$;

-- Bulk approve all pending users from the admin's company
CREATE OR REPLACE FUNCTION public.approve_all_pending_users()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _company_id uuid;
  _count integer;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not admin'; END IF;
  _company_id := get_user_company_id(auth.uid());
  IF _company_id IS NULL THEN RAISE EXCEPTION 'No company'; END IF;

  WITH updated AS (
    UPDATE public.profiles
       SET status = 'active', updated_at = now()
     WHERE company_id = _company_id
       AND status = 'pending'
    RETURNING 1
  )
  SELECT count(*) INTO _count FROM updated;

  RETURN COALESCE(_count, 0);
END;
$function$;

-- Approve many specific users (admin scoped)
CREATE OR REPLACE FUNCTION public.approve_users_bulk(_target_user_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _company_id uuid;
  _count integer;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not admin'; END IF;
  _company_id := get_user_company_id(auth.uid());

  WITH updated AS (
    UPDATE public.profiles
       SET status = 'active', updated_at = now()
     WHERE id = ANY(_target_user_ids)
       AND company_id = _company_id
       AND status = 'pending'
    RETURNING 1
  )
  SELECT count(*) INTO _count FROM updated;

  RETURN COALESCE(_count, 0);
END;
$function$;

-- Returns pending users for admin's company including email and signup time from auth.users
CREATE OR REPLACE FUNCTION public.get_pending_users()
RETURNS TABLE(
  id uuid,
  full_name text,
  email text,
  requested_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _company_id uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not admin'; END IF;
  _company_id := get_user_company_id(auth.uid());
  IF _company_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT p.id,
         p.full_name,
         u.email::text,
         COALESCE(p.updated_at, p.created_at) AS requested_at
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
   WHERE p.company_id = _company_id
     AND p.status = 'pending'
   ORDER BY COALESCE(p.updated_at, p.created_at) ASC;
END;
$function$;