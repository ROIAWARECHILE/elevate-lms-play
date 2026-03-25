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
  INSERT INTO user_roles (user_id, role)
  VALUES (_user_id, 'collaborator')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN _company_id;
END; $$;