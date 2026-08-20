-- ============================================================
-- Storage buckets: صور الحسابات + مرفقات الشات
-- (صور المنتجات هتتحدد طريقتها بالتفصيل في مرحلة لاحقة منفصلة)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 5242880)          -- 5MB، عام (يظهر بدون تسجيل دخول)
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


