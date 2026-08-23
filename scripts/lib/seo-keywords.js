/**
 * كلمات مفتاحية عامة (بالعربي والإنجليزي) بتتضاف لكل صفحات الموقع عشان
 * جوجل يقدر يوصّل الموقع لأكبر عدد ممكن من عمليات البحث المرتبطة —
 * سواء حد بحث باسم الموقع بأي شكل من أشكال كتابته (توتة/توته/توتا/تاتا/
 * Tota) أو بحث عام عن "متجر"/"ستور"/"تسوق أونلاين"/"منتجات" وما شابه.
 *
 * الملف ده مستخدم من build-meta.js (الصفحة الرئيسية وصفحة المنتجات)
 * ومن build-share-pages.js (صفحة كل منتج لوحده)، عشان أي تحديث هنا
 * يوصل للموقع كله تلقائيًا مع كل نشر.
 */

// أشكال كتابة اسم الموقع اللي محتمل حد يدور بيها (تهجئات شائعة/أخطاء
// إملائية متوقعة) — بيتضافوا لأي اسم موقع متظبط من برنامج الأدمن.
const BRAND_SPELLING_VARIANTS = [
  "توتة",
  "توته",
  "توتا",
  "تاتا",
  "Tota",
  "Toota",
  "Totta",
];

// كلمات عامة عن "متجر/تسوق" بالعربي والإنجليزي، مفيدة لأي متجر إلكتروني
// بغض النظر عن التصنيفات اللي بيبيعها بالظبط.
const GENERIC_STORE_TERMS_AR = [
  "متجر",
  "متجر اونلاين",
  "متجر أونلاين",
  "ستور",
  "اونلاين ستور",
  "تسوق اونلاين",
  "تسوق اون لاين",
  "شوبينج",
  "اونلاين شوبينج",
  "منتجات",
  "أفضل المنتجات",
  "عروض",
  "خصومات",
  "توصيل سريع",
  "شحن لكل مصر",
  "اسعار مناسبة",
];

const GENERIC_STORE_TERMS_EN = [
  "store",
  "shop",
  "online store",
  "online shop",
  "online shopping",
  "shop online",
  "ecommerce",
  "best products",
  "best prices",
  "fast delivery",
  "deals",
  "discounts",
];

/**
 * بيبني قائمة كلمات مفتاحية (String واحد مفصول بفواصل) لصفحة معيّنة.
 * @param {string} siteName - اسم الموقع الحالي (من config.json)
 * @param {string[]} extra - كلمات إضافية خاصة بالصفحة (اسم منتج، تصنيف، إلخ)
 */
function buildKeywords(siteName, extra = []) {
  const name = (siteName || "").trim();
  const brandTerms = [
    name,
    ...BRAND_SPELLING_VARIANTS.filter(
      (v) => v.toLowerCase() !== name.toLowerCase()
    ),
  ].filter(Boolean);

  // كل شكل من أشكال الاسم مقرون بكلمة "متجر"/"ستور"/"store"/"shop" —
  // عشان يغطي عمليات بحث زي "متجر توتة" أو "Tota store" مباشرة.
  const brandedCombos = [];
  for (const b of brandTerms) {
    brandedCombos.push(`متجر ${b}`, `ستور ${b}`, `${b} store`, `${b} shop`);
  }

  const all = [
    ...brandTerms,
    ...brandedCombos,
    ...GENERIC_STORE_TERMS_AR,
    ...GENERIC_STORE_TERMS_EN,
    ...extra,
  ]
    .map((s) => (s || "").trim())
    .filter(Boolean);

  // إزالة التكرار (case-insensitive) مع الحفاظ على أول ظهور
  const seen = new Set();
  const unique = [];
  for (const term of all) {
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(term);
  }
  return unique.join(", ");
}

module.exports = { buildKeywords, BRAND_SPELLING_VARIANTS };
