/**
 * watch.js
 * بيراقب فولدر /products وأي تغيير فيه (إضافة/تعديل/حذف) يعيد بناء data/products.json تلقائيًا.
 * تشغيل: node scripts/watch.js  (أو npm run dev)
 * سيبه شغال في التيرمينال وانت بتضيف منتجات، مش محتاج توقفه.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PRODUCTS_DIR = path.join(ROOT, 'products');
const BUILD_SCRIPT = path.join(__dirname, 'build-index.js');

let debounceTimer = null;

function rebuild() {
  try {
    execFileSync('node', [BUILD_SCRIPT], { stdio: 'inherit' });
  } catch (e) {
    console.error('فشل البناء:', e.message);
  }
}

function scheduleRebuild(reason) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    console.log(`\nتغيير اتكشف (${reason}) — بعيد البناء...`);
    rebuild();
  }, 250);
}

if (!fs.existsSync(PRODUCTS_DIR)) {
  console.error('مفيش فولدر products/. شغّل السكريبت من جذر المشروع.');
  process.exit(1);
}

console.log('بناء أولي...');
rebuild();

console.log(`مراقبة products/ ... (Ctrl+C للإيقاف)`);
fs.watch(PRODUCTS_DIR, { recursive: true }, (eventType, filename) => {
  if (!filename) return;
  scheduleRebuild(filename);
});
