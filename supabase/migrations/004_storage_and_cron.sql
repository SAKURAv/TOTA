-- ============================================================
-- Storage buckets: صور الحسابات + مرفقات الشات
-- (صور المنتجات هتتحدد طريقتها بالتفصيل في مرحلة لاحقة منفصلة)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 5242880)          -- 5MB، عام (يظهر بدون تسجيل دخول)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-attachments', 'chat-attachments', false, 10485760) -- 10MB، خاص
on conflict (id) do nothing;

-- avatars: كل مستخدم يرفع وبيعدّل صورته هو بس، لكن أي حد يقدر يشوفها
-- (لازم اسم الملف يبدأ بـ user_id/ زي: avatars/<user_id>/photo.webp)
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars: owner can upload"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: owner can update"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- chat-attachments: لازم المسار يبدأ بـ <chat_id>/، والمستخدم يقدر
-- يرفع/يشوف بس لو هو صاحب الشات ده
create policy "chat-attachments: owner read"
  on storage.objects for select
  using (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.chats c
      where c.id::text = (storage.foldername(name))[1]
        and c.user_id = auth.uid()
    )
  );

create policy "chat-attachments: owner upload"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.chats c
      where c.id::text = (storage.foldername(name))[1]
        and c.user_id = auth.uid()
    )
  );

-- ============================================================
-- Cron: تشغيل دوري (كل ساعة) لحذف الشاتات المنتهية تلقائيًا.
-- pg_cron متاح مجانًا في مشاريع Supabase.
-- ============================================================
-- ملحوظة: لو الأمر ده فشل بسبب صلاحيات، فعّل pg_cron يدويًا مرة واحدة
-- من: Supabase Dashboard → Database → Extensions → دور على "pg_cron" وفعّله
create extension if not exists pg_cron;

select cron.schedule(
  'purge-expired-chats',   -- اسم المهمة
  '0 * * * *',             -- كل ساعة بالظبط
  $$ select public.purge_expired_chats(); $$
);
