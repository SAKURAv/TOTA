# قاعدة البيانات (Supabase) — بتتظبط تلقائيًا من GitHub

مفيش أي خطوة يدوية مطلوبة منك في SQL Editor. بمجرد ما تضيف السر
`SUPABASE_DB_URL` في GitHub (زي ما موضح في `../ENV_SETUP.md`)،
الـ workflow `.github/workflows/migrate.yaml` بيطبّق كل ملفات
`migrations/*.sql` تلقائيًا بالترتيب الرقمي أول ما تتعمل Push، أو
تقدر تشغّله يدويًا فورًا من تبويب **Actions → Apply Database
Migrations → Run workflow**.

## اللي اتعمل في القاعدة
- الجداول: `profiles, products, addresses, favorites, cart_items, orders, order_items, account_delete_requests`
- حماية كاملة (RLS) بحيث كل مستخدم يشوف بياناته هو بس (تفاصيل كل جدول في تعليقات ملفات `migrations/*.sql`)
- Storage bucket لصور الحسابات (`avatars`، عام للقراءة، كل مستخدم يرفع/يعدّل صورته هو بس)
- مفيش نظام شات في المشروع — التواصل كله عن طريق واتساب (`wa.me`) مباشرة

## لو ضفت ملف هجرة جديد مستقبلاً
سمّيه بترقيم تصاعدي (مثلاً `004_...sql`) وارفعه في نفس المجلد —
الـ workflow بيتذكر أي ملفات اتنفذت قبل كده (جدول `schema_migrations`)
وينفّذ الجديد بس تلقائيًا، من غير أي تكرار أو أخطاء.

## تنبيهات تليجرام فورية للأدمن (خاص، مش جروب)
عشان توصلك رسالة في الخاص على تليجرام لحظة ما يحصل أي حدث مهم
(أوردر جديد، منتج اتضاف لعربة موجودة، طلب حذف حساب، حساب جديد اتسجل):

1. اعمل بوت جديد من [@BotFather](https://t.me/BotFather) بالأمر `/newbot`
   وهياديك **TELEGRAM_BOT_TOKEN**.
2. من حسابك الشخصي في تليجرام، ابعت أي رسالة (زي "أهلاً") للبوت
   نفسه، وبعدين افتح الرابط ده في المتصفح (حط التوكن بتاعك مكان
   `<TOKEN>`):
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
   هتلاقي رقم جوه `"chat":{"id": ...}` — ده هو **TELEGRAM_ADMIN_CHAT_ID**.
3. سجّل الاثنين كـ secrets للـ Edge Function (من الطرفية، بعد
   `supabase login` و `supabase link`):
   ```bash
   supabase secrets set TELEGRAM_BOT_TOKEN=xxxxx TELEGRAM_ADMIN_CHAT_ID=xxxxx
   supabase functions deploy notify-telegram
   ```
4. من لوحة تحكم المشروع: **Database → Webhooks → Create a new hook**،
   واعمل webhook منفصل لكل جدول من الأربعة دول (Insert بس، بدون
   Update/Delete)، ووجّه كل واحد لـ Edge Function اللي اسمها
   `notify-telegram`:
   - `orders`
   - `order_items`
   - `account_delete_requests`
   - `profiles`

بعد كده أي حدث من دول هيوصلك في الخاص على تليجرام فورًا، من غير ما
تحتاج تفتح برنامج الأدمن أو الموقع خالص. الرسائل بتتبعت من قاعدة
البيانات مباشرة، فهتوصل حتى لو الزائر قفل المتصفح فورًا بعد الإجراء.
