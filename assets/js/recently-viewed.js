// ============================================================
//  "شفتها مؤخرًا" — بيسجّل آخر المنتجات اللي فتحها الزائر في
//  localStorage (بدون تسجيل دخول، بدون أي اتصال بالسيرفر) وبيعرضهم
//  كشريط هادئ جوه نافذة المنتج نفسها. مفيش أي popup ولا تنبيه —
//  الشريط ببساطة بيتخفي تلقائيًا لو مفيش منتجات سابقة.
// ============================================================
(function () {
  'use strict';

  const STORAGE_KEY = 'tota_recently_viewed';
  const MAX_ITEMS = 8;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function save(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function record(product) {
    if (!product || !product.id) return;
    let list = load();
    list = list.filter(function (item) { return item.id !== product.id; });
    list.unshift({
      id: product.id,
      name: product.name,
      price: product.price,
      currency: product.currency,
      image: product.image
    });
    if (list.length > MAX_ITEMS) list = list.slice(0, MAX_ITEMS);
    save(list);
  }

  function render(currentId) {
    const wrap = document.getElementById('recentlyViewedStrip');
    const track = document.getElementById('recentlyViewedTrack');
    if (!wrap || !track) return;

    const list = load().filter(function (item) { return item.id !== currentId; });
    if (!list.length) { wrap.hidden = true; track.innerHTML = ''; return; }

    track.innerHTML = list.map(function (item) {
      const price = item.price != null ? (item.price.toLocaleString('ar-EG') + ' ' + (item.currency || '')) : '';
      return (
        '<button type="button" class="recently-viewed-item" data-recent-id="' + item.id + '">' +
          '<img src="' + item.image + '" alt="' + item.name + '" loading="lazy">' +
          '<span class="recently-viewed-name">' + item.name + '</span>' +
          (price ? '<span class="recently-viewed-price">' + price + '</span>' : '') +
        '</button>'
      );
    }).join('');
    wrap.hidden = false;
  }

  // بتتسجل من products.js لما حد يفتح منتج (حتى لو من لينك مباشر)
  window.addEventListener('tota:product-viewed', function (e) {
    const product = e.detail;
    render(product && product.id); // نعرض الشريط فورًا (من غير المنتج الحالي)
    record(product);
  });

  // الضغط على منتج في الشريط يفتح نافذته — بنستخدم نفس آلية فتح
  // المودال الموجودة في products.js عن طريق تغيير الرابط لصفحة المنتج
  // (products.js بيتصنّت على popstate/روابط p/ ويفتح المودال تلقائي).
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-recent-id]');
    if (!btn) return;
    const id = btn.getAttribute('data-recent-id');
    if (window.totaOpenProduct) { window.totaOpenProduct(id); return; }
    // fallback: تنقل الصفحة لرابط المنتج نفسه
    const encoded = id.split('/').map(encodeURIComponent).join('/');
    window.location.href = 'p/' + encoded + '/';
  });
})();
