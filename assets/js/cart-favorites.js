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

  async function addToCart(slug, qty, btn) {
    const client = await getClient();
    if (!client) { toast('تعذر الاتصال بالخدمة الآن، حاول لاحقًا.', 'error'); return; }
    const session = await requireSession(client);
    if (!session) {
      toast('سجّل دخولك الأول عشان تضيف للعربة');
      window.dispatchEvent(new CustomEvent('tota:auth-required'));
      return;
    }
    // لازم رقم هاتف واتساب مسجّل قبل أي طلب — عشان الأدمن يقدر يتواصل
    // مع صاحب الأوردر فعليًا. لو مش موجود، بتفتح نافذة صغيرة تطلبه
    // وترجع تكمل نفس العملية تلقائيًا بعد ما يحفظه.
    if (!window.totaEnsurePhone) { toast('حصل خطأ غير متوقع، حاول تاني.', 'error'); return; }
    window.totaEnsurePhone(function () { _addToCartAfterPhone(client, session, slug, qty, btn); });
  }

  async function _addToCartAfterPhone(client, session, slug, qty, btn) {
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
    if (error) {
      if (btn) btn.disabled = false;
      toast('تعذر الإضافة للعربة، حاول تاني.', 'error');
      return;
    }

    // كل ما حد يضيف منتج للعربة، ده معناه طلب فعلي — فبنسجله كـ "أوردر"
    // (أو نضيفه لأوردر pending_payment مفتوح بالفعل لنفس المستخدم) عشان
    // يظهر فورًا في برنامج الأدمن برقم الهاتف وبيانات الحساب.
    await ensureOrderForCartAdd(client, userId, product, qty);

    if (btn) {
      btn.disabled = false;
      const original = btn.textContent;
      btn.textContent = 'تمت الإضافة ✓';
      setTimeout(function () { btn.textContent = original; }, 1500);
    }
    toast('تمام، هيتم التواصل معاك في أقرب وقت ✓', 'success');
  }

  // بيدوّر على أوردر "لسه ماتدفعش" (pending_payment) مفتوح لنفس المستخدم
  // ويضيفله المنتج ده، أو ينشئ أوردر جديد لو مفيش. كده كل منتجات العربة
  // بتتجمع في أوردر واحد بدل ما كل ضغطة تعمل أوردر منفصل.
  async function ensureOrderForCartAdd(client, userId, product, qty) {
    try {
      const { data: openOrder } = await client.from('orders')
        .select('id').eq('user_id', userId).eq('status', 'pending_payment')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      let orderId = openOrder && openOrder.id;
      if (!orderId) {
        const { data: newOrder, error: orderErr } = await client.from('orders')
          .insert({ user_id: userId, status: 'pending_payment', total: 0 })
          .select('id').single();
        if (orderErr || !newOrder) return;
        orderId = newOrder.id;
      }

      const unitPrice = product.price != null ? product.price : 0;
      const { data: existingItem } = await client.from('order_items')
        .select('id, quantity').eq('order_id', orderId).eq('product_id', product.id).maybeSingle();

      if (existingItem) {
        await client.from('order_items').update({ quantity: existingItem.quantity + qty }).eq('id', existingItem.id);
      } else {
        await client.from('order_items').insert({
          order_id: orderId,
          product_id: product.id,
          product_name_snapshot: product.name,
          unit_price: unitPrice,
          quantity: qty
        });
      }

      // إعادة حساب الإجمالي من كل عناصر الأوردر عشان يفضل مطابق دايمًا
      const { data: items } = await client.from('order_items').select('unit_price, quantity').eq('order_id', orderId);
      const total = (items || []).reduce(function (sum, it) { return sum + (it.unit_price * it.quantity); }, 0);
      await client.from('orders').update({ total: total }).eq('id', orderId);
    } catch (e) {
      // لو فشل تسجيل الأوردر لأي سبب، العربة نفسها لسه اتسجلت بنجاح —
      // منسيبش المستخدم يشوف رسالة فشل غير حقيقية
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
  window.totaGetFavoriteSlugs = getFavoriteSlugs;
})();
