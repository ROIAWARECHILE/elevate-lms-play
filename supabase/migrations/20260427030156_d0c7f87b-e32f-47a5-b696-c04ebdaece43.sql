-- 1. Add lesson_type to lessons (default 'reading' preserves backward compat)
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS lesson_type text NOT NULL DEFAULT 'reading';

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_lessons_lesson_type ON public.lessons(lesson_type);

-- 2. Add source_brief to courses (audit trail of what AI extracted)
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS source_brief jsonb;

-- 3. New table course_sources for traceability
CREATE TABLE IF NOT EXISTS public.course_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  kind text NOT NULL, -- 'pdf' | 'image' | 'text' | 'url' | 'excel' | 'search'
  name text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_sources_course_id ON public.course_sources(course_id);
CREATE INDEX IF NOT EXISTS idx_course_sources_company_id ON public.course_sources(company_id);

ALTER TABLE public.course_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage course sources"
  ON public.course_sources
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users can view course sources of their company"
  ON public.course_sources
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));