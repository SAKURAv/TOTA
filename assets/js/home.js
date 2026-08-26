(async function(){
  const cfg = await (window.TOTA_CONFIG_READY || Promise.resolve(window.TOTA_CONFIG || {}));

  // إظهار علامة التحميل في مكان المنتجات المقترحة لحد ما البيانات توصل
  const featuredGridEl = document.getElementById('featuredGrid');
  if (featuredGridEl && window.totaLoaderHTML){
    featuredGridEl.innerHTML = `<div class="tota-loading-box">${totaLoaderHTML()}</div>`;
  }

  let data;
  try{
    const res = await fetch('data/products.json', { cache:'no-store' });
    data = await res.json();
  }catch(e){
    console.error('تعذر تحميل المنتجات. لازم تشغل الموقع من خلال سيرفر محلي.', e);
    if (featuredGridEl) featuredGridEl.innerHTML =
      `<p style="color:var(--text-dim)">تعذر تحميل المنتجات — شغّل الموقع من خلال سيرفر محلي.</p>`;
    return;
  }

  const products = data.products || [];
  const categories = data.categories || [];

  // --- floating product bubbles around the hero heading ---
  const bubbles = document.querySelectorAll('#bgBubbles .bg-bubble');
  if (bubbles.length){
    const pickIds = (cfg.featuredProducts || []).filter(Boolean);
    let picks = pickIds.length ? pickIds.map(id => products.find(p => p.id === id)).filter(Boolean) : [];
    if (picks.length < bubbles.length){
      const rest = products.filter(p => !picks.includes(p));
      picks = picks.concat(rest).slice(0, bubbles.length);
    }
    bubbles.forEach((b,i)=>{
      const p = picks[i % (picks.length || 1)];
      if (!p) return;
      b.href = `products.html?p=${encodeURIComponent(p.id)}`;
      b.setAttribute('aria-label', p.name);
      b.innerHTML = `<img src="${p.image}" alt="${p.name}" loading="lazy">`;
    });
  }

  // --- قائمة التصنيفات المنسدلة في الهيرو (بديل السحابة القديمة) ---
  // زرار واحد واضح "الكل ⌄" بيفتح قايمة فيها كل التصنيفات، وكل واحد فيها
  // بيوديك لصفحة المنتجات مفلترة على التصنيف ده مباشرة.
  const heroCatToggle = document.getElementById('heroCategoryToggle');
  const heroCatMenu = document.getElementById('heroCategoryMenu');
  const heroCatDropdown = document.getElementById('heroCategoryDropdown');
  if (heroCatToggle && heroCatMenu && heroCatDropdown){
    const items = [{ slug:'all', name:'الكل' }, ...categories.map(c=>({ slug:c.slug, name:c.name }))];
    heroCatMenu.innerHTML = items.map(c =>
      `<a href="products.html${c.slug==='all' ? '' : `?cat=${encodeURIComponent(c.slug)}`}" class="category-menu-item${c.slug==='all' ? ' active' : ''}">${c.name}</a>`
    ).join('');

    // القايمة بتتفتح كـ position:fixed محسوبة من مكان الزرار نفسه، عشان
    // overflow:hidden بتاع .hero (اللي بيحتوي زخارف الفقاعات) ميقصّهاش
    // ويخبيها ورا محتوى الصفحة.
    // القايمة بتتفتح كـ position:fixed محسوبة من مكان الزرار نفسه. بعض
    // المتصفحات (خصوصًا سفاري على الموبايل) بتفضل تقص أي عنصر fixed لو
    // لسه جوّه عنصر أب عنده overflow:hidden (زي .hero اللي فيه زخارف
    // الفقاعات)، حتى لو نظريًا مفروض ميتقصش. الحل الأضمن: ننقل القايمة
    // فعليًا لتكون آخر عنصر جوه body مباشرة أول ما تتفتح، فمفيش أي عنصر
    // أب عنده overflow:hidden بينها وبين الشاشة خالص
    document.body.appendChild(heroCatMenu);

    function positionHeroMenu(){
      const rect = heroCatToggle.getBoundingClientRect();
      const menuWidth = Math.max(heroCatMenu.offsetWidth, 210);
      // نتأكد إن القايمة ما تخرجش برة حواف الشاشة (يمين أو شمال) على
      // الموبايل، خصوصًا إن الصفحة RTL والزرار ممكن يكون قريب من أي حافة
      let left = rect.left;
      const maxLeft = window.innerWidth - menuWidth - 8;
      left = Math.max(8, Math.min(left, maxLeft));
      heroCatMenu.style.top = (rect.bottom + 8) + 'px';
      heroCatMenu.style.left = left + 'px';
      // لو مفيش مساحة كفاية تحت الزرار لحد آخر الشاشة، نخلي القايمة نفسها
      // تعمل سكرول جواها بدل ما تتقص من تحت
      const spaceBelow = window.innerHeight - rect.bottom - 16;
      heroCatMenu.style.maxHeight = Math.max(120, Math.min(280, spaceBelow)) + 'px';
    }
    function setHeroCatMenuOpen(open){
      if (open) positionHeroMenu();
      else heroCatMenu.style.maxHeight = '';
      heroCatMenu.classList.toggle('open', open);
      heroCatMenu.classList.toggle('detached', open);
      heroCatToggle.setAttribute('aria-expanded', String(open));
    }
    heroCatToggle.addEventListener('click', ()=>{
      setHeroCatMenuOpen(!heroCatMenu.classList.contains('open'));
    });
    document.addEventListener('click', (e)=>{
      if (!heroCatDropdown.contains(e.target) && !heroCatMenu.contains(e.target)) setHeroCatMenuOpen(false);
    });
    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape') setHeroCatMenuOpen(false);
    });
    window.addEventListener('scroll', ()=> setHeroCatMenuOpen(false), { passive:true });
    window.addEventListener('resize', ()=> setHeroCatMenuOpen(false));
  }

  // --- featured grid: pick from config, fallback to latest ---
  const grid = document.getElementById('featuredGrid');
  if (grid){
    const pickIds = (cfg.featuredProducts || []).filter(Boolean);
    let featured;
    if (pickIds.length){
      featured = pickIds.map(id => products.find(p => p.id === id)).filter(Boolean);
      if (featured.length < pickIds.length){
        // كمّل بمنتجات تانية لو في id متكتب غلط أو مش موجود
        const rest = products.filter(p => !featured.includes(p));
        featured = featured.concat(rest).slice(0, 8);
      }
    } else {
      featured = products.slice(0, 8);
    }
    grid.innerHTML = featured.map(cardHTML).join('') ||
      `<p style="color:var(--text-dim)">لسه مفيش منتجات مضافة في فولدر products/</p>`;
    grid.classList.add('reveal-stagger');
    window.observeReveals && observeReveals();
    window.attachImageLoaders && attachImageLoaders(grid);
    if (window.totaGetFavoriteSlugs){
      window.totaGetFavoriteSlugs().then(function (slugs) {
        if (!slugs.size) return;
        grid.querySelectorAll('[data-favorite-toggle-slug]').forEach(function (btn) {
          if (slugs.has(btn.getAttribute('data-favorite-toggle-slug'))) {
            btn.classList.add('is-favorited');
            btn.textContent = '♥';
          }
        });
      });
    }
  }

  function cardHTML(p){
    const price = p.price != null ? `${p.price.toLocaleString('ar-EG')} ${p.currency||''}` : '';
    const old = p.oldPrice ? `<span class="card-old-price">${p.oldPrice.toLocaleString('ar-EG')} ${p.currency||''}</span>` : '';
    const badge = p.badge ? `<span class="card-badge">${p.badge}</span>` : '';
    return `
    <a class="card" href="products.html?p=${encodeURIComponent(p.id)}">
      ${badge}
      <span class="card-cat-tag">${p.categoryName}</span>
      <button type="button" class="card-fav-btn" data-favorite-toggle-slug="${p.id}" aria-label="أضف للمفضلة" onclick="event.preventDefault();event.stopPropagation();">♡</button>
      <button type="button" class="card-cart-btn" data-add-to-cart-slug="${p.id}" data-qty="1" aria-label="أضف للسلة" onclick="event.preventDefault();event.stopPropagation();">🛒</button>
      <div class="card-media"><img src="${p.image}" alt="${p.name}" loading="lazy"></div>
      <div class="card-body">
        <div class="card-name">${p.name}</div>
        <div class="card-price-row"><span class="card-price">${price}</span>${old}</div>
      </div>
    </a>`;
  }
})();
