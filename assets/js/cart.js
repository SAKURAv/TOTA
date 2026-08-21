// ============================================================
//  منطق صفحة السلة: عرض المنتجات المضافة، تعديل الكمية أو حذف
//  منتج، اختيار عنوان (أو إضافة واحد جديد)، كتابة ملاحظة، وحساب
//  الإجمالي (منتجات + توصيل) قبل ما يتبعت الأوردر كله دفعة واحدة.
// ============================================================
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async function () {
    const client = window.TOTA_SUPABASE || (await window.TOTA_SUPABASE_READY);
    if (!client) return;
    const { data: sessionData } = await client.auth.getSession();
    const session = sessionData && sessionData.session;
    if (!session) { document.getElementById('cartGuest').hidden = false; return; }
    const user = session.user;
    document.getElementById('cartBody').hidden = false;

    // بيانات المنتجات الثابتة (اسم/صورة/سعر) عشان نعرضها جنب كل سطر في
    // السلة — المصدر الحقيقي للسعر وقت الطلب هو دايمًا جدول products في
    // Supabase (بيتقرا هنا مباشرة)، والملف ده بس للصورة والعرض.
    let productsCatalog = {};
    try {
      const res = await fetch('data/products.json', { cache: 'no-store' });
      const json = await res.json();
      (json.products || []).forEach(function (p) { productsCatalog[p.id] = p; });
    } catch (e) { /* لو فشل تحميل الكتالوج، هنعرض بدون صورة بس */ }

    const itemsListEl = document.getElementById('cartItemsList');
    const emptyEl = document.getElementById('cartEmpty');
    const checkoutAreaEl = document.getElementById('cartCheckoutArea');
    const subtotalEl = document.getElementById('cartSubtotal');
    const deliveryEl = document.getElementById('cartDelivery');
    const totalEl = document.getElementById('cartTotal');
    const submitBtn = document.getElementById('cartSubmitBtn');
    const submitStatusEl = document.getElementById('cartSubmitStatus');

    let cartRows = []; // { id, quantity, product_id, name, price, slug, image }
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
        await client.from('cart_items').update({ quantity: item.quantity }).eq('id', id);
        renderItems();
        window.dispatchEvent(new CustomEvent('tota:cart-updated'));
      } else if (e.target.closest('[data-qty-minus]')) {
        if (item.quantity <= 1) return;
        item.quantity -= 1;
        await client.from('cart_items').update({ quantity: item.quantity }).eq('id', id);
        renderItems();
        window.dispatchEvent(new CustomEvent('tota:cart-updated'));
      } else if (e.target.closest('[data-remove]')) {
        await client.from('cart_items').delete().eq('id', id);
        cartRows = cartRows.filter(function (r) { return r.id !== id; });
        renderItems();
        window.dispatchEvent(new CustomEvent('tota:cart-updated'));
      }
    });

    // ---------------- العناوين ----------------
    const addrListEl = document.getElementById('cartAddressList');
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

    // ---------------- اطلب الآن ----------------
    submitBtn.addEventListener('click', async function () {
      if (!cartRows.length) return;
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

    async function placeOrder() {
      try {
        const { data: profile } = await client.from('profiles').select('country_code').eq('id', user.id).maybeSingle();
        const countryCode = (profile && profile.country_code) || '+20';
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
        }).select('id').single();
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

        submitStatusEl.style.color = '#2e7d32';
        submitStatusEl.textContent = 'تم إرسال طلبك بنجاح ✓ هنتواصل معاك قريب.';
        cartRows = [];
        renderItems();
        window.dispatchEvent(new CustomEvent('tota:cart-updated'));
      } catch (e) {
        submitStatusEl.style.color = '#d64545';
        submitStatusEl.textContent = 'حصل خطأ وإحنا بنبعت الطلب، حاول تاني.';
      } finally {
        submitBtn.disabled = false;
      }
    }

    await Promise.all([loadCart(), loadDeliveryPrice(), loadAddresses()]);
  });
})();