#!/usr/bin/env node
/**
 * بيربط اسم الموقع الظاهر في meta tags الصفحات الثابتة (index.html و products.html)
 * بـ "siteName" في data/config.json — نفس الحقل اللي برنامج الأدمن (Dart) بيعدّله
 * من شاشة "إعدادات الموقع". يعني تغيير الاسم من البرنامج بيوصل تلقائي هنا كمان
 * من غير ما تفتح أو تلمس كود الصفحات يدويًا أبدًا.
 *
 * ليه محتاجين السكريبت ده أصلًا؟ الاسم اللي بيظهر فعليًا في الصفحة (الشعار، الفوتر)
 * بيتحدّث لايف من JS (shared.js) بعد ما الصفحة تفتح. لكن meta tags زي <title> و
 * og:title و og:site_name بتتقرا من برامج معاينة اللينكات (واتساب، فيسبوك...) اللي
 * مبتشغلش JS خالص، فلازم تبقى مكتوبة صح جوه ملف الـ HTML نفسه من الأول.
 *
 * السكريبت ده بيدور على مكان الاسم بالبنية (attribute/tag) مش بالنص الحرفي "Tota"،
 * فبيشتغل صح مهما اتغيّر الاسم قبل كده وأي عدد مرات (idempotent) — زي بالظبط
 * build-share-pages.js بيعمل مع صفحات المنتجات.
 *
 * بيتشغّل تلقائي مع كل نشر (جوه npm run build)، فمفيش أي حاجة إضافية مطلوبة
 * من برنامج الأدمن.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CONFIG_JSON = path.join(ROOT, "data", "config.json");
const TARGET_FILES = ["index.html", "products.html"];

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function build() {
  if (!fs.existsSync(CONFIG_JSON)) {
    console.warn("⚠ مفيش data/config.json — هسيب أسماء الصفحات زي ما هي.");
    return;
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_JSON, "utf8"));
  const rawSiteName = config.siteName || "Tota";
  const siteName = escapeHtml(rawSiteName);

  for (const file of TARGET_FILES) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) continue;
    let html = fs.readFileSync(filePath, "utf8");

    // <meta property="og:site_name" content="...">
    html = html.replace(
      /(<meta property="og:site_name" content=")[^"]*(">)/,
      `$1${siteName}$2`
    );

    if (file === "index.html") {
      // <title>اسم الموقع | اكتشف مجموعتنا</title>
      html = html.replace(
        /(<title>)[^<|]*( \| اكتشف مجموعتنا<\/title>)/,
        `$1${siteName}$2`
      );
      // og:title / twitter:title بنفس الصيغة "اسم الموقع | اكتشف مجموعتنا"
      html = html.replace(
        /(<meta property="og:title" content=")[^"]*( \| اكتشف مجموعتنا">)/,
        `$1${siteName}$2`
      );
      html = html.replace(
        /(<meta name="twitter:title" content=")[^"]*( \| اكتشف مجموعتنا">)/,
        `$1${siteName}$2`
      );
    } else if (file === "products.html") {
      // <title>المنتجات | اسم الموقع</title>
      html = html.replace(
        /(<title>المنتجات \| )[^<]*(<\/title>)/,
        `$1${siteName}$2`
      );
      html = html.replace(
        /(<meta property="og:title" content="المنتجات \| )[^"]*(">)/,
        `$1${siteName}$2`
      );
      html = html.replace(
        /(<meta name="twitter:title" content="المنتجات \| )[^"]*(">)/,
        `$1${siteName}$2`
      );
    }

    // كل <span data-site-name>...</span> (الشعار في الهيدر والفوتر وحقوق النشر)
    html = html.replace(
      /(<span data-site-name>)[^<]*(<\/span>)/g,
      `$1${siteName}$2`
    );

    fs.writeFileSync(filePath, html, "utf8");
  }

  console.log(`✔ اسم الموقع "${rawSiteName}" اتربط بالـ meta tags في index.html و products.html`);
}

build();
