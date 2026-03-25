-- Add invite_code to companies
ALTER TABLE companies ADD COLUMN invite_code text UNIQUE;

-- Generate codes for existing companies
UPDATE companies SET invite_code = upper(substr(md5(random()::text), 1, 6))
WHERE invite_code IS NULL;

-- Make invite_code NOT NULL after populating
ALTER TABLE companies ALTER COLUMN invite_code SET NOT NULL;
ALTER TABLE companies ALTER COLUMN invite_code SET DEFAULT upper(substr(md5(random()::text), 1, 6));

-- Add status to profiles
ALTER TABLE profiles ADD COLUMN status text NOT NULL DEFAULT 'active';

-- Update create_company_for_user to generate invite_code
CREATE OR REPLACE FUNCTION public.create_company_for_user(_name text, _slug text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _company_id uuid; _user_id uuid; _code text;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF get_user_company_id(_user_id) IS NOT NULL THEN
    RAISE EXCEPTION 'User already belongs to a company';
  END IF;
  LOOP
    _code := upper(substr(md5(random()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM companies WHERE invite_code = _code);
  END LOOP;
  INSERT INTO companies (name, slug, invite_code) VALUES (_name, _slug, _code)
    RETURNING id INTO _company_id;
  UPDATE profiles SET company_id = _company_id, status = 'active' WHERE id = _user_id;
  DELETE FROM user_roles WHERE user_id = _user_id;
  INSERT INTO user_roles (user_id, role) VALUES (_user_id, 'admin');
  RETURN _company_id;
END; $$;

-- Join by code (pending approval)
CREATE OR REPLACE FUNCTION public.join_company_by_code(_code text)
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
  SELECT id INTO _company_id FROM companies WHERE invite_code = upper(_code);
  IF _company_id IS NULL THEN RAISE EXCEPTION 'Código inválido'; END IF;
  UPDATE profiles SET company_id = _company_id, status = 'pending' WHERE id = _user_id;
  INSERT INTO user_roles (user_id, role) VALUES (_user_id, 'collaborator')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN _company_id;
END; $$;

-- Approve user (admin only, same company)
CREATE OR REPLACE FUNCTION public.approve_user(_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not admin'; END IF;
  UPDATE profiles SET status = 'active'
  WHERE id = _target_user_id
    AND company_id = get_user_company_id(auth.uid());
END; $$;

-- Reject user (admin only, same company)
CREATE OR REPLACE FUNCTION public.reject_user(_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not admin'; END IF;
  DELETE FROM user_roles WHERE user_id = _target_user_id;
  UPDATE profiles SET company_id = NULL, status = 'active'
  WHERE id = _target_user_id
    AND company_id = get_user_company_id(auth.uid());
END; $$;