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
  let activeSort = 'default'; // 'default' | 'asc' | 'desc'
  let activeBadges = new Set(); // بيتفلتر بيهم على حسب الشعار (تريند/جديد/الأكتر طلبًا...)
  let currentPage = 1;
  const PAGE_SIZE = 30;

  function escapeHtml(str){
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  // --- إظهار/إخفاء لوحة الفلاتر (سعر + ترتيب + شعارات)، وتفضل ظاهرة
  // مربوطة (sticky) تحت شريط التصنيفات علشان لو نزلنا آخر الصفحة نقدر
  // نغيّر التصنيف أو الفلاتر من غير ما نرجع لفوق ---
  // ملحوظة: لازم البلوك ده ييجي قبل إعداد فلتر السعر تحت، لأن
  // updatePriceUI() بتنادي updateFiltersToggleState() اللي بتستخدم
  // filtersToggle، فلو فضل تحت هيرمي خطأ "Cannot access before
  // initialization" (TDZ) ويوقف الصفحة كلها من غير أي رسالة واضحة.
  const filtersBar = document.getElementById('filtersBar');
  const filtersPanel = document.getElementById('filtersPanel');
  const filtersToggle = document.getElementById('filtersToggle');
  function setFiltersOpen(open){
    filtersPanel.classList.toggle('open', open);
    filtersToggle.setAttribute('aria-expanded', String(open));
  }
  if (filtersToggle){
    filtersToggle.addEventListener('click', ()=> setFiltersOpen(!filtersPanel.classList.contains('open')));
    // على الشاشات الكبيرة نسيبها مفتوحة افتراضيًا، وعلى الموبايل نسيبها
    // مقفولة عشان ما تاخدش مساحة كبيرة من الشاشة
    setFiltersOpen(window.innerWidth > 860);
  }
  function updateFiltersToggleState(){
    if (!filtersToggle) return;
    const priceActive = prices.length && dataMin !== dataMax && (priceMin !== dataMin || priceMax !== dataMax);
    const hasActive = priceActive || activeSort !== 'default' || activeBadges.size > 0;
    filtersToggle.classList.toggle('has-active', hasActive);
  }

  // --- price range filter setup ---
  const priceFilter = document.getElementById('priceFilter');
  const priceMinInput = document.getElementById('priceMinInput');
  const priceMaxInput = document.getElementById('priceMaxInput');
  const priceMinNumber = document.getElementById('priceMinNumber');
  const priceMaxNumber = document.getElementById('priceMaxNumber');
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
    priceMinNumber.min = priceMaxNumber.min = dataMin;
    priceMinNumber.max = priceMaxNumber.max = dataMax;
    priceMinNumber.value = dataMin;
    priceMaxNumber.value = dataMax;
    priceCurrencyLabel.textContent = (allProducts.find(p=>p.currency)||{}).currency || '';

    function updatePriceUI(){
      const pct = (v) => ((v - dataMin) / (dataMax - dataMin)) * 100;
      priceSliderRange.style.right = pct(priceMin) + '%';
      priceSliderRange.style.left = (100 - pct(priceMax)) + '%';
      priceMinLabel.textContent = priceMin.toLocaleString('ar-EG');
      priceMaxLabel.textContent = priceMax.toLocaleString('ar-EG');
      priceMinInput.value = priceMin;
      priceMaxInput.value = priceMax;
      priceMinNumber.value = priceMin;
      priceMaxNumber.value = priceMax;
      updateFiltersToggleState();
    }

    // شريط السحب (رينج) — بيفضل شغال زي ما هو
    priceMinInput.addEventListener('input', ()=>{
      priceMin = Math.min(+priceMinInput.value, priceMax);
      updatePriceUI();
      currentPage = 1;
      render();
    });
    priceMaxInput.addEventListener('input', ()=>{
      priceMax = Math.max(+priceMaxInput.value, priceMin);
      updatePriceUI();
      currentPage = 1;
      render();
    });

    // خانات الكتابة اليدوية — تسمح بكتابة رقم السعر مباشرة من غير ما تشد الشريط
    function applyMinNumber(){
      let v = priceMinNumber.value === '' ? dataMin : +priceMinNumber.value;
      if (isNaN(v)) v = dataMin;
      v = Math.max(dataMin, Math.min(v, priceMax));
      priceMin = v;
      updatePriceUI();
      currentPage = 1;
      render();
    }
    function applyMaxNumber(){
      let v = priceMaxNumber.value === '' ? dataMax : +priceMaxNumber.value;
      if (isNaN(v)) v = dataMax;
      v = Math.min(dataMax, Math.max(v, priceMin));
      priceMax = v;
      updatePriceUI();
      currentPage = 1;
      render();
    }
    priceMinNumber.addEventListener('change', applyMinNumber);
    priceMaxNumber.addEventListener('change', applyMaxNumber);
    priceMinNumber.addEventListener('keydown', e=>{ if (e.key === 'Enter'){ e.preventDefault(); priceMinNumber.blur(); } });
    priceMaxNumber.addEventListener('keydown', e=>{ if (e.key === 'Enter'){ e.preventDefault(); priceMaxNumber.blur(); } });

    updatePriceUI();
  }

  // --- الترتيب حسب السعر ---
  const sortRow = document.getElementById('sortRow');
  if (sortRow){
    sortRow.querySelectorAll('.sort-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const val = btn.dataset.sort;
        if (val === activeSort) return;
        activeSort = val;
        sortRow.querySelectorAll('.sort-btn').forEach(b=> b.classList.toggle('active', b.dataset.sort === activeSort));
        updateFiltersToggleState();
        currentPage = 1;
        render();
      });
    });
  }

  // --- فلترة الشعارات (تريند / جديد / الأكتر طلبًا...) — بتتبني تلقائيًا
  // من الشعارات الموجودة فعليًا في التصنيف اللي المستخدم واقف فيه دلوقتي ---
  const badgeFilterSection = document.getElementById('badgeFilter');
  const badgeChipRow = document.getElementById('badgeChipRow');
  function buildBadgeFilter(){
    const pool = activeCategory === 'all' ? allProducts : allProducts.filter(p=>p.category === activeCategory);
    const badges = [...new Set(pool.map(p=>p.badge).filter(Boolean))];
    if (!badges.length){
      badgeFilterSection.hidden = true;
      badgeChipRow.innerHTML = '';
      return;
    }
    badgeFilterSection.hidden = false;
    badgeChipRow.innerHTML = badges.map(b=>
      `<button type="button" class="badge-chip ${activeBadges.has(b)?'active':''}" data-badge="${escapeHtml(b)}">${escapeHtml(b)}</button>`
    ).join('');
    badgeChipRow.querySelectorAll('.badge-chip').forEach(chip=>{
      chip.addEventListener('click', ()=>{
        const b = chip.dataset.badge;
        if (activeBadges.has(b)) activeBadges.delete(b); else activeBadges.add(b);
        chip.classList.toggle('active');
        updateFiltersToggleState();
        currentPage = 1;
        render();
      });
    });
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
        activeBadges = new Set();
        currentPage = 1;
        history.pushState({ category: activeCategory }, '', categoryUrl(activeCategory));
        buildTags();
        buildBadgeFilter();
        render();
      });
    });
  }

  // --- render grid ---
  function render(){
    // بنطبق كل فلتر لوحده وبالترتيب، وكل واحد بياخد نتيجة اللي قبله —
    // كده أي عدد من الفلاتر (تصنيف + شعار + سعر + بحث) بيشتغلوا مع بعض
    // من غير ما يتعارضوا أو يمسحوا بعض
    let list = allProducts;

    if (activeCategory !== 'all') list = list.filter(p=>p.category === activeCategory);

    if (activeBadges.size) list = list.filter(p => p.badge && activeBadges.has(p.badge));

    if (prices.length && dataMin !== dataMax){
      list = list.filter(p => p.price == null || (p.price >= priceMin && p.price <= priceMax));
    }

    let scored = null;
    if (activeQuery.trim()){
      scored = FuzzySearch.search(activeQuery, list);
      list = scored.map(r=>r.item);
    }

    if (activeSort === 'asc' || activeSort === 'desc'){
      list = list.slice().sort((a, b)=>{
        const pa = a.price == null ? Infinity : a.price;
        const pb = b.price == null ? Infinity : b.price;
        return activeSort === 'asc' ? pa - pb : (pb === Infinity && pa === Infinity ? 0 : (pa === Infinity ? 1 : (pb === Infinity ? -1 : pb - pa)));
      });
    }

    sectionTitle.textContent = activeQuery.trim()
      ? `نتائج البحث عن "${activeQuery}"`
      : (activeCategory === 'all' ? 'كل المنتجات' : (categories.find(c=>c.slug===activeCategory)||{}).name);
    sectionCount.textContent = `${list.length} منتج`;

    if (!list.length){
      grid.innerHTML = '';
      pagination.innerHTML = '';
      noResults.classList.add('show');
      buildSuggestions();
      return;
    }
    noResults.classList.remove('show');

    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    const pageList = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    grid.innerHTML = pageList.map(p => cardHTML(p, activeQuery)).join('');
    grid.classList.add('reveal-stagger');
    window.observeReveals && observeReveals();
    window.attachImageLoaders && attachImageLoaders(grid);
    grid.querySelectorAll('.card').forEach(c=>{
      c.addEventListener('click', (e)=>{
        e.preventDefault();
        openModal(c.dataset.id);
      });
    });
    grid.querySelectorAll('[data-wa-card-slug]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        const p = allProducts.find(x=>x.id === btn.dataset.waCardSlug);
        if (p) openWhatsapp(p);
      });
    });
    syncFavoriteHearts();
    renderPagination(totalPages);

    searchMeta.innerHTML = activeQuery.trim()
      ? `لقينا <b>${list.length}</b> نتيجة قريبة من بحثك`
      : '';
  }

  const pagination = document.getElementById('pagination');
  function renderPagination(totalPages){
    if (totalPages <= 1){ pagination.innerHTML = ''; return; }
    const pages = [];
    for (let i = 1; i <= totalPages; i++){
      if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) pages.push(i);
      else if (pages[pages.length - 1] !== '…') pages.push('…');
    }
    const btn = (label, page, opts) => {
      opts = opts || {};
      return `<button type="button" class="page-btn ${opts.active?'active':''}" ${opts.disabled?'disabled':''} data-page="${page||''}">${label}</button>`;
    };
    pagination.innerHTML =
      btn('السابق', currentPage - 1, { disabled: currentPage === 1 }) +
      pages.map(p => p === '…' ? `<span class="page-dots">…</span>` : btn(p, p, { active: p === currentPage })).join('') +
      btn('التالي', currentPage + 1, { disabled: currentPage === totalPages });

    pagination.querySelectorAll('.page-btn[data-page]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const p = +b.dataset.page;
        if (!p || p === currentPage) return;
        currentPage = p;
        render();
        filtersBar && filtersBar.scrollIntoView({ behavior:'smooth', block:'start' });
      });
    });
  }

  // بيحدد رقم الواتساب المستخدَم للمنتج: رقم المنتج نفسه لو موجود،
  // وإلا رقم التصنيف اللي المنتج تابع له لو موجود، وإلا الرقم العام للموقع
  function resolveWhatsappNumber(p){
    const raw = (p && p.whatsapp) || (p && p.categoryWhatsapp) || cfg.whatsapp || '201000000000';
    return String(raw).replace(/\D/g, '') || WHATSAPP_NUMBER;
  }

  function openWhatsapp(p){
    const waText = encodeURIComponent(`مرحبا اريد الاستفسار عن (${p.name})\n${productPageUrl(p.id)}`);
    window.open(`https://wa.me/${resolveWhatsappNumber(p)}?text=${waText}`, '_blank');
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
        activeBadges = new Set();
        currentPage = 1;
        history.pushState({ category: activeCategory }, '', currentFiltersUrl());
        buildTags();
        buildBadgeFilter();
        render();
      });
    });
  }

  // بيبني محتوى خانة السعر حسب priceMode (ممكن أكتر من وضع مفعّل مع بعض):
  // 'price' -> السعر الرقمي، 'text' -> كتابة مخصّصة، 'whatsapp' -> زر واتس مباشر
  const WA_ICON_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.29-1.38a9.9 9.9 0 0 0 4.7 1.2h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2Zm0 18.06h-.01a8.13 8.13 0 0 1-4.15-1.14l-.3-.18-3.13.82.84-3.06-.2-.31a8.15 8.15 0 0 1-1.25-4.28c0-4.49 3.66-8.15 8.16-8.15 2.18 0 4.22.85 5.76 2.4a8.1 8.1 0 0 1 2.39 5.76c0 4.5-3.66 8.15-8.16 8.15Zm4.47-6.11c-.25-.12-1.45-.72-1.67-.8-.22-.08-.39-.12-.55.12-.16.24-.63.8-.78.96-.14.16-.29.18-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.71-.14-.24-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.24.24-.4.08-.16.04-.31-.02-.43-.06-.12-.55-1.32-.75-1.8-.2-.48-.4-.42-.55-.42h-.47c-.16 0-.42.06-.64.31-.22.24-.85.83-.85 2.02 0 1.19.87 2.34.99 2.5.12.16 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.45-.59 1.65-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.47-.28Z"/></svg>`;

  // بيبني محتوى خانة السعر حسب priceMode (ممكن أكتر من وضع مفعّل مع بعض):
  // 'price' -> السعر الرقمي، 'text' -> كتابة مخصّصة، 'whatsapp' -> زر واتس مباشر
  // isCard=true لكارت المنتج داخل الشبكة، false للمودال (نفس المنطق بكلاسات مختلفة للتنسيق)
  function priceCellHTML(p, isCard){
    const priceCls = isCard ? 'card-price' : 'modal-price';
    const oldCls = isCard ? 'card-old-price' : 'modal-old-price';
    const textCls = isCard ? 'card-price-text' : 'modal-price-text';
    const waCls = isCard ? 'card-price-whatsapp' : 'modal-price-whatsapp';
    const waAttr = isCard ? `data-wa-card-slug="${p.id}"` : `data-wa-modal-slug="${p.id}"`;
    const modes = (p.priceMode && p.priceMode.length) ? p.priceMode : ['price'];
    const parts = [];
    if (modes.includes('price') && p.price != null){
      const old = p.oldPrice ? `<span class="${oldCls}">${p.oldPrice.toLocaleString('ar-EG')} ${p.currency||''}</span>` : '';
      parts.push(`<span class="${priceCls}">${p.price.toLocaleString('ar-EG')} ${p.currency||''}</span>${old}`);
    }
    if (modes.includes('text') && p.priceText){
      parts.push(`<span class="${textCls}">${escapeHtml(p.priceText)}</span>`);
    }
    if (modes.includes('whatsapp')){
      parts.push(`<button type="button" class="${waCls}" ${waAttr} aria-label="تواصل عبر واتساب">${WA_ICON_SVG}<span>واتساب</span></button>`);
    }
    if (!parts.length && p.price != null){
      parts.push(`<span class="${priceCls}">${p.price.toLocaleString('ar-EG')} ${p.currency||''}</span>`);
    }
    return parts.join('');
  }

  function cardHTML(p, query){
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
        <div class="card-price-row">${priceCellHTML(p, true)}</div>
      </div>
    </a>`;
  }

  // بيحول صيغة [نص](رابط) جوه الوصف لرابط حقيقي قابل للضغط بيفتح في تاب جديد،
  // مع الهروب (escape) من أي HTML تاني في النص علشان الأمان
  function renderDescriptionHTML(desc){
    const escaped = escapeHtml(desc || '');
    return escaped.replace(/\[([^\[\]]+)\]\((https?:\/\/[^\s()]+)\)/g, (m, text, url) => {
      return `<a class="desc-link" href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    });
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
    document.getElementById('modalDesc').innerHTML = renderDescriptionHTML(p.description);
    const modalPriceRow = document.getElementById('modalPriceRow');
    if (modalPriceRow){
      modalPriceRow.innerHTML = priceCellHTML(p, false);
      const waBtn = modalPriceRow.querySelector('[data-wa-modal-slug]');
      if (waBtn) waBtn.addEventListener('click', (e)=>{ e.preventDefault(); openWhatsapp(p); });
    } else {
      // توافق مع أي نسخة قديمة من الـ HTML لسه معندهاش modalPriceRow
      const mp = document.getElementById('modalPrice');
      const mop = document.getElementById('modalOldPrice');
      if (mp) mp.textContent = p.price != null ? `${p.price.toLocaleString('ar-EG')} ${p.currency||''}` : '';
      if (mop) mop.textContent = p.oldPrice ? `${p.oldPrice.toLocaleString('ar-EG')} ${p.currency||''}` : '';
    }
    document.getElementById('modalSpecs').innerHTML = (p.specs||[]).map(s=>
      `<div class="modal-spec"><span>${s.label}</span><span>${s.value}</span></div>`
    ).join('');
    const waText = encodeURIComponent(`مرحبا اريد الاستفسار عن (${p.name})\n${productPageUrl(p.id)}`);
    const waUrl = `https://wa.me/${resolveWhatsappNumber(p)}?text=${waText}`;
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
    // نفس مشكلة Lenis في مودال تسجيل الدخول/حساب جديد (شوف auth.js):
    // Lenis بيمسك عجلة الماوس على مستوى الصفحة كلها، فلازم نوقّفه
    // مؤقتًا عشان السكرول جوه مودال المنتج (لو محتواه أطول من الشاشة)
    // يشتغل طبيعي بدل ما يحرّك الصفحة اللي وراه.
    if (window.lenis && typeof window.lenis.stop === 'function') window.lenis.stop();
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
    if (window.lenis && typeof window.lenis.start === 'function') window.lenis.start();
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
  buildBadgeFilter();
  render();

  const initId = getIdFromLocation();
  if (initId) openModal(initId, false, true);
})();