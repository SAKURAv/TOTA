// ============================================================
//  العربة والمفضلة: تعمل عن طريق data-attributes على أي زرار في
//  أي صفحة، وبتحل slug المنتج (نفس id في data/products.json)
//  لـ UUID الحقيقي في جدول public.products تلقائيًا (مع كاش بسيط
//  في الذاكرة لتقليل عدد الطلبات).
//
//  الاستخدام:
//   <button data-favorite-toggle-slug="accessories/xyz">♡</button>
//   <button data-add-to-cart-slug="accessories/xyz" data-qty="1">أضف للعربة</button>
// ============================================================
(function () {
  'use strict';

  const slugToId = {};

  async function getClient() {
    return window.TOTA_SUPABASE || (await window.TOTA_SUPABASE_READY);
  }

  async function resolveProductId(client, slug) {
    if (slugToId[slug]) return slugToId[slug];
    const { data, error } = await client.from('products').select('id').eq('slug', slug).maybeSingle();
    if (error || !data) return null;
    slugToId[slug] = data.id;
    return data.id;
  }

  async function requireSession(client) {
    const { data } = await client.auth.getSession();
    return data.session;
  }

  async function toggleFavorite(slug, btn) {
    const client = await getClient();
    if (!client) return;
    const session = await requireSession(client);
    if (!session) { window.dispatchEvent(new CustomEvent('tota:auth-required')); return; }
    const productId = await resolveProductId(client, slug);
    if (!productId) { console.error('المنتج غير متزامن بعد مع قاعدة البيانات:', slug); return; }
    const userId = session.user.id;

    const { data: existing } = await client.from('favorites')
      .select('user_id').eq('user_id', userId).eq('product_id', productId).maybeSingle();

    if (existing) {
      await client.from('favorites').delete().eq('user_id', userId).eq('product_id', productId);
      if (btn) { btn.classList.remove('is-favorited'); btn.textContent = btn.textContent.replace('♥', '♡').replace('في المفضلة', 'أضف للمفضلة'); }
    } else {
      await client.from('favorites').insert({ user_id: userId, product_id: productId });
      if (btn) { btn.classList.add('is-favorited'); btn.textContent = btn.textContent.replace('♡', '♥').replace('أضف للمفضلة', 'في المفضلة'); }
    }
  }

  async function checkFavorite(slug) {
    const client = await getClient();
    if (!client) return false;
    const session = await requireSession(client);
    if (!session) return false;
    const productId = await resolveProductId(client, slug);
    if (!productId) return false;
    const { data } = await client.from('favorites')
      .select('user_id').eq('user_id', session.user.id).eq('product_id', productId).maybeSingle();
    return !!data;
  }

  async function addToCart(slug, qty, btn) {
    const client = await getClient();
    if (!client) return;
    const session = await requireSession(client);
    if (!session) { window.dispatchEvent(new CustomEvent('tota:auth-required')); return; }
    const productId = await resolveProductId(client, slug);
    if (!productId) { console.error('المنتج غير متزامن بعد مع قاعدة البيانات:', slug); return; }
    const userId = session.user.id;

    const { data: existing } = await client.from('cart_items')
      .select('id, quantity').eq('user_id', userId).eq('product_id', productId).maybeSingle();

    if (existing) {
      await client.from('cart_items').update({ quantity: existing.quantity + qty }).eq('id', existing.id);
    } else {
      await client.from('cart_items').insert({ user_id: userId, product_id: productId, quantity: qty });
    }
    if (btn) {
      const original = btn.textContent;
      btn.textContent = 'تمت الإضافة ✓';
      setTimeout(function () { btn.textContent = original; }, 1500);
    }
  }

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
  });

  window.addEventListener('tota:auth-required', function () {
    const openBtn = document.querySelector('[data-account-link]');
    if (openBtn) openBtn.click();
  });

  window.totaToggleFavorite = toggleFavorite;
  window.totaAddToCart = addToCart;
  window.totaCheckFavorite = checkFavorite;
})();
