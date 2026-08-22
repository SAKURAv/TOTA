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
| `TELEGRAM_SITE_BOT_TOKEN` | توكن بوت تليجرام **مخصص للموقع بس** (من BotFather) — بيتحط في `data/env.json` وقت النشر عشان الموقع يبعت لتليجرام **من المتصفح مباشرة**، من غير أي سيرفر وسيط (Supabase Edge Function/Webhook). **لازم يكون بوت منفصل تمامًا** عن `TELEGRAM_BOT_TOKEN` المستخدم في `telegram-notify.yaml` (إعلان منتج جديد في الجروب) — لو استخدمت نفس البوت في الاتنين، أي `/revoke` تعمله بسبب تسريب التوكن ده (طبيعي وحتمي لأنه ظاهر في المتصفح) هيوقف بوت إعلانات المنتجات كمان. خليهم بوتين مختلفين من الأول. |
| `TELEGRAM_ADMIN_CHAT_IDS` | رقم أو أرقام الشات بتاعة الأدمن على تليجرام، **مفصولين بفاصلة** لو أكتر من واحد (مثال: `111111,222222`) — كل واحد فيهم هيستلم إشعار فوري بكل أوردر/حذف حساب جديد على الموقع. لازم كل أدمن يكون بدأ محادثة مع البوت شخصيًا الأول (تليجرام مش بيسمح لبوت يبعت لحد لسه ما بدأش معاه محادثة) |

3. بمجرد ما تضيفهم، أي Push جديد على `main` (أو تشغيل الـ workflow يدويًا من تبويب Actions) هيولّد `data/env.json` تلقائيًا من القيم دي وينشر الموقع بيها — ده كل اللي محتاجه عشان إشعارات الأوردرات تشتغل، مفيش أي خطوة يدوية تانية في Supabase مطلوبة (لا Webhooks ولا `supabase secrets set`).

كمان، أي تعديل أو إضافة لملفات `supabase/migrations/**` هيشغّل تلقائيًا `.github/workflows/migrate.yaml`.

> ⚠️ **تنبيه أمان مهم بخصوص `TELEGRAM_SITE_BOT_TOKEN`:** بما إن الموقع بيبعت لتليجرام مباشرة من المتصفح (من غير سيرفر وسيط)، فالتوكن ده هيكون موجود في كود الموقع المنشور وأي حد يقدر يشوفه من devtools. ده الثمن الحتمي لأي حل "بيعتمد على نفسه" بدون سيرفر. لتقليل المخاطرة:
> - **استخدم بوت مختلف تمامًا** عن `TELEGRAM_BOT_TOKEN` (اللي بيستخدمه `telegram-notify.yaml` لإعلانات المنتجات في الجروب) — البوتان ده لازم يكونوا منفصلين من الأول، عشان تسريب توكن الموقع (المتوقع والحتمي) ميأثرش على بوت المنتجات خالص.
> - لو حسيت إن حد بيبعت رسايل غريبة من `TELEGRAM_SITE_BOT_TOKEN`، اعمل `/revoke` من BotFather **لبوت الموقع بس**، حط التوكن الجديد في نفس الـ GitHub Secret، وانشر تاني (Push جديد أو تشغيل الـ workflow يدويًا). بوت المنتجات في الجروب هيفضل شغال عادي من غير أي تأثير.
> - باقي المفاتيح السرية الحقيقية (زي `service_role key` بتاع Supabase أو `Secret Key` بتاع Turnstile) **مبتتحطش هنا أبدًا** وفضلانة في مكانها الآمن بس (البرنامج أو Supabase Edge Functions).

دالة `supabase/functions/notify-telegram` القديمة بقت غير مستخدمة من كود الموقع خالص دلوقتي (تقدر تسيبها موجودة من غير أي ضرر، أو تشيلها لو عايز تبسّط المشروع).