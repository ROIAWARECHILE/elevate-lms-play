-- =====================================================================
-- Sistema de repaso de errores y diccionario del alumno
-- =====================================================================

-- Tabla de errores marcados manualmente por el alumno para repasar
CREATE TABLE public.user_mistakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  lesson_id uuid,
  course_id uuid,
  block_type text NOT NULL,        -- mc | true_false | fill_blank | match_pairs | order_steps | etc.
  question text NOT NULL,           -- enunciado / contexto
  user_answer text,                 -- lo que respondió el alumno (si aplica)
  correct_answer text NOT NULL,     -- respuesta correcta
  explanation text,                 -- explicación opcional
  times_failed integer NOT NULL DEFAULT 1,
  times_reviewed integer NOT NULL DEFAULT 0,
  mastered boolean NOT NULL DEFAULT false,
  last_failed_at timestamptz NOT NULL DEFAULT now(),
  last_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_mistakes_user ON public.user_mistakes(user_id, mastered, last_failed_at DESC);
CREATE INDEX idx_user_mistakes_company ON public.user_mistakes(company_id);

ALTER TABLE public.user_mistakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mistakes"
ON public.user_mistakes FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own mistakes"
ON public.user_mistakes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update own mistakes"
ON public.user_mistakes FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own mistakes"
ON public.user_mistakes FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Diccionario de conceptos: índice automático desde lecciones tipo "concept"
-- Visible para todos los miembros de la compañía del curso al que pertenece la lección.
CREATE TABLE public.course_dictionary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  course_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  term text NOT NULL,
  definition text NOT NULL,
  example text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, term)
);

CREATE INDEX idx_course_dictionary_company ON public.course_dictionary(company_id);
CREATE INDEX idx_course_dictionary_course ON public.course_dictionary(course_id);
CREATE INDEX idx_course_dictionary_term_lower ON public.course_dictionary(company_id, lower(term));

ALTER TABLE public.course_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view company dictionary"
ON public.course_dictionary FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can manage dictionary"
ON public.course_dictionary FOR ALL TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- Permitir también que el alumno upserte entradas que vienen de lecciones del curso al que tiene acceso.
-- Esto habilita el indexado automático cuando un alumno abre una lección "concept".
CREATE POLICY "Users can insert dictionary from accessible lessons"
ON public.course_dictionary FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE l.id = course_dictionary.lesson_id
      AND c.company_id = public.get_user_company_id(auth.uid())
  )
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_course_dictionary_updated
BEFORE UPDATE ON public.course_dictionary
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();