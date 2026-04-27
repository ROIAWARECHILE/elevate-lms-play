-- ============================================================
-- SRS items: tarjetas de memoria adaptativa
-- ============================================================
create table public.srs_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  company_id uuid not null,
  course_id uuid,
  lesson_id uuid,
  item_type text not null,            -- 'concept' | 'quiz_block' | 'term' | 'mistake'
  item_key text not null,             -- hash dedup
  payload jsonb not null,             -- {question, answer, explanation, hint?}
  -- SM-2
  ease_factor real not null default 2.5,
  interval_days int not null default 0,
  repetitions int not null default 0,
  -- Estado
  strength real not null default 0.3, -- 0..1
  last_reviewed_at timestamptz,
  next_review_at timestamptz not null default now(),
  total_reviews int not null default 0,
  total_correct int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, item_key)
);

create index idx_srs_due
  on public.srs_items (user_id, next_review_at);
create index idx_srs_user_course
  on public.srs_items (user_id, course_id);

alter table public.srs_items enable row level security;

create policy "Users read own srs"
  on public.srs_items for select to authenticated
  using (user_id = auth.uid());

create policy "Users insert own srs"
  on public.srs_items for insert to authenticated
  with check (user_id = auth.uid()
    and company_id = public.get_user_company_id(auth.uid()));

create policy "Users update own srs"
  on public.srs_items for update to authenticated
  using (user_id = auth.uid());

create policy "Users delete own srs"
  on public.srs_items for delete to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- RPC: encolar una tarjeta (idempotente por item_key)
-- ============================================================
create or replace function public.srs_enqueue(
  _item_type text,
  _item_key text,
  _payload jsonb,
  _course_id uuid default null,
  _lesson_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _company_id uuid;
  _id uuid;
begin
  if _user_id is null then
    raise exception 'Not authenticated';
  end if;
  _company_id := public.get_user_company_id(_user_id);
  if _company_id is null then
    raise exception 'No company';
  end if;

  insert into public.srs_items (
    user_id, company_id, course_id, lesson_id,
    item_type, item_key, payload, next_review_at
  )
  values (
    _user_id, _company_id, _course_id, _lesson_id,
    _item_type, _item_key, _payload, now()
  )
  on conflict (user_id, item_key) do update
    set payload = excluded.payload,
        course_id = coalesce(public.srs_items.course_id, excluded.course_id),
        lesson_id = coalesce(public.srs_items.lesson_id, excluded.lesson_id)
  returning id into _id;

  return _id;
end;
$$;

-- ============================================================
-- RPC: registrar review (calidad 0-5 estilo SM-2)
-- ============================================================
create or replace function public.srs_review(
  _item_id uuid,
  _quality int
) returns public.srs_items
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _row public.srs_items;
  _new_ef real;
  _new_interval int;
  _new_reps int;
  _new_strength real;
begin
  if _user_id is null then
    raise exception 'Not authenticated';
  end if;
  if _quality < 0 or _quality > 5 then
    raise exception 'quality must be 0..5';
  end if;

  select * into _row from public.srs_items
   where id = _item_id and user_id = _user_id
   for update;
  if not found then
    raise exception 'Item not found';
  end if;

  -- Update ease factor (SM-2)
  _new_ef := greatest(1.3,
    _row.ease_factor + (0.1 - (5 - _quality) * (0.08 + (5 - _quality) * 0.02))
  );

  if _quality < 3 then
    _new_reps := 0;
    _new_interval := 1;
    _new_strength := greatest(0.1, _row.strength * 0.5);
  else
    _new_reps := _row.repetitions + 1;
    if _new_reps = 1 then
      _new_interval := 1;
    elsif _new_reps = 2 then
      _new_interval := 6;
    else
      _new_interval := greatest(1, round(_row.interval_days * _new_ef)::int);
    end if;
    -- strength: cuanto más fácil percibido, más fuerza
    _new_strength := least(1.0,
      _row.strength + (0.15 + (_quality - 3) * 0.07)
    );
  end if;

  update public.srs_items
     set ease_factor = _new_ef,
         interval_days = _new_interval,
         repetitions = _new_reps,
         strength = _new_strength,
         last_reviewed_at = now(),
         next_review_at = now() + (_new_interval || ' days')::interval,
         total_reviews = _row.total_reviews + 1,
         total_correct = _row.total_correct + case when _quality >= 3 then 1 else 0 end
   where id = _item_id
   returning * into _row;

  return _row;
end;
$$;

-- ============================================================
-- RPC: tarjetas vencidas
-- ============================================================
create or replace function public.srs_get_due(
  _limit int default 10,
  _course_id uuid default null
) returns setof public.srs_items
language sql
stable
security definer
set search_path = public
as $$
  select * from public.srs_items
   where user_id = auth.uid()
     and next_review_at <= now()
     and (_course_id is null or course_id = _course_id)
   order by next_review_at asc, strength asc
   limit greatest(1, least(_limit, 50));
$$;

-- ============================================================
-- RPC: conteo rápido
-- ============================================================
create or replace function public.srs_due_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.srs_items
   where user_id = auth.uid()
     and next_review_at <= now();
$$;