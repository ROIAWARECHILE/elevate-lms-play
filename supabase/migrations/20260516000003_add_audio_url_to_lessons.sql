-- URL del audio explicativo generado por ElevenLabs para cada lección.
-- Null = no generado aún. Se genera on-demand al primer play y se cachea.
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS audio_url TEXT DEFAULT NULL;
