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

const ROOT = path.join(__dirname, "..");
const PRODUCTS_JSON = path.join(ROOT, "data", "products.json");
const CONFIG_JSON = path.join(ROOT, "data", "config.json");
const OUT_DIR = path.join(ROOT, "p");

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  let siteUrl = (config.siteUrl || "").trim().replace(/\/+$/, "");

  if (!siteUrl) {
    console.warn(
      "⚠ مفيش siteUrl في data/config.json — هبني اللينكات بروابط نسبية وده هيبوظ المعاينة على واتساب.\n" +
      "  ضيف مثلاً: \"siteUrl\": \"https://username.github.io/repo-name\" في config.json وابني تاني."
    );
  }

  // نضف القديم عشان منتج اتمسح ميفضلش ليه صفحة ميتة
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let count = 0;
  for (const p of products) {
    const absBase = siteUrl ? `${siteUrl}/` : "";
    const pageUrl = `${absBase}p/${p.id}/`;
    const targetUrl = `${absBase}products.html?p=${encodeURIComponent(p.id)}`;
    const imageUrl = `${absBase}${p.image || "assets/img/placeholder.svg"}`;
    const title = p.name || siteName;
    const priceText =
      p.price != null ? ` — ${p.price.toLocaleString("ar-EG")} ${p.currency || ""}`.trim() : "";
    const description = (p.description || `تفاصيل ${title}`) + priceText;

    const dir = path.join(OUT_DIR, p.id);
    fs.mkdirSync(dir, { recursive: true });

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)} | ${escapeHtml(siteName)}</title>
<meta name="description" content="${escapeHtml(description)}">

<meta property="og:type" content="product">
<meta property="og:site_name" content="${escapeHtml(siteName)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(imageUrl)}">
<meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}">
<meta property="og:url" content="${escapeHtml(pageUrl)}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(imageUrl)}">

<link rel="canonical" href="${escapeHtml(targetUrl)}">
<meta http-equiv="refresh" content="0; url=${escapeHtml(targetUrl)}">
<script>location.replace(${JSON.stringify(targetUrl)});</script>
</head>
<body>
<p>تحويل لصفحة <a href="${escapeHtml(targetUrl)}">${escapeHtml(title)}</a>...</p>
</body>
</html>
`;
    fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
    count++;
  }

  console.log(`✔ تم بناء ${count} صفحة معاينة جوه /p`);
}

build();
