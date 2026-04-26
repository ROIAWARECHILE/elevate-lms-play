
-- =====================================================
-- ACHIEVEMENTS / BADGES SYSTEM
-- =====================================================
CREATE TABLE IF NOT EXISTS public.achievements (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'trophy',
  category text NOT NULL DEFAULT 'general',
  xp_reward integer NOT NULL DEFAULT 50,
  requirement_type text NOT NULL,
  requirement_value integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view achievements"
  ON public.achievements FOR SELECT
  TO authenticated
  USING (true);

-- Seed achievements catalog
INSERT INTO public.achievements (id, name, description, icon, category, xp_reward, requirement_type, requirement_value, sort_order) VALUES
  ('first_lesson', 'Primer paso', 'Completa tu primera lección', 'sparkles', 'progress', 25, 'lessons_completed', 1, 1),
  ('lessons_10', 'Aprendiz constante', 'Completa 10 lecciones', 'book-open', 'progress', 50, 'lessons_completed', 10, 2),
  ('lessons_50', 'Estudiante dedicado', 'Completa 50 lecciones', 'graduation-cap', 'progress', 150, 'lessons_completed', 50, 3),
  ('first_quiz', 'Quiz maestro', 'Aprueba tu primer quiz', 'check-circle', 'quiz', 25, 'quizzes_passed', 1, 4),
  ('perfect_quiz', 'Perfeccionista', 'Obtén 100% en un quiz', 'star', 'quiz', 75, 'perfect_quizzes', 1, 5),
  ('streak_3', 'Constancia inicial', 'Mantén una racha de 3 días', 'flame', 'streak', 30, 'streak_days', 3, 6),
  ('streak_7', 'Una semana imparable', 'Mantén una racha de 7 días', 'flame', 'streak', 75, 'streak_days', 7, 7),
  ('streak_30', 'Mes de fuego', 'Mantén una racha de 30 días', 'flame', 'streak', 250, 'streak_days', 30, 8),
  ('xp_100', 'Centena de XP', 'Acumula 100 XP', 'zap', 'xp', 25, 'xp_total', 100, 9),
  ('xp_500', 'Quinientos XP', 'Acumula 500 XP', 'zap', 'xp', 75, 'xp_total', 500, 10),
  ('xp_1000', 'Mil XP', 'Acumula 1000 XP', 'zap', 'xp', 150, 'xp_total', 1000, 11),
  ('first_course', 'Curso completado', 'Completa tu primer curso', 'award', 'courses', 100, 'courses_completed', 1, 12),
  ('level_5', 'Nivel 5', 'Alcanza el nivel 5', 'trophy', 'level', 50, 'level', 5, 13),
  ('level_10', 'Nivel 10', 'Alcanza el nivel 10', 'trophy', 'level', 100, 'level', 10, 14)
ON CONFLICT (id) DO NOTHING;

-- User achievements (unlocked)
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  achievement_id text NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_company ON public.user_achievements(company_id);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements"
  ON public.user_achievements FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert own achievements"
  ON public.user_achievements FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- DAILY QUESTS SYSTEM
-- =====================================================
CREATE TABLE IF NOT EXISTS public.daily_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  quest_date date NOT NULL DEFAULT CURRENT_DATE,
  quest_type text NOT NULL,
  target_value integer NOT NULL,
  current_value integer NOT NULL DEFAULT 0,
  xp_reward integer NOT NULL DEFAULT 20,
  claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, quest_date, quest_type)
);

CREATE INDEX IF NOT EXISTS idx_daily_quests_user_date ON public.daily_quests(user_id, quest_date);

ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quests"
  ON public.daily_quests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own quests"
  ON public.daily_quests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own quests"
  ON public.daily_quests FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- RPC: ensure today's quests exist for the calling user
CREATE OR REPLACE FUNCTION public.ensure_daily_quests()
RETURNS SETOF public.daily_quests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _company_id uuid;
  _today date := CURRENT_DATE;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _company_id := public.get_user_company_id(_user_id);
  IF _company_id IS NULL THEN RAISE EXCEPTION 'No company'; END IF;

  -- Insert default 3 quests for today if missing
  INSERT INTO public.daily_quests (user_id, company_id, quest_date, quest_type, target_value, xp_reward)
  VALUES
    (_user_id, _company_id, _today, 'lessons', 2, 20),
    (_user_id, _company_id, _today, 'xp', 30, 25),
    (_user_id, _company_id, _today, 'quiz', 1, 30)
  ON CONFLICT (user_id, quest_date, quest_type) DO NOTHING;

  RETURN QUERY
    SELECT * FROM public.daily_quests
    WHERE user_id = _user_id AND quest_date = _today
    ORDER BY quest_type;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_daily_quests() TO authenticated;

-- RPC: increment quest progress (called from app after lesson/quiz/xp earned)
CREATE OR REPLACE FUNCTION public.increment_quest_progress(_quest_type text, _amount integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RETURN; END IF;

  UPDATE public.daily_quests
  SET current_value = LEAST(current_value + _amount, target_value)
  WHERE user_id = _user_id
    AND quest_date = CURRENT_DATE
    AND quest_type = _quest_type;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_quest_progress(text, integer) TO authenticated;
