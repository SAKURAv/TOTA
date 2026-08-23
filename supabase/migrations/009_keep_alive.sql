-- ============================================================
-- جدول صغير جداً بس عشان الـ workflow الدوري (keep-alive.yaml)
-- يقدر يعمل استعلام حقيقي (insert فعلي) على القاعدة كل شوية،
-- عشان يفضّل عداد الـ "inactivity" بتاع Supabase Free Plan متصفرش
-- ويوقف المشروع تلقائي بعد 7 أيام من غير أي نشاط.
--
-- بيحتفظ بآخر صف بس (بيمسح القديم قبل ما يضيف الجديد) عشان الجدول
-- يفضل بحجم صفر تقريباً مهما اتكرر التشغيل.
-- ============================================================
create table if not exists public.keep_alive (
  id smallint primary key default 1 check (id = 1),
  pinged_at timestamptz not null default now()
);

insert into public.keep_alive (id, pinged_at)
values (1, now())
on conflict (id) do update set pinged_at = excluded.pinged_at;
