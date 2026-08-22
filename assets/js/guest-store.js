// ============================================================
//  تخزين محلي (localStorage) بالكامل للزائر اللي معندوش حساب:
//  - السلة (tota_guest_cart): [{ slug, quantity }]
//  - المفضلة (tota_guest_favorites): [slug, ...]
//  - أوردراته (tota_guest_orders): [{ id, phone, created_at }]
//  - آخر بيانات كتبها (اسم/تليفون/عنوان) عشان تتعبى تلقائي المرة الجاية
//
//  مفيش أي حاجة من دي بتتبعت لأي سيرفر إلا وقت "اطلب الآن" بس (وقتها
//  بيتبعت الأوردر فعليًا زي ما هو متوقع)، والسلة/المفضلة نفسها بتفضل
//  في المتصفح بس. لو المستخدم سجّل حساب بعدين، السلة/المفضلة المحلية
//  دي منفصلة تمامًا عن سلة/مفضلة الحساب.
// ============================================================
(function () {
  'use strict';

  const KEYS = {
    cart: 'tota_guest_cart',
    favorites: 'tota_guest_favorites',
    orders: 'tota_guest_orders',
    info: 'tota_guest_info'
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore (خاص/مساحة ممتلئة) */ }
  }

  // ---------------- السلة ----------------
  function getCart() { return read(KEYS.cart, []); }
  function setCart(items) { write(KEYS.cart, items); }

  function addToCart(slug, qty) {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    const items = getCart();
    const existing = items.find(function (r) { return r.slug === slug; });
    if (existing) existing.quantity += qty;
    else items.push({ slug: slug, quantity: qty });
    setCart(items);
    return items;
  }
  function setCartQty(slug, qty) {
    const items = getCart();
    const row = items.find(function (r) { return r.slug === slug; });
    if (!row) return items;
    if (qty <= 0) return removeFromCart(slug);
    row.quantity = qty;
    setCart(items);
    return items;
  }
  function removeFromCart(slug) {
    const items = getCart().filter(function (r) { return r.slug !== slug; });
    setCart(items);
    return items;
  }
  function clearCart() { setCart([]); }
  function cartCount() {
    return getCart().reduce(function (sum, r) { return sum + (r.quantity || 0); }, 0);
  }

  // ---------------- المفضلة ----------------
  function getFavorites() { return read(KEYS.favorites, []); }
  function isFavorite(slug) { return getFavorites().indexOf(slug) !== -1; }
  function toggleFavorite(slug) {
    const list = getFavorites();
    const idx = list.indexOf(slug);
    let added;
    if (idx === -1) { list.push(slug); added = true; }
    else { list.splice(idx, 1); added = false; }
    write(KEYS.favorites, list);
    return added;
  }
  function removeFavorite(slug) {
    write(KEYS.favorites, getFavorites().filter(function (s) { return s !== slug; }));
  }

  // ---------------- الأوردرات (بعد ما تتبعت فعليًا) ----------------
  function getOrderRefs() { return read(KEYS.orders, []); }
  function addOrderRef(id, phone) {
    const list = getOrderRefs();
    list.unshift({ id: id, phone: phone, created_at: new Date().toISOString() });
    write(KEYS.orders, list.slice(0, 100)); // سقف معقول، مش متوقع حد يعدي عليه
  }

  // ---------------- آخر بيانات (اسم/تليفون/عنوان/كود دولة) ----------------
  function getInfo() { return read(KEYS.info, {}); }
  function setInfo(info) { write(KEYS.info, info); }

  window.TotaGuest = {
    getCart: getCart,
    addToCart: addToCart,
    setCartQty: setCartQty,
    removeFromCart: removeFromCart,
    clearCart: clearCart,
    cartCount: cartCount,
    getFavorites: getFavorites,
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    removeFavorite: removeFavorite,
    getOrderRefs: getOrderRefs,
    addOrderRef: addOrderRef,
    getInfo: getInfo,
    setInfo: setInfo
  };
})();
