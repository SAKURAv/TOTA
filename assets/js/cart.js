// ============================================================
//  منطق صفحة السلة: عرض المنتجات المضافة، تعديل الكمية أو حذف
//  منتج، اختيار عنوان (أو إضافة واحد جديد)، كتابة ملاحظة، وحساب
//  الإجمالي (منتجات + توصيل) قبل ما يتبعت الأوردر كله دفعة واحدة.
//
//  فيه وضعين:
//   - مستخدم عنده حساب: زي ما كان بالظبط (cart_items/orders/favorites
//     في Supabase، مربوطين بـ user_id).
//   - زائر من غير حساب: السلة والمفضلة كلها محلية (localStorage عن
//     طريق window.TotaGuest)، ولما يضغط "اطلب الآن" لازم يكتب رقم
//     تليفونه وعنوانه، وبيتبعت الأوردر عن طريق RPC (place_guest_order)
//     بـ user_id = null + guest_phone/guest_name/guest_address، وبعدين
//     id الأوردر بيتخزن محليًا عشان يقدر يتابع حالته من تاب "أوردراتي"
//     من غير ما يحتاج حساب خالص.
// ============================================================
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async function () {
    const client = window.TOTA_SUPABASE || (await window.TOTA_SUPABASE_READY);
    if (!client) return;
    const { data: sessionData } = await client.auth.getSession();
    const session = sessionData && sessionData.session;
    const user = session ? session.user : null;
    const isGuest = !user;
    document.getElementById('cartBody').hidden = false;

    // ---------------- تابات "السلة" / "المفضلة" / "أوردراتي" ----------------
    const tabsEl = document.getElementById('cartTabs');
    const ordersPanelEl = document.getElementById('cartOrders');
    const favoritesPanelEl = document.getElementById('cartFavorites');
    const cartBodyEl = document.getElementById('cartBody');
    tabsEl.hidden = false;
    let ordersLoaded = false;
    let favoritesLoaded = false;
    function switchCartTab(tab) {
      tabsEl.querySelectorAll('[data-cart-tab]').forEach(function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-cart-tab') === tab);
      });
      cartBodyEl.hidden = tab !== 'cart';
      ordersPanelEl.hidden = tab !== 'orders';
      favoritesPanelEl.hidden = tab !== 'favorites';
      if (tab === 'orders' && !ordersLoaded) { ordersLoaded = true; loadMyOrders(); }
      if (tab === 'favorites' && !favoritesLoaded) { favoritesLoaded = true; loadFavorites(); }
    }
    tabsEl.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-cart-tab]');
      if (btn) switchCartTab(btn.getAttribute('data-cart-tab'));
    });

    // بيانات المنتجات الثابتة (اسم/صورة/سعر) عشان نعرضها جنب كل سطر في
    // السلة — المصدر الحقيقي للسعر وقت الطلب هو دايمًا جدول products في
    // Supabase (بيتقرا هنا مباشرة للمستخدم صاحب حساب، وجوه الـ RPC نفسها
    // لزائر من غير حساب)، والملف ده بس للصورة والعرض + كسلة الزائر
    // المحلية اللي محتاجة الاسم/السعر من مكان ما لأنها بتخزن slug بس.
    let productsCatalog = {};
    try {
      const res = await fetch('data/products.json', { cache: 'no-store' });
      const json = await res.json();
      (json.products || []).forEach(function (p) { productsCatalog[p.id] = p; });
    } catch (e) { /* لو فشل تحميل الكتالوج، هنعرض بدون صورة بس */ }

    // ---------------- المفضلة ----------------
    async function loadFavorites() {
      const listEl = document.getElementById('cartFavoritesList');
      listEl.innerHTML = 'جاري التحميل...';

      if (isGuest) {
        const slugs = window.TotaGuest ? window.TotaGuest.getFavorites() : [];
        if (!slugs.length) { listEl.innerHTML = '<p style="color:var(--muted);">مفيش منتجات في المفضلة لسه.</p>'; return; }
        listEl.innerHTML = slugs.map(function (slug) {
          const catalog = productsCatalog[slug] || {};
          const img = catalog.image ? ('<img src="' + catalog.image + '" alt="">') : '';
          return (
            '<div class="fav-item" data-fav-slug="' + slug + '">' +
            '<div class="fav-item-media">' + img + '</div>' +
            '<div class="fav-item-info">' +
            '<a href="p/' + slug + '/">' + (catalog.name || 'منتج') + '</a>' +
            (catalog.price ? ('<div class="fav-item-price">' + money(catalog.price) + ' ج.م</div>') : '') +
            '</div>' +
            '<div class="fav-item-actions">' +
            '<button type="button" class="btn-primary" data-fav-add-cart>أضف للسلة</button>' +
            '<button type="button" class="fav-remove-btn" data-fav-remove>حذف من المفضلة</button>' +
            '</div>' +
            '</div>'
          );
        }).join('');
        return;
      }

      const { data: favorites, error } = await client.from('favorites')
        .select('product_id, products(id, name, slug, price)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error || !favorites || !favorites.length) {
        listEl.innerHTML = '<p style="color:var(--muted);">مفيش منتجات في المفضلة لسه.</p>';
        return;
      }
      listEl.innerHTML = favorites.map(function (f) {
        const p = f.products;
        if (!p) return '';
        const catalog = productsCatalog[p.slug] || {};
        const img = catalog.image ? ('<img src="' + catalog.image + '" alt="">') : '';
        return (
          '<div class="fav-item" data-fav="' + p.id + '" data-slug="' + p.slug + '">' +
          '<div class="fav-item-media">' + img + '</div>' +
          '<div class="fav-item-info">' +
          '<a href="p/' + p.slug + '/">' + (p.name || 'منتج') + '</a>' +
          (p.price ? ('<div class="fav-item-price">' + money(p.price) + ' ج.م</div>') : '') +
          '</div>' +
          '<div class="fav-item-actions">' +
          '<button type="button" class="btn-primary" data-fav-add-cart>أضف للسلة</button>' +
          '<button type="button" class="fav-remove-btn" data-fav-remove>حذف من المفضلة</button>' +
          '</div>' +
          '</div>'
        );
      }).join('');
    }

    document.getElementById('cartFavoritesList').addEventListener('click', async function (e) {
      if (isGuest) {
        const row = e.target.closest('[data-fav-slug]');
        if (!row) return;
        const slug = row.dataset.favSlug;
        if (e.target.closest('[data-fav-remove]')) {
          window.TotaGuest.removeFavorite(slug);
          row.remove();
          window.dispatchEvent(new CustomEvent('tota:favorite-updated'));
        } else if (e.target.closest('[data-fav-add-cart]')) {
          window.TotaGuest.addToCart(slug, 1);
          if (window.totaToast) window.totaToast('اتضاف للسلة ✓', 'success');
          window.dispatchEvent(new CustomEvent('tota:cart-updated'));
          await loadCart();
        }
        return;
      }
      const row = e.target.closest('[data-fav]');
      if (!row) return;
      const productId = row.dataset.fav;
      if (e.target.closest('[data-fav-remove]')) {
        await client.from('favorites').delete().eq('user_id', user.id).eq('product_id', productId);
        row.remove();
        window.dispatchEvent(new CustomEvent('tota:favorite-updated'));
      } else if (e.target.closest('[data-fav-add-cart]')) {
        const { data: existing } = await client.from('cart_items')
          .select('id, quantity').eq('user_id', user.id).eq('product_id', productId).maybeSingle();
        if (existing) {
          await client.from('cart_items').update({ quantity: existing.quantity + 1 }).eq('id', existing.id);
        } else {
          await client.from('cart_items').insert({ user_id: user.id, product_id: productId, quantity: 1 });
        }
        if (window.totaToast) window.totaToast('اتضاف للسلة ✓', 'success');
        window.dispatchEvent(new CustomEvent('tota:cart-updated'));
        await loadCart();
      }
    });

    // ---------------- أوردراتي ----------------
    const PAYMENT_STATUS_LABELS = { unpaid: 'لم يتم الدفع', partial: 'تم دفع جزء من المبلغ', paid: 'تم الدفع بالكامل' };
    const DELIVERY_STATUS_LABELS = { not_shipped: 'لم يشحن', out_for_delivery: 'خرج للتوصيل', shipping: 'جار التوصيل', delivered: 'تم التوصيل' };

    function renderOrder(o) {
      const itemsHtml = (o.order_items || []).map(function (it) {
        return '<li>' + it.product_name_snapshot + ' × ' + it.quantity + ' — ' + it.unit_price + ' ج.م</li>';
      }).join('');
      const paymentLabel = PAYMENT_STATUS_LABELS[o.payment_status] || o.payment_status || 'لم يتم الدفع';
      const deliveryLabel = DELIVERY_STATUS_LABELS[o.delivery_status] || o.delivery_status || 'لم يشحن';
      const paymentClass = o.payment_status === 'paid' ? 'is-done' : (o.payment_status === 'partial' ? 'is-progress' : 'is-cancelled');
      const deliveryClass = o.delivery_status === 'delivered' ? 'is-done' : 'is-progress';
      return '<div class="orders-list-item">' +
        '<div class="orders-list-head">' +
        '<strong>أوردر #' + o.id.slice(0, 8) + '</strong>' +
        '</div>' +
        '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">' +
        '<span class="orders-status-badge ' + paymentClass + '">💳 ' + paymentLabel + '</span>' +
        '<span class="orders-status-badge ' + deliveryClass + '">🚚 ' + deliveryLabel + '</span>' +
        '</div>' +
        '<ul class="orders-list-items">' + itemsHtml + '</ul>' +
        '<div class="orders-list-total">الإجمالي: ' + o.total + ' ج.م' +
        (o.payment_status === 'partial' ? (' (اتدفع ' + (o.paid_amount || 0) + ' ج.م)') : '') + '</div>' +
        '</div>';
    }
    function isDoneOrder(o) { return o.status === 'delivered' || o.delivery_status === 'delivered' || o.status === 'cancelled'; }

    async function loadMyOrders() {
      const pendingEl = document.getElementById('cartOrdersPending');
      const doneEl = document.getElementById('cartOrdersDone');

      if (isGuest) {
        const refs = window.TotaGuest ? window.TotaGuest.getOrderRefs() : [];
        if (!refs.length) {
          pendingEl.innerHTML = '<p style="color:var(--muted);">مفيش أوردرات لسه. أوردراتك بتتحفظ هنا تلقائيًا بعد ما تطلب من نفس المتصفح ده.</p>';
          doneEl.innerHTML = '';
          return;
        }
        // بنجمّع الأوردرات حسب رقم التليفون (غالبًا رقم واحد بس) عشان
        // نبعت أقل عدد ممكن من الطلبات لدالة get_guest_orders.
        const byPhone = {};
        refs.forEach(function (r) { (byPhone[r.phone] = byPhone[r.phone] || []).push(r.id); });
        let orders = [];
        for (const phone of Object.keys(byPhone)) {
          const { data, error } = await client.rpc('get_guest_orders', { p_order_ids: byPhone[phone], p_phone: phone });
          if (!error && data) orders = orders.concat(data.map(function (o) { return Object.assign({}, o, { order_items: o.items }); }));
        }
        orders.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        if (!orders.length) {
          pendingEl.innerHTML = '<p style="color:var(--muted);">مفيش أوردرات لسه.</p>';
          doneEl.innerHTML = '';
          return;
        }
        const pending = orders.filter(function (o) { return !isDoneOrder(o); });
        const done = orders.filter(isDoneOrder);
        pendingEl.innerHTML = pending.length ? pending.map(renderOrder).join('') : '<p style="color:var(--muted);">مفيش أوردرات لسه ما وصلتش.</p>';
        doneEl.innerHTML = done.length ? done.map(renderOrder).join('') : '<p style="color:var(--muted);">مفيش أوردرات مكتملة لسه.</p>';
        return;
      }

      const { data: orders, error } = await client.from('orders')
        .select('id, status, payment_status, delivery_status, paid_amount, total, created_at, order_items(id, product_name_snapshot, unit_price, quantity)')
        .eq('user_id', user.id)
        .neq('status', 'pending_payment')
        .order('created_at', { ascending: false });
      if (error || !orders || !orders.length) {
        pendingEl.innerHTML = '<p style="color:var(--muted);">مفيش أوردرات لسه.</p>';
        doneEl.innerHTML = '';
        return;
      }
      const pending = orders.filter(function (o) { return !isDoneOrder(o); });
      const done = orders.filter(isDoneOrder);
      pendingEl.innerHTML = pending.length ? pending.map(renderOrder).join('') : '<p style="color:var(--muted);">مفيش أوردرات لسه ما وصلتش.</p>';
      doneEl.innerHTML = done.length ? done.map(renderOrder).join('') : '<p style="color:var(--muted);">مفيش أوردرات مكتملة لسه.</p>';
    }

    // ---------------- رسالة تأكيد الطلب ----------------
    const confirmOverlay = document.getElementById('orderConfirmOverlay');
    const confirmWhatsappBtn = document.getElementById('orderConfirmWhatsappBtn');
    document.getElementById('orderConfirmCloseBtn').addEventListener('click', function () {
      confirmOverlay.classList.remove('open');
    });
    document.getElementById('orderConfirmViewOrdersBtn').addEventListener('click', function () {
      confirmOverlay.classList.remove('open');
      switchCartTab('orders');
      ordersLoaded = false;
      loadMyOrders();
      ordersLoaded = true;
    });

    // بيبني رابط واتساب برسالة جاهزة (رقم الأوردر المختصر لـ 8 رموز — زي
    // ما بيظهر بالظبط في برنامج الأدمن عشان يتقدر يتلاقي بيه — + الاسم لو
    // متوفر + رقم الهاتف كامل بكود الدولة)، ويحطه في زرار "الذهاب إلى
    // الواتساب" جوه رسالة تأكيد الطلب. رقم الواتساب بييجي من
    // data/config.json (نفس المصدر في كل الموقع).
    async function openOrderConfirm(info) {
      const shortOrderId = (info.orderId || '').replace(/-/g, '').slice(0, 8).toUpperCase();
      try {
        const cfg = window.TOTA_CONFIG || (window.TOTA_CONFIG_READY ? await window.TOTA_CONFIG_READY : {});
        const waNumber = ((cfg && cfg.whatsapp) || '').replace(/\D/g, '');
        const lines = ['السلام عليكم، طلبت اوردر وعايز اعرف باقي خطوات الدفع.', ''];
        if (shortOrderId) lines.push('رقم الطلب: ```' + shortOrderId + '```');
        if (info.name) lines.push('الاسم: ' + info.name);
        if (info.phone) lines.push('رقم الهاتف: ' + info.phone);
        const text = encodeURIComponent(lines.join('\n'));
        confirmWhatsappBtn.href = waNumber ? ('https://wa.me/' + waNumber + '?text=' + text) : '#';
      } catch (e) {
        confirmWhatsappBtn.href = '#';
      }
      confirmOverlay.classList.add('open');
    }

    // ---------------- عرض عناصر السلة ----------------
    const itemsListEl = document.getElementById('cartItemsList');
    const emptyEl = document.getElementById('cartEmpty');
    const checkoutAreaEl = document.getElementById('cartCheckoutArea');
    const subtotalEl = document.getElementById('cartSubtotal');
    const deliveryEl = document.getElementById('cartDelivery');
    const totalEl = document.getElementById('cartTotal');
    const submitBtn = document.getElementById('cartSubmitBtn');
    const submitStatusEl = document.getElementById('cartSubmitStatus');

    let cartRows = []; // { id (row id لو حساب / slug لو زائر), quantity, product_id, name, price, slug, image }
    let deliveryPrice = 0;
    let selectedAddressId = null;

    function money(n) { return (n || 0).toLocaleString('ar-EG'); }

    function computeSubtotal() {
      return cartRows.reduce(function (sum, r) { return sum + (r.price || 0) * r.quantity; }, 0);
    }

    function renderSummary() {
      const subtotal = computeSubtotal();
      subtotalEl.textContent = money(subtotal);
      deliveryEl.textContent = money(deliveryPrice);
      totalEl.textContent = money(subtotal + deliveryPrice);
    }

    function renderItems() {
      if (!cartRows.length) {
        itemsListEl.innerHTML = '';
        emptyEl.hidden = false;
        checkoutAreaEl.hidden = true;
        return;
      }
      emptyEl.hidden = true;
      checkoutAreaEl.hidden = false;
      itemsListEl.innerHTML = cartRows.map(function (r) {
        const img = r.image ? ('<img src="' + r.image + '" alt="">') : '';
        const link = r.slug ? ('p/' + r.slug + '/') : '#';
        return (
          '<div class="cart-item" data-row="' + r.id + '">' +
          '<div class="cart-item-media">' + img + '</div>' +
          '<div class="cart-item-info">' +
          '<a href="' + link + '">' + (r.name || 'منتج') + '</a>' +
          '<div class="cart-item-price">' + money(r.price) + ' × ' + r.quantity + ' = ' + money(r.price * r.quantity) + '</div>' +
          '</div>' +
          '<div class="cart-qty">' +
          '<button type="button" data-qty-minus>−</button>' +
          '<span>' + r.quantity + '</span>' +
          '<button type="button" data-qty-plus>+</button>' +
          '</div>' +
          '<button type="button" class="cart-item-remove" data-remove>حذف</button>' +
          '</div>'
        );
      }).join('');
      renderSummary();
    }

    async function loadCart() {
      if (isGuest) {
        const local = window.TotaGuest ? window.TotaGuest.getCart() : [];
        cartRows = local.map(function (row) {
          const catalog = productsCatalog[row.slug] || {};
          return {
            id: row.slug,
            quantity: row.quantity,
            product_id: null, // بيتحل فعليًا وقت الطلب
            name: catalog.name,
            price: catalog.price || 0,
            slug: row.slug,
            image: catalog.image
          };
        });
        renderItems();
        return;
      }
      const { data, error } = await client.from('cart_items')
        .select('id, quantity, product_id, products(id, name, slug, price)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error || !data) { cartRows = []; renderItems(); return; }
      cartRows = data.map(function (row) {
        const p = row.products || {};
        const catalog = productsCatalog[p.slug] || {};
        return {
          id: row.id,
          quantity: row.quantity,
          product_id: row.product_id,
          name: p.name || catalog.name,
          price: p.price != null ? p.price : (catalog.price || 0),
          slug: p.slug,
          image: catalog.image
        };
      });
      renderItems();
    }

    async function loadDeliveryPrice() {
      const { data } = await client.from('settings').select('delivery_price').eq('id', 1).maybeSingle();
      deliveryPrice = (data && data.delivery_price) || 0;
      renderSummary();
    }

    itemsListEl.addEventListener('click', async function (e) {
      const row = e.target.closest('[data-row]');
      if (!row) return;
      const id = row.dataset.row;
      const item = cartRows.find(function (r) { return r.id === id; });
      if (!item) return;

      if (e.target.closest('[data-qty-plus]')) {
        item.quantity += 1;
        if (isGuest) window.TotaGuest.setCartQty(item.slug, item.quantity);
        else await client.from('cart_items').update({ quantity: item.quantity }).eq('id', id);
        renderItems();
        window.dispatchEvent(new CustomEvent('tota:cart-updated'));
      } else if (e.target.closest('[data-qty-minus]')) {
        if (item.quantity <= 1) return;
        item.quantity -= 1;
        if (isGuest) window.TotaGuest.setCartQty(item.slug, item.quantity);
        else await client.from('cart_items').update({ quantity: item.quantity }).eq('id', id);
        renderItems();
        window.dispatchEvent(new CustomEvent('tota:cart-updated'));
      } else if (e.target.closest('[data-remove]')) {
        if (isGuest) window.TotaGuest.removeFromCart(item.slug);
        else await client.from('cart_items').delete().eq('id', id);
        cartRows = cartRows.filter(function (r) { return r.id !== id; });
        renderItems();
        window.dispatchEvent(new CustomEvent('tota:cart-updated'));
      }
    });

    // ---------------- العناوين (صاحب حساب) / بيانات الزائر ----------------
    const addressSectionEl = document.getElementById('cartAddressSection');
    const guestFieldsSectionEl = document.getElementById('cartGuestFieldsSection');
    const addrListEl = document.getElementById('cartAddressList');

    if (isGuest) {
      addressSectionEl.hidden = true;
      guestFieldsSectionEl.hidden = false;
      const info = window.TotaGuest ? window.TotaGuest.getInfo() : {};
      const nameInput = document.getElementById('cartGuestName');
      const phoneInput = document.getElementById('cartGuestPhone');
      const addressInput = document.getElementById('cartGuestAddress');
      if (info.name) nameInput.value = info.name;
      if (info.address) addressInput.value = info.address;
      if (window.totaScanPhoneInputs) window.totaScanPhoneInputs();
      if (info.local) phoneInput.value = info.local;
      if (info.countryCode && window.totaSetPhoneCountry) {
        // totaSetPhoneCountry بيحتاج الـ select يكون اتعمل الأول (بعد scan)
        setTimeout(function () { window.totaSetPhoneCountry(phoneInput, info.countryCode); }, 0);
      }
    } else {
      async function loadAddresses() {
        const { data: addresses } = await client.from('addresses')
          .select('id, label, full_address, city, is_default')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (!addresses || !addresses.length) {
          addrListEl.innerHTML = '<p style="color:var(--muted); font-size:13.5px;">مفيش عناوين محفوظة — ضيف عنوان عشان تقدر تطلب.</p>';
          selectedAddressId = null;
          return;
        }
        if (!selectedAddressId || !addresses.some(function (a) { return a.id === selectedAddressId; })) {
          const def = addresses.find(function (a) { return a.is_default; });
          selectedAddressId = (def || addresses[0]).id;
        }
        addrListEl.innerHTML = addresses.map(function (a) {
          return (
            '<label class="cart-addr-row">' +
            '<input type="radio" name="cartAddr" value="' + a.id + '" ' + (a.id === selectedAddressId ? 'checked' : '') + '>' +
            '<span class="cart-addr-text"><strong>' + (a.label || 'عنوان') + '</strong>' +
            '<span>' + a.full_address + (a.city ? (' — ' + a.city) : '') + '</span></span>' +
            '</label>'
          );
        }).join('');
      }
      addrListEl.addEventListener('change', function (e) {
        if (e.target.name === 'cartAddr') selectedAddressId = e.target.value;
      });

      const showAddBtn = document.getElementById('cartShowAddAddress');
      const addForm = document.getElementById('cartAddAddressForm');
      showAddBtn.addEventListener('click', function () { addForm.hidden = !addForm.hidden; });
      addForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const fd = new FormData(addForm);
        const { data: inserted, error } = await client.from('addresses').insert({
          user_id: user.id,
          label: fd.get('label'),
          full_address: fd.get('full_address'),
          city: fd.get('city')
        }).select('id').single();
        if (error) { alert('تعذر إضافة العنوان، حاول تاني.'); return; }
        addForm.reset();
        addForm.hidden = true;
        selectedAddressId = inserted.id;
        await loadAddresses();
      });

      window.__totaCartLoadAddresses = loadAddresses;
    }

    // ---------------- اطلب الآن ----------------
    submitBtn.addEventListener('click', async function () {
      if (!cartRows.length) return;

      if (isGuest) {
        const nameInput = document.getElementById('cartGuestName');
        const phoneInput = document.getElementById('cartGuestPhone');
        const addressInput = document.getElementById('cartGuestAddress');
        const phone = window.totaGetFullPhone ? window.totaGetFullPhone(phoneInput) : phoneInput.value.trim();
        const countryCode = window.totaGetPhoneDial ? window.totaGetPhoneDial(phoneInput) : '+20';
        if (!phoneInput.value.trim() || phone.length < 8) {
          submitStatusEl.style.color = '#d64545';
          submitStatusEl.textContent = 'لازم تكتب رقم هاتف صحيح الأول.';
          phoneInput.focus();
          return;
        }
        if (!addressInput.value.trim()) {
          submitStatusEl.style.color = '#d64545';
          submitStatusEl.textContent = 'لازم تكتب عنوان التوصيل الأول.';
          addressInput.focus();
          return;
        }
        submitBtn.disabled = true;
        submitStatusEl.style.color = 'var(--muted)';
        submitStatusEl.textContent = '';
        await placeGuestOrder({
          name: nameInput.value.trim(),
          phone: phone,
          local: phoneInput.value.trim(),
          countryCode: countryCode,
          address: addressInput.value.trim()
        });
        return;
      }

      if (!selectedAddressId) {
        submitStatusEl.style.color = '#d64545';
        submitStatusEl.textContent = 'اختار عنوان التوصيل الأول (أو ضيف واحد جديد).';
        return;
      }
      if (!window.totaEnsurePhone) { submitStatusEl.textContent = 'حصل خطأ غير متوقع، حاول تاني.'; return; }
      submitBtn.disabled = true;
      submitStatusEl.style.color = 'var(--muted)';
      submitStatusEl.textContent = '';
      window.totaEnsurePhone(async function (_sess, _phone) {
        await placeOrder();
      });
      // لو المستخدم قفل نافذة طلب الرقم من غير ما يكمل، نرجع الزرار شغال
      setTimeout(function () { if (submitBtn.disabled) submitBtn.disabled = false; }, 15000);
    });

    // نفس المنطق بالظبط بتاع resolveProductId في cart-favorites.js، لكن
    // محتاجينه هنا كمان عشان نحوّل slugs السلة المحلية لـ UUID حقيقي
    // وقت إرسال أوردر الزائر (السلة المحلية بتخزن slug بس مش الـ id).
    const slugToId = {};
    async function resolveProductId(slug) {
      if (slugToId[slug]) return slugToId[slug];
      const { data } = await client.from('products').select('id').eq('slug', slug).maybeSingle();
      if (!data) return null;
      slugToId[slug] = data.id;
      return data.id;
    }

    async function placeGuestOrder(info) {
      try {
        const resolvedItems = [];
        for (const r of cartRows) {
          const productId = await resolveProductId(r.slug);
          if (productId) resolvedItems.push({ product_id: productId, quantity: r.quantity });
        }
        if (!resolvedItems.length) throw new Error('no valid items');
        const note = (document.getElementById('cartNoteInput').value || '').trim();

        const { data: orderId, error } = await client.rpc('place_guest_order', {
          p_guest_name: info.name || null,
          p_guest_phone: info.phone,
          p_guest_address: info.address,
          p_country_code: info.countryCode,
          p_note: note || null,
          p_items: resolvedItems
        });
        if (error || !orderId) throw error || new Error('place_guest_order failed');

        // نخزّن الأوردر ده وبيانات الزائر محليًا في المتصفح فقط
        window.TotaGuest.addOrderRef(orderId, info.phone);
        window.TotaGuest.setInfo({ name: info.name, local: info.local, countryCode: info.countryCode, address: info.address });

        // إشعار تليجرام فوري (زي بالظبط تدفق صاحب الحساب)
        if (window.totaNotifyOrderTelegram) {
          window.totaNotifyOrderTelegram({
            name: (info.name || 'بدون اسم') + ' (ضيف بدون حساب)',
            phone: info.local || info.phone,
            countryCode: info.countryCode,
            address: info.address,
            items: cartRows.map(function (r) { return { name: r.name || 'منتج', quantity: r.quantity, price: r.price || 0 }; }),
            deliveryPrice: deliveryPrice,
            total: computeSubtotal() + deliveryPrice,
            note: note
          });
        }

        submitStatusEl.style.color = '#2e7d32';
        submitStatusEl.textContent = 'تم إرسال طلبك بنجاح ✓';
        window.TotaGuest.clearCart();
        cartRows = [];
        renderItems();
        window.dispatchEvent(new CustomEvent('tota:cart-updated'));
        await openOrderConfirm({ orderId: orderId, name: info.name, phone: info.phone });
        ordersLoaded = false;
      } catch (e) {
        submitStatusEl.style.color = '#d64545';
        submitStatusEl.textContent = 'حصل خطأ وإحنا بنبعت الطلب، حاول تاني.';
      } finally {
        submitBtn.disabled = false;
      }
    }

    async function placeOrder() {
      try {
        const { data: profile } = await client.from('profiles').select('full_name, phone, country_code').eq('id', user.id).maybeSingle();
        const countryCode = (profile && profile.country_code) || '+20';
        const { data: selectedAddress } = await client.from('addresses')
          .select('label, full_address, city')
          .eq('id', selectedAddressId)
          .maybeSingle();
        const subtotal = computeSubtotal();
        const note = (document.getElementById('cartNoteInput').value || '').trim();

        const { data: order, error: orderErr } = await client.from('orders').insert({
          user_id: user.id,
          address_id: selectedAddressId,
          status: 'placed',
          total: subtotal + deliveryPrice,
          delivery_price: deliveryPrice,
          payment_status: 'unpaid',
          delivery_status: 'not_shipped',
          note: note || null,
          country_code: countryCode
        }).select().single();
        if (orderErr || !order) throw orderErr || new Error('order insert failed');

        const itemsPayload = cartRows.map(function (r) {
          return {
            order_id: order.id,
            product_id: r.product_id,
            product_name_snapshot: r.name || 'منتج',
            unit_price: r.price || 0,
            quantity: r.quantity
          };
        });
        const { error: itemsErr } = await client.from('order_items').insert(itemsPayload);
        if (itemsErr) throw itemsErr;

        await client.from('cart_items').delete().eq('user_id', user.id);

        if (window.totaNotifyOrderTelegram) {
          window.totaNotifyOrderTelegram({
            name: (profile && profile.full_name) || 'بدون اسم',
            phone: (profile && profile.phone) || '',
            countryCode: countryCode,
            address: selectedAddress
              ? ((selectedAddress.label || 'عنوان') + ': ' + selectedAddress.full_address + (selectedAddress.city ? (' — ' + selectedAddress.city) : ''))
              : 'بدون عنوان',
            items: cartRows.map(function (r) {
              return { name: r.name || 'منتج', quantity: r.quantity, price: r.price || 0 };
            }),
            deliveryPrice: deliveryPrice,
            total: subtotal + deliveryPrice,
            note: note
          });
        }

        submitStatusEl.style.color = '#2e7d32';
        submitStatusEl.textContent = 'تم إرسال طلبك بنجاح ✓';
        cartRows = [];
        renderItems();
        window.dispatchEvent(new CustomEvent('tota:cart-updated'));
        const fullPhone = (profile && profile.phone)
          ? (countryCode + (window.totaStripLeadingZeros ? window.totaStripLeadingZeros(profile.phone) : profile.phone))
          : '';
        await openOrderConfirm({
          orderId: order.id,
          name: (profile && profile.full_name) || '',
          phone: fullPhone
        });
        ordersLoaded = false;
      } catch (e) {
        submitStatusEl.style.color = '#d64545';
        submitStatusEl.textContent = 'حصل خطأ وإحنا بنبعت الطلب، حاول تاني.';
      } finally {
        submitBtn.disabled = false;
      }
    }

    const tasks = [loadCart(), loadDeliveryPrice()];
    if (!isGuest) tasks.push(window.__totaCartLoadAddresses());
    await Promise.all(tasks);
  });
})();
