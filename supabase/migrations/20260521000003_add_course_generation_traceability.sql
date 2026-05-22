-- Trazabilidad de generación en courses
-- source_library_id: qué fuente se usó para generar el curso
-- blueprint_id: qué blueprint se usó
-- generation_metadata: metadatos de la generación (modelo, tokens, tiempo, calidad)
-- Nota: se usa source_library_id (no source_id) para no colisionar con course_sources existente

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS source_library_id uuid REFERENCES public.source_library(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blueprint_id uuid REFERENCES public.course_blueprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generation_metadata jsonb;
