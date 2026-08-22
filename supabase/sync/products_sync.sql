-- ============================================================
-- ملف مولّد تلقائيًا من scripts/sync-products.js وقت كل نشر.
-- لا تعدّل هذا الملف يدويًا، أي تعديل هيتغطى في النشر الجاي.
-- ============================================================

insert into public.products (slug, name, price, is_active, updated_at)
values
  ('accessories/ayat-alkursi-bracelet', 'اسورة آية الكرسي', 85, true, now()),
  ('accessories/angel-necklace', 'سلسلة الملاك ترندي', 110, true, now()),
  ('accessories/horse-necklace', 'سلسلة حصان ترند', 70, true, now()),
  ('accessories/butterfly-necklace', 'سلسلة فراشة', 140, true, now()),
  ('accessories/tiger-necklace', 'سلسلة تايجر ترندي', 130, true, now())
on conflict (slug) do update set
  name = excluded.name,
  price = excluded.price,
  is_active = true,
  updated_at = now();

-- أي منتج في القاعدة مش موجود في الملف الحالي يبقى غير نشط
-- (مش بيتحذف عشان يفضل مرتبط بالأوردرات والمفضلة القديمة)
update public.products set is_active = false
  where slug not in ('accessories/ayat-alkursi-bracelet', 'accessories/angel-necklace', 'accessories/horse-necklace', 'accessories/butterfly-necklace', 'accessories/tiger-necklace');
