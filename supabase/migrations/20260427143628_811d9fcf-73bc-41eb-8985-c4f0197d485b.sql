-- 1) Extend companies with richer profile fields
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS industry text DEFAULT '',
  ADD COLUMN IF NOT EXISTS size text DEFAULT '',
  ADD COLUMN IF NOT EXISTS website text DEFAULT '',
  ADD COLUMN IF NOT EXISTS country text DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_email text DEFAULT '';

-- 2) Storage bucket for company logos (public for easy display)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- 3) Storage policies: public read, admin write to their company folder
DROP POLICY IF EXISTS "Public can view company logos" ON storage.objects;
CREATE POLICY "Public can view company logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "Admins can upload company logo" ON storage.objects;
CREATE POLICY "Admins can upload company logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
  AND public.has_role(auth.uid(), 'admin')
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);

DROP POLICY IF EXISTS "Admins can update company logo" ON storage.objects;
CREATE POLICY "Admins can update company logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND public.has_role(auth.uid(), 'admin')
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);

DROP POLICY IF EXISTS "Admins can delete company logo" ON storage.objects;
CREATE POLICY "Admins can delete company logo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND public.has_role(auth.uid(), 'admin')
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);

-- 4) Extended create_company_for_user RPC (accepts optional metadata)
CREATE OR REPLACE FUNCTION public.create_company_for_user(
  _name text,
  _slug text,
  _description text DEFAULT '',
  _industry text DEFAULT '',
  _size text DEFAULT '',
  _website text DEFAULT '',
  _country text DEFAULT '',
  _contact_email text DEFAULT '',
  _primary_color text DEFAULT '#7c3aed',
  _logo_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF trim(coalesce(_name, '')) = '' THEN
    RAISE EXCEPTION 'Company name is required';
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

  INSERT INTO public.companies (
    name, slug, invite_code, description, industry, size, website, country, contact_email, primary_color, logo_url
  )
  VALUES (
    trim(_name), _final_slug, _code,
    coalesce(_description, ''), coalesce(_industry, ''), coalesce(_size, ''),
    coalesce(_website, ''), coalesce(_country, ''), coalesce(_contact_email, ''),
    coalesce(nullif(_primary_color, ''), '#7c3aed'), _logo_url
  )
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
$function$;