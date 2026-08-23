// ============================================================
//  تحميل إعدادات المتجر (رقم واتساب، وسائل التواصل، المنتجات
//  المميزة...) من data/config.json مع منع التخزين المؤقت تمامًا،
//  عشان أي تعديل في الرقم أو الروابط يوصل لكل الزوار فورًا من
//  غير ما يحتاجوا يعملوا Hard Refresh بأنفسهم.
//
//  للتعديل: افتح data/config.json وغيّر القيم هناك، مش هنا.
// ============================================================
// ------------------------------------------------------------
//  الشعار (اللوجو): البرنامج (تطبيق الأدمن) بيرفع صورة اللوجو في
//  المسار assets/img/site-logo.<امتداد الصورة> (جنب باقي صور
//  الموقع في نفس مجلد assets/img)، وبيكتب المسار ده في حقل
//  "logo" جوه data/config.json.
//
//  صورة اللوجو دي هي الأساس لأي مكان بيظهر فيه "شعار صغير" للموقع:
//  - أيقونة المتصفح/نتائج البحث (favicon / apple-touch-icon)
//  - صورة صغيرة جنب اسم الموقع في الهيدر والفوتر
//
//  أما assets/img/og-image.jpg فهي صورة تانية منفصلة، مخصصة بس
//  لمعاينة الروابط (Open Graph / Twitter Card) ومش بتتلمس هنا.
// ------------------------------------------------------------
function applyTotaLogo(cfg){
  const logo = cfg && cfg.logo ? String(cfg.logo).trim() : '';

  function ensureLink(rel){
    let el = document.querySelector('link[rel="' + rel + '"]');
    if (!el){
      el = document.createElement('link');
      el.rel = rel;
      document.head.appendChild(el);
    }
    return el;
  }

  if (logo){
    // أيقونة الموقع (اللي بتظهر في تاب المتصفح ونتائج البحث زي جوجل)
    ensureLink('icon').href = logo;
    ensureLink('shortcut icon').href = logo;
    ensureLink('apple-touch-icon').href = logo;
  }

  // صورة مصغّرة للوجو جنب اسم الموقع في أي هيدر/فوتر فيه class="brand"
  // أو class="footer-brand"
  document.querySelectorAll('.brand, .footer-brand').forEach(function(el){
    let img = el.querySelector('img.tota-logo-mini');
    if (logo){
      if (!img){
        img = document.createElement('img');
        img.className = 'tota-logo-mini';
        img.alt = '';
        el.prepend(img);
      }
      img.src = logo;
    } else if (img){
      img.remove();
    }
  });
}

window.TOTA_CONFIG_READY = (async function(){
  try{
    const res = await fetch('data/config.json', { cache: 'no-store' });
    const data = await res.json();
    window.TOTA_CONFIG = data;
    applyTotaLogo(data);
    return data;
  }catch(e){
    console.error('تعذر تحميل ملف الإعدادات (data/config.json)', e);
    window.TOTA_CONFIG = window.TOTA_CONFIG || {};
    return window.TOTA_CONFIG;
  }
})();
