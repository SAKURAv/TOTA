// ============================================================
//  تحميل Cloudflare Web Analytics (بيكون/Beacon مجاني) ديناميكيًا
//  حسب التوكن المتظبط في data/config.json (analytics.cloudflareToken)
//  — من غير ما نحط الكود ده ثابت جوه أي ملف HTML، عشان لو اتغيّر
//  يكفي نعدّل مكان واحد بس ويشتغل فورًا في كل الصفحات (بما فيها أي
//  صفحة منتج جديدة بتتولد تلقائيًا وقت الـ build).
//
//  ليه مش بنحط <script data-cf-beacon="..."> ثابت زي الطريقة العادية؟
//  نفس السبب اللي كان موجود مع GoatCounter قبل كده: التوكن ممكن
//  يتغيّر، وعايزين نتحكم فيه من مكان واحد بس (config.json).
//
//  مهم: بيكون Cloudflare بيتابع صفحات الـ SPA تلقائيًا من غير أي كود
//  إضافي، لأنه بيعمل override لدالة history.pushState وبيسمع لحدث
//  popstate بنفسه (راجع docs.cloudflare.com/web-analytics). وبما إن
//  الموقع أصلاً بيغيّر شريط العنوان بمسار نضيف /p/<تصنيف>/<منتج>/ عند
//  فتح أي منتج (products.js: history.pushState)، فكل فتحة منتج جوه
//  الـ SPA هتتسجل تلقائيًا كزيارة لصفحة مستقلة بنفس المسار ده من غير
//  ما نحتاج أي نداء يدوي زي trackProduct اللي كنا مضطرين نعمله مع
//  GoatCounter. سايبين TotaAnalytics.trackProduct موجودة تحت (بدون
//  تأثير فعلي) بس عشان products.js يفضل شغال زي ما هو من غير أي خطأ.
// ============================================================
(function () {
  // API بسيطة (شكلها زي القديم) سايبينها من غير تأثير فعلي — تتبع
  // الصفحات بقى تلقائي بالكامل مع Cloudflare Web Analytics (شوف
  // الشرح فوق)، فمفيش داعي نبعت أي حاجة يدوي من هنا.
  window.TotaAnalytics = {
    trackProduct: function () { /* Cloudflare بيتابع الـ SPA تلقائيًا، مفيش داعي لأي نداء يدوي */ }
  };

  var ready = window.TOTA_CONFIG_READY || Promise.resolve({});
  ready.then(function (cfg) {
    var token = ((cfg && cfg.analytics && cfg.analytics.cloudflareToken) || '').trim();
    if (!token) return; // مفيش توكن متظبط — من غير أي تتبع، من غير أخطاء
    if (document.querySelector('script[data-cf-beacon]')) return; // اتحمّل قبل كده
    var s = document.createElement('script');
    s.type = 'module'; // بيمنع أي خطأ غير ظاهر للمستخدم على متصفحات قديمة (زي Internet Explorer) لا بتدعم صيغة الجافاسكريبت الحديثة اللي البيكون مبني بيها — نفس اللي Cloudflare بتحطه تلقائي في السنيبت الرسمي
    s.defer = true;
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', JSON.stringify({ token: token }));
    document.head.appendChild(s);
  }).catch(function () { /* تجاهل — التحليلات مش أساسية لعمل الموقع */ });
})();
