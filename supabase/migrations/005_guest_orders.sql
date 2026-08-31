-- ============================================================
-- دعم "طلب ضيف" (Guest Order) من برنامج الأدمن: عميل بيكلم على
-- واتساب أو تليفون من غير ما يكون عنده حساب على الموقع، والأدمن
-- عايز يسجّل طلبه برضه بدل ما يضيع.
--
-- - user_id بقى ينفع يبقى فاضي (null) لو الطلب لضيف مش لحساب مسجّل.
-- - أضفنا أعمدة guest_name / guest_phone / guest_address تتملى بس
--   لما user_id يكون فاضي.
-- - check constraint بيضمن دايمًا: إما فيه user_id (حساب حقيقي) أو
--   فيه على الأقل guest_phone (ضيف)، مش الاتنين فاضيين مع بعض.
-- ============================================================

alter table public.orders
  alter column user_id drop not null;

alter table public.orders
  add column if not exists guest_name text,
  add column if not exists guest_phone text,
  add column if not exists guest_address text;

alter table public.orders
  drop constraint if exists orders_user_or_guest_check;

alter table public.orders
  add constraint orders_user_or_guest_check
  check (user_id is not null or guest_phone is not null);

-- سياسات RLS الحالية (orders: select own / insert own) شغالة بـ
-- auth.uid() = user_id وده هيفضل يشتغل عادي لأصحاب الحسابات. طلبات
-- الضيوف بتتحط عن طريق service_role من برنامج الأدمن نفسه، وده بيتخطى
-- الـ RLS تلقائيًا زي أي عملية تانية من البرنامج.

notify pgrst, 'reload schema';
