-- Source Library: fuentes reutilizables de conocimiento por empresa
-- Independiente de cualquier curso específico (a diferencia de course_sources que requiere course_id)

CREATE TABLE IF NOT EXISTS public.source_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  source_type text CHECK (source_type IN ('pdf','url','markdown','docx','text')),
  raw_url text,
  content_md text NOT NULL DEFAULT '',
  content_checksum text,
  word_count int,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.source_library ENABLE ROW LEVEL SECURITY;

-- Admins de la misma empresa pueden gestionar fuentes
CREATE POLICY "Admins can manage source_library"
  ON public.source_library
  FOR ALL
  USING (
    company_id IN (
      SELECT p.company_id FROM public.profiles p
      INNER JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Todos los usuarios autenticados de la misma empresa pueden leer
CREATE POLICY "Users can read own company source_library"
  ON public.source_library
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );
