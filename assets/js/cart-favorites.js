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
  const slugToProduct = {};

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

  // زي resolveProductId بس بيرجع الاسم والسعر كمان — محتاجينهم وقت إنشاء
  // الأوردر عشان نحفظ "صورة" من بيانات المنتج وقت الطلب (product_name_snapshot)
  async function resolveProduct(client, slug) {
    if (slugToProduct[slug]) return slugToProduct[slug];
    const { data, error } = await client.from('products').select('id, name, price').eq('slug', slug).maybeSingle();
    if (error || !data) return null;
    slugToId[slug] = data.id;
    slugToProduct[slug] = data;
    return data;
  }

  async function requireSession(client) {
    const { data } = await client.auth.getSession();
    return data.session;
  }

  function toast(msg, kind) {
    if (window.totaToast) window.totaToast(msg, kind);
  }

  async function toggleFavorite(slug, btn) {
    const client = await getClient();
    if (!client) { toast('تعذر الاتصال بالخدمة الآن، حاول لاحقًا.', 'error'); return; }
    const session = await requireSession(client);
    if (!session) {
      toast('سجّل دخولك الأول عشان تضيف للمفضلة');
      window.dispatchEvent(new CustomEvent('tota:auth-required'));
      return;
    }
    const productId = await resolveProductId(client, slug);
    if (!productId) { toast('المنتج ده لسه بيتزامن مع النظام، جرب تاني بعد شوية.', 'error'); return; }
    const userId = session.user.id;
    if (btn) btn.disabled = true;

    const { data: existing } = await client.from('favorites')
      .select('user_id').eq('user_id', userId).eq('product_id', productId).maybeSingle();

    if (existing) {
      const { error } = await client.from('favorites').delete().eq('user_id', userId).eq('product_id', productId);
      if (btn) btn.disabled = false;
      if (error) { toast('تعذر الحذف من المفضلة، حاول تاني.', 'error'); return; }
      if (btn) { btn.classList.remove('is-favorited'); btn.textContent = btn.textContent.replace('♥', '♡').replace('في المفضلة', 'أضف للمفضلة'); }
      toast('اتشال من المفضلة');
    } else {
      const { error } = await client.from('favorites').insert({ user_id: userId, product_id: productId });
      if (btn) btn.disabled = false;
      if (error) { toast('تعذر الإضافة للمفضلة، حاول تاني.', 'error'); return; }
      if (btn) { btn.classList.add('is-favorited'); btn.textContent = btn.textContent.replace('♡', '♥').replace('أضف للمفضلة', 'في المفضلة'); }
      toast('اتضاف للمفضلة ✓', 'success');
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

  // بيرجع Set فيه slugs كل منتجات المفضلة بطلب واحد بس لقاعدة البيانات
  // (بدل ما نسأل عن كل منتج لوحده وقت عرض شبكة المنتجات، وده بيوفر
  // عدد كبير من الطلبات لما يكون فيه عشرات المنتجات معروضة مرة واحدة).
  async function getFavoriteSlugs() {
    const client = await getClient();
    if (!client) return new Set();
    const session = await requireSession(client);
    if (!session) return new Set();
    const { data, error } = await client.from('favorites')
      .select('products(slug)').eq('user_id', session.user.id);
    if (error || !data) return new Set();
    const slugs = new Set();
    data.forEach(function (row) {
      if (row.products && row.products.slug) slugs.add(row.products.slug);
    });
    return slugs;
  }

  // إضافة للسلة بسيطة وسريعة: من غير ما نطلب رقم هاتف أو أي بيانات
  // إضافية هنا خالص — ده كله بقى بيحصل في صفحة "السلة" لما المستخدم
  // يضغط "اطلب الآن" مش وقت الإضافة، عشان تجربة تصفح وشراء سلسة.
  async function addToCart(slug, qty, btn) {
    const client = await getClient();
    if (!client) { toast('تعذر الاتصال بالخدمة الآن، حاول لاحقًا.', 'error'); return; }
    const session = await requireSession(client);
    if (!session) {
      toast('سجّل دخولك الأول عشان تضيف للسلة');
      window.dispatchEvent(new CustomEvent('tota:auth-required'));
      return;
    }
    const product = await resolveProduct(client, slug);
    if (!product) { toast('المنتج ده لسه بيتزامن مع النظام، جرب تاني بعد شوية.', 'error'); return; }
    const userId = session.user.id;
    if (btn) btn.disabled = true;

    const { data: existingCart } = await client.from('cart_items')
      .select('id, quantity').eq('user_id', userId).eq('product_id', product.id).maybeSingle();

    let error;
    if (existingCart) {
      ({ error } = await client.from('cart_items').update({ quantity: existingCart.quantity + qty }).eq('id', existingCart.id));
    } else {
      ({ error } = await client.from('cart_items').insert({ user_id: userId, product_id: product.id, quantity: qty }));
    }
    if (btn) btn.disabled = false;
    if (error) { toast('تعذر الإضافة للسلة، حاول تاني.', 'error'); return; }

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
