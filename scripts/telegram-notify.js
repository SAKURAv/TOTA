#!/usr/bin/env node
/**
 * بيقارن المنتجات الحالية (data/products.json) بقائمة آخر المنتجات اللي
 * اتبعتت قبل كده على تليجرام (.telegram/sent.json)، وأي منتج جديد لسه ما
 * اتبعتش بيبعته على جروب/قناة تليجرام (صورة + اسم + سعر + رابط صفحته)،
 * وبعدين بيحدّث ملف القائمة نفسه عشان منبعتش نفس المنتج مرتين.
 *
 * التوكن الخاص بالبوت وid الجروب مبيتحطوش هنا في الكود خالص — بييجوا من
 * متغيرات البيئة (Environment Variables) اللي بتتحط في GitHub Secrets،
 * وworkflow التوقيت (.github/workflows/telegram-notify.yaml) هو اللي بيمررهم
 * للسكريبت ده وقت التشغيل بس، فمحدش يقدر يشوفهم حتى لو الريبو عام بالكامل.
 *
 * الملف ده بيشتغل بشكل منفصل تمامًا عن نشر الموقع (deploy.yaml) — مفيش أي
 * تأثير على بناء أو نشر الموقع نفسه لو السكريبت ده فشل أو اتأخر لأي سبب.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PRODUCTS_JSON = path.join(ROOT, "data", "products.json");
const CONFIG_JSON = path.join(ROOT, "data", "config.json");
const SENT_STATE_FILE = path.join(ROOT, ".telegram", "sent.json");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function fail(msg) {
  console.error("✖ " + msg);
  process.exit(1);
}

function loadSentIds() {
  if (!fs.existsSync(SENT_STATE_FILE)) return new Set();
  try {
    const arr = JSON.parse(fs.readFileSync(SENT_STATE_FILE, "utf8"));
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    console.warn("⚠ ملف .telegram/sent.json تالف — هبدأ بقائمة فاضية.");
    return new Set();
  }
}

function saveSentIds(ids) {
  fs.mkdirSync(path.dirname(SENT_STATE_FILE), { recursive: true });
  fs.writeFileSync(SENT_STATE_FILE, JSON.stringify([...ids].sort(), null, 2) + "\n", "utf8");
}

function encodePath(id) {
  return id.split("/").map(encodeURIComponent).join("/");
}

async function sendProductToTelegram({ botToken, chatId, product, config, repoRawBase }) {
  const priceText =
    product.price != null
      ? `\n💰 ${product.price.toLocaleString("ar-EG")} ${product.currency || ""}`.trim()
      : "";
  const siteUrl = (config.siteUrl || "").trim().replace(/\/+$/, "");
  const link = siteUrl ? `${siteUrl}/p/${encodePath(product.id)}/` : "";
  const caption =
    `🆕 ${product.name}` +
    priceText +
    (product.description ? `\n\n${product.description}` : "") +
    (link ? `\n\n🔗 ${link}` : "");

  const imageRawUrl = product.image ? `${repoRawBase}/${product.image}` : null;

  const body = {
    chat_id: chatId,
    caption: caption.slice(0, 1024), // حد تليجرام الأقصى للتعليق (caption)
  };
  let endpoint;
  if (imageRawUrl) {
    endpoint = `https://api.telegram.org/bot${botToken}/sendPhoto`;
    body.photo = imageRawUrl;
  } else {
    endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;
    body.text = body.caption;
    delete body.caption;
  }
  if (link) {
    body.reply_markup = JSON.stringify({
      inline_keyboard: [[{ text: "عرض المنتج 🛍️", url: link }]],
    });
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(
      `فشل إرسال "${product.name}" لتليجرام: ${data.description || res.status}`
    );
  }
}

async function main() {
  if (!BOT_TOKEN || !CHAT_ID) {
    fail(
      "متغيرات TELEGRAM_BOT_TOKEN و/أو TELEGRAM_CHAT_ID مش متظبطة في GitHub Secrets. " +
        "شوف تعليمات إضافتهم في README.md."
    );
  }
  if (!fs.existsSync(PRODUCTS_JSON)) {
    fail("مفيش data/products.json — لازم يتعمل build للموقع الأول.");
  }

  const { products } = JSON.parse(fs.readFileSync(PRODUCTS_JSON, "utf8"));
  const config = fs.existsSync(CONFIG_JSON)
    ? JSON.parse(fs.readFileSync(CONFIG_JSON, "utf8"))
    : {};

  // رابط raw.githubusercontent.com عشان صورة المنتج تكون متاحة فورًا حتى لو
  // نشر GitHub Pages للموقع لسه ما خلصش (على عكس رابط الموقع المنشور نفسه).
  const repoSlug = process.env.GITHUB_REPOSITORY; // شكله: owner/repo
  const branch = process.env.GITHUB_REF_NAME || "main";
  if (!repoSlug) fail("متغير GITHUB_REPOSITORY مش موجود (لازم يشتغل السكريبت جوه GitHub Actions).");
  const repoRawBase = `https://raw.githubusercontent.com/${repoSlug}/${branch}`;

  const sentIds = loadSentIds();
  const newProducts = products.filter((p) => !sentIds.has(p.id));

  if (newProducts.length === 0) {
    console.log("✔ مفيش منتجات جديدة — كل حاجة مبعوتة قبل كده.");
    return;
  }

  console.log(`📦 لقيت ${newProducts.length} منتج جديد، هبعتهم لتليجرام...`);
  let sentCount = 0;
  for (const product of newProducts) {
    try {
      await sendProductToTelegram({
        botToken: BOT_TOKEN,
        chatId: CHAT_ID,
        product,
        config,
        repoRawBase,
      });
      sentIds.add(product.id);
      sentCount++;
      console.log(`  ✔ اتبعت: ${product.name}`);
      // تأخير بسيط عشان منضربش Rate Limit بتاع تليجرام (~30 رسالة/ثانية للجروبات المختلفة،
      // لكن أفضل نكون مطمّنين خالص لو فيه منتجات كتير مرة واحدة)
      await new Promise((r) => setTimeout(r, 1200));
    } catch (err) {
      // لو منتج معيّن فشل (زي صورة تالفة)، منوقفش باقي المنتجات — نسجّله
      // كخطأ ونكمل، وهو هيفضل يتحاول تاني في التشغيلة الجاية (مش هيتحط
      // في sent.json إلا لو نجح فعليًا).
      console.error(`  ✖ فشل: ${product.name} — ${err.message}`);
    }
  }

  // بنمسح من القائمة أي منتج اتحذف من الموقع نفسه، عشان الملف يفضل نضيف
  // ومنتراكمش فيه IDs لمنتجات مبقتش موجودة.
  const currentIds = new Set(products.map((p) => p.id));
  for (const id of [...sentIds]) {
    if (!currentIds.has(id)) sentIds.delete(id);
  }

  saveSentIds(sentIds);
  console.log(`✔ خلصت — ${sentCount}/${newProducts.length} منتج اتبعتوا بنجاح.`);
}

main().catch((err) => fail(err.message || String(err)));
