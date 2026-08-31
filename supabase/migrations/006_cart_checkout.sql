-- ============================================================
-- دعم صفحة "السلة" الجديدة: تجميع الطلب في أوردر واحد بيتبعت
-- فعليًا (submit) بدل ما يفضل draft للأبد، + حالة دفع/توصيل
-- تفصيلية، + كود دولة للتليفون، + ملاحظة إضافية من العميل،
-- + سعر توصيل ثابت (متغيّر) يتحدد من برنامج الأدمن ويتقرأ في
-- الموقع، مع إمكانية تغييره لأوردر معيّن لوحده.
--
-- الملف ده idempotent زي باقي الـ migrations.
-- ============================================================

-- ------------------------------------------------------------
-- settings: صف واحد بس (singleton) فيه إعدادات عامة زي سعر
-- التوصيل الافتراضي. برنامج الأدمن (service_role) هو اللي بيعدّله،
-- والموقع (anon) بيقرأه بس.
-- ------------------------------------------------------------
create table if not exists public.settings (
  id smallint primary key default 1 check (id = 1),
  delivery_price numeric(10,2) not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.settings (id, delivery_price)
values (1, 0)
on conflict (id) do nothing;

alter table public.settings enable row level security;
drop policy if exists "settings: readable by everyone" on public.settings;
create policy "settings: readable by everyone"
  on public.settings for select
  using (true);
-- مفيش policy لـ insert/update/delete عمدًا — التعديل بس من
-- برنامج الأدمن اللي بيستخدم service_role وبيتخطى RLS.

-- ------------------------------------------------------------
-- إضافة "placed" لحالة الأوردر: الفرق بينها وبين pending_payment
-- إن pending_payment = لسه بيتجمع فيه منتجات (سلة مفتوحة)، و
-- placed = العميل ضغط "اطلب الآن" فعليًا والأوردر اتبعت للأدمن.
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'order_status' and e.enumlabel = 'placed'
  ) then
    alter type public.order_status add value 'placed' after 'pending_payment';
  end if;
end $$;

-- ------------------------------------------------------------
-- أعمدة جديدة على orders
-- ------------------------------------------------------------
alter table public.orders
  add column if not exists delivery_price numeric(10,2) not null default 0,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists paid_amount numeric(10,2) not null default 0,
  add column if not exists delivery_status text not null default 'not_shipped',
  add column if not exists note text,
  add column if not exists country_code text not null default '+20';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_status_check') then
    alter table public.orders
      add constraint orders_payment_status_check
      check (payment_status in ('unpaid', 'partial', 'paid'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_delivery_status_check') then
    alter table public.orders
      add constraint orders_delivery_status_check
      check (delivery_status in ('not_shipped', 'out_for_delivery', 'shipping', 'delivered'));
  end if;
end $$;

-- كود الدولة بتاع تليفون صاحب الحساب/العنوان (مثال: "+20"). بيتحفظ
-- منفصل عن الرقم نفسه عشان معالجة الصفر اللي بعد كود الدولة تبقى
-- سهلة ومتسقة سواء في الموقع أو في البرنامج.
alter table public.profiles
  add column if not exists country_code text not null default '+20';

alter table public.addresses
  add column if not exists country_code text not null default '+20';

-- ------------------------------------------------------------
-- السماح لصاحب الأوردر يعدّل بيانات إضافية (عنوان، ملاحظة، كود
-- دولة) طول ما لسه pending_payment (سلة مفتوحة) — زيادة على
-- الأعمدة اللي كانت متاحة قبل كده في 003.
-- ------------------------------------------------------------
drop policy if exists "orders: update own while pending" on public.orders;
create policy "orders: update own while pending" on public.orders
  for update
  using (auth.uid() = user_id and status = 'pending_payment')
  with check (auth.uid() = user_id and status = 'pending_payment');

-- policy جديدة منفصلة: تسمح لصاحب الأوردر "يطلبه فعليًا" (يحوّله من
-- pending_payment لـ placed) بشرط يكون معاه عنوان مربوط ورقم هاتف
-- محفوظ في البروفايل بتاعه (اتشيّك عليه من الموقع قبل الإرسال أصلاً،
-- لكن هنا حماية إضافية على مستوى قاعدة البيانات).
drop policy if exists "orders: submit own pending order" on public.orders;
create policy "orders: submit own pending order" on public.orders
  for update
  using (auth.uid() = user_id and status = 'pending_payment')
  with check (
    auth.uid() = user_id
    and status = 'placed'
    and address_id is not null
  );

notify pgrst, 'reload schema';
