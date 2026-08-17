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

  // --- floating category buttons (fills the empty hero space) ---
  const cloud = document.getElementById('tagCloud');
  if (cloud){
    const positions = [
      {top:'12%', left:'4%'}, {top:'72%', left:'2%'}, {top:'20%', left:'40%'},
      {top:'68%', left:'40%'}, {top:'4%',  left:'22%'}, {top:'86%', left:'20%'}
    ];
    categories.forEach((c,i)=>{
      const pos = positions[i % positions.length];
      const a = document.createElement('a');
      a.className = 'floating-tag';
      a.textContent = c.name;
      a.href = `products.html?cat=${encodeURIComponent(c.slug)}`;
      a.style.top = pos.top; a.style.left = pos.left;
      a.style.animationDelay = (i*0.6)+'s';
      cloud.appendChild(a);
    });
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
  }

  function cardHTML(p){
    const price = p.price != null ? `${p.price.toLocaleString('ar-EG')} ${p.currency||''}` : '';
    const old = p.oldPrice ? `<span class="card-old-price">${p.oldPrice.toLocaleString('ar-EG')} ${p.currency||''}</span>` : '';
    const badge = p.badge ? `<span class="card-badge">${p.badge}</span>` : '';
    return `
    <a class="card" href="products.html?p=${encodeURIComponent(p.id)}">
      ${badge}
      <span class="card-cat-tag">${p.categoryName}</span>
      <div class="card-media"><img src="${p.image}" alt="${p.name}" loading="lazy"></div>
      <div class="card-body">
        <div class="card-name">${p.name}</div>
        <div class="card-price-row"><span class="card-price">${price}</span>${old}</div>
      </div>
    </a>`;
  }
})();
