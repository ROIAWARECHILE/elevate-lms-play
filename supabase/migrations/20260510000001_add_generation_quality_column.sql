-- Adds a dedicated column for course quality audit data.
-- Previously this was embedded inside source_brief JSONB to avoid a migration.
-- Now generation_quality is a proper column enabling efficient SQL queries.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS generation_quality JSONB;
