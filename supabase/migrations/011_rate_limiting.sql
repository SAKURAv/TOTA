-- ============================================================
-- Rate limiting عام بالـ IP لأي RPC حساس (place_guest_order،
-- get_guest_orders دلوقتي — وأي دالة تانية في المستقبل).
--
-- الفكرة: جدول واحد بسيط (rate_limit_hits) بيسجل "ضربة" لكل مفتاح
-- (IP + اسم العملية) مع وقتها، ودالة check_and_hit_rate_limit بتحسب
-- كام ضربة حصلت لنفس المفتاح خلال آخر p_window_seconds، ولو العدد
-- وصل للحد الأقصى بترفض (false) من غير ما تسجل ضربة جديدة، غير كده
-- بتسجل الضربة وترجع true. التنضيف بيحصل تلقائيًا (delete القديم)
-- في كل استدعاء، فمحتاجينش cron منفصل.
--
-- الـ IP بيتقرا من هيدر x-forwarded-for اللي PostgREST بيعرضه في
-- current_setting('request.headers') — ده الهيدر القياسي اللي
-- Supabase/Cloudflare بيحطوه بأول IP هو بتاع الزائر الحقيقي.
-- ============================================================

create table if not exists public.rate_limit_hits (
  id bigint generated always as identity primary key,
  rl_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_hits_key_time on public.rate_limit_hits (rl_key, created_at);

-- تنظيف تلقائي بسيط: أي صف أقدم من يوم كامل مالوش لازمة أصلاً
-- (أطول نافذة rate limit عندنا ساعة)، فبنشيله كل ما حد يستدعي الدالة
-- عشان الجدول ميكبرش من غير داعي من غير ما نحتاج cron/pg_cron منفصل.
create or replace function public.rl_client_ip()
returns text
language plpgsql
stable
as $$
declare
  v_headers json;
  v_xff text;
begin
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    return null;
  end;
  if v_headers is null then
    return null;
  end if;
  v_xff := v_headers->>'x-forwarded-for';
  if v_xff is null or length(trim(v_xff)) = 0 then
    v_xff := v_headers->>'cf-connecting-ip';
  end if;
  if v_xff is null then
    return null;
  end if;
  -- x-forwarded-for ممكن يكون فيه أكتر من IP (ip_الزائر, proxy1, proxy2...)
  -- أول واحدة هي بتاعة الزائر الحقيقي.
  return trim(split_part(v_xff, ',', 1));
end;
$$;

revoke all on function public.rl_client_ip() from public;
grant execute on function public.rl_client_ip() to anon, authenticated;

create or replace function public.check_and_hit_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- تنظيف الضربات القديمة بتاعة نفس المفتاح ده (أوفر من مسح الجدول كله)
  delete from public.rate_limit_hits
    where rl_key = p_key and created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into v_count from public.rate_limit_hits where rl_key = p_key;

  if v_count >= p_max then
    return false;
  end if;

  insert into public.rate_limit_hits (rl_key) values (p_key);
  return true;
end;
$$;

revoke all on function public.check_and_hit_rate_limit(text, integer, integer) from public;
-- الدالة دي بتتنادى من جوه دوال تانية بس (security definer)، مش
-- مطلوب حد يقدر ينادها هي نفسها من بره مباشرة.

-- ------------------------------------------------------------
-- تطبيق الحد على place_guest_order: نفس الـ IP ميقدرش يبعت أكتر من
-- طلبين (أوردر) في الساعة الواحدة.
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
  v_ip text;
begin
  v_ip := coalesce(public.rl_client_ip(), 'unknown');
  if not public.check_and_hit_rate_limit('guest_order:' || v_ip, 2, 3600) then
    raise exception 'تم تجاوز الحد المسموح به لعدد الطلبات (طلبين كل ساعة)، حاول تاني بعد شوية.';
  end if;

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
-- تطبيق حد أخف على get_guest_orders: بيمنع محاولة "تخمين" أرقام
-- أوردرات عشوائية بسرعة عالية من نفس الـ IP (لسه بيتطلب تطابق رقم
-- الهاتف أصلاً، لكن ده طبقة حماية إضافية ضد الـ scan نفسه).
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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text;
begin
  v_ip := coalesce(public.rl_client_ip(), 'unknown');
  if not public.check_and_hit_rate_limit('guest_orders_lookup:' || v_ip, 30, 3600) then
    raise exception 'محاولات كتير في وقت قصير، حاول تاني بعد شوية.';
  end if;

  return query
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
end;
$$;

revoke all on function public.get_guest_orders(uuid[], text) from public;
grant execute on function public.get_guest_orders(uuid[], text) to anon, authenticated;

notify pgrst, 'reload schema';
