-- ============================================================
-- تصحيحات على تدفق "السلة" الجديد (بعد 006):
--
-- 1) صفحة السلة الجديدة بتعمل insert للأوردر بحالة 'placed' على
--    طول (مفيش مرحلة "pending_payment" بيتحدّث منها زي التصميم
--    القديم — العربة بقت متسجلة كلها في جدول cart_items لحد ما
--    المستخدم يضغط "اطلب الآن")، فسياسة إدراج order_items في 003
--    اللي بتشترط status = 'pending_payment' بقت بتمنع أي أوردر
--    جديد من إنه يتبعت خالص (RLS بترفض الإدراج). الملف ده بيوسّع
--    الشرط عشان يسمح بالحالتين.
--
-- 2) trigger إنشاء البروفايل عند التسجيل (handle_new_user) كان
--    بياخد الاسم والتليفون بس من بيانات التسجيل، من غير كود
--    الدولة اللي بقينا بنبعته دلوقتي من الموقع.
--
-- idempotent زي باقي الـ migrations.
-- ============================================================

drop policy if exists "order_items: insert into own pending order" on public.order_items;
drop policy if exists "order_items: insert into own order" on public.order_items;
create policy "order_items: insert into own order" on public.order_items
  for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
        and o.status in ('pending_payment', 'placed')
    )
  );

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, country_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'country_code', '+20')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

notify pgrst, 'reload schema';
