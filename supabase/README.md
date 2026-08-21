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
(أوردر جديد، أوردر اتسلّم، طلب حذف حساب)، الموقع والبرنامج بيستدعوا
الـ Edge Function `notify-telegram` **مباشرة** بعد كل عملية ناجحة —
مش عن طريق Database Webhook (كان فيه مشكلة إعداد من ناحية Supabase
منعت سكيما `supabase_functions` من الظهور في المشروع، فالـ Webhook
كان بيفشل يتعمل خالص). الاستدعاء المباشر ده مش محتاج السكيما دي أو
أي حاجة تانية غير إن الفنكشن منشورة وشغالة عادي.

1. اعمل بوت جديد من [@BotFather](https://t.me/BotFather) بالأمر `/newbot`
   وهياديك **TELEGRAM_BOT_TOKEN**.
2. من حسابك الشخصي في تليجرام، ابعت أي رسالة (زي "أهلاً") للبوت
   نفسه، وبعدين افتح الرابط ده في المتصفح (حط التوكن بتاعك مكان
   `<TOKEN>`):
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
   هتلاقي رقم جوه `"chat":{"id": ...}` — ده هو **TELEGRAM_ADMIN_CHAT_ID**.
   كرر الخطوة دي لكل أدمن تاني عايز يستقبل الإشعارات.
3. سجّل القيم دي كـ Secrets للـ Edge Function — إما من لوحة التحكم
   (Edge Functions → Secrets)، أو من الطرفية بعد `supabase login` و
   `supabase link`:
   ```bash
   supabase secrets set TELEGRAM_BOT_TOKEN=xxxxx TELEGRAM_ADMIN_CHAT_IDS=id1,id2
   supabase functions deploy notify-telegram
   ```
   لو أدمن واحد بس، ممكن تستخدم `TELEGRAM_ADMIN_CHAT_ID` (من غير S)
   بدلاً من `TELEGRAM_ADMIN_CHAT_IDS`.

مفيش أي خطوة تانية مطلوبة في Database → Webhooks — الاستدعاء بيحصل
من كود الموقع (`assets/js/telegram-notify.js`) وكود البرنامج
(`SupabaseService.notifyTelegramEvent`) نفسهم مباشرة.

لو الرسايل لسه مش وصلة بعد التأكد من الـ Secrets:
- تأكد إنك (وأي أدمن تاني في القايمة) بدأت محادثة مع البوت شخصيًا
  أولاً — تليجرام مش بيسمح لبوت يبعت لشخص لسه ما بدأش معاه محادثة.
- شوف Function Logs (Dashboard → Edge Functions → notify-telegram
  → Logs) لتفاصيل أي خطأ فعلي وقت الإرسال.
- تأكد إن الفنكشن نفسها منشورة وشغالة (Edge Functions → notify-telegram
  لازم تكون ظاهرة في القايمة، زي أي فنكشن تانية).

بعد كده أي حدث من دول هيوصلك في الخاص على تليجرام فورًا.
