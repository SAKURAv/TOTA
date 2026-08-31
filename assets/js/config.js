// ============================================================
//  تحميل إعدادات المتجر (رقم واتساب، وسائل التواصل، المنتجات
//  المميزة...) من data/config.json مع منع التخزين المؤقت تمامًا،
//  عشان أي تعديل في رقم الواتساب أو الروابط يوصل لكل الزوار فورًا
//  من غير ما يحتاجوا يعملوا Hard Refresh بأنفسهم.
//
//  ده الاستثناء الوحيد من تحسين الكاش اللي اتعمل في باقي الموقع —
//  اتسيب عمدًا no-store لأن رقم الواتساب حاجة حساسة لازم تتحدث فورًا،
//  فمقايضة استهلاك نت بسيطة (ملف صغير جدًا) مقابل التحديث اللحظي.
//
//  للتعديل: افتح data/config.json وغيّر القيم هناك، مش هنا.
// ============================================================
window.TOTA_CONFIG_READY = (async function(){
  try{
    const res = await fetch('data/config.json', { cache: 'no-store' });
    const data = await res.json();
    window.TOTA_CONFIG = data;
    return data;
  }catch(e){
    console.error('تعذر تحميل ملف الإعدادات (data/config.json)', e);
    window.TOTA_CONFIG = window.TOTA_CONFIG || {};
    return window.TOTA_CONFIG;
  }
})();
