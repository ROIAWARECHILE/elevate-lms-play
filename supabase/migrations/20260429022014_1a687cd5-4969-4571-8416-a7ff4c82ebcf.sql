-- =====================================================================
-- publish_course_if_valid: audita y publica un curso sólo si tiene
-- contenido renderizable mínimo. Devuelve un reporte JSON con el estado.
-- =====================================================================
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
        FROM public.lessons WHERE module_id = _module.id
    LOOP
      _lessons_total := _lessons_total + 1;
      -- Conteo "permisivo": cualquier bloque con campo `type` no vacío.
      -- La validación estricta vive en las edge functions; aquí sólo
      -- bloqueamos cursos manifiestamente vacíos.
      SELECT COUNT(*)::int INTO _block_count
        FROM jsonb_array_elements(COALESCE(_lesson.content->'blocks', '[]'::jsonb)) b
       WHERE jsonb_typeof(b) = 'object'
         AND COALESCE(NULLIF(trim(b->>'type'), ''), '') <> '';
      IF _block_count >= 1 THEN
        _lessons_valid := _lessons_valid + 1;
        _module_valid := true;
      ELSE
        _issues := _issues || jsonb_build_object(
          'module', _module.title,
          'lesson', _lesson.title,
          'reason', 'sin bloques renderizables'
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