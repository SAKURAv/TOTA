-- ============================================================
-- السماح للموقع (anon key + RLS) بإنشاء وتحديث الأوردر الخاص بيه
-- وقت "أضف للعربة" — قبل كده كان مفيش أي policy تسمح بإدراج أو
-- تحديث order_items، ولا بتحديث orders.total، فكانت عربة الشراء
-- بتتسجل من غير ما تتحول لأوردر حقيقي يوصل للأدمن. الملف ده
-- idempotent زي باقي المigrations.
-- ============================================================

-- المستخدم يقدر يحدّث أوردره هو بس، وبشرط إن الأوردر لسه
-- "pending_payment" قبل وبعد التحديث (يعني مينفعش يغيّر الحالة
-- بنفسه لأي حاجة تانية زي "تم التوصيل" مثلاً)
drop policy if exists "orders: update own while pending" on public.orders;
create policy "orders: update own while pending" on public.orders
  for update
  using (auth.uid() = user_id and status = 'pending_payment')
  with check (auth.uid() = user_id and status = 'pending_payment');

-- المستخدم يقدر يضيف عناصر لأوردر هو صاحبه ولسه pending بس
drop policy if exists "order_items: insert into own pending order" on public.order_items;
create policy "order_items: insert into own pending order" on public.order_items
  for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
        and o.status = 'pending_payment'
    )
  );

-- المستخدم يقدر يعدّل كمية عنصر (لو ضاف نفس المنتج تاني من صفحة تانية)
-- في أوردر هو صاحبه ولسه pending بس
drop policy if exists "order_items: update own pending order" on public.order_items;
create policy "order_items: update own pending order" on public.order_items
  for update
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
        and o.status = 'pending_payment'
    )
  );
