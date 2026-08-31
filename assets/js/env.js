// ============================================================
//  تحميل متغيرات الخدمات الخارجية (Supabase, Turnstile...) من
//  data/env.json.
//
//  ملحوظة أداء: شيلنا cache:'no-store' اللي كانت بتجبر كل صفحة في
//  الموقع تعمل طلب شبكة جديد لنفس الملف من غير أي كاش — ده كان بيسحب
//  نت زيادة عن اللزوم من غير فايدة حقيقية، لأن المفاتيح دي بتتغيّر
//  بس وقت نشر جديد. دلوقتي المتصفح بيستخدم الكاش العادي بتاعه.
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
    const res = await fetch('data/env.json');
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
