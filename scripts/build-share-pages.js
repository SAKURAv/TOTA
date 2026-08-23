#!/usr/bin/env node
/**
 * بيبني صفحة HTML ثابتة صغيرة لكل منتج جوه فولدر /p/<category>/<product>/index.html
 * فيها Open Graph meta tags (اسم + صورة + وصف المنتج) عشان لما حد ينسخ لينك المنتج
 * على واتساب/فيسبوك/تويتر تظهر معاينة صحيحة بصورة واسم المنتج نفسه.
 *
 * الصفحة دي مالهاش أي شكل ظاهر للمستخدم — أول ما تتفتح في متصفح حقيقي بتحوّل فورًا
 * لصفحة المنتج الحقيقية (products.html?p=...) اللي فيها كل التفاعل والتصميم العادي.
 * برامج معاينة اللينكات (WhatsApp إلخ) مبتشغلش جافاسكريبت، فبتقرا الـ meta tags بس
 * وتوقف هناك — يعني مفيش أي تأثير على شكل أو أداء الموقع الأساسي أو الـ SPA نفسها.
 *
 * البناء ده بيحصل تلقائي مع كل نشر (ضمن npm run build في GitHub Actions)،
 * فمفيش أي حاجة إضافية مطلوبة من برنامج الأدمن (Dart) — هو بيفضل يعدّل بيانات
 * المنتجات زي ما هو من غير أي تغيير.
 */
const fs = require("fs");
const path = require("path");
const { getImageSize } = require("./lib/image-size");

const ROOT = path.join(__dirname, "..");
const PRODUCTS_JSON = path.join(ROOT, "data", "products.json");
const CONFIG_JSON = path.join(ROOT, "data", "config.json");
const OUT_DIR = path.join(ROOT, "p");
// الصيغ دي بس اللي واتساب/فيسبوك مضمون يعرضوها كصورة معاينة (og:image).
// SVG مش بيتعرض خالص كمعاينة، وWebP/AVIF مش مدعومين على كل نسخ واتساب،
// فلو صورة المنتج مش من الصيغ المضمونة دي، بنستخدم لوجو الموقع بدالها.
const SAFE_OG_IMAGE_EXT = [".jpg", ".jpeg", ".png"];
const FALLBACK_OG_IMAGE = "assets/img/og-image.jpg";
const MAX_DESC_LENGTH = 200;

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// بتشفّر كل جزء من المسار لوحده (مش الـ "/" الفاصلة بينهم) عشان أي سلاج
// فيه مسافة أو حرف عربي (لو حصل بالغلط من غير ما يتراجع في برنامج الأدمن)
// ميبوظش شكل اللينك.
function encodePath(id) {
  return id.split("/").map(encodeURIComponent).join("/");
}

function truncate(str, max) {
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trimEnd() + "…";
}

