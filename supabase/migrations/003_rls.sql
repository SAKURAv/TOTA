-- ============================================================
-- Row Level Security: كل مستخدم يشوف ويعدّل بياناته هو بس.
-- البرنامج (tota_admin2) بيستخدم service_role key اللي بيتخطى
-- الـ RLS تلقائيًا، فالأدمن هيشوف كل حاجة من غير أي قيد هنا.
-- ============================================================

alter table public.profiles      enable row level security;
alter table public.addresses     enable row level security;
alter table public.favorites     enable row level security;
alter table public.cart_items    enable row level security;
alter table public.orders        enable row level security;
alter table public.order_items   enable row level security;
alter table public.products      enable row level security;

-- products: أي حد (حتى الزائر مش مسجل) يقدر يقرا المنتجات النشطة فقط
create policy "products readable by everyone"
  on public.products for select
  using (is_active = true);

-- profiles: كل مستخدم يشوف ويعدّل بروفايله بس
create policy "profile: select own" on public.profiles
  for select using (auth.uid() = id);
create policy "profile: update own" on public.profiles
  for update using (auth.uid() = id);
create policy "profile: insert own" on public.profiles
  for insert with check (auth.uid() = id);

-- addresses
create policy "addresses: manage own" on public.addresses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- favorites
create policy "favorites: manage own" on public.favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- cart_items
create policy "cart: manage own" on public.cart_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- orders: المستخدم يشوف أوردراته بس، ومينفعش يعدّل الحالة بنفسه
-- (التعديل على status/paid/delivered يبقى من البرنامج بـ service_role)
create policy "orders: select own" on public.orders
  for select using (auth.uid() = user_id);
create policy "orders: insert own" on public.orders
  for insert with check (auth.uid() = user_id);

create policy "order_items: select own" on public.order_items
  for select using (
    exists (select 1 from public.orders o
            where o.id = order_items.order_id and o.user_id = auth.uid())
  );

