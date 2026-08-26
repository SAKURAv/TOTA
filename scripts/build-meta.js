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
const { buildKeywords, BRAND_SPELLING_VARIANTS } = require("./lib/seo-keywords");

const ROOT = path.join(__dirname, "..");
const CONFIG_JSON = path.join(ROOT, "data", "config.json");
const TARGET_FILES = ["index.html", "products.html"];
// الصفحات دي مالهاش meta tags للمشاركة (og:title..إلخ) لكن لازم تاخد نفس
// أيقونة تبويب المتصفح (favicon) بتاعة باقي الموقع، فبنعدّل عليها الـ
// <link rel="icon"> بس من غير باقي meta tags.
const FAVICON_ONLY_FILES = ["account.html", "cart.html", "terms.html"];
const FALLBACK_OG_IMAGE = "assets/img/og-image.jpg";
// أيقونة تبويب المتصفح / جوجل ليها ملف احتياطي منفصل تمامًا عن صورة
// معاينة اللينكات (og-image.jpg)، عشان رفع لوجو من برنامج الأدمن يأثر
// بس على الفافيكون، ومايبوظش صورة المعاينة ولا العكس.
const FALLBACK_SITE_LOGO = "assets/img/site-logo.jpg";

function mimeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".ico") return "image/x-icon";
  return "image/jpeg";
}

