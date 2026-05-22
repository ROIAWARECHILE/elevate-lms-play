-- Stores previous versions of lesson content before each regeneration.
-- Allows admins to view and restore prior content if regeneration degrades quality.
CREATE TABLE IF NOT EXISTS lesson_content_history (
  id          UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id   UUID         NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  content     JSONB        NOT NULL,
  replaced_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  replaced_by UUID         REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS lesson_content_history_lesson_id_idx
  ON lesson_content_history(lesson_id, replaced_at DESC);

ALTER TABLE lesson_content_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read lesson_content_history"
  ON lesson_content_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "Service role can insert lesson_content_history"
  ON lesson_content_history FOR INSERT
  WITH CHECK (true);
