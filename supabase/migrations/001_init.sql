-- ============================================================
-- الإعداد الكامل لقاعدة البيانات: users, products, orders,
-- cart, favorites, addresses + RLS + storage avatars + trigger
-- تسجيل حساب جديد.
--
-- ملحوظة: مفيش نظام شات في المشروع أصلاً — التواصل بيتم عبر
-- واتساب (wa.me) مباشرة من الموقع والبرنامج.
--
-- الملف ده idempotent بالكامل: تقدر تشغّله أي عدد مرات من غير
-- ما يحصل أي error، حتى لو الجداول/الأنواع كانت موجودة بالفعل.
-- ============================================================

-- تفعيل الامتداد اللازم لتوليد UUID تلقائيًا
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- profiles: بيانات الحساب الإضافية فوق auth.users
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_path text,              -- المسار داخل storage bucket "avatars"، مش الصورة نفسها
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- products: بيانات المنتجات
-- ------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  price numeric(10,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- addresses: عناوين كل مستخدم
-- ------------------------------------------------------------
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,                    -- زي "المنزل" / "الشغل"
  full_address text not null,
  city text,
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- favorites: المفضلة (منتج واحد لا يتكرر لنفس المستخدم)
-- ------------------------------------------------------------
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ------------------------------------------------------------
-- cart_items: عربة الشراء
-- ------------------------------------------------------------
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

-- ------------------------------------------------------------
-- orders + order_items
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum (
      'pending_payment',   -- لسه ما اتدفعش
      'paid',              -- تم الدفع
      'shipped',           -- تم الشحن
      'delivered',         -- تم التوصيل
      'cancelled',         -- ملغي
      'issue'              -- فيه مشكلة
    );
  end if;
end $$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  address_id uuid references public.addresses(id) on delete set null,
  status public.order_status not null default 'pending_payment',
  total numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name_snapshot text not null,   -- يحفظ اسم المنتج وقت الطلب حتى لو اتحذف بعدين
  unit_price numeric(10,2) not null,
  quantity integer not null default 1 check (quantity > 0)
);

create index if not exists idx_orders_user on public.orders(user_id);
create index if not exists idx_orders_created on public.orders(created_at desc);
create index if not exists idx_cart_user on public.cart_items(user_id);
create index if not exists idx_favorites_user on public.favorites(user_id);

-- ============================================================
-- Row Level Security
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

drop policy if exists "products readable by everyone" on public.products;
create policy "products readable by everyone"
  on public.products for select
  using (is_active = true);

drop policy if exists "profile: select own" on public.profiles;
create policy "profile: select own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profile: update own" on public.profiles;
create policy "profile: update own" on public.profiles
  for update using (auth.uid() = id);
drop policy if exists "profile: insert own" on public.profiles;
create policy "profile: insert own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "addresses: manage own" on public.addresses;
create policy "addresses: manage own" on public.addresses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "favorites: manage own" on public.favorites;
create policy "favorites: manage own" on public.favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cart: manage own" on public.cart_items;
create policy "cart: manage own" on public.cart_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "orders: select own" on public.orders;
create policy "orders: select own" on public.orders
  for select using (auth.uid() = user_id);
drop policy if exists "orders: insert own" on public.orders;
create policy "orders: insert own" on public.orders
  for insert with check (auth.uid() = user_id);

drop policy if exists "order_items: select own" on public.order_items;
create policy "order_items: select own" on public.order_items
  for select using (
    exists (select 1 from public.orders o
            where o.id = order_items.order_id and o.user_id = auth.uid())
  );

-- ============================================================
-- Storage: صور الحسابات (avatars)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 5242880)          -- 5MB، عام (يظهر بدون تسجيل دخول)
on conflict (id) do nothing;

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars: owner can upload" on storage.objects;
create policy "avatars: owner can upload"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: owner can update" on storage.objects;
create policy "avatars: owner can update"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- إنشاء صف تلقائي في profiles عند تسجيل حساب جديد في auth.users
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