// بتحدّث <link rel="icon"> و "shortcut icon"> (أيقونة تبويب المتصفح) بس،
// عشان يبقوا مشيرين للوجو اللي البرنامج (الأدمن) رفعه، بدل الصورة
// الافتراضية site-logo.jpg. لو مفيش لوجو مرفوع، بترجع لـ site-logo.jpg
// الثابت — الفافيكون منفصل تمامًا عن og-image.jpg.
//
// ⚠️ apple-touch-icon اتشال عمدًا من هنا (كان ده سبب مشاكل الأيقونة وقت
// التثبيت/Add to Home Screen): كان بيتكتب فوق بنفس اللوجو الخام
// (faviconRelPath) في كل نشر، فبيمسح قيمة icons/icon-apple-touch.png
// اللي generate-icons.py بيولّدها خصيصًا بمقاس 180×180 وهامش أمان مناسب
// لآيفون. apple-touch-icon المفروض يفضل ثابت على الملف المولّد ده دايمًا
// (مكتوب أصلاً صح في كل صفحة)، ومايتلمسش هنا خالص.
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

  // فافيكون (تبويب المتصفح + جوجل): لو البرنامج رفع لوجو (config.logo)
  // بنستخدمه، وإلا بنرجع لـ site-logo.jpg الثابت — مش og-image.jpg.
  const faviconRelPath = configLogo && !isRemoteLogo ? configLogo : FALLBACK_SITE_LOGO;
  const faviconAbsUrl = configLogo && isRemoteLogo ? configLogo : `${absBase}${faviconRelPath}`;

  // og:image / twitter:image (معاينة اللينكات): دايمًا og-image.jpg الثابت،
  // ومش بيتأثر بلوجو البرنامج خالص — ده منفصل عن الفافيكون.
  const ogImageRelPath = FALLBACK_OG_IMAGE;
  const ogImageAbsUrl = `${absBase}${ogImageRelPath}`;
  const ogImageLocalPath = path.join(ROOT, ogImageRelPath);
  const ogImageDims = fs.existsSync(ogImageLocalPath) ? getImageSize(ogImageLocalPath) : null;

  for (const file of TARGET_FILES) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) continue;
    let html = fs.readFileSync(filePath, "utf8");

    // أيقونة تبويب المتصفح (favicon): بتاخد نفس لوجو الموقع اللي بيتظبط من
    // برنامج الأدمن (config.logo)، وبترجع لـ site-logo.jpg الافتراضي لو
    // مفيش لوجو مرفوع لسه. منفصل تمامًا عن og:image.
    html = applyFavicon(html, faviconAbsUrl);

    // <meta name="keywords">: خليط من اسم الموقع بكل أشكال كتابته المحتملة
    // (عربي/إنجليزي) + كلمات عامة عن "متجر/ستور/تسوق أونلاين" — عشان يغطي
    // أكبر عدد من عمليات البحث المرتبطة بالموقع.
    const pageKeywords =
      file === "products.html"
        ? buildKeywords(rawSiteName, ["منتجات " + rawSiteName, "products " + rawSiteName])
        : buildKeywords(rawSiteName);
    html = html.replace(
      /(<meta name="keywords" content=")[^"]*(">)/,
      `$1${escapeHtml(pageKeywords)}$2`
    );
    html = html.replace(
      /(<meta name="author" content=")[^"]*(">)/,
      `$1${siteName}$2`
    );

    // <meta property="og:site_name" content="...">
    html = html.replace(
      /(<meta property="og:site_name" content=")[^"]*(">)/,
      `$1${siteName}$2`
    );

    // og:image / twitter:image: دايمًا assets/img/og-image.jpg الثابت،
    // بغض النظر عن لوجو البرنامج — عشان معاينة اللينكات (واتساب/فيسبوك)
    // تفضل ثابتة على صورة og-image المخصصة للمشاركة.
    html = html.replace(
      /(<meta property="og:image" content=")[^"]*(">)/,
      `$1${escapeHtml(ogImageAbsUrl)}$2`
    );
    html = html.replace(
      /(<meta name="twitter:image" content=")[^"]*(">)/,
      `$1${escapeHtml(ogImageAbsUrl)}$2`
    );

    // بنشيل أي og:image:width/height/type قديمة مكتوبة إيدويًا، وبعدين
    // بنضيفها تاني (لو الأبعاد معروفة) جنب og:image مباشرة — تليجرام محتاجها
    // عشان يعرض المعاينة بثقة.
    html = html.replace(
      /\n<meta property="og:image:(?:width|height|type)" content="[^"]*">/g,
      ""
    );
    if (ogImageDims) {
      html = html.replace(
        /(<meta property="og:image" content="[^"]*">)/,
        `$1\n<meta property="og:image:width" content="${ogImageDims.width}">\n<meta property="og:image:height" content="${ogImageDims.height}">\n<meta property="og:image:type" content="${ogImageDims.type}">`
      );
    }

    if (file === "index.html") {
      // بيانات منظّمة (JSON-LD) — بنعيد بناء الـ OnlineStore والـ WebSite
      // بالكامل في كل مرة (idempotent) عشان تفضل متزامنة مع siteName/logo/
      // socials من config.json، وتشمل alternateName بكل أشكال كتابة اسم
      // الموقع المحتملة عشان تساعد جوجل يربطها كلها بنفس الكيان.
      const alternateNames = BRAND_SPELLING_VARIANTS.filter(
        (v) => v.toLowerCase() !== rawSiteName.toLowerCase()
      );
      const sameAs = Object.values(config.socials || {}).filter(
        (v) => typeof v === "string" && /^https?:\/\//i.test(v)
      );
      const orgLd = {
        "@context": "https://schema.org",
        "@type": "OnlineStore",
        name: rawSiteName,
        alternateName: alternateNames,
        url: absBase || siteUrl,
        image: ogImageAbsUrl,
        description: config.description || "وجهتك المختارة لأفضل المنتجات، بجودة وثقة، وتواصل مباشر.",
        sameAs,
      };
      const websiteLd = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: rawSiteName,
        alternateName: alternateNames,
        url: absBase || siteUrl,
        potentialAction: {
          "@type": "SearchAction",
          target: `${absBase}products.html?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      };
      html = html.replace(
        /<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@type":"OnlineStore".*?<\/script>/,
        `<script type="application/ld+json">${JSON.stringify(orgLd)}</script>`
      );
      html = html.replace(
        /<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@type":"WebSite".*?<\/script>/,
        `<script type="application/ld+json">${JSON.stringify(websiteLd)}</script>`
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
    html = applyFavicon(html, faviconAbsUrl);
    fs.writeFileSync(filePath, html, "utf8");
  }

  console.log(`✔ اسم الموقع "${rawSiteName}" اتربط بالـ meta tags، والفافيكون اتربط بلوجو الموقع`);
}

build();
