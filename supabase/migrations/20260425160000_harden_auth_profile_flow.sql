-- Harden registration/login profile synchronization.
-- Keeps roles in public.user_roles and makes company/join RPCs resilient if the profile trigger is delayed.

CREATE OR REPLACE FUNCTION public.ensure_user_profile(_full_name text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.profiles (id, full_name)
  VALUES (_user_id, COALESCE(NULLIF(trim(_full_name), ''), ''))
  ON CONFLICT (id) DO UPDATE
    SET full_name = CASE
      WHEN public.profiles.full_name = '' AND EXCLUDED.full_name <> '' THEN EXCLUDED.full_name
      ELSE public.profiles.full_name
    END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'collaborator')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_profile(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_company_for_user(_name text, _slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _user_id uuid;
  _code text;
  _base_slug text;
  _final_slug text;
  _suffix integer := 1;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  PERFORM public.ensure_user_profile('');

  IF get_user_company_id(_user_id) IS NOT NULL THEN
    RAISE EXCEPTION 'User already belongs to a company';
  END IF;

  _base_slug := lower(regexp_replace(coalesce(nullif(trim(_slug), ''), trim(_name)), '[^a-z0-9]+', '-', 'g'));
  _base_slug := trim(both '-' from _base_slug);
  IF _base_slug = '' THEN
    _base_slug := 'company';
  END IF;
  _final_slug := _base_slug;

  WHILE EXISTS (SELECT 1 FROM public.companies WHERE slug = _final_slug) LOOP
    _suffix := _suffix + 1;
    _final_slug := _base_slug || '-' || _suffix::text;
  END LOOP;

  LOOP
    _code := upper(substr(md5(random()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.companies WHERE invite_code = _code);
  END LOOP;

  INSERT INTO public.companies (name, slug, invite_code)
  VALUES (trim(_name), _final_slug, _code)
  RETURNING id INTO _company_id;

  UPDATE public.profiles
  SET company_id = _company_id, status = 'active', updated_at = now()
  WHERE id = _user_id;

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_company_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  PERFORM public.ensure_user_profile('');

  IF get_user_company_id(_user_id) IS NOT NULL THEN
    RAISE EXCEPTION 'User already belongs to a company';
  END IF;

  SELECT id INTO _company_id
  FROM public.companies
  WHERE invite_code = upper(trim(_code));

  IF _company_id IS NULL THEN RAISE EXCEPTION 'Código inválido'; END IF;

  UPDATE public.profiles
  SET company_id = _company_id, status = 'pending', updated_at = now()
  WHERE id = _user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'collaborator')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = CASE
      WHEN public.profiles.full_name = '' AND EXCLUDED.full_name <> '' THEN EXCLUDED.full_name
      ELSE public.profiles.full_name
    END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'collaborator')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
