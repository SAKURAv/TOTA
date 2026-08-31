-- ============================================================
-- دالة بتنضّف جداول تسجيل الدخول اللي بتتراكم تلقائيًا في سكيمة
-- auth بتاعة Supabase (auth.sessions + auth.refresh_tokens) مع كل
-- عملية تسجيل دخول جديدة على الموقع.
--
-- بتمسح لأي مستخدم:
--   1) أي جلسة (session) غير آخر جلسة نشطة ليه (حسب last_active_at)
--   2) أي جلسة معملهاش أي نشاط من شهر أو أكتر، حتى لو كانت أحدث جلسة
--      (يعني لو المستخدم مسجّلش دخول من شهر، جلسته القديمة بتتمسح
--      برضو ومش بتفضل متراكمة من غير فايدة)
--
-- refresh_tokens بتتمسح تبعًا لأي session اتمسحت (عن طريق session_id)
-- عشان محدش يقدر يستخدم refresh token بتاع جلسة اتمسحت.
--
-- الجلسة النشطة الحالية لأي مستخدم بتفضل زي ما هي دايمًا (هي اللي
-- ليها آخر last_active_at)، فمحدش بيتسجّل خروجه فجأة بسبب الدالة دي.
--
-- الدالة دي منفصلة تمامًا عن نشر الموقع وباقي الـ workflows — بتتشغّل
-- بس عن طريق الـ workflow الدوري (cleanup-stale-sessions.yaml) كل
-- أسبوعين، ولو فشلت لأي سبب الموقع والبرنامج مش بيتأثروا خالص.
-- ============================================================
create or replace function public.cleanup_stale_auth_sessions()
returns table (deleted_sessions bigint, deleted_refresh_tokens bigint)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_deleted_sessions bigint := 0;
  v_deleted_refresh_tokens bigint := 0;
begin
  -- آخر جلسة نشطة لكل مستخدم (اللي المفروض تفضل بس)
  create temporary table _keep_sessions on commit drop as
  select distinct on (user_id) id
  from auth.sessions
  order by user_id, coalesce(last_active_at, created_at) desc;

  -- الجلسات اللي هتتمسح: أي جلسة مش هي آخر جلسة نشطة للمستخدم،
  -- أو أي جلسة (حتى لو هي آخر واحدة) معملهاش نشاط من شهر أو أكتر
  create temporary table _sessions_to_delete on commit drop as
  select s.id
  from auth.sessions s
  where s.id not in (select id from _keep_sessions)
     or coalesce(s.last_active_at, s.created_at) < (now() - interval '30 days');

  delete from auth.refresh_tokens rt
  using _sessions_to_delete d
  where rt.session_id = d.id;
  get diagnostics v_deleted_refresh_tokens = row_count;

  delete from auth.sessions s
  using _sessions_to_delete d
  where s.id = d.id;
  get diagnostics v_deleted_sessions = row_count;

  return query select v_deleted_sessions, v_deleted_refresh_tokens;
end;
$$;

-- بنمنع تنفيذ الدالة من أي حد غير service_role (اللي الـ workflow
-- بيستخدمه عن طريق SUPABASE_DB_URL)، عشان محدش يقدر يشغّلها من الموقع
revoke all on function public.cleanup_stale_auth_sessions() from public, anon, authenticated;
