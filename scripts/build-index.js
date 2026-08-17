#!/usr/bin/env node
/**
 * يقرأ فولدر /products تلقائيًا ويبني /data/products.json
 * الهيكل المتوقع:
 * products/
 *   <category-slug>/
 *     category.json        { "name": "اسم التصنيف", "order": 1 }
 *     <product-slug>/
 *       data.json           { name, price, oldPrice, currency, badge, description, specs:[{label,value}] }
 *       1.(svg|jpg|jpeg|png|webp|avif)   -> الصورة الأولى بالترتيب = الصورة الرئيسية تلقائيًا
 *       2.(svg|jpg|jpeg|png|webp|avif)   -> صور إضافية (اختياري، أي عدد)
 * لترتيب/ترقيم صور مضافة بأسماء عشوائية تلقائيًا: npm run reorganize-images
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PRODUCTS_DIR = path.join(ROOT, "products");
const OUT_FILE = path.join(ROOT, "data", "products.json");
const IMG_EXT = [".svg", ".jpg", ".jpeg", ".png", ".webp", ".avif"];

// بيدور على كل صور المنتج أيًا كانت صيغتها وعددها وأسماؤها،
// وبيرتبهم ترتيب طبيعي (natural sort) بحيث 1, 2, 3... 10 يبقوا مرتبين صح
// (مش أبجدي عادي اللي بيحط "10" قبل "2"). أول صورة بعد الترتيب = الصورة الرئيسية
// تلقائيًا (مفيش داعي لتسمية أي ملف "main" يدويًا، لكن لو موجود بيتاخد الأولوية).
function findAllImages(dir) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => IMG_EXT.includes(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "ar", { numeric: true, sensitivity: "base" }));

  const mainCandidate = files.find((f) => /^main\.(svg|jpe?g|png|webp|avif)$/i.test(f));
  if (mainCandidate) {
    const rest = files.filter((f) => f !== mainCandidate);
    return [mainCandidate, ...rest];
  }
  return files;
}

function findImage(dir) {
  const all = findAllImages(dir);
  return all.length ? all[0] : null;
}

function build() {
  if (!fs.existsSync(PRODUCTS_DIR)) {
    console.error("مفيش فولدر products/");
    process.exit(1);
  }

  const categorySlugs = fs
    .readdirSync(PRODUCTS_DIR)
    .filter((f) => fs.statSync(path.join(PRODUCTS_DIR, f)).isDirectory());

  const categories = [];

  for (const catSlug of categorySlugs) {
    const catDir = path.join(PRODUCTS_DIR, catSlug);
    const catJsonPath = path.join(catDir, "category.json");
    let catMeta = { name: catSlug, order: 999 };
    if (fs.existsSync(catJsonPath)) {
      try {
        catMeta = { ...catMeta, ...JSON.parse(fs.readFileSync(catJsonPath, "utf8")) };
      } catch (e) {
        console.warn(`⚠ category.json غلط في ${catSlug}: ${e.message}`);
      }
    }

    const productSlugs = fs
      .readdirSync(catDir)
      .filter((f) => fs.statSync(path.join(catDir, f)).isDirectory());

    const products = [];
    for (const prodSlug of productSlugs) {
      const prodDir = path.join(catDir, prodSlug);
      const dataPath = path.join(prodDir, "data.json");
      if (!fs.existsSync(dataPath)) continue;
      let data;
      try {
        data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
      } catch (e) {
        console.warn(`⚠ data.json غلط في ${catSlug}/${prodSlug}: ${e.message}`);
        continue;
      }
      const img = findImage(prodDir);
      const allImgs = findAllImages(prodDir);
      const images = allImgs.length
        ? allImgs.map((f) => `products/${catSlug}/${prodSlug}/${f}`)
        : ["assets/img/placeholder.svg"];
      products.push({
        id: `${catSlug}/${prodSlug}`,
        slug: prodSlug,
        category: catSlug,
        categoryName: catMeta.name,
        name: data.name || prodSlug,
        price: data.price ?? null,
        oldPrice: data.oldPrice ?? null,
        currency: data.currency || "EGP",
        badge: data.badge || null,
        description: data.description || "",
        specs: Array.isArray(data.specs) ? data.specs : [],
        image: img ? `products/${catSlug}/${prodSlug}/${img}` : "assets/img/placeholder.svg",
        images: images,
        _order: data.order ?? 999,
      });
    }

    products.sort((a, b) => a._order - b._order || a.slug.localeCompare(b.slug));
    products.forEach((p) => delete p._order);

    categories.push({
      slug: catSlug,
      name: catMeta.name,
      order: catMeta.order ?? 999,
      products,
    });
  }

  categories.sort((a, b) => a.order - b.order);

  const allProducts = categories.flatMap((c) => c.products);

  const output = {
    generatedAt: new Date().toISOString(),
    categories,
    products: allProducts,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf8");
  console.log(`✔ تم بناء data/products.json — ${allProducts.length} منتج في ${categories.length} تصنيف`);
}

build();
