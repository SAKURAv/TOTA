# خطوات ربط المتغيرات على Cloudflare Pages

## ⚠️ تحديث مهم بعد أول محاولة فشلت

### 1) مكان المتغيرات الصحيح
لو دخلت على تبويب **Bindings** ولقيت رسالة "Variables cannot be
added to a Worker that only has static assets" — ده مكان غلط. المكان
الصح هو: **Settings → Environment variables** (مش Bindings)، لأن
موقعك ملفات ثابتة بدون كود Worker شغال وقت الطلب، فمتغيرات الـ
Bindings (runtime) مش متاحة أصلاً، لكن متغيرات الـ Build (اللي
محتاجها generate-env.js) موجودة في مكان تاني.

### 2) مكتبة sharp اتشالت من package.json
كانت بتسبب فشل في `npm ci` لإن Cloudflare بيمنع سكربتات التثبيت
(postinstall) من تنزيل ملفات من الإنترنت، و`sharp` محتاجة كده عشان
تجيب ملف binary جاهز. بما إن `sharp` مستخدمة بس محليًا (تحويل الصور
لـ webp قبل الرفع)، مبقتش موجودة في package.json خالص. لو عايز تحوّل
صور جديدة لـ webp على جهازك، ثبّتها مؤقتًا:
```bash
npm install sharp --no-save
node scripts/convert-webp.js
```
وبعدين ارفع الصور الناتجة عادي زي أي ملف تاني (الأمر ده مش لازم يتكرر
كل نشر، بس أول مرة أو لما تضيف صور جديدة).


## 1) ضيف ملف السكربت
حط `scripts/generate-env.js` (المرفق في هذا الملف المضغوط) داخل مجلد
`scripts/` في جذر مشروعك على GitHub (نفس مكان `build-index.js`).

## 2) عدّل أمر البناء في package.json
افتح `package.json` وغيّر سطر "build" ليصبح:

```json
"build": "node scripts/generate-env.js && node scripts/build-index.js && node scripts/convert-webp.js && node scripts/build-share-pages.js && node scripts/build-meta.js"
```

(بس ضفنا `node scripts/generate-env.js &&` في الأول)

## 3) اعمل commit و push للتعديلين دول

## 4) ضيف المتغيرات في Cloudflare
من صفحة المشروع في Cloudflare:
**tota-store → Settings → Variables and Secrets → Add variable**

ضيف كل واحد من دول (الاسم بالظبط زي ما هو):

| الاسم | من فين تجيبه | Secret ولا Plaintext؟ |
|---|---|---|
| SUPABASE_URL | Supabase → Settings → API → Project URL | Plaintext |
| SUPABASE_ANON_KEY | Supabase → Settings → API → anon public key | Secret (اختياري تخليه Plaintext، هو أصلاً عام) |
| TURNSTILE_SITE_KEY | Cloudflare → Turnstile (اختياري) | Plaintext |
| TELEGRAM_SITE_BOT_TOKEN | من BotFather — بوت منفصل عن أي بوت تاني | Secret |
| TELEGRAM_ADMIN_CHAT_IDS | أرقام شات الأدمن مفصولة بفاصلة | Plaintext |

## 5) اعمل Retry build / Deploy
بعد ما تضيف المتغيرات، اضغط "Retry build" أو اعمل push جديد لأي تعديل
بسيط عشان يشتغل الـ build تاني بالمتغيرات الجديدة.

⚠️ ملحوظة: أي تعديل تعمله للمتغيرات في Cloudflare بعد كده، لازم عمل
Deploy جديد يدويًا (مش بيتحدث تلقائي زي GitHub Actions إلا لو عملت
push فعلي للريبو).
