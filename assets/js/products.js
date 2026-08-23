(async function(){
  const cfg = await (window.TOTA_CONFIG_READY || Promise.resolve(window.TOTA_CONFIG || {}));
  const WHATSAPP_NUMBER = (cfg.whatsapp || '201000000000').replace(/\D/g,'');

  // بينما البيانات لسه بتتحمل من data/products.json، تظهر علامة التحميل بدل ما الشبكة تفضل فاضية
  const gridEl = document.getElementById('productGrid');
  if (gridEl && window.totaLoaderHTML){
    gridEl.innerHTML = `<div class="tota-loading-box">${totaLoaderHTML()}</div>`;
  }

  let data, allProducts = [], categories = [];
  try{
    const res = await fetch('data/products.json', { cache:'no-store' });
    data = await res.json();
    allProducts = data.products || [];
    categories = data.categories || [];
  }catch(e){
    document.getElementById('productGrid').innerHTML =
      `<p style="color:var(--text-dim)">تعذر تحميل المنتجات — شغّل الموقع من خلال سيرفر محلي (مش دبل كليك على الملف).</p>`;
    console.error(e);
    return;
  }

  const grid = document.getElementById('productGrid');
  const noResults = document.getElementById('noResults');
  const sectionTitle = document.getElementById('sectionTitle');
  const sectionCount = document.getElementById('sectionCount');
  const searchInput = document.getElementById('searchInput');
  const searchWrap = document.getElementById('searchWrap');
  const searchClear = document.getElementById('searchClear');
  const searchMeta = document.getElementById('searchMeta');
  const tagScroll = document.getElementById('categoryTags');
  const suggestionChips = document.getElementById('suggestionChips');

  let activeCategory = 'all';
  let activeQuery = '';

  // --- price range filter setup ---
  const priceFilter = document.getElementById('priceFilter');
  const priceMinInput = document.getElementById('priceMinInput');
  const priceMaxInput = document.getElementById('priceMaxInput');
  const priceSliderRange = document.getElementById('priceSliderRange');
  const priceMinLabel = document.getElementById('priceMinLabel');
  const priceMaxLabel = document.getElementById('priceMaxLabel');
  const priceCurrencyLabel = document.getElementById('priceCurrencyLabel');

  const prices = allProducts.map(p => p.price).filter(v => v != null);
  const dataMin = prices.length ? Math.min(...prices) : 0;
  const dataMax = prices.length ? Math.max(...prices) : 0;
  let priceMin = dataMin, priceMax = dataMax;

  if (!prices.length || dataMin === dataMax){
    if (priceFilter) priceFilter.style.display = 'none';
  } else if (priceFilter) {
    priceMinInput.min = priceMaxInput.min = dataMin;
    priceMinInput.max = priceMaxInput.max = dataMax;
    priceMinInput.value = dataMin;
    priceMaxInput.value = dataMax;
    priceCurrencyLabel.textContent = (allProducts.find(p=>p.currency)||{}).currency || '';

    function updatePriceUI(){
      const pct = (v) => ((v - dataMin) / (dataMax - dataMin)) * 100;
      priceSliderRange.style.right = pct(priceMin) + '%';
      priceSliderRange.style.left = (100 - pct(priceMax)) + '%';
      priceMinLabel.textContent = priceMin.toLocaleString('ar-EG');
      priceMaxLabel.textContent = priceMax.toLocaleString('ar-EG');
    }

    priceMinInput.addEventListener('input', ()=>{
      priceMin = Math.min(+priceMinInput.value, priceMax);
      priceMinInput.value = priceMin;
      updatePriceUI();
      render();
    });
    priceMaxInput.addEventListener('input', ()=>{
      priceMax = Math.max(+priceMaxInput.value, priceMin);
      priceMaxInput.value = priceMax;
      updatePriceUI();
      render();
    });
    updatePriceUI();
  }

  // --- بناء لينكات الصفحة بحيث يحافظ على الفلاتر الحالية (تصنيف + بحث)،
  // ويسمح بتغيير أي واحد فيهم لوحده عن طريق overrides ---
  function currentFiltersUrl(overrides){
    overrides = overrides || {};
    const cat = 'cat' in overrides ? overrides.cat : activeCategory;
    const q = 'q' in overrides ? overrides.q : activeQuery;
    const params = new URLSearchParams();
    if (cat && cat !== 'all') params.set('cat', cat);
    if (q && q.trim()) params.set('q', q.trim());
    const qs = params.toString();
    return new URL('products.html' + (qs ? `?${qs}` : ''), document.baseURI).href;
  }

  // --- build category chips ---
  // بنستخدم document.baseURI (المضبوط بتاج <base>) بدل location.pathname مباشرة،
  // بنفس المنطق المستخدم في لينكات المنتجات، عشان اللينك يتحسب صح دايمًا.
  function categoryUrl(slug){
    return currentFiltersUrl({ cat: slug });
  }
  function buildTags(){
    const all = [{slug:'all', name:'الكل'}, ...categories.map(c=>({slug:c.slug, name:c.name}))];
    // بقت <a> حقيقية بلينك فعلي لكل تصنيف (تفتح في تاب جديد بـ Ctrl+كليك، تتنسخ،
    // وتتحفظ في المفضّلة) بدل ما تكون أزرار فلترة بس من غير أي لينك.
    tagScroll.innerHTML = all.map(c=>
      `<a href="${categoryUrl(c.slug)}" class="tag-chip ${c.slug===activeCategory?'active':''}" data-slug="${c.slug}">${c.name}</a>`
    ).join('');
    tagScroll.querySelectorAll('.tag-chip').forEach(link=>{
      link.addEventListener('click', (e)=>{
        // كليك عادي: نفلتر في نفس الصفحة من غير إعادة تحميل، بس نحدّث شريط
        // العنوان عشان اللينك يفضل صحيح ومتزامن مع التصنيف الظاهر.
        // (Ctrl/Cmd/كليك بالنص الأوسط لسه بيفتح في تاب جديد عادي زي أي لينك)
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        const slug = link.dataset.slug;
        if (slug === activeCategory) return;
        activeCategory = slug;
        history.pushState({ category: activeCategory }, '', categoryUrl(activeCategory));
        buildTags();
        render();
      });
    });
  }

  // --- render grid ---
  function render(){
    let list = allProducts;

    if (activeCategory !== 'all') list = list.filter(p=>p.category === activeCategory);

    if (prices.length && dataMin !== dataMax){
      list = list.filter(p => p.price == null || (p.price >= priceMin && p.price <= priceMax));
    }

    let scored = null;
    if (activeQuery.trim()){
      scored = FuzzySearch.search(activeQuery, list);
      list = scored.map(r=>r.item);
    }

    sectionTitle.textContent = activeQuery.trim()
      ? `نتائج البحث عن "${activeQuery}"`
      : (activeCategory === 'all' ? 'كل المنتجات' : (categories.find(c=>c.slug===activeCategory)||{}).name);
    sectionCount.textContent = `${list.length} منتج`;

    if (!list.length){
      grid.innerHTML = '';
      noResults.classList.add('show');
      buildSuggestions();
      return;
    }
    noResults.classList.remove('show');

    grid.innerHTML = list.map(p => cardHTML(p, activeQuery)).join('');
    grid.classList.add('reveal-stagger');
    window.observeReveals && observeReveals();
    window.attachImageLoaders && attachImageLoaders(grid);
    grid.querySelectorAll('.card').forEach(c=>{
      c.addEventListener('click', (e)=>{
        e.preventDefault();
        openModal(c.dataset.id);
      });
    });
    syncFavoriteHearts();

    searchMeta.innerHTML = activeQuery.trim()
      ? `لقينا <b>${list.length}</b> نتيجة قريبة من بحثك`
      : '';
  }

  // بيظبط شكل قلوب المفضلة على كل كروت المنتجات المعروضة دلوقتي بطلب
  // واحد بس لقاعدة البيانات (شايف toggleFavorite/getFavoriteSlugs في
  // cart-favorites.js)، بدل ما القلب يفضل فاضي حتى لو المنتج متضاف
  // بالفعل للمفضلة.
  async function syncFavoriteHearts(){
    if (!window.totaGetFavoriteSlugs) return;
    const slugs = await window.totaGetFavoriteSlugs();
    if (!slugs.size) return;
    grid.querySelectorAll('[data-favorite-toggle-slug]').forEach(function (btn) {
      const slug = btn.getAttribute('data-favorite-toggle-slug');
      if (slugs.has(slug)) {
        btn.classList.add('is-favorited');
        btn.textContent = '♥';
      }
    });
  }

  function buildSuggestions(){
    const others = categories.map(c=>c.name).slice(0,4);
    suggestionChips.innerHTML = others.map(n=>`<button data-name="${n}">${n}</button>`).join('');
    suggestionChips.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        searchInput.value = '';
        searchClear.classList.remove('show');
        activeQuery = '';
        const cat = categories.find(c=>c.name===btn.dataset.name);
        activeCategory = cat ? cat.slug : 'all';
        history.pushState({ category: activeCategory }, '', currentFiltersUrl());
        buildTags();
        render();
      });
    });
  }

  function cardHTML(p, query){
    const price = p.price != null ? `${p.price.toLocaleString('ar-EG')} ${p.currency||''}` : '';
    const old = p.oldPrice ? `<span class="card-old-price">${p.oldPrice.toLocaleString('ar-EG')} ${p.currency||''}</span>` : '';
    const badge = p.badge ? `<span class="card-badge">${p.badge}</span>` : '';
    const name = query ? FuzzySearch.highlight(p.name, query) : p.name;
    return `
    <a class="card" href="#" data-id="${p.id}">
      ${badge}
      <span class="card-cat-tag">${p.categoryName}</span>
      <button type="button" class="card-fav-btn" data-favorite-toggle-slug="${p.id}" aria-label="أضف للمفضلة" onclick="event.preventDefault();event.stopPropagation();">♡</button>
      <button type="button" class="card-cart-btn" data-add-to-cart-slug="${p.id}" data-qty="1" aria-label="أضف للسلة" onclick="event.preventDefault();event.stopPropagation();">🛒</button>
      <div class="card-media"><img src="${p.image}" alt="${p.name}" loading="lazy"></div>
      <div class="card-body">
        <div class="card-name">${name}</div>
        <div class="card-price-row"><span class="card-price">${price}</span>${old}</div>
      </div>
    </a>`;
  }

  // --- search: بيتنفذ بس لما تدوس زرار "بحث" أو تدوس Enter، مش أول ما تكتب،
  // وبيحدّث شريط العنوان بلينك فيه كلمة البحث نفسها (زي التصنيفات بالظبط) ---
  searchInput.addEventListener('input', ()=>{
    searchClear.classList.toggle('show', !!searchInput.value);
  });
  searchInput.addEventListener('focus', ()=> searchWrap.classList.add('focused'));
  searchInput.addEventListener('blur', ()=> searchWrap.classList.remove('focused'));
  searchWrap.addEventListener('submit', (e)=>{
    e.preventDefault();
    const q = searchInput.value;
    if (q.trim() === activeQuery.trim()) return;
    activeQuery = q;
    history.pushState({ query: activeQuery }, '', currentFiltersUrl({ q: activeQuery }));
    render();
  });
  searchClear.addEventListener('click', ()=>{
    searchInput.value = ''; activeQuery = '';
    searchClear.classList.remove('show');
    searchInput.focus();
    history.pushState({ query: '' }, '', currentFiltersUrl({ q: '' }));
    render();
  });

  // --- modal image gallery ---
  const galleryTrack = document.getElementById('galleryTrack');
  const galleryDots = document.getElementById('galleryDots');
  const galleryEl = document.getElementById('modalGallery');
  const galleryPrev = document.getElementById('galleryPrev');
  const galleryNext = document.getElementById('galleryNext');
  let galleryImgs = [];
  let galleryIndex = 0;

  function renderGallery(p){
    galleryImgs = (p.images && p.images.length) ? p.images : [p.image];
    galleryIndex = 0;
    galleryTrack.innerHTML = galleryImgs.map(src => `<img src="${src}" alt="${p.name}">`).join('');
    galleryDots.innerHTML = galleryImgs.map((_,i) => `<button class="gallery-dot ${i===0?'active':''}" data-i="${i}" aria-label="صورة ${i+1}"></button>`).join('');
    galleryEl.classList.toggle('has-multi', galleryImgs.length > 1);
    galleryDots.classList.toggle('show', galleryImgs.length > 1);
    window.attachImageLoaders && attachImageLoaders(document.querySelector('.modal-media'));
    updateGalleryPos();
    galleryDots.querySelectorAll('.gallery-dot').forEach(dot=>{
      dot.addEventListener('click', ()=>{ galleryIndex = +dot.dataset.i; updateGalleryPos(); });
    });
  }
  function updateGalleryPos(){
    galleryTrack.style.transform = `translateX(${galleryIndex * 100}%)`;
    galleryDots.querySelectorAll('.gallery-dot').forEach((d,i)=> d.classList.toggle('active', i===galleryIndex));
  }
  galleryPrev.addEventListener('click', ()=>{
    galleryIndex = (galleryIndex - 1 + galleryImgs.length) % galleryImgs.length;
    updateGalleryPos();
  });
  galleryNext.addEventListener('click', ()=>{
    galleryIndex = (galleryIndex + 1) % galleryImgs.length;
    updateGalleryPos();
  });
  // swipe support on touch devices
  (function(){
    let startX = null;
    galleryEl.addEventListener('touchstart', e=>{ startX = e.touches[0].clientX; }, {passive:true});
    galleryEl.addEventListener('touchend', e=>{
      if (startX == null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40 && galleryImgs.length > 1){
        if (dx < 0) galleryIndex = (galleryIndex - 1 + galleryImgs.length) % galleryImgs.length;
        else galleryIndex = (galleryIndex + 1) % galleryImgs.length;
        updateGalleryPos();
      }
      startX = null;
    });
  })();

  // --- modal ---
  const overlay = document.getElementById('modalOverlay');
  // فولدر p/ فيه صفحة ثابتة لكل منتج (بتتولد وقت الـ build) بمقاسات Open Graph
  // صحيحة، وبتحوّل فورًا لصفحة المنتج الحقيقية دي. بنستخدم نفس اللينك ده في
  // شريط العنوان أثناء التصفح العادي كمان، عشان أي نسخ للينك (مش بس زرار
  // "مشاركة") يدّي نفس المعاينة الصحيحة على واتساب/فيسبوك.
  // بنستخدم document.baseURI (المضبوط مرة واحدة بتاج <base> في الصفحة) بدل
  // location.pathname مباشرة، عشان لو المستخدم فتح أكتر من منتج في نفس
  // الجلسة من غير ريفريش، شريط العنوان اللي اتغيّر بـ pushState قبل كده
  // ميأثرش على حساب الروابط الجديدة.
  function encodeId(id){
    return id.split('/').map(encodeURIComponent).join('/');
  }
  function productPageUrl(id){
    return new URL(`p/${encodeId(id)}/`, document.baseURI).href;
  }
  function productsPageUrl(){
    return currentFiltersUrl();
  }
  function getIdFromLocation(){
    const m = location.pathname.match(/\/p\/(.+?)\/?$/);
    if (m) return m[1].split('/').map(decodeURIComponent).join('/');
    return new URLSearchParams(location.search).get('p');
  }
  function openModal(id, pushHistory, isBootstrap){
    if (pushHistory === undefined) pushHistory = true;
    const p = allProducts.find(x=>x.id === id);
    if (!p) {
      // حد فتح لينك منتج اتمسح أو غلط — بدل ما الموقع يسكت، بنورّيه رسالة
      // واضحة ونرجّعه لقائمة المنتجات بدل ما يفضل واقف على صفحة فاضية.
      if (noResults){
        noResults.classList.add('show');
        const t = document.getElementById('noResultsText');
        if (t) t.textContent = 'المنتج ده مش موجود أو اتشال من الموقع';
      }
      history.replaceState(null, '', productsPageUrl());
      return;
    }
    renderGallery(p);
    // بتوصل لسكريبت "شفتها مؤخرًا" (recently-viewed.js) عشان يسجل المنتج
    // ده ويحدّث الشريط — بدون أي ربط مباشر بين الملفين.
    window.dispatchEvent(new CustomEvent('tota:product-viewed', { detail: p }));
    document.getElementById('modalCat').textContent = p.categoryName;
    document.getElementById('modalTitle').textContent = p.name;
    document.getElementById('modalDesc').textContent = p.description || '';
    document.getElementById('modalPrice').textContent = p.price != null ? `${p.price.toLocaleString('ar-EG')} ${p.currency||''}` : '';
    document.getElementById('modalOldPrice').textContent = p.oldPrice ? `${p.oldPrice.toLocaleString('ar-EG')} ${p.currency||''}` : '';
    document.getElementById('modalSpecs').innerHTML = (p.specs||[]).map(s=>
      `<div class="modal-spec"><span>${s.label}</span><span>${s.value}</span></div>`
    ).join('');
    const waText = encodeURIComponent(`مرحبا اريد الاستفسار عن (${p.name})\n${productPageUrl(p.id)}`);
    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;
    const waBtn = document.getElementById('modalWhatsapp');
    // لو المستخدم مسجّل دخول ومحفوظش رقم هاتفه، بنطلبه منه الأول (عشان
    // الأدمن يقدر يتابع معاه من داخل النظام). لكن الزائر اللي مسجّلش
    // حساب أصلاً مفيهوش داعي يتسجل عشان يستفسر على واتساب — بيروح
    // مباشرة على طول، هو أصلاً هيدّي رقمه بنفسه جوه المحادثة.
    waBtn.removeAttribute('href');
    waBtn.onclick = async function (e) {
      e.preventDefault();
      const client = window.TOTA_SUPABASE || (await window.TOTA_SUPABASE_READY);
      const session = client ? (await client.auth.getSession()).data.session : null;
      if (!session) { window.open(waUrl, '_blank'); return; }
      if (!window.totaEnsurePhone) { window.open(waUrl, '_blank'); return; }
      window.totaEnsurePhone(function () { window.open(waUrl, '_blank'); });
    };
    const addToCartBtn = document.getElementById('modalAddToCart');
    if (addToCartBtn) addToCartBtn.setAttribute('data-add-to-cart-slug', p.id);
    const favBtn = document.getElementById('modalFavorite');
    if (favBtn) {
      favBtn.setAttribute('data-favorite-toggle-slug', p.id);
      favBtn.textContent = '♡ أضف للمفضلة';
      favBtn.classList.remove('is-favorited');
      if (window.totaCheckFavorite) {
        window.totaCheckFavorite(p.id).then(function (isFav) {
          favBtn.classList.toggle('is-favorited', isFav);
          favBtn.textContent = isFav ? '♥ في المفضلة' : '♡ أضف للمفضلة';
        });
      }
    }
    document.getElementById('modalShare').onclick = (e)=>{
      e.preventDefault();
      const url = productPageUrl(p.id);
      const shareBtn = document.getElementById('modalShare');
      if (navigator.share) {
        navigator.share({ title:p.name, url }).catch(()=>{ /* المستخدم لغى المشاركة، مفيش داعي لرسالة خطأ */ });
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(()=>{
          shareBtn.textContent = 'تم النسخ ✓';
          window.totaToast && window.totaToast('اتنسخ لينك المنتج ✓', 'success');
          setTimeout(()=>{ shareBtn.textContent = 'مشاركة'; }, 1800);
        }).catch(()=>{
          window.totaToast && window.totaToast('تعذر نسخ اللينك، انسخه يدويًا من شريط العنوان.', 'error');
        });
      } else {
        window.totaToast && window.totaToast('تعذر نسخ اللينك، انسخه يدويًا من شريط العنوان.', 'error');
      }
    };
    overlay.classList.add('open');
    document.body.classList.add('modal-locked');
    const url = productPageUrl(p.id);
    if (pushHistory) history.pushState({ modalId: p.id }, '', url);
    else history.replaceState({ modalId: p.id }, '', url);
    // ملحوظة: Cloudflare Web Analytics بيتابع تغييرات history.pushState دي
    // تلقائيًا لوحده (مفيش نداء يدوي مطلوب هنا)، فالسطر تحت سايبينه بس
    // من غير تأثير فعلي عشان التوافق مع أي كود قديم (شوف analytics.js).
    if (!isBootstrap && window.TotaAnalytics) TotaAnalytics.trackProduct(p.id, p.name);
  }
  // fromPopstate: true when triggered by the browser's back/forward button —
  // in that case history already moved, so we just update the UI without touching it again.
  function closeModal(fromPopstate){
    overlay.classList.remove('open');
    document.body.classList.remove('modal-locked');
    if (!fromPopstate){
      if (history.state && history.state.modalId) history.back();
      else history.replaceState(null,'', productsPageUrl());
    }
  }
  // بيتاح لأي سكريبت تاني في الصفحة (زي recently-viewed.js) إنه يفتح
  // منتج بالـ id من غير ما يحتاج يعرف تفاصيل تنفيذ المودال نفسه.
  window.totaOpenProduct = function (id) { openModal(id, true); };

  document.getElementById('modalClose').addEventListener('click', ()=>closeModal(false));
  overlay.addEventListener('click', e=>{ if (e.target === overlay) closeModal(false); });
  window.addEventListener('keydown', e=>{ if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal(false); });
  window.addEventListener('popstate', ()=>{
    const p = getIdFromLocation();
    if (p) { openModal(p, false); return; }
    if (overlay.classList.contains('open')) closeModal(true);
    // مفيش لينك منتج — يبقى نرجّع التصنيف وكلمة البحث لنفس اللي في اللينك (زرار الرجوع)
    const params = new URLSearchParams(location.search);
    const catParam = params.get('cat');
    const qParam = params.get('q') || '';
    const nextCategory = (catParam && categories.some(c=>c.slug===catParam)) ? catParam : 'all';
    let changed = false;
    if (nextCategory !== activeCategory){ activeCategory = nextCategory; buildTags(); changed = true; }
    if (qParam !== activeQuery){
      activeQuery = qParam;
      searchInput.value = qParam;
      searchClear.classList.toggle('show', !!qParam);
      changed = true;
    }
    if (changed) render();
  });

  // --- init ---
  const initParams = new URLSearchParams(location.search);
  const initCat = initParams.get('cat');
  if (initCat && categories.some(c=>c.slug===initCat)) activeCategory = initCat;
  const initQuery = initParams.get('q');
  if (initQuery){
    activeQuery = initQuery;
    searchInput.value = initQuery;
    searchClear.classList.add('show');
  }

  buildTags();
  render();

  const initId = getIdFromLocation();
  if (initId) openModal(initId, false, true);
})();
