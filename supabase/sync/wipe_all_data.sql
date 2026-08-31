-- ============================================================
-- تنضيف كامل لقاعدة بيانات Supabase قبل بداية الإطلاق الفعلي.
-- بيمسح: كل الحسابات (بما فيها التجريبية) + كل بياناتها التابعة
-- (عناوين، مفضلة، سلة، أوردرات، طلبات حذف حساب) + المنتجات.
--
-- ⚠️ تحذير: العملية دي لا رجعة فيها (irreversible). اعمل نسخة
-- احتياطية الأول لو مش متأكد (Supabase → Database → Backups).
--
-- إزاي تشغّله:
-- Supabase Dashboard → SQL Editor → New query → الصق الملف ده كامل
-- → Run. لازم تشغّله بحساب postgres/owner (اللي بتفتح بيه SQL Editor
-- عادي) عشان يقدر يمسح من auth.users.
-- ============================================================

begin;

-- 1) مسح كل المستخدمين (بيمسح تلقائيًا وبالتتابع بسبب "on delete
--    cascade" كل صف تابع ليهم في: profiles, addresses, favorites,
--    cart_items, orders, order_items, account_delete_requests)
delete from auth.users;

-- 2) مسح المنتجات (هتترجع تلقائيًا مع أول نشر جاي، لأن
--    products_sync.sql بيعيد بناءها بالكامل من data/products.json
--    في كل مرة الموقع بينشر)
truncate table public.products restart identity cascade;

-- 3) تصفير إعداد سعر التوصيل لقيمته الافتراضية (اختياري — امسح
--    السطر ده لو عايز تسيب سعر التوصيل الحالي زي ما هو)
update public.settings set delivery_price = 0, updated_at = now() where id = 1;

commit;

-- تأكيد سريع إن كل حاجة اتفضّت (المفروض كل الأرقام تطلع صفر
-- ما عدا settings هيفضل فيه صف واحد بس)
select 'auth.users' as table_name, count(*) from auth.users
union all
select 'profiles', count(*) from public.profiles
union all
select 'addresses', count(*) from public.addresses
union all
select 'favorites', count(*) from public.favorites
union all
select 'cart_items', count(*) from public.cart_items
union all
select 'orders', count(*) from public.orders
union all
select 'order_items', count(*) from public.order_items
union all
select 'account_delete_requests', count(*) from public.account_delete_requests
union all
select 'products', count(*) from public.products;
