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
const { getImageSize } = require("./lib/image-size");

const ROOT = path.join(__dirname, "..");
const CONFIG_JSON = path.join(ROOT, "data", "config.json");
const TARGET_FILES = ["index.html", "products.html"];
// الصفحات دي مالهاش meta tags للمشاركة (og:title..إلخ) لكن لازم تاخد نفس
// أيقونة تبويب المتصفح (favicon) بتاعة باقي الموقع، فبنعدّل عليها الـ
// <link rel="icon"> بس من غير باقي meta tags.
const FAVICON_ONLY_FILES = ["account.html", "cart.html"];
const FALLBACK_OG_IMAGE = "assets/img/og-image.jpg";

function mimeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".ico") return "image/x-icon";
  return "image/jpeg";
}

// بتحدّث كل <link rel="icon"|"shortcut icon"|"apple-touch-icon"> في ملف
// HTML واحد عشان يبقوا مشيرين للوجو اللي البرنامج (الأدمن) رفعه، بدل
// الصورة الافتراضية og-image.jpg. لو مفيش لوجو مرفوع، بتسيبهم زي ما هم
// (يعني على og-image.jpg الافتراضي).
function applyFavicon(html, faviconRelPath) {
  const mime = mimeFromExt(faviconRelPath);
  html = html.replace(
    /(<link rel="icon" href=")[^"]*("[^>]*>)/,
    `$1${faviconRelPath}$2`
  );
  html = html.replace(
    /(<link rel="icon" href="[^"]*" type=")[^"]*(">)/,
    `$1${mime}$2`
  );
  html = html.replace(
    /(<link rel="shortcut icon" href=")[^"]*("[^>]*>)/,
    `$1${faviconRelPath}$2`
  );
  html = html.replace(
    /(<link rel="shortcut icon" href="[^"]*" type=")[^"]*(">)/,
    `$1${mime}$2`
  );
  html = html.replace(
    /(<link rel="apple-touch-icon" href=")[^"]*(">)/,
    `$1${faviconRelPath}$2`
  );
  return html;
}

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

  const siteUrl = (config.siteUrl || "").trim().replace(/\/+$/, "");
  const absBase = siteUrl ? `${siteUrl}/` : "";
  const configLogo = (config.logo || "").trim();
  const isRemoteLogo = /^https?:\/\//i.test(configLogo);
  const logoRelPath = configLogo && !isRemoteLogo ? configLogo : FALLBACK_OG_IMAGE;
  const logoAbsUrl = configLogo && isRemoteLogo ? configLogo : `${absBase}${logoRelPath}`;
  const logoLocalPath = path.join(ROOT, logoRelPath);
  const logoDims = !isRemoteLogo && fs.existsSync(logoLocalPath) ? getImageSize(logoLocalPath) : null;

  for (const file of TARGET_FILES) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) continue;
    let html = fs.readFileSync(filePath, "utf8");

    // أيقونة تبويب المتصفح (favicon): بتاخد نفس لوجو الموقع اللي بيتظبط من
    // برنامج الأدمن (config.logo)، وبترجع لـ og-image.jpg الافتراضي لو
    // مفيش لوجو مرفوع لسه.
    html = applyFavicon(html, logoAbsUrl);

    // <meta property="og:site_name" content="...">
    html = html.replace(
      /(<meta property="og:site_name" content=")[^"]*(">)/,
      `$1${siteName}$2`
    );

    // og:image / twitter:image: بيتظبط على اللوجو (سلوت config.logo لو متظبط،
    // وإلا assets/img/og-image.jpg الافتراضي) — عشان أي لينك غير لينكات
    // المنتجات (الصفحة الرئيسية، صفحة المنتجات) يظهر بمعاينة لوجو الموقع.
    html = html.replace(
      /(<meta property="og:image" content=")[^"]*(">)/,
      `$1${escapeHtml(logoAbsUrl)}$2`
    );
    html = html.replace(
      /(<meta name="twitter:image" content=")[^"]*(">)/,
      `$1${escapeHtml(logoAbsUrl)}$2`
    );

    // بنشيل أي og:image:width/height/type قديمة مكتوبة إيدويًا، وبعدين
    // بنضيفها تاني (لو الأبعاد معروفة) جنب og:image مباشرة — تليجرام محتاجها
    // عشان يعرض المعاينة بثقة.
    html = html.replace(
      /\n<meta property="og:image:(?:width|height|type)" content="[^"]*">/g,
      ""
    );
    if (logoDims) {
      html = html.replace(
        /(<meta property="og:image" content="[^"]*">)/,
        `$1\n<meta property="og:image:width" content="${logoDims.width}">\n<meta property="og:image:height" content="${logoDims.height}">\n<meta property="og:image:type" content="${logoDims.type}">`
      );
    }

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

    // og:url: كان بيفضل مكتوب بالدومين القديم لو siteUrl اتغيّر (المشكلة
    // اللي ظهرت لما انتقلنا من GitHub Pages لـ Cloudflare) — بنبنيه دلوقتي
    // من siteUrl + اسم الملف نفسه، بنفس المنطق المستخدم في build-share-pages.js
    if (absBase) {
      html = html.replace(
        /(<meta property="og:url" content=")[^"]*(">)/,
        `$1${escapeHtml(absBase + file)}$2`
      );
    }

    fs.writeFileSync(filePath, html, "utf8");
  }

  for (const file of FAVICON_ONLY_FILES) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) continue;
    let html = fs.readFileSync(filePath, "utf8");
    html = applyFavicon(html, logoAbsUrl);
    fs.writeFileSync(filePath, html, "utf8");
  }

  console.log(`✔ اسم الموقع "${rawSiteName}" اتربط بالـ meta tags، والفافيكون اتربط بلوجو الموقع`);
}

build();
