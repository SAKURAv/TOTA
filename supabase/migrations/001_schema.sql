-- ============================================================
-- المرحلة الأولى: الجداول الأساسية (users, products, orders,
-- cart, favorites, addresses) + الشات المرتبط بالحسابات والمنتجات
--
-- طريقة التشغيل: افتح مشروعك في supabase.com → SQL Editor →
-- New query → الصق محتوى هذا الملف بالكامل → Run.
-- شغّل الملفات بالترتيب الرقمي: 001 ثم 002 ثم 003.
-- ============================================================

-- تفعيل الامتداد اللازم لتوليد UUID تلقائيًا
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- profiles: بيانات الحساب الإضافية فوق auth.users (اللي بيدير
-- تسجيل الدخول والباسورد والإيميل تلقائيًا وبأمان)
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
-- products: بيانات المنتجات (المصدر الرئيسي لعرضها في الموقع
-- لسه هو data/products.json الحالي، لكن الجدول ده هيبقى المرجع
-- اللي البرنامج بيتحكم بيه ويتزامن منه مستقبلاً + مطلوب أصلاً
-- عشان الأوردرات والمفضلة والشات يرتبطوا بـ id ثابت لكل منتج)
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
-- status: يمثل حالة الأوردر (تُعرض في صفحة "الأوردرات" بالبرنامج)
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
  chat_id uuid,                  -- بيتربط بالشات بعد إنشاء جدول chats (يتحدث في 002)
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
