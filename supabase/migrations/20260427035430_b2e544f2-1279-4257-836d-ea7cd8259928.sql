-- RPC: Remove a user from the company (admin only)
CREATE OR REPLACE FUNCTION public.remove_user_from_company(_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin_company_id uuid;
  _target_company_id uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not admin';
  END IF;

  IF _target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot remove yourself';
  END IF;

  _admin_company_id := get_user_company_id(auth.uid());
  SELECT company_id INTO _target_company_id FROM profiles WHERE id = _target_user_id;

  IF _target_company_id IS NULL OR _target_company_id <> _admin_company_id THEN
    RAISE EXCEPTION 'User not in your company';
  END IF;

  -- Wipe user data scoped to this company
  DELETE FROM public.user_xp_log WHERE user_id = _target_user_id AND company_id = _admin_company_id;
  DELETE FROM public.user_progress WHERE user_id = _target_user_id AND company_id = _admin_company_id;
  DELETE FROM public.user_mistakes WHERE user_id = _target_user_id AND company_id = _admin_company_id;
  DELETE FROM public.user_achievements WHERE user_id = _target_user_id AND company_id = _admin_company_id;
  DELETE FROM public.daily_quests WHERE user_id = _target_user_id AND company_id = _admin_company_id;
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;

  UPDATE public.profiles
  SET company_id = NULL,
      status = 'active',
      xp_total = 0,
      level = 1,
      current_streak = 0,
      longest_streak = 0,
      last_activity_date = NULL,
      updated_at = now()
  WHERE id = _target_user_id;
END;
$$;

-- RPC: Reset progress for a user (admin only) - keeps them in company
CREATE OR REPLACE FUNCTION public.reset_user_progress(_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin_company_id uuid;
  _target_company_id uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not admin';
  END IF;

  _admin_company_id := get_user_company_id(auth.uid());
  SELECT company_id INTO _target_company_id FROM profiles WHERE id = _target_user_id;

  IF _target_company_id IS NULL OR _target_company_id <> _admin_company_id THEN
    RAISE EXCEPTION 'User not in your company';
  END IF;

  DELETE FROM public.user_xp_log WHERE user_id = _target_user_id AND company_id = _admin_company_id;
  DELETE FROM public.user_progress WHERE user_id = _target_user_id AND company_id = _admin_company_id;
  DELETE FROM public.user_mistakes WHERE user_id = _target_user_id AND company_id = _admin_company_id;
  DELETE FROM public.user_achievements WHERE user_id = _target_user_id AND company_id = _admin_company_id;
  DELETE FROM public.daily_quests WHERE user_id = _target_user_id AND company_id = _admin_company_id;

  UPDATE public.profiles
  SET xp_total = 0,
      level = 1,
      current_streak = 0,
      longest_streak = 0,
      last_activity_date = NULL,
      updated_at = now()
  WHERE id = _target_user_id;
END;
$$;