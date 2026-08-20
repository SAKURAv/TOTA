# قاعدة البيانات (Supabase) — بتتظبط تلقائيًا من GitHub

مفيش أي خطوة يدوية مطلوبة منك في SQL Editor. بمجرد ما تضيف السر
`SUPABASE_DB_URL` في GitHub (زي ما موضح في `../ENV_SETUP.md`)،
الـ workflow `.github/workflows/migrate.yaml` بيطبّق كل ملفات
`migrations/*.sql` تلقائيًا بالترتيب الرقمي أول ما تتعمل Push، أو
تقدر تشغّله يدويًا فورًا من تبويب **Actions → Apply Database
Migrations → Run workflow**.

## اللي اتعمل في القاعدة
- الجداول: `profiles, products, addresses, favorites, cart_items, orders, order_items, chats, chat_messages`
- حماية كاملة (RLS) بحيث كل مستخدم يشوف بياناته هو بس
- Storage bucket لصور الحسابات (`avatars`) وواحد لمرفقات الشات (`chat-attachments`)
- حذف تلقائي للشاتات المنتهية كل ساعة عبر `pg_cron`، ومدة الاحتفاظ (30 يوم افتراضيًا) في جدول `app_settings`

## لو ضفت ملف هجرة جديد مستقبلاً
سمّيه بترقيم تصاعدي (مثلاً `005_...sql`) وارفعه في نفس المجلد —
الـ workflow بيتذكر أي ملفات اتنفذت قبل كده (جدول `schema_migrations`)
وينفّذ الجديد بس تلقائيًا، من غير أي تكرار أو أخطاء.