function build() {
  if (!fs.existsSync(PRODUCTS_JSON)) {
    console.error("مفيش data/products.json — شغّل npm run build الأول (build-index.js).");
    process.exit(1);
  }
  const { products } = JSON.parse(fs.readFileSync(PRODUCTS_JSON, "utf8"));
  const config = fs.existsSync(CONFIG_JSON)
    ? JSON.parse(fs.readFileSync(CONFIG_JSON, "utf8"))
    : {};

  const siteName = config.siteName || "المتجر";
  const cloudflareToken = ((config.analytics && config.analytics.cloudflareToken) || "").trim();
  let siteUrl = (config.siteUrl || "").trim().replace(/\/+$/, "");

  if (!siteUrl) {
    console.warn(
      "⚠ مفيش siteUrl في data/config.json — هبني اللينكات بروابط نسبية وده هيبوظ المعاينة على واتساب.\n" +
      "  ضيف مثلاً: \"siteUrl\": \"https://username.github.io/repo-name\" في config.json وابني تاني."
    );
  }
  const absBase = siteUrl ? `${siteUrl}/` : "";

  // لوجو الموقع الاحتياطي: لو config.logo متظبط (سلوت مستقبلي لبرنامج الأدمن)
  // بنستخدمه، وإلا بنرجع لمسار assets/img/og-image.jpg الثابت زي ما هو من الأول.
  const configLogo = (config.logo || "").trim();
  const isRemoteLogo = /^https?:\/\//i.test(configLogo);
  const logoRelPath = configLogo && !isRemoteLogo ? configLogo : FALLBACK_OG_IMAGE;
  const logoAbsUrl = configLogo && isRemoteLogo ? configLogo : `${absBase}${logoRelPath}`;
  const logoLocalPath = path.join(ROOT, logoRelPath);
  const hasLogo = isRemoteLogo || fs.existsSync(logoLocalPath);
  // بنحسب أبعاد اللوجو مرة واحدة بس (بيتكرر استخدامه في كل منتج مالوش صورة مضمونة)
  const logoDims = !isRemoteLogo && hasLogo ? getImageSize(logoLocalPath) : null;

  // نضف القديم عشان منتج اتمسح ميفضلش ليه صفحة ميتة
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let count = 0;
  let skippedImages = 0;
  for (const p of products) {
    const pageUrl = `${absBase}p/${encodePath(p.id)}/`;
    const targetUrl = `${absBase}products.html?p=${encodeURIComponent(p.id)}`;

    const rawImage = p.ogImage || p.image || "assets/img/placeholder.svg";
    const imageExt = path.extname(rawImage).toLowerCase();
    let imageUrl;
    let imageDims = null;
    if (SAFE_OG_IMAGE_EXT.includes(imageExt)) {
      imageUrl = `${absBase}${rawImage}`;
      imageDims = getImageSize(path.join(ROOT, rawImage));
    } else if (hasLogo) {
      imageUrl = logoAbsUrl;
      imageDims = logoDims;
      skippedImages++;
    } else {
      // مفيش لوجو احتياطي لسه — أحسن نبعت الصورة الأصلية بدل مفيش صورة خالص،
      // حتى لو مش مضمونة تظهر في كل تطبيقات المعاينة.
      imageUrl = `${absBase}${rawImage}`;
      skippedImages++;
    }

    const title = p.name || siteName;
    const priceText =
      p.price != null ? ` — ${p.price.toLocaleString("ar-EG")} ${p.currency || ""}`.trim() : "";
    const description = truncate((p.description || `تفاصيل ${title}`) + priceText, MAX_DESC_LENGTH);

    const dir = path.join(OUT_DIR, p.id);
    fs.mkdirSync(dir, { recursive: true });

    // بنحمّل بيكون Cloudflare Web Analytics على صفحة التحويل نفسها (اللي
    // عنوانها /p/<تصنيف>/<منتج>/) قبل ما نحوّل المستخدم فورًا لصفحة المنتج
    // الحقيقية. الفايدة إن Cloudflare هيسجّل زيارة حقيقية على نفس المسار
    // النضيف ده، فتقدر تشوف عدد فتحات كل منتج (من رابط مشاركة أو من جوه
    // الموقع نفسه) مجمّعة صح تحت نفس المسار في تبويب "Top Paths".
    // (على عكس GoatCounter، Cloudflare مبيديش إمكانية تسجيل Event منفصل
    // بمسار وهمي زي /share-click/...، فمفيش تمييز دقيق هنا بين زيارة
    // جايه من واتساب تحديدًا وزيارة عادية لنفس الصفحة — لو عايز تعرف
    // مصدر الزيارة استخدم تبويب "Top Referrers" في Cloudflare بدل كده.)
    const trackingScript = cloudflareToken
      ? `<script type="module" defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=${JSON.stringify(
          JSON.stringify({ token: cloudflareToken })
        )}></script>\n`
      : "";

    // تليجرام (على عكس واتساب) بيميل يتجاهل og:image من غير أبعاد صريحة،
    // فبنكتبها لما تكون معروفة (JPG/PNG محلي قدرنا نقرا أبعاده).
    const imageMetaLines = imageDims
      ? `<meta property="og:image:width" content="${imageDims.width}">
<meta property="og:image:height" content="${imageDims.height}">
<meta property="og:image:type" content="${imageDims.type}">`
      : "";

    // بيانات منظّمة (JSON-LD) بصيغة Product عشان جوجل يقدر يعرض السعر والتوفر
    // جنب رابط المنتج في نتائج البحث (Rich Results). بنكتبها هنا (مش في
    // products.html اللي هو SPA) لأن الصفحة دي ثابتة وجوجل بيقدر يقراها
    // فورًا من غير ما يشغّل جافاسكريبت.
    const availability =
      p.available === false
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock";
    const productJsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: title,
      description: p.description || title,
      image: imageUrl,
      url: pageUrl,
      ...(p.category ? { category: p.categoryName || p.category } : {}),
      offers: {
        "@type": "Offer",
        url: pageUrl,
        priceCurrency: p.currency || "EGP",
        price: p.price != null ? String(p.price) : undefined,
        availability,
        itemCondition: "https://schema.org/NewCondition",
      },
    };
    if (productJsonLd.offers.price === undefined) delete productJsonLd.offers.price;

    const breadcrumbJsonLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: siteName, item: absBase || siteUrl },
        {
          "@type": "ListItem",
          position: 2,
          name: p.categoryName || p.category,
          item: `${absBase}products.html?cat=${encodeURIComponent(p.category)}`,
        },
        { "@type": "ListItem", position: 3, name: title, item: pageUrl },
      ],
    };

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} | ${escapeHtml(siteName)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index, follow">

<meta property="og:type" content="product">
<meta property="og:site_name" content="${escapeHtml(siteName)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(imageUrl)}">
<meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}">
${imageMetaLines}
<meta property="og:url" content="${escapeHtml(pageUrl)}">
${p.price != null ? `<meta property="product:price:amount" content="${escapeHtml(String(p.price))}">\n<meta property="product:price:currency" content="${escapeHtml(p.currency || "EGP")}">\n` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(imageUrl)}">

<link rel="canonical" href="${escapeHtml(pageUrl)}">
<script type="application/ld+json">${JSON.stringify(productJsonLd)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbJsonLd)}</script>
${trackingScript}<script>location.replace(${JSON.stringify(targetUrl)});</script>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
<p>تحويل لصفحة <a href="${escapeHtml(targetUrl)}">${escapeHtml(title)}</a>...</p>
</body>
</html>
`;
    fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
    count++;
  }

  console.log(`✔ تم بناء ${count} صفحة معاينة جوه /p`);
  if (skippedImages) {
    console.warn(
      `⚠ ${skippedImages} منتج صورته مش JPG/PNG (SVG أو WebP أو AVIF) — واتساب ممكن ميعرضش المعاينة صح.\n` +
      (hasLogo
        ? "  استخدمنا لوجو الموقع بدالها."
        : "  ضيف صورة لوجو في assets/img/og-image.jpg عشان تتستخدم كبديل تلقائي.")
    );
  }
}

build();
