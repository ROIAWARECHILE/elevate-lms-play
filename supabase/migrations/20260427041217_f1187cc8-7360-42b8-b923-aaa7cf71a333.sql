-- =====================================================================
-- PR3: Adaptive Learning — perfil de habilidad por usuario+curso
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_skill_profile (
  user_id uuid NOT NULL,
  course_id uuid NOT NULL,
  company_id uuid NOT NULL,
  mastery real NOT NULL DEFAULT 0,           -- 0..1 promedio strength
  difficulty_preference text NOT NULL DEFAULT 'beginner', -- beginner|intermediate|advanced
  avg_response_ms integer,
  total_items integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);

ALTER TABLE public.user_skill_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own skill profile"
  ON public.user_skill_profile FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admins read team skill profile"
  ON public.user_skill_profile FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid())
         AND public.has_role(auth.uid(), 'admin'));

-- Recalcula mastery de un curso a partir de srs_items
CREATE OR REPLACE FUNCTION public.recalc_skill_profile(_user_id uuid, _course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _mastery real;
  _count integer;
  _pref text;
BEGIN
  _company_id := public.get_user_company_id(_user_id);
  IF _company_id IS NULL OR _course_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(AVG(strength), 0)::real, COUNT(*)::int
    INTO _mastery, _count
  FROM public.srs_items
  WHERE user_id = _user_id AND course_id = _course_id;

  -- Inferir preferencia de dificultad por mastery + nº items
  _pref := CASE
    WHEN _count < 5 THEN 'beginner'
    WHEN _mastery >= 0.75 THEN 'advanced'
    WHEN _mastery >= 0.45 THEN 'intermediate'
    ELSE 'beginner'
  END;

  INSERT INTO public.user_skill_profile (user_id, course_id, company_id, mastery, difficulty_preference, total_items, updated_at)
  VALUES (_user_id, _course_id, _company_id, _mastery, _pref, _count, now())
  ON CONFLICT (user_id, course_id) DO UPDATE
    SET mastery = EXCLUDED.mastery,
        difficulty_preference = EXCLUDED.difficulty_preference,
        total_items = EXCLUDED.total_items,
        company_id = EXCLUDED.company_id,
        updated_at = now();
END;
$$;

-- Reescribimos srs_review para que tras actualizar la tarjeta recalcule el perfil
CREATE OR REPLACE FUNCTION public.srs_review(_item_id uuid, _quality integer)
RETURNS public.srs_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _row public.srs_items;
  _new_ef real;
  _new_interval int;
  _new_reps int;
  _new_strength real;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _quality < 0 OR _quality > 5 THEN RAISE EXCEPTION 'quality must be 0..5'; END IF;

  SELECT * INTO _row FROM public.srs_items
   WHERE id = _item_id AND user_id = _user_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;

  _new_ef := greatest(1.3,
    _row.ease_factor + (0.1 - (5 - _quality) * (0.08 + (5 - _quality) * 0.02))
  );

  IF _quality < 3 THEN
    _new_reps := 0;
    _new_interval := 1;
    _new_strength := greatest(0.1, _row.strength * 0.5);
  ELSE
    _new_reps := _row.repetitions + 1;
    IF _new_reps = 1 THEN
      _new_interval := 1;
    ELSIF _new_reps = 2 THEN
      _new_interval := 6;
    ELSE
      _new_interval := greatest(1, round(_row.interval_days * _new_ef)::int);
    END IF;
    _new_strength := least(1.0, _row.strength + (0.15 + (_quality - 3) * 0.07));
  END IF;

  UPDATE public.srs_items
     SET ease_factor = _new_ef,
         interval_days = _new_interval,
         repetitions = _new_reps,
         strength = _new_strength,
         last_reviewed_at = now(),
         next_review_at = now() + (_new_interval || ' days')::interval,
         total_reviews = _row.total_reviews + 1,
         total_correct = _row.total_correct + CASE WHEN _quality >= 3 THEN 1 ELSE 0 END
   WHERE id = _item_id
   RETURNING * INTO _row;

  -- Recalcular perfil del curso (si la tarjeta está asociada a uno)
  IF _row.course_id IS NOT NULL THEN
    PERFORM public.recalc_skill_profile(_user_id, _row.course_id);
  END IF;

  RETURN _row;
END;
$$;