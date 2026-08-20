/**
 * تحويل تلقائي لصور المنتجات (jpg/jpeg/png) إلى WebP، بشكل غير مدمّر:
 *
 * - بيتشغّل بعد build-index.js (يعني data/products.json فيه المسارات الأصلية جاهزة).
 * - لكل صورة jpg/png بيولّد نسخة .webp جنبها في نفس المكان، ومفيش أي حذف أو
 *   إعادة تسمية للملفات الأصلية — عشان معاينة اللينك على واتساب/فيسبوك
 *   (Open Graph) لازم صورة jpg/png أصلية، والـ webp مش مدعوم فيها على كل الأجهزة.
 * - SVG بيتسيب زي ما هو (أصلًا خفيف ومفيهوش فايدة من تحويله).
 * - بعد التوليد، بيعدّل data/products.json نفسه: p.image و p.images بتشاور
 *   على نسخ الـ webp (فالموقع بيعرض WebP فعليًا وبيستفيد من صغر الحجم)،
 *   وبيضيف p.ogImage بالمسار الأصلي (jpg/png) عشان build-share-pages.js
 *   يستخدمه في معاينة الروابط بدل ما يرجع للوجو الافتراضي.
 * - أي حاجة تانية في الموقع (البرنامج، الشات، الأفاتار) مش بتتلمس خالص هنا.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const PRODUCTS_JSON = path.join(ROOT, "data", "products.json");
const CONVERTIBLE_EXT = [".jpg", ".jpeg", ".png"];

async function toWebp(relPath) {
  if (!relPath) return relPath;
  const ext = path.extname(relPath).toLowerCase();
  if (!CONVERTIBLE_EXT.includes(ext)) return relPath; // svg/webp/avif: بلاش تعديل
  const absSrc = path.join(ROOT, relPath);
  const relWebp = relPath.slice(0, -ext.length) + ".webp";
  const absWebp = path.join(ROOT, relWebp);
  if (!fs.existsSync(absSrc)) return relPath;
  if (!fs.existsSync(absWebp)) {
    try {
      await sharp(absSrc).webp({ quality: 82 }).toFile(absWebp);
      console.log(`✓ ${relPath} -> ${path.basename(relWebp)}`);
    } catch (err) {
      console.error(`✗ فشل تحويل ${relPath}:`, err.message);
      return relPath; // فشل التحويل؟ سيب المسار الأصلي زي ما هو، متكسرش حاجة
    }
  }
  return relWebp;
}

async function processProduct(p) {
  if (p.image) {
    const original = p.image;
    const webp = await toWebp(original);
    if (webp !== original) {
      p.ogImage = original; // للمعاينة على واتساب/فيسبوك بس
      p.image = webp;       // للعرض الفعلي في الموقع
    }
  }
  if (Array.isArray(p.images)) {
    p.images = await Promise.all(p.images.map(toWebp));
  }
}

(async () => {
  if (!fs.existsSync(PRODUCTS_JSON)) {
    console.log("مفيش data/products.json — شغّل build-index.js الأول. متخطي التحويل.");
    return;
  }
  const data = JSON.parse(fs.readFileSync(PRODUCTS_JSON, "utf8"));
  const categories = data.categories || [];
  for (const cat of categories) {
    for (const p of cat.products || []) {
      await processProduct(p);
    }
  }
  // بعض بنيات المشروع بتحتفظ كمان بمصفوفة products مسطحة على المستوى الأعلى
  if (Array.isArray(data.products)) {
    for (const p of data.products) {
      await processProduct(p);
    }
  }
  fs.writeFileSync(PRODUCTS_JSON, JSON.stringify(data, null, 2));
  console.log("تم تحويل صور المنتجات إلى WebP وتحديث data/products.json.");
})();
