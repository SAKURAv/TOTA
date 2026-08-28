// ============================================================
//  بيحدّث رقم عدد منتجات السلة الظاهر جنب رابط "السلة" (تحت وفوق)
//  في كل الصفحات. بيتحدّث تلقائيًا كل ما حدث تغيير في السلة عن طريق
//  الحدث tota:cart-updated (متبعوت من cart-favorites.js / cart.js).
// ============================================================
(function () {
  'use strict';

  async function refreshBadge() {
    const badges = document.querySelectorAll('[data-cart-badge]');
    if (!badges.length) return;
    // السلة تخزين محلي بالكامل دلوقتي لكل الزوار (حتى أصحاب الحساب)،
    // فمفيش داعي نتصل بـ Supabase هنا خالص.
    const count = window.TotaGuest ? window.TotaGuest.cartCount() : 0;
    badges.forEach(function (b) {
      if (count > 0) { b.textContent = count > 99 ? '99+' : String(count); b.hidden = false; }
      else { b.hidden = true; }
    });
  }

  document.addEventListener('DOMContentLoaded', refreshBadge);
  window.addEventListener('tota:cart-updated', refreshBadge);
  window.totaRefreshCartBadge = refreshBadge;
})();
