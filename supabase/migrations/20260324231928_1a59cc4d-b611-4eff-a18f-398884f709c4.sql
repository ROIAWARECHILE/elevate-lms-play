
-- Function to atomically create company + assign admin role
CREATE OR REPLACE FUNCTION public.create_company_for_user(
  _name text, _slug text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _company_id uuid; _user_id uuid;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
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

-- Drop old restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view own company" ON public.companies;

-- Allow any authenticated user to view companies (needed for join flow)
CREATE POLICY "Anyone can view companies"
  ON public.companies FOR SELECT TO authenticated
  USING (true);
