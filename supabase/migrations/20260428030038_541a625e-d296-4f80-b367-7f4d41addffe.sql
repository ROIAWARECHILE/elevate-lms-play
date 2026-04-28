DO $$
DECLARE _uid uuid := '0f6bb114-dd29-4653-b8f7-78cf5a831555';
BEGIN
  DELETE FROM public.user_xp_log WHERE user_id = _uid;
  DELETE FROM public.user_progress WHERE user_id = _uid;
  DELETE FROM public.user_mistakes WHERE user_id = _uid;
  DELETE FROM public.user_achievements WHERE user_id = _uid;
  DELETE FROM public.daily_quests WHERE user_id = _uid;
  DELETE FROM public.srs_items WHERE user_id = _uid;
  DELETE FROM public.user_skill_profile WHERE user_id = _uid;
  DELETE FROM public.user_roles WHERE user_id = _uid;
  DELETE FROM public.profiles WHERE id = _uid;
  DELETE FROM auth.users WHERE id = _uid;
END $$;