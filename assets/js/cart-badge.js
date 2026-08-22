// ============================================================
//  بيحدّث رقم عدد منتجات السلة الظاهر جنب رابط "السلة" (تحت وفوق)
//  في كل الصفحات. بيتحدّث تلقائيًا كل ما حدث تغيير في السلة عن طريق
//  الحدث tota:cart-updated (متبعوت من cart-favorites.js / cart.js).
// ============================================================
(function () {
  'use strict';

  async function getClient() {
    return window.TOTA_SUPABASE || (await window.TOTA_SUPABASE_READY);
  }

  async function refreshBadge() {
    const badges = document.querySelectorAll('[data-cart-badge]');
    if (!badges.length) return;
    const client = await getClient();
    if (!client) return;
    const { data } = await client.auth.getSession();
    const session = data && data.session;
    let count = 0;
    if (session) {
      const { data: items } = await client.from('cart_items').select('quantity').eq('user_id', session.user.id);
      count = (items || []).reduce(function (sum, it) { return sum + (it.quantity || 0); }, 0);
    } else if (window.TotaGuest) {
      count = window.TotaGuest.cartCount();
    }
    badges.forEach(function (b) {
      if (count > 0) { b.textContent = count > 99 ? '99+' : String(count); b.hidden = false; }
      else { b.hidden = true; }
    });
  }

  document.addEventListener('DOMContentLoaded', refreshBadge);
  window.addEventListener('tota:cart-updated', refreshBadge);
  window.totaRefreshCartBadge = refreshBadge;
})();
