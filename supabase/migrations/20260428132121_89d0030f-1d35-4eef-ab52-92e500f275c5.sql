CREATE OR REPLACE FUNCTION public.delete_draft_course(_course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin_company_id uuid;
  _course_company_id uuid;
  _course_status course_status;
  _course_creator uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not admin';
  END IF;

  _admin_company_id := get_user_company_id(auth.uid());

  SELECT company_id, status, created_by
    INTO _course_company_id, _course_status, _course_creator
  FROM public.courses
  WHERE id = _course_id;

  IF _course_company_id IS NULL THEN
    RAISE EXCEPTION 'Course not found';
  END IF;

  IF _course_company_id <> _admin_company_id THEN
    RAISE EXCEPTION 'Course belongs to another company';
  END IF;

  IF _course_status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft courses can be deleted with this function';
  END IF;

  -- Cascade delete: questions -> quizzes -> lessons -> modules -> sources -> course
  DELETE FROM public.questions
   WHERE quiz_id IN (
     SELECT q.id FROM public.quizzes q
     JOIN public.modules m ON m.id = q.module_id
     WHERE m.course_id = _course_id
   );

  DELETE FROM public.quizzes
   WHERE module_id IN (SELECT id FROM public.modules WHERE course_id = _course_id);

  DELETE FROM public.lessons
   WHERE module_id IN (SELECT id FROM public.modules WHERE course_id = _course_id);

  DELETE FROM public.modules WHERE course_id = _course_id;
  DELETE FROM public.course_sources WHERE course_id = _course_id;
  DELETE FROM public.course_dictionary WHERE course_id = _course_id;
  DELETE FROM public.user_progress WHERE course_id = _course_id;
  DELETE FROM public.srs_items WHERE course_id = _course_id;
  DELETE FROM public.user_skill_profile WHERE course_id = _course_id;

  DELETE FROM public.courses WHERE id = _course_id;
END;
$$;