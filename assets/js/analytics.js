// ============================================================
//  تحميل GoatCounter (تحليلات زيارات مجانية) ديناميكيًا حسب كود
//  الموقع المتظبط في data/config.json (analytics.goatcounterSite)
//  — من غير ما نحط الكود ده ثابت جوه أي ملف HTML، عشان لو اتغيّر
//  يكفي نعدّل مكان واحد بس ويشتغل فورًا في كل الصفحات (بما فيها أي
//  صفحة منتج جديدة بتتولد تلقائيًا وقت الـ build).
//
//  ليه مش بنحط <script data-goatcounter="..."> ثابت زي الطريقة
//  العادية؟ عشان الموقع صفحة واحدة تفاعلية (SPA) لصفحة المنتجات:
//  فتح منتج بالكارت بيغيّر شريط العنوان (pushState) من غير ريفريش
//  حقيقي للصفحة، فـ GoatCounter العادي (اللي بيتصرف مرة واحدة بس
//  وقت تحميل الصفحة) مش هيلاحظ الفتحات دي. الحل: بنسيب التتبع
//  التلقائي شغال زي ما هو لأول تحميل، وبنضيف نداء يدوي (trackProduct)
//  من جوه products.js في كل مرة يتفتح منتج بدون ريفريش حقيقي.
//
//  كمان بنوحّد شكل مسار كل صفحات المنتجات في الإحصائيات تحت نفس
//  الصيغة النضيفة /p/<تصنيف>/<منتج>/ سواء الزائر جاي من:
//   - رابط مشاركة واتساب (يوصله على /p/.../ مباشرة)
//   - فتح مباشر لـ products.html?p=... (من غير جافاسكريبت SPA)
//   - كارت داخل صفحة المنتجات، أو زرار رجوع/تقدّم في المتصفح
//  عشان الأرقام تبقى مجمّعة صح على نفس المنتج، مش متفرّقة بين
//  أشكال روابط مختلفة لنفس الصفحة.
// ============================================================
(function () {
  function canonicalProductPath() {
    // من رابط SPA النضيف: /p/<id>/
    var m = location.pathname.match(/\/p\/(.+?)\/?$/);
    if (m) return '/p/' + m[1].split('/').map(encodeURIComponent).join('/') + '/';
    // من رابط ?p=<id> (فتح مباشر لـ products.html?p=...)
    var q = new URLSearchParams(location.search).get('p');
    if (q) return '/p/' + q.split('/').map(encodeURIComponent).join('/') + '/';
    return null;
  }

  // لازم يتظبط قبل تحميل count.js نفسه عشان ياخد بالإعداد ده
  window.goatcounter = window.goatcounter || {};
  window.goatcounter.path = function (defaultPath) {
    return canonicalProductPath() || defaultPath;
  };

  // API بسيطة تستخدمها باقي ملفات الموقع (products.js) عشان تسجّل
  // "زيارة افتراضية" لصفحة منتج اتفتح جوه الـ SPA من غير ريفريش حقيقي.
  window.TotaAnalytics = {
    trackProduct: function (id, title) {
      try {
        if (!(window.goatcounter && window.goatcounter.count)) return;
        var path = '/p/' + String(id).split('/').map(encodeURIComponent).join('/') + '/';
        window.goatcounter.count({ path: path, title: title || document.title });
      } catch (e) { /* تجاهل أي خطأ عشان ميأثرش على باقي الموقع */ }
    }
  };

  var ready = window.TOTA_CONFIG_READY || Promise.resolve({});
  ready.then(function (cfg) {
    var site = ((cfg && cfg.analytics && cfg.analytics.goatcounterSite) || '').trim();
    if (!site) return; // مفيش كود GoatCounter متظبط — من غير أي تتبع، من غير أخطاء
    if (document.querySelector('script[data-goatcounter]')) return; // اتحمّل قبل كده
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://gc.zgo.at/count.js';
    s.setAttribute('data-goatcounter', 'https://' + site + '.goatcounter.com/count');
    document.head.appendChild(s);
  }).catch(function () { /* تجاهل — التحليلات مش أساسية لعمل الموقع */ });
})();
