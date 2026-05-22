-- Historial de reportes de calidad por curso
-- Permite ver evolución de calidad a lo largo del tiempo y hace A/B testing de prompts

CREATE TABLE IF NOT EXISTS public.course_quality_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status text CHECK (status IN ('valid', 'needs_review', 'failed')),
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_quality_reports ENABLE ROW LEVEL SECURITY;

-- Admins de la empresa del curso pueden leer reportes
CREATE POLICY "Admins can read quality reports"
  ON public.course_quality_reports
  FOR SELECT
  USING (
    course_id IN (
      SELECT c.id FROM public.courses c
      INNER JOIN public.profiles p ON p.company_id = c.company_id
      INNER JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Solo edge functions (service role) pueden insertar reportes
CREATE POLICY "Service role can insert quality reports"
  ON public.course_quality_reports
  FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_quality_reports_course_id
  ON public.course_quality_reports (course_id, generated_at DESC);
