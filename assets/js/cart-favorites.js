// ============================================================
//  العربة والمفضلة: تعمل عن طريق data-attributes على أي زرار في
//  أي صفحة، وبتحل slug المنتج (نفس id في data/products.json)
//  لـ UUID الحقيقي في جدول public.products تلقائيًا (مع كاش بسيط
//  في الذاكرة لتقليل عدد الطلبات).
//
//  ملحوظة مهمة (تغيير عن قبل): السلة والمفضلة بقت بالكامل تخزين
//  محلي (localStorage عن طريق window.TotaGuest) لكل الزوار، سواء
//  كان عندهم حساب أو لأ — بدل ما كانت بتتخزن في جداول cart_items/
//  favorites في Supabase لصاحب الحساب وبتعمل طلب لكل إضافة/شيل.
//  السبب: تقليل الحمل على قاعدة البيانات (flood/traffic) لأن السلة
//  والمفضلة بيتغيروا كتير أثناء التصفح العادي. الأوردر النهائي بس
//  (لما المستخدم يضغط "اطلب الآن") هو اللي بيتسجل فعليًا على الحساب
//  في Supabase زي ما كان بالظبط (شوف cart.js).
//
//  الاستخدام:
//   <button data-favorite-toggle-slug="accessories/xyz">♡</button>
//   <button data-add-to-cart-slug="accessories/xyz" data-qty="1">أضف للعربة</button>
// ============================================================
(function () {
  'use strict';

  function toast(msg, kind) {
    if (window.totaToast) window.totaToast(msg, kind);
  }

  function toggleFavorite(slug, btn) {
    if (!window.TotaGuest) return;
    const added = window.TotaGuest.toggleFavorite(slug);
    if (btn) {
      btn.classList.toggle('is-favorited', added);
      btn.textContent = added
        ? btn.textContent.replace('♡', '♥').replace('أضف للمفضلة', 'في المفضلة')
        : btn.textContent.replace('♥', '♡').replace('في المفضلة', 'أضف للمفضلة');
    }
    toast(added ? 'اتضاف للمفضلة ✓' : 'اتشال من المفضلة', added ? 'success' : undefined);
    window.dispatchEvent(new CustomEvent('tota:favorite-updated'));
  }

  function checkFavorite(slug) {
    return window.TotaGuest ? window.TotaGuest.isFavorite(slug) : false;
  }

  // بيرجع Set فيه slugs كل منتجات المفضلة (من التخزين المحلي).
  function getFavoriteSlugs() {
    return window.TotaGuest ? new Set(window.TotaGuest.getFavorites()) : new Set();
  }

  // إضافة للسلة بسيطة وسريعة: من غير ما نطلب رقم هاتف أو أي بيانات
  // إضافية هنا خالص — ده كله بقى بيحصل في صفحة "السلة" لما المستخدم
  // يضغط "اطلب الآن" مش وقت الإضافة، عشان تجربة تصفح وشراء سلسة.
  function addToCart(slug, qty, btn) {
    if (!window.TotaGuest) return;
    window.TotaGuest.addToCart(slug, qty);
    if (btn) {
      const original = btn.textContent;
      btn.textContent = 'تمت الإضافة ✓';
      setTimeout(function () { btn.textContent = original; }, 1500);
    }
    window.dispatchEvent(new CustomEvent('tota:cart-updated'));
    toast('اتضاف للسلة ✓', 'success');
  }

  // ملحوظة مهمة: الاستماع هنا لازم يكون في مرحلة الـ capture (المعامل
  // الأخير true) مش الـ bubble العادية. زرار المفضلة جوه كارت المنتج
  // (products.js / home.js) بيعمل event.stopPropagation() على طول عشان
  // يمنع فتح المودال لما تدوس على القلب، ولو استنينا الـ bubble فالحدث
  // بيتوقف قبل ما يوصل هنا خالص والزرار مبيعملش أي حاجة. مرحلة الـ
  // capture بتتنفذ قبل ما stopPropagation في زرار نفسه يشتغل، فالحدث
  // بيتلقط هنا الأول بغض النظر.
  document.addEventListener('click', function (e) {
    const favBtn = e.target.closest('[data-favorite-toggle-slug]');
    if (favBtn) {
      const slug = favBtn.getAttribute('data-favorite-toggle-slug');
      if (slug) toggleFavorite(slug, favBtn);
      return;
    }
    const cartBtn = e.target.closest('[data-add-to-cart-slug]');
    if (cartBtn) {
      const slug = cartBtn.getAttribute('data-add-to-cart-slug');
      const qty = parseInt(cartBtn.dataset.qty || '1', 10) || 1;
      if (slug) addToCart(slug, qty, cartBtn);
    }
  }, true);

  window.addEventListener('tota:auth-required', function () {
    const openBtn = document.querySelector('[data-account-link]');
    if (openBtn) openBtn.click();
  });

  window.totaToggleFavorite = toggleFavorite;
  window.totaAddToCart = addToCart;
  window.totaCheckFavorite = checkFavorite;
  window.totaGetFavoriteSlugs = getFavoriteSlugs;
})();