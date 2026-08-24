#!/usr/bin/env node
/**
 * بيبني sitemap.xml في جذر الموقع تلقائيًا من data/products.json + data/config.json،
 * بالإضافة لاكتشاف تلقائي لأي صفحة .html موجودة في جذر الموقع (زي cart.html،
 * account.html، terms.html، أو أي صفحة جديدة تتضاف مستقبلاً) من غير الحاجة لإضافتها
 * يدويًا في السكريبت في كل مرة.
 *
 * بيحتوي على: الصفحة الرئيسية، كل صفحة .html في جذر الموقع، صفحة كل منتج (رابط
 * /p/<category>/<slug>/ الثابت اللي بيبنيه build-share-pages.js)، وصفحة كل
 * تصنيف (products.html?cat=...).
 *
 * محرك البحث (جوجل) بيستخدم الملف ده عشان يعرف كل روابط الموقع من غير ما يستنى
 * يلاقيها بنفسه بالزحف العادي. لازم يتحدث تلقائي مع كل نشر زي باقي السكريبتات،
 * فبيتشغل جوه npm run build بعد build-index.js (عشان يكون عنده أحدث قائمة منتجات).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PRODUCTS_JSON = path.join(ROOT, "data", "products.json");
const CONFIG_JSON = path.join(ROOT, "data", "config.json");
const OUT_FILE = path.join(ROOT, "sitemap.xml");

// صفحات مستثناة من خريطة الموقع رغم وجودها كـ .html في الجذر: ملفات تحقق ملكية
// (Google Search Console وغيرها) ومستندات داخلية مش مخصصة للزيارة العادية.
const EXCLUDED_PAGES = new Set(["index.html"]);
function isExcludedPage(filename) {
  if (EXCLUDED_PAGES.has(filename)) return true;
  // ملفات تحقق ملكية جوجل بالشكل googleXXXXXXXXXXXXXXXX.html
  if (/^google[a-f0-9]+\.html$/i.test(filename)) return true;
  return false;
}

// أولوية وتكرار تحديث مخصصين لصفحات معروفة، وأي صفحة تانية بتاخد قيمة افتراضية
// معقولة تلقائيًا من غير ما تحتاج تعديل السكريبت.
const PAGE_OVERRIDES = {
  "products.html": { changefreq: "daily", priority: "0.9" },
  "cart.html": { changefreq: "monthly", priority: "0.5" },
  "account.html": { changefreq: "monthly", priority: "0.5" },
  "terms.html": { changefreq: "monthly", priority: "0.4" },
};
const DEFAULT_PAGE = { changefreq: "monthly", priority: "0.5" };

function encodePath(id) {
  return id.split("/").map(encodeURIComponent).join("/");
}

function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function discoverRootPages() {
  return fs
    .readdirSync(ROOT)
    .filter((name) => name.toLowerCase().endsWith(".html"))
    .filter((name) => !isExcludedPage(name))
    .sort();
}

function build() {
  if (!fs.existsSync(PRODUCTS_JSON)) {
    console.error("مفيش data/products.json — شغّل npm run build الأول (build-index.js).");
    process.exit(1);
  }
  const { categories, products, generatedAt } = JSON.parse(
    fs.readFileSync(PRODUCTS_JSON, "utf8")
  );
  const config = fs.existsSync(CONFIG_JSON)
    ? JSON.parse(fs.readFileSync(CONFIG_JSON, "utf8"))
    : {};

  let siteUrl = (config.siteUrl || "").trim().replace(/\/+$/, "");
  if (!siteUrl) {
    console.warn(
      "⚠ مفيش siteUrl في data/config.json — sitemap.xml مش هيتبني (لازم روابط مطلقة كاملة)."
    );
    return;
  }

  const today = isoDate(generatedAt || Date.now());
  const urls = [];

  urls.push({ loc: `${siteUrl}/`, changefreq: "daily", priority: "1.0", lastmod: today });

  for (const page of discoverRootPages()) {
    const overrides = PAGE_OVERRIDES[page] || DEFAULT_PAGE;
    urls.push({
      loc: `${siteUrl}/${page}`,
      changefreq: overrides.changefreq,
      priority: overrides.priority,
      lastmod: today,
    });
  }

  for (const cat of categories || []) {
    urls.push({
      loc: `${siteUrl}/products.html?cat=${encodeURIComponent(cat.slug)}`,
      changefreq: "weekly",
      priority: "0.7",
      lastmod: today,
    });
  }

  for (const p of products || []) {
    urls.push({
      loc: `${siteUrl}/p/${encodePath(p.id)}/`,
      changefreq: "weekly",
      priority: "0.8",
      lastmod: today,
    });
  }

  const body = urls
    .map(
      (u) =>
        `  <url>\n` +
        `    <loc>${u.loc}</loc>\n` +
        `    <lastmod>${u.lastmod}</lastmod>\n` +
        `    <changefreq>${u.changefreq}</changefreq>\n` +
        `    <priority>${u.priority}</priority>\n` +
        `  </url>`
    )
    .join("\n");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

  fs.writeFileSync(OUT_FILE, xml, "utf8");
  console.log(`✔ تم بناء sitemap.xml بـ ${urls.length} رابط`);
}

build();
