#!/usr/bin/env node
// ============================================================
//  بيولّد data/env.json وقت البناء (Build) على Cloudflare Pages
//  من Environment Variables المتظبطة في: Settings → Variables
//  and Secrets. بيتشغل تلقائيًا كخطوة أولى في "npm run build".
//
//  أي متغيّر فاضي هيتحط في الملف كـ string فاضي "" (مش هيتحذف)
//  عشان env.js في المتصفح يفضل شغال بدون أخطاء حتى لو حاجة
//  زي Turnstile مش متفعّلة.
// ============================================================
const fs = require('fs');
const path = require('path');

const keys = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'TURNSTILE_SITE_KEY',
  'TELEGRAM_SITE_BOT_TOKEN',
  'TELEGRAM_ADMIN_CHAT_IDS',
];

const output = {};
for (const key of keys) {
  output[key] = process.env[key] || '';
}

const outPath = path.join(__dirname, '..', 'data', 'env.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log('✅ تم توليد data/env.json من Environment Variables بنجاح.');
const missing = keys.filter((k) => !output[k]);
if (missing.length) {
  console.log('⚠️  المتغيرات دي فاضية (تأكد إنها متظبطة في Cloudflare لو محتاجها):');
  missing.forEach((k) => console.log('   - ' + k));
}
