-- 1) thêm vài cột quiz (không bắt buộc nhưng tiện)
alter table public.quizzes
  add column if not exists require_login boolean not null default true,
  add column if not exists pinned boolean not null default false,
  add column if not exists cover_image text;

-- 2) bảng câu hỏi
create table if not exists public.quiz_questions (
  id bigserial primary key,
  quiz_id text not null references public.quizzes(quiz_id) on delete cascade,
  no int,
  qid int,
  qtype text not null default 'mcq1',
  prompt text not null,
  options text[] not null default '{}'::text[],
  answer text not null default '',
  points numeric(6,2),
  created_at timestamptz not null default now()
);

create index if not exists quiz_questions_quiz_no_idx on public.quiz_questions(quiz_id, no);

-- 3) RPC: lấy info quiz (public)
drop function if exists public.api_get_quiz_public(text);
create function public.api_get_quiz_public(p_quiz_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
  qid text := lower(trim(coalesce(p_quiz_id,'')));
begin
  select quiz_id, title, sub, is_public, is_hidden, require_access_code, require_login, pinned, cover_image
  into q
  from public.quizzes
  where quiz_id = qid
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'quiz not found');
  end if;

  -- public gate
  if q.is_public = false then
    return jsonb_build_object('ok', false, 'error', 'quiz is private');
  end if;

  return jsonb_build_object('ok', true, 'quiz', jsonb_build_object(
    'quiz_id', q.quiz_id,
    'title', q.title,
    'sub', q.sub,
    'require_login', q.require_login,
    'require_access_code', q.require_access_code,
    'pinned', q.pinned,
    'cover_image', coalesce(q.cover_image,'')
  ));
end;
$$;

grant execute on function public.api_get_quiz_public(text) to anon, authenticated;

-- 4) RPC: lấy danh sách câu hỏi (public)
drop function if exists public.api_get_questions(text);
create function public.api_get_questions(p_quiz_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  qid text := lower(trim(coalesce(p_quiz_id,'')));
begin
  return jsonb_build_object(
    'ok', true,
    'items',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'no', no,
          'qid', qid,
          'type', qtype,
          'text', prompt,
          'options', options,
          'answer', answer,
          'points', points
        )
        order by no nulls last, id
      )
      from public.quiz_questions
      where quiz_id = qid
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.api_get_questions(text) to anon, authenticated;

-- 5) RPC: admin import questions (dán HTML .q trong admin panel)
drop function if exists public.api_admin_import_questions(text,text,jsonb);
create function public.api_admin_import_questions(
  p_token text,
  p_quiz_id text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u record;
  qid text := lower(trim(coalesce(p_quiz_id,'')));
  it jsonb;
  inserted int := 0;
begin
  select * into u from public.user_from_token(p_token);
  if u.user_id is null then
    return jsonb_build_object('ok', false, 'error', 'not logged in');
  end if;
  if u.role <> 'admin' then
    return jsonb_build_object('ok', false, 'error', 'not admin');
  end if;

  if qid = '' then
    return jsonb_build_object('ok', false, 'error', 'missing quiz_id');
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'items must be array');
  end if;

  delete from public.quiz_questions where quiz_id = qid;

  for it in select * from jsonb_array_elements(p_items)
  loop
    insert into public.quiz_questions(quiz_id, no, qid, qtype, prompt, options, answer, points)
    values (
      qid,
      nullif((it->>'no')::int, 0),
      nullif((it->>'qid')::int, 0),
      coalesce(it->>'type','mcq1'),
      coalesce(it->>'text',''),
      coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(coalesce(it->'options','[]'::jsonb))),
        '{}'::text[]
      ),
      upper(coalesce(it->>'answer','')),
      nullif((it->>'points')::numeric, 0)
    );
    inserted := inserted + 1;
  end loop;

  return jsonb_build_object('ok', true, 'inserted', inserted);
end;
$$;

grant execute on function public.api_admin_import_questions(text,text,jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
