#!/usr/bin/env node
/**
 * بيبني sitemap.xml في جذر الموقع تلقائيًا من data/products.json + data/config.json.
 * بيحتوي على: الصفحة الرئيسية، صفحة المنتجات، صفحة كل منتج (رابط /p/<category>/<slug>/
 * الثابت اللي بيبنيه build-share-pages.js)، وصفحة كل تصنيف (products.html?cat=...).
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

function encodePath(id) {
  return id.split("/").map(encodeURIComponent).join("/");
}

function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10);
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
  urls.push({
    loc: `${siteUrl}/products.html`,
    changefreq: "daily",
    priority: "0.9",
    lastmod: today,
  });

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
