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

  // --- build category chips ---
  function buildTags(){
    const all = [{slug:'all', name:'الكل'}, ...categories.map(c=>({slug:c.slug, name:c.name}))];
    tagScroll.innerHTML = all.map(c=>
      `<button class="tag-chip ${c.slug===activeCategory?'active':''}" data-slug="${c.slug}">${c.name}</button>`
    ).join('');
    tagScroll.querySelectorAll('.tag-chip').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        activeCategory = btn.dataset.slug;
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

    searchMeta.innerHTML = activeQuery.trim()
      ? `لقينا <b>${list.length}</b> نتيجة قريبة من بحثك`
      : '';
  }

  function buildSuggestions(){
    const others = categories.map(c=>c.name).slice(0,4);
    suggestionChips.innerHTML = others.map(n=>`<button data-name="${n}">${n}</button>`).join('');
    suggestionChips.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        searchInput.value = '';
        activeQuery = '';
        const cat = categories.find(c=>c.name===btn.dataset.name);
        activeCategory = cat ? cat.slug : 'all';
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
      <div class="card-media"><img src="${p.image}" alt="${p.name}" loading="lazy"></div>
      <div class="card-body">
        <div class="card-name">${name}</div>
        <div class="card-price-row"><span class="card-price">${price}</span>${old}</div>
      </div>
    </a>`;
  }

  // --- search input events ---
  let debounceT;
  searchInput.addEventListener('input', ()=>{
    activeQuery = searchInput.value;
    searchClear.classList.toggle('show', !!activeQuery);
    clearTimeout(debounceT);
    debounceT = setTimeout(render, 150);
  });
  searchInput.addEventListener('focus', ()=> searchWrap.classList.add('focused'));
  searchInput.addEventListener('blur', ()=> searchWrap.classList.remove('focused'));
  searchClear.addEventListener('click', ()=>{
    searchInput.value = ''; activeQuery = '';
    searchClear.classList.remove('show');
    searchInput.focus();
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
  function siteBase(){
    return location.pathname.replace(/products\.html$/, '');
  }
  function productPageUrl(id){
    return `${siteBase()}p/${id}/`;
  }
  function getIdFromLocation(){
    const m = location.pathname.match(/\/p\/(.+?)\/?$/);
    if (m) return decodeURIComponent(m[1]);
    return new URLSearchParams(location.search).get('p');
  }
  function openModal(id, pushHistory){
    if (pushHistory === undefined) pushHistory = true;
    const p = allProducts.find(x=>x.id === id);
    if (!p) return;
    renderGallery(p);
    document.getElementById('modalCat').textContent = p.categoryName;
    document.getElementById('modalTitle').textContent = p.name;
    document.getElementById('modalDesc').textContent = p.description || '';
    document.getElementById('modalPrice').textContent = p.price != null ? `${p.price.toLocaleString('ar-EG')} ${p.currency||''}` : '';
    document.getElementById('modalOldPrice').textContent = p.oldPrice ? `${p.oldPrice.toLocaleString('ar-EG')} ${p.currency||''}` : '';
    document.getElementById('modalSpecs').innerHTML = (p.specs||[]).map(s=>
      `<div class="modal-spec"><span>${s.label}</span><span>${s.value}</span></div>`
    ).join('');
    const waText = encodeURIComponent(`مرحبا اريد الاستفسار عن (${p.name})`);
    document.getElementById('modalWhatsapp').href = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;
    document.getElementById('modalShare').onclick = (e)=>{
      e.preventDefault();
      const url = `${location.origin}${productPageUrl(p.id)}`;
      if (navigator.share) navigator.share({ title:p.name, url });
      else { navigator.clipboard.writeText(url); document.getElementById('modalShare').textContent='تم النسخ ✓'; }
    };
    overlay.classList.add('open');
    document.body.classList.add('modal-locked');
    const url = productPageUrl(p.id);
    if (pushHistory) history.pushState({ modalId: p.id }, '', url);
    else history.replaceState({ modalId: p.id }, '', url);
  }
  // fromPopstate: true when triggered by the browser's back/forward button —
  // in that case history already moved, so we just update the UI without touching it again.
  function closeModal(fromPopstate){
    overlay.classList.remove('open');
    document.body.classList.remove('modal-locked');
    if (!fromPopstate){
      if (history.state && history.state.modalId) history.back();
      else history.replaceState(null,'', location.pathname.replace(/\/p\/.*$/, 'products.html') + (activeCategory!=='all' ? `?cat=${activeCategory}` : ''));
    }
  }
  document.getElementById('modalClose').addEventListener('click', ()=>closeModal(false));
  overlay.addEventListener('click', e=>{ if (e.target === overlay) closeModal(false); });
  window.addEventListener('keydown', e=>{ if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal(false); });
  window.addEventListener('popstate', ()=>{
    const p = getIdFromLocation();
    if (p) openModal(p, false);
    else if (overlay.classList.contains('open')) closeModal(true);
  });

  // --- init ---
  const initParams = new URLSearchParams(location.search);
  const initCat = initParams.get('cat');
  if (initCat && categories.some(c=>c.slug===initCat)) activeCategory = initCat;

  buildTags();
  render();

  const initId = getIdFromLocation();
  if (initId) openModal(initId, false);
})();
