#!/usr/bin/env node
/**
 * بيعيد تسمية صور كل منتج:
 * - لو فيه ملف main.* بياخده كصورة رئيسية، وإلا أول صورة بالترتيب الأبجدي
 * - الصورة الرئيسية بتتسمى 1.<ext>
 * - باقي الصور بترقم 2, 3, 4... بنفس ترتيبها الأبجدي الأصلي (من غير main)
 * بيشتغل على كل فولدرات المنتجات جوه products/<category>/<product>/
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PRODUCTS_DIR = path.join(ROOT, "products");
const IMG_EXT = [".svg", ".jpg", ".jpeg", ".png", ".webp", ".avif"];

function reorganizeProduct(dir, catSlug, prodSlug) {
  const files = fs.readdirSync(dir);
  const imageFiles = files
    .filter((f) => IMG_EXT.includes(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "ar"));

  if (imageFiles.length === 0) return;

  const mainCandidate = imageFiles.find((f) =>
    /^main\.(svg|jpe?g|png|webp|avif)$/i.test(f)
  );
  const main = mainCandidate || imageFiles[0];
  const rest = imageFiles.filter((f) => f !== main);

  const ordered = [main, ...rest];

  // خطوة أولى: نسمي كل الملفات بأسماء مؤقتة عشان نتجنب تضارب الأسماء
  // (مثلاً لو فيه صورة اسمها "1.jpg" أصلاً وعايزين نحط حاجة تانية مكانها)
  const tempNames = [];
  ordered.forEach((f, i) => {
    const ext = path.extname(f);
    const tempName = `__tmp_${i}${ext}`;
    fs.renameSync(path.join(dir, f), path.join(dir, tempName));
    tempNames.push(tempName);
  });

  // خطوة تانية: نسمي بالاسم النهائي 1, 2, 3...
  const finalNames = [];
  tempNames.forEach((f, i) => {
    const ext = path.extname(f);
    const finalName = `${i + 1}${ext}`;
    fs.renameSync(path.join(dir, f), path.join(dir, finalName));
    finalNames.push(finalName);
  });

  console.log(`  ✔ ${catSlug}/${prodSlug}: ${ordered.join(", ")} -> ${finalNames.join(", ")}`);
}

function run() {
  if (!fs.existsSync(PRODUCTS_DIR)) {
    console.error("مفيش فولدر products/");
    process.exit(1);
  }

  const categorySlugs = fs
    .readdirSync(PRODUCTS_DIR)
    .filter((f) => fs.statSync(path.join(PRODUCTS_DIR, f)).isDirectory());

  for (const catSlug of categorySlugs) {
    const catDir = path.join(PRODUCTS_DIR, catSlug);
    const productSlugs = fs
      .readdirSync(catDir)
      .filter((f) => fs.statSync(path.join(catDir, f)).isDirectory());

    console.log(`📁 ${catSlug}`);
    for (const prodSlug of productSlugs) {
      reorganizeProduct(path.join(catDir, prodSlug), catSlug, prodSlug);
    }
  }

  console.log("\n✔ تمت إعادة تسمية كل الصور بنجاح");
}

run();
