// ============================================================
//  تحميل متغيرات الخدمات الخارجية (Supabase, Turnstile...) من
//  data/env.json مع منع التخزين المؤقت تمامًا (cache: no-store).
//
//  ملف data/env.json نفسه غير موجود في الكود المصدري إطلاقًا —
//  بيتولّد تلقائيًا وقت النشر (Deploy) من GitHub Secrets، ومش
//  بيتحفظ أبدًا في تاريخ الـ Git ولا في أي كاش. كل نشر جديد
//  بيولّده من جديد من القيم المسجّلة في GitHub.
//
//  المفاتيح دي كلها "عامة" بطبيعتها (anon key / site key) ومصمّمة
//  إنها تظهر في كود المتصفح، عكس المفاتيح السرية (service_role،
//  Secret Key) اللي بتفضل في مكانها الآمن ومتوصلش للموقع أبدًا.
// ============================================================
window.TOTA_ENV_READY = (async function () {
  try {
    const res = await fetch('data/env.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    window.TOTA_ENV = data;
    return data;
  } catch (e) {
    console.error('تعذر تحميل متغيرات الخدمات (data/env.json)', e);
    window.TOTA_ENV = window.TOTA_ENV || {};
    return window.TOTA_ENV;
  }
})();
