CREATE OR REPLACE FUNCTION public.safe_jsonb_array_length(_value jsonb)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE WHEN jsonb_typeof(_value) = 'array' THEN jsonb_array_length(_value) ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.lesson_valid_block_count(_lesson_type text, _content jsonb)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH blocks AS (
    SELECT b
    FROM jsonb_array_elements(COALESCE(_content->'blocks', '[]'::jsonb)) AS b
    WHERE jsonb_typeof(b) = 'object'
  )
  SELECT COUNT(*)::integer
  FROM blocks
  WHERE CASE COALESCE(NULLIF(_lesson_type, ''), 'reading')
    WHEN 'reading' THEN (
      (b->>'type' IN ('heading', 'paragraph', 'callout', 'quote') AND trim(COALESCE(b->>'text', '')) <> '') OR
      (b->>'type' = 'code' AND trim(COALESCE(b->>'code', '')) <> '') OR
      (b->>'type' = 'image' AND trim(COALESCE(b->>'url', '')) <> '') OR
      (b->>'type' = 'divider')
    )
    WHEN 'concept' THEN b->>'type' = 'term'
      AND trim(COALESCE(b->>'term', '')) <> ''
      AND trim(COALESCE(b->>'definition', '')) <> ''
    WHEN 'flashcards' THEN b->>'type' = 'flashcard'
      AND trim(COALESCE(b->>'front', '')) <> ''
      AND trim(COALESCE(b->>'back', '')) <> ''
    WHEN 'steps' THEN b->>'type' = 'step'
      AND trim(COALESCE(b->>'title', '')) <> ''
      AND trim(COALESCE(b->>'description', '')) <> ''
    WHEN 'comparison' THEN b->>'type' = 'comparison_table'
      AND public.safe_jsonb_array_length(b->'headers') >= 2
      AND public.safe_jsonb_array_length(b->'rows') >= 2
    WHEN 'case_study' THEN b->>'type' IN ('scenario', 'question', 'reflection')
      AND trim(COALESCE(b->>'text', '')) <> ''
    WHEN 'sop_walkthrough' THEN b->>'type' = 'sop_step'
      AND trim(COALESCE(b->>'title', '')) <> ''
      AND trim(COALESCE(b->>'description', '')) <> ''
    WHEN 'video_embed' THEN b->>'type' = 'video'
      AND trim(COALESCE(b->>'url', '')) <> ''
    WHEN 'interactive_quiz' THEN (
      (b->>'type' = 'mc'
        AND trim(COALESCE(b->>'question', '')) <> ''
        AND trim(COALESCE(b->>'correct', '')) <> ''
        AND public.safe_jsonb_array_length(b->'options') >= 3
        AND (b->'options') ? (b->>'correct')) OR
      (b->>'type' = 'true_false'
        AND trim(COALESCE(b->>'question', '')) <> ''
        AND jsonb_typeof(b->'correct') = 'boolean') OR
      (b->>'type' = 'fill_blank'
        AND position('___' in COALESCE(b->>'sentence', '')) > 0
        AND (trim(COALESCE(b->>'correct', '')) <> '' OR public.safe_jsonb_array_length(b->'correct') > 0)) OR
      (b->>'type' = 'match_pairs' AND public.safe_jsonb_array_length(b->'pairs') >= 3) OR
      (b->>'type' = 'order_steps' AND public.safe_jsonb_array_length(b->'steps') >= 3) OR
      (b->>'type' = 'sort_into_buckets'
        AND public.safe_jsonb_array_length(b->'buckets') >= 2
        AND public.safe_jsonb_array_length(b->'items') >= 3) OR
      (b->>'type' = 'highlight_terms'
        AND trim(COALESCE(b->>'sentence', '')) <> ''
        AND public.safe_jsonb_array_length(b->'terms') > 0) OR
      (b->>'type' = 'tap_to_complete'
        AND position('___' in COALESCE(b->>'sentence', '')) > 0
        AND public.safe_jsonb_array_length(b->'bank') >= 3
        AND public.safe_jsonb_array_length(b->'correct') > 0)
    )
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.safe_jsonb_array_length(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lesson_valid_block_count(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.safe_jsonb_array_length(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lesson_valid_block_count(text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_course_if_valid(_course_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin_company_id uuid;
  _course_company_id uuid;
  _modules_total int := 0;
  _modules_valid int := 0;
  _lessons_total int := 0;
  _lessons_valid int := 0;
  _issues jsonb := '[]'::jsonb;
  _module record;
  _lesson record;
  _block_count int;
  _required_count int;
  _module_valid boolean;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not admin';
  END IF;

  _admin_company_id := get_user_company_id(auth.uid());

  SELECT company_id INTO _course_company_id FROM public.courses WHERE id = _course_id;
  IF _course_company_id IS NULL THEN
    RAISE EXCEPTION 'Course not found';
  END IF;
  IF _course_company_id <> _admin_company_id THEN
    RAISE EXCEPTION 'Course belongs to another company';
  END IF;

  FOR _module IN
    SELECT id, title FROM public.modules WHERE course_id = _course_id ORDER BY sort_order
  LOOP
    _modules_total := _modules_total + 1;
    _module_valid := false;

    FOR _lesson IN
      SELECT id, title, lesson_type, content
      FROM public.lessons
      WHERE module_id = _module.id
      ORDER BY sort_order
    LOOP
      _lessons_total := _lessons_total + 1;
      _block_count := public.lesson_valid_block_count(_lesson.lesson_type, _lesson.content);
      _required_count := CASE COALESCE(NULLIF(_lesson.lesson_type, ''), 'reading')
        WHEN 'reading' THEN 2
        WHEN 'concept' THEN 2
        WHEN 'flashcards' THEN 3
        WHEN 'steps' THEN 3
        WHEN 'comparison' THEN 1
        WHEN 'case_study' THEN 2
        WHEN 'interactive_quiz' THEN 4
        WHEN 'sop_walkthrough' THEN 3
        WHEN 'video_embed' THEN 1
        ELSE 1
      END;

      IF _block_count >= _required_count THEN
        _lessons_valid := _lessons_valid + 1;
        _module_valid := true;
      ELSE
        _issues := _issues || jsonb_build_object(
          'module', _module.title,
          'lesson', _lesson.title,
          'reason', CASE
            WHEN _block_count = 0 THEN 'sin bloques renderizables'
            ELSE 'solo ' || _block_count::text || '/' || _required_count::text || ' bloques válidos'
          END
        );
      END IF;
    END LOOP;

    IF _module_valid THEN
      _modules_valid := _modules_valid + 1;
    ELSE
      _issues := _issues || jsonb_build_object(
        'module', _module.title,
        'reason', 'sin lecciones renderizables'
      );
    END IF;
  END LOOP;

  IF _modules_valid = 0 OR _modules_total = 0 THEN
    RETURN jsonb_build_object(
      'published', false,
      'status', 'failed',
      'modules_total', _modules_total,
      'modules_valid', _modules_valid,
      'lessons_total', _lessons_total,
      'lessons_valid', _lessons_valid,
      'issues', _issues
    );
  END IF;

  UPDATE public.courses SET status = 'published', updated_at = now() WHERE id = _course_id;

  RETURN jsonb_build_object(
    'published', true,
    'status', CASE WHEN jsonb_array_length(_issues) > 0 THEN 'needs_review' ELSE 'ready' END,
    'modules_total', _modules_total,
    'modules_valid', _modules_valid,
    'lessons_total', _lessons_total,
    'lessons_valid', _lessons_valid,
    'issues', _issues
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_course_if_valid(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_course_if_valid(uuid) TO authenticated;