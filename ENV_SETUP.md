# إعداد المتغيرات (GitHub Secrets)

كل مفاتيح الخدمات الخارجية بتتحط في مكان واحد بس: **Settings → Secrets and variables → Actions** في مستودع GitHub بتاع الموقع. الموقع نفسه مفيهوش أي مفتاح مكتوب في الكود، وملف `data/env.json` بيتولّد تلقائيًا من الأسرار دي في كل عملية نشر (Deploy) ومبيتحفظش في الفرع الرئيسي ولا في أي كاش.

## الخطوات
1. من صفحة المستودع على GitHub: **Settings → Secrets and variables → Actions → New repository secret**
2. ضيف الأسرار دي واحد واحد (الاسم بالظبط زي ما هو):

| اسم الـ Secret | القيمة |
|---|---|
| `SUPABASE_URL` | Project URL من Supabase |
| `SUPABASE_ANON_KEY` | anon public key من Supabase |
| `TURNSTILE_SITE_KEY` | Site Key من Cloudflare Turnstile — **اختياري**. لو سبته فاضي/محطتوش، الموقع هيسمح بإنشاء حساب من غير أي تحقق "أنا لست روبوت" (الويدجت مش بيظهر خالص). لو عايز التحقق يشتغل لازم تحط ده مع `TURNSTILE_SECRET_KEY` تحت مع بعض — لو حطيت واحد وسبت التاني فاضي، التسجيل هيفشل بمشكلة أمنية. |
| `SUPABASE_DB_URL` | Connection string (URI) من Supabase → Settings → Database — يُستخدم فقط بواسطة `migrate.yaml` لتطبيق قاعدة البيانات تلقائيًا، ولا يظهر أبدًا في كود الموقع |
| `SUPABASE_ACCESS_TOKEN` | Personal Access Token من supabase.com → Account → Access Tokens — يُستخدم فقط لنشر Edge Functions تلقائيًا |
| `SUPABASE_PROJECT_REF` | معرّف المشروع (Project Reference ID)، تلاقيه في Settings → General أو في رابط المشروع نفسه |
| `TURNSTILE_SECRET_KEY` | Secret Key من Cloudflare Turnstile — سري بالكامل، بيتحط فقط داخل Supabase Edge Function عبر `deploy-functions.yaml`، ولا يظهر في كود الموقع أبدًا. سيبه فاضي لو مش هتستخدم Turnstile. |
| `TELEGRAM_BOT_TOKEN` | توكن بوت تليجرام (من BotFather) — بيتحط كـ secret في Supabase Edge Function `notify-telegram` |
| `TELEGRAM_ADMIN_CHAT_IDS` | رقم أو أرقام الشات بتاعة الأدمن على تليجرام، **مفصولين بفاصلة** لو أكتر من واحد (مثال: `111111,222222`) — كل واحد فيهم هيستلم إشعار فوري بكل حساب/أوردر جديد على الموقع |

3. بمجرد ما تضيفهم، أي Push جديد على `main` (أو تشغيل الـ workflow يدويًا من تبويب Actions) هيولّد `data/env.json` تلقائيًا من القيم دي وينشر الموقع بيها.

كمان، أي تعديل أو إضافة لملفات `supabase/migrations/**` هيشغّل تلقائيًا `.github/workflows/migrate.yaml`، وأي تعديل في `supabase/functions/**` هيشغّل تلقائيًا `.github/workflows/deploy-functions.yaml` وينشر دالة التحقق من Turnstile ودالة إشعارات تليجرام على Supabase مباشرة. الموقع فعليًا بيدير نفسه بالكامل من GitHub من غير أي تدخل يدوي منك في أي خدمة خارجية — **ما عدا خطوة واحدة يدوية لازم تتعمل مرة واحدة من لوحة تحكم Supabase نفسها** (مش من GitHub) عشان إشعارات تليجرام بتاعة "أوردر جديد من الموقع" تشتغل فعليًا:

## تفعيل إشعارات تليجرام لأوردرات الموقع (خطوة يدوية لازمة، مرة واحدة)
دالة `notify-telegram` جاهزة في الكود، لكن محتاجة حد "يناديها" كل ما يحصل Insert في الجداول. ده بيتعمل بـ **Database Webhooks** من لوحة تحكم Supabase (مفيش طريقة تتعمل من الكود/GitHub):

1. ادخل مشروعك على supabase.com → **Database → Webhooks → Create a new hook**
2. اعمل Webhook منفصل لكل جدول من الأربعة دول (Insert بس في كل مرة):
   - `orders`
   - `order_items`
   - `profiles`
   - `account_delete_requests`
3. في كل واحد: النوع `Supabase Edge Functions`، الدالة المستهدفة `notify-telegram`، والـ HTTP method `POST`.
4. تأكد إنك ضايف `TELEGRAM_BOT_TOKEN` و `TELEGRAM_ADMIN_CHAT_IDS` في GitHub Secrets (الجدول فوق) عشان يوصلوا للدالة عند أول Deploy بعد كده.

من غير الخطوة دي، الجدول والدالة موجودين لكن محدش بينادي الدالة فعليًا، فمفيش إشعارات هتوصل تليجرام لأي حاجة بتحصل على الموقع (حساب جديد أو أوردر جديد).

> المفاتيح دي كلها عامة بطبيعتها (مصممة تظهر في المتصفح) — أي مفتاح سري (زي `service_role key` بتاع Supabase أو `Secret Key` بتاع Turnstile أو `TELEGRAM_BOT_TOKEN`) **مش هيتحط هنا أبدًا**، ده مكانه لاحقًا في البرنامج (tota_admin3) أو في Supabase Edge Functions بس.