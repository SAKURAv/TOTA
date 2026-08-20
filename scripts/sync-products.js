// ============================================================
//  بيقرأ data/products.json (بعد ما الـ build يبنيه) ويولّد ملف
//  SQL بيعمل Upsert لكل المنتجات في جدول public.products، وبيعطّل
//  (is_active = false) أي منتج موجود في القاعدة لكن اتشال من
//  الملف. بيتشغّل تلقائيًا مع كل نشر (deploy.yaml) — مفيش أي
//  خطوة يدوية مطلوبة.
// ============================================================
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'products.json');
const outPath = path.join(__dirname, '..', 'supabase', 'sync', 'products_sync.sql');

function sqlEscape(str) {
  if (str === null || str === undefined) return 'null';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function main() {
  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const allProducts = [];
  (raw.categories || []).forEach(function (cat) {
    (cat.products || []).forEach(function (p) {
      allProducts.push(p);
    });
  });

  const lines = [];
  lines.push('-- ============================================================');
  lines.push('-- ملف مولّد تلقائيًا من scripts/sync-products.js وقت كل نشر.');
  lines.push('-- لا تعدّل هذا الملف يدويًا، أي تعديل هيتغطى في النشر الجاي.');
  lines.push('-- ============================================================');
  lines.push('');

  if (allProducts.length) {
    lines.push('insert into public.products (slug, name, price, is_active, updated_at)');
    lines.push('values');
    const rows = allProducts.map(function (p) {
      return '  (' + sqlEscape(p.id) + ', ' + sqlEscape(p.name) + ', ' +
        (p.price != null ? p.price : 'null') + ', true, now())';
    });
    lines.push(rows.join(',\n') + '');
    lines.push('on conflict (slug) do update set');
    lines.push('  name = excluded.name,');
    lines.push('  price = excluded.price,');
    lines.push('  is_active = true,');
    lines.push('  updated_at = now();');
    lines.push('');

    const slugList = allProducts.map(function (p) { return sqlEscape(p.id); }).join(', ');
    lines.push('-- أي منتج في القاعدة مش موجود في الملف الحالي يبقى غير نشط');
    lines.push('-- (مش بيتحذف عشان يفضل مرتبط بالأوردرات والمفضلة القديمة)');
    lines.push('update public.products set is_active = false');
    lines.push('  where slug not in (' + slugList + ');');
  } else {
    lines.push('update public.products set is_active = false;');
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n') + '\n');
  console.log('تم توليد ' + outPath + ' من ' + allProducts.length + ' منتج.');
}

main();
