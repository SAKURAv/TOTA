# إعداد المتغيرات (GitHub Secrets)

كل مفاتيح الخدمات الخارجية بتتحط في مكان واحد بس: **Settings → Secrets and variables → Actions** في مستودع GitHub بتاع الموقع. الموقع نفسه مفيهوش أي مفتاح مكتوب في الكود، وملف `data/env.json` بيتولّد تلقائيًا من الأسرار دي في كل عملية نشر (Deploy) ومبيتحفظش في الفرع الرئيسي ولا في أي كاش.

## الخطوات
1. من صفحة المستودع على GitHub: **Settings → Secrets and variables → Actions → New repository secret**
2. ضيف الأسرار دي واحد واحد (الاسم بالظبط زي ما هو):

| اسم الـ Secret | القيمة |
|---|---|
| `SUPABASE_URL` | Project URL من Supabase |
| `SUPABASE_ANON_KEY` | anon public key من Supabase |
| `TURNSTILE_SITE_KEY` | Site Key من Cloudflare Turnstile |
| `SUPABASE_DB_URL` | Connection string (URI) من Supabase → Settings → Database — يُستخدم فقط بواسطة `migrate.yaml` لتطبيق قاعدة البيانات تلقائيًا، ولا يظهر أبدًا في كود الموقع |
| `SUPABASE_ACCESS_TOKEN` | Personal Access Token من supabase.com → Account → Access Tokens — يُستخدم فقط لنشر Edge Functions تلقائيًا |
| `SUPABASE_PROJECT_REF` | معرّف المشروع (Project Reference ID)، تلاقيه في Settings → General أو في رابط المشروع نفسه |
| `TURNSTILE_SECRET_KEY` | Secret Key من Cloudflare Turnstile — سري بالكامل، بيتحط فقط داخل Supabase Edge Function عبر `deploy-functions.yaml`، ولا يظهر في كود الموقع أبدًا |

3. بمجرد ما تضيفهم، أي Push جديد على `main` (أو تشغيل الـ workflow يدويًا من تبويب Actions) هيولّد `data/env.json` تلقائيًا من القيم دي وينشر الموقع بيها.

كمان، أي تعديل أو إضافة لملفات `supabase/migrations/**` هيشغّل تلقائيًا `.github/workflows/migrate.yaml`، وأي تعديل في `supabase/functions/**` هيشغّل تلقائيًا `.github/workflows/deploy-functions.yaml` وينشر دالة التحقق من Turnstile على Supabase مباشرة. الموقع فعليًا بيدير نفسه بالكامل من GitHub من غير أي تدخل يدوي منك في أي خدمة خارجية.

> المفاتيح دي كلها عامة بطبيعتها (مصممة تظهر في المتصفح) — أي مفتاح سري (زي `service_role key` بتاع Supabase أو `Secret Key` بتاع Turnstile) **مش هيتحط هنا أبدًا**، ده مكانه لاحقًا في البرنامج (tota_admin2) أو في Supabase Edge Functions بس.
