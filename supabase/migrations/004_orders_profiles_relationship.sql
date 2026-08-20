-- ============================================================
-- إصلاح: PostgrestException - "Could not find a relationship
-- between 'orders' and 'profiles'"
--
-- السبب: orders.user_id كان بيشاور على auth.users(id) مباشرة،
-- مش على public.profiles(id). PostgREST بيقدر يعمل embed تلقائي
-- بس لو فيه foreign key حقيقي بين الجدولين في schema "public"،
-- فمكنش عارف يربط orders بـ profiles حتى لو الاتنين بيشاوروا على
-- نفس المستخدم في auth.users.
--
-- الحل: نغيّر الـ foreign key بتاع orders.user_id عشان يشاور على
-- public.profiles(id) بدل auth.users(id) مباشرة. ده آمن 100% لأن:
--   - profiles.id أصلاً = auth.users.id (نفس القيمة بالظبط، مربوطة
--     بـ trigger handle_new_user وقت التسجيل)
--   - profiles.id already "on delete cascade" من auth.users، فلو
--     اتحذف المستخدم من auth.users هيتحذف الصف بتاعه في profiles
--     تلقائيًا، وبالتالي orders هيتحذف برضه (cascade) بنفس الطريقة
--     القديمة بالظبط.
-- ============================================================

alter table public.orders
  drop constraint if exists orders_user_id_fkey;

alter table public.orders
  add constraint orders_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- إجبار PostgREST يعيد تحميل الـ schema cache فورًا بدل ما يستنى
-- الـ auto-reload الدوري (بيحل مشكلة استمرار ظهور نفس الخطأ لفترة
-- بعد تطبيق أي migration بيغيّر foreign keys).
notify pgrst, 'reload schema';
