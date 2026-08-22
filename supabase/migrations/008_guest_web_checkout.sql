-- ============================================================
-- تفعيل "اطلب من غير حساب" فعليًا من الموقع نفسه (مش بس من برنامج
-- الأدمن). قبل الملف ده: عمود guest_phone/guest_name/guest_address
-- كانوا موجودين (005) بس مفيش أي طريقة آمنة للموقع (anon key) إنه
-- يستخدمهم، لأن:
--   1) مفيش insert policy على orders تسمح بـ user_id = null.
--   2) لو حطينا select policy عادية على "orders" بشرط user_id is
--      null، ده هيسمح لأي حد معاه الـ anon key (يعني أي زائر) إنه
--      يقرا كل أوردرات كل الضيوف (اسم/تليفون/عنوان) مش بس بتاعته
--      هو. الـ anon key نفسه public أصلاً (موجود في كود الموقع).
--
-- الحل: بدل ما نفتح الجدول للـ SELECT مباشرة، بنعمل RPC functions
-- بـ security definer بتشتغل هي بس اللي تلمس الجدول من جوه، وتتأكد
-- من تطابق رقم التليفون قبل ما ترجع أي بيانات. الموقع بيخزن id بس
-- بتاع كل أوردر (+ رقم التليفون) محليًا في localStorage عند المتصفح،
-- ولازم الاتنين مع بعض عشان تقدر تجيب تفاصيل الأوردر تاني.
-- ============================================================

-- ------------------------------------------------------------
-- 1) إدراج أوردر ضيف بالكامل (order + order_items) في استدعاء واحد
--    ذري (atomic) — بدل ما الموقع يعمل insert للأوردر وبعدين insert
--    تاني للعناصر (لو الأول نجح والتاني فشل هيفضل أوردر فاضي معلق).
--    السعر بيتقرا من جدول products مباشرة جوه الدالة (مش من اللي
--    الموقع بعته) عشان محدش يقدر يغيّر السعر من الـ devtools مثلاً.
-- ------------------------------------------------------------
create or replace function public.place_guest_order(
  p_guest_name text,
  p_guest_phone text,
  p_guest_address text,
  p_country_code text,
  p_note text,
  p_items jsonb  -- [{"product_id": "...", "quantity": 2}, ...]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_delivery_price numeric(10,2);
  v_subtotal numeric(10,2) := 0;
  v_item jsonb;
  v_product record;
  v_qty integer;
  v_items_count integer := 0;
begin
  if p_guest_phone is null or length(trim(p_guest_phone)) < 5 then
    raise exception 'رقم الهاتف مطلوب';
  end if;
  if p_guest_address is null or length(trim(p_guest_address)) < 3 then
    raise exception 'العنوان مطلوب';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'السلة فاضية';
  end if;

  select delivery_price into v_delivery_price from public.settings where id = 1;
  v_delivery_price := coalesce(v_delivery_price, 0);

  insert into public.orders (
    user_id, status, total, delivery_price, payment_status, delivery_status,
    note, country_code, guest_name, guest_phone, guest_address
  ) values (
    null, 'placed', 0, v_delivery_price, 'unpaid', 'not_shipped',
    nullif(trim(coalesce(p_note, '')), ''), coalesce(p_country_code, '+20'),
    nullif(trim(coalesce(p_guest_name, '')), ''), trim(p_guest_phone), trim(p_guest_address)
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := greatest(1, coalesce((v_item->>'quantity')::integer, 1));
    select id, name, price into v_product from public.products
      where id = (v_item->>'product_id')::uuid and is_active = true;
    if v_product.id is null then
      continue; -- تجاهل أي منتج مش موجود/متوقف بدل ما يفشل الأوردر كله
    end if;
    insert into public.order_items (order_id, product_id, product_name_snapshot, unit_price, quantity)
      values (v_order_id, v_product.id, v_product.name, coalesce(v_product.price, 0), v_qty);
    v_subtotal := v_subtotal + coalesce(v_product.price, 0) * v_qty;
    v_items_count := v_items_count + 1;
  end loop;

  if v_items_count = 0 then
    delete from public.orders where id = v_order_id;
    raise exception 'مفيش منتجات صالحة في السلة';
  end if;

  update public.orders set total = v_subtotal + v_delivery_price where id = v_order_id;

  return v_order_id;
end;
$$;

revoke all on function public.place_guest_order(text, text, text, text, text, jsonb) from public;
grant execute on function public.place_guest_order(text, text, text, text, text, jsonb) to anon, authenticated;

-- ------------------------------------------------------------
-- 2) قراءة أوردرات الضيف: لازم id الأوردر (محفوظ محليًا في المتصفح)
--    + رقم التليفون يتطابقوا مع بعض، وإلا الصف مبيرجعش خالص.
-- ------------------------------------------------------------
create or replace function public.get_guest_orders(
  p_order_ids uuid[],
  p_phone text
)
returns table (
  id uuid,
  status public.order_status,
  payment_status text,
  delivery_status text,
  paid_amount numeric,
  total numeric,
  delivery_price numeric,
  created_at timestamptz,
  items jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  select
    o.id, o.status, o.payment_status, o.delivery_status, o.paid_amount,
    o.total, o.delivery_price, o.created_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', oi.id, 'product_name_snapshot', oi.product_name_snapshot,
        'unit_price', oi.unit_price, 'quantity', oi.quantity
      ))
      from public.order_items oi where oi.order_id = o.id
    ), '[]'::jsonb) as items
  from public.orders o
  where o.user_id is null
    and o.guest_phone = trim(p_phone)
    and o.id = any(p_order_ids)
  order by o.created_at desc;
$$;

revoke all on function public.get_guest_orders(uuid[], text) from public;
grant execute on function public.get_guest_orders(uuid[], text) to anon, authenticated;

create index if not exists idx_orders_guest_phone on public.orders(guest_phone) where guest_phone is not null;

notify pgrst, 'reload schema';
