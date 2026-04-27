-- Reemplaza la misión 'quiz' por 'srs' en el seeding diario
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

  INSERT INTO public.daily_quests (user_id, company_id, quest_date, quest_type, target_value, xp_reward)
  VALUES
    (_user_id, _company_id, _today, 'lessons', 2, 20),
    (_user_id, _company_id, _today, 'xp', 30, 25),
    (_user_id, _company_id, _today, 'srs', 10, 35)
  ON CONFLICT (user_id, quest_date, quest_type) DO NOTHING;

  RETURN QUERY
    SELECT * FROM public.daily_quests
    WHERE user_id = _user_id AND quest_date = _today
    ORDER BY quest_type;
END;
$$;

-- Logros pedagógicos nuevos (idempotente)
INSERT INTO public.achievements (id, name, description, icon, category, requirement_type, requirement_value, xp_reward, sort_order)
VALUES
  ('elephant_memory', 'Memoria de elefante', 'Domina 50 tarjetas con alta retención', 'brain', 'srs', 'srs_strong', 50, 200, 50),
  ('iron_streak', 'Racha de hierro', 'Mantén una racha de 14 días seguidos', 'flame', 'streak', 'streak_days', 14, 250, 51),
  ('flawless', 'Sin errores', '20 ejercicios correctos seguidos', 'target', 'quiz', 'correct_streak', 20, 150, 52),
  ('reviewer', 'Repasador', 'Revisa 100 tarjetas en práctica diaria', 'repeat', 'srs', 'srs_reviews', 100, 200, 53)
ON CONFLICT (id) DO NOTHING;