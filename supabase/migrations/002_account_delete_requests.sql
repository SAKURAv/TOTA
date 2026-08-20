-- ============================================================
-- طلبات حذف الحساب: المستخدم يطلب حذف حسابه من الموقع، والحذف
-- الفعلي بيحصل بس بعد موافقة الأدمن من برنامج tota_admin3
-- (اللي بيستخدم service_role وبيتخطى الـ RLS، فهو الوحيد اللي
-- يقدر يوافق/يرفض ويحذف الحساب فعليًا عن طريق auth.admin.deleteUser).
--
-- الملف ده idempotent زي 001_init.sql: تقدر تشغّله أي عدد مرات.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'delete_request_status') then
    create type public.delete_request_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

create table if not exists public.account_delete_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  status public.delete_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  admin_note text
);

-- مستخدم واحد ميقدرش يبعت أكتر من طلب "pending" في نفس الوقت
create unique index if not exists idx_one_pending_delete_request
  on public.account_delete_requests (user_id)
  where (status = 'pending');

create index if not exists idx_delete_requests_status
  on public.account_delete_requests (status, created_at desc);

alter table public.account_delete_requests enable row level security;

-- المستخدم يقدر يشوف طلباته بس
drop policy if exists "delete_requests: select own" on public.account_delete_requests;
create policy "delete_requests: select own" on public.account_delete_requests
  for select using (auth.uid() = user_id);

-- المستخدم يقدر يبعت طلب حذف لحسابه هو بس، وبحالة pending بس
-- (مينفعش يزوّر الطلب ويحطه approved من الموقع مثلاً)
drop policy if exists "delete_requests: insert own pending" on public.account_delete_requests;
create policy "delete_requests: insert own pending" on public.account_delete_requests
  for insert with check (auth.uid() = user_id and status = 'pending');

-- المستخدم يقدر يلغي طلبه هو بس لو لسه pending (قبل ما الأدمن يبت فيه)
drop policy if exists "delete_requests: delete own pending" on public.account_delete_requests;
create policy "delete_requests: delete own pending" on public.account_delete_requests
  for delete using (auth.uid() = user_id and status = 'pending');

-- ملحوظة: مفيش policy لـ update هنا عمدًا — التحديث (الموافقة/الرفض)
-- بيتم بس من برنامج الأدمن اللي بيستخدم service_role وبيتخطى RLS.
