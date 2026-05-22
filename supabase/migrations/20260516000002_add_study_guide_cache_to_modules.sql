-- Cache de guías de repaso generadas por IA por módulo.
-- JSONB nullable: null = no generada aún, objeto = guía cacheada.
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS study_guide_cache JSONB DEFAULT NULL;
