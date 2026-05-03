
-- 1) Companies: tighten SELECT
DROP POLICY IF EXISTS "Anon can view companies" ON public.companies;
DROP POLICY IF EXISTS "Anyone can view companies" ON public.companies;

CREATE POLICY "Members can view their company"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (id = public.get_user_company_id(auth.uid()));

-- 2) Storage: remove broad listing on company-logos bucket
DROP POLICY IF EXISTS "Public can view company logos" ON storage.objects;

-- 3) Hardening set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- 4) Server-side XP / progress functions
CREATE OR REPLACE FUNCTION public.record_lesson_completion(_lesson_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _company_id uuid;
  _module_id uuid;
  _course_id uuid;
  _xp_reward int;
  _lesson_type text;
  _final_xp int;
  _existing uuid;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _company_id := public.get_user_company_id(_user_id);
  IF _company_id IS NULL THEN RAISE EXCEPTION 'No company'; END IF;

  SELECT l.module_id, m.course_id, l.xp_reward, l.lesson_type
    INTO _module_id, _course_id, _xp_reward, _lesson_type
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  JOIN public.courses c ON c.id = m.course_id
  WHERE l.id = _lesson_id AND c.company_id = _company_id;

  IF _module_id IS NULL THEN RAISE EXCEPTION 'Lesson not accessible'; END IF;

  SELECT id INTO _existing FROM public.user_progress
   WHERE user_id = _user_id AND lesson_id = _lesson_id AND completed = true LIMIT 1;
  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('duplicate', true, 'xp_earned', 0);
  END IF;

  _final_xp := COALESCE(_xp_reward, 10);
  IF _lesson_type = 'interactive_quiz' THEN
    _final_xp := round(_final_xp * 1.5);
  END IF;

  INSERT INTO public.user_progress (user_id, company_id, course_id, module_id, lesson_id, completed, xp_earned, completed_at)
  VALUES (_user_id, _company_id, _course_id, _module_id, _lesson_id, true, _final_xp, now());

  INSERT INTO public.user_xp_log (user_id, company_id, xp_amount, source, source_id)
  VALUES (_user_id, _company_id, _final_xp, 'lesson', _lesson_id);

  RETURN jsonb_build_object('duplicate', false, 'xp_earned', _final_xp);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_quiz_completion(_quiz_id uuid, _correct int, _total int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _company_id uuid;
  _module_id uuid;
  _course_id uuid;
  _xp_reward int;
  _passing int;
  _score int;
  _passed boolean;
  _xp_earned int := 0;
  _existing uuid;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _total IS NULL OR _total <= 0 THEN RAISE EXCEPTION 'Invalid total'; END IF;
  IF _correct < 0 OR _correct > _total THEN RAISE EXCEPTION 'Invalid correct count'; END IF;

  _company_id := public.get_user_company_id(_user_id);
  IF _company_id IS NULL THEN RAISE EXCEPTION 'No company'; END IF;

  SELECT q.module_id, m.course_id, q.xp_reward, q.passing_score
    INTO _module_id, _course_id, _xp_reward, _passing
  FROM public.quizzes q
  JOIN public.modules m ON m.id = q.module_id
  JOIN public.courses c ON c.id = m.course_id
  WHERE q.id = _quiz_id AND c.company_id = _company_id;

  IF _module_id IS NULL THEN RAISE EXCEPTION 'Quiz not accessible'; END IF;

  SELECT id INTO _existing FROM public.user_progress
   WHERE user_id = _user_id AND quiz_id = _quiz_id AND completed = true LIMIT 1;
  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('duplicate', true, 'xp_earned', 0, 'passed', false, 'score', 0);
  END IF;

  _score := round((_correct::numeric / _total) * 100);
  _passed := _score >= COALESCE(_passing, 70);
  IF _passed THEN _xp_earned := COALESCE(_xp_reward, 25); END IF;

  INSERT INTO public.user_progress (user_id, company_id, course_id, module_id, quiz_id, completed, score, xp_earned, completed_at)
  VALUES (_user_id, _company_id, _course_id, _module_id, _quiz_id, true, _score, _xp_earned, now());

  IF _passed THEN
    INSERT INTO public.user_xp_log (user_id, company_id, xp_amount, source, source_id)
    VALUES (_user_id, _company_id, _xp_earned, 'quiz', _quiz_id);
  END IF;

  RETURN jsonb_build_object('duplicate', false, 'xp_earned', _xp_earned, 'passed', _passed, 'score', _score);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_practice_xp(_xp int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _company_id uuid;
  _capped int;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _company_id := public.get_user_company_id(_user_id);
  IF _company_id IS NULL THEN RAISE EXCEPTION 'No company'; END IF;
  IF _xp IS NULL OR _xp <= 0 THEN RETURN jsonb_build_object('xp_earned', 0); END IF;
  -- Cap to mitigate abuse
  _capped := LEAST(_xp, 200);

  INSERT INTO public.user_xp_log (user_id, company_id, xp_amount, source)
  VALUES (_user_id, _company_id, _capped, 'practice');

  RETURN jsonb_build_object('xp_earned', _capped);
END;
$$;

-- 5) Remove user-facing INSERT policies that allowed XP / progress manipulation
DROP POLICY IF EXISTS "Users can insert own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can insert own xp" ON public.user_xp_log;

-- 6) Revoke EXECUTE on privileged functions from anon (keep authenticated)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
      AND p.proname NOT IN ('handle_new_user','set_updated_at','update_updated_at_column')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, public', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', r.proname, r.args);
  END LOOP;
END $$;
