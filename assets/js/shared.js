// ============ Shared behaviour: theme, cursor, intro, reveals, marquee, magnetic, header ============
(function(){

  // --- smooth scroll (Lenis) — makes the whole site feel soft instead of jumpy ---
  // forced on for everyone, even with prefers-reduced-motion, per site owner's choice
  if (window.Lenis){
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true, smoothTouch: false });
    function raf(time){ lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    window.lenis = lenis;
    // keep in-page anchor links (e.g. #catalog) buttery smooth too
    document.querySelectorAll('a[href^="#"]').forEach(a=>{
      a.addEventListener('click', e=>{
        const id = a.getAttribute('href');
        const target = id.length > 1 ? document.querySelector(id) : null;
        if (target){ e.preventDefault(); lenis.scrollTo(target, { duration: 1.1 }); }
      });
    });
  }

  // --- theme: always light by default, remembers the user's own choice ---
  const root = document.documentElement;
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') root.setAttribute('data-theme', 'dark');

  const toggleBtn = document.getElementById('themeToggle');
  if (toggleBtn){
    toggleBtn.addEventListener('click', ()=>{
      const isDark = root.getAttribute('data-theme') === 'dark';
      if (isDark) { root.removeAttribute('data-theme'); localStorage.setItem('theme','light'); }
      else { root.setAttribute('data-theme','dark'); localStorage.setItem('theme','dark'); }
    });
  }

  // --- intro curtain ---
  const curtain = document.querySelector('.curtain');
  let curtainHidden = false;
  function hideCurtain(){
    if (curtainHidden) return;
    curtainHidden = true;
    curtain && curtain.classList.add('hide');
  }
  window.addEventListener('load', () => setTimeout(hideCurtain, 320));
  // safety net: لو في مورد بطيء أو اتحجب (زي CDN خارجي) مبيخليش الستارة عالقة على الشاشة للأبد
  setTimeout(hideCurtain, 2500);

  // --- reusable "Tota" loading mark: letters fade out/in in sequence ---
  window.totaLoaderHTML = function(size){
    const cls = size === 'sm' ? 'tota-loader sm' : 'tota-loader';
    return `<div class="${cls}"><span>T</span><span>o</span><span>t</span><span>a</span></div>`;
  };

  // --- image loading state: shows a shimmer + keeps the image hidden until it's actually ready ---
  window.attachImageLoaders = function(root){
    (root || document).querySelectorAll('.card-media, .modal-media').forEach(box => {
      const img = box.querySelector('img');
      if (!img) return;
      const done = () => box.classList.remove('is-loading');
      if (img.complete && img.naturalWidth > 0) { done(); return; }
      box.classList.add('is-loading');
      img.addEventListener('load', done, { once:true });
      img.addEventListener('error', done, { once:true });
    });
  };

  // --- toast: رسالة صغيرة تظهر تحت وتختفي لوحدها، لأي رد فعل محتاج
  // "تم/فشل" واضح للمستخدم بدل ما الزرار يفضل ساكت من غير أي تفاعل ---
  window.totaToast = function (msg, kind) {
    let box = document.getElementById('totaToastBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'totaToastBox';
      box.style.cssText = 'position:fixed; bottom:20px; right:50%; transform:translateX(50%); z-index:9999; display:flex; flex-direction:column; gap:8px; align-items:center; pointer-events:none;';
      document.body.appendChild(box);
    }
    const el = document.createElement('div');
    const bg = kind === 'error' ? '#d64545' : (kind === 'success' ? '#2e7d32' : '#333');
    el.textContent = msg;
    el.style.cssText = `background:${bg}; color:#fff; padding:10px 18px; border-radius:20px; font-size:13.5px; box-shadow:0 4px 16px rgba(0,0,0,.18); opacity:0; transform:translateY(8px); transition:opacity .2s,transform .2s; max-width:88vw; text-align:center;`;
    box.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
    setTimeout(() => {
      el.style.opacity = '0'; el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 250);
    }, 2600);
  };

  // --- custom cursor (desktop only) ---
  if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
    const dot = document.createElement('div');
    const ring = document.createElement('div');
    dot.className = 'cursor-dot';
    ring.className = 'cursor-ring';
    document.body.append(dot, ring);
    let mx = 0, my = 0, rx = 0, ry = 0;
    window.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      dot.style.left = mx + 'px'; dot.style.top = my + 'px';
    });
    (function loop(){
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
      requestAnimationFrame(loop);
    })();
    document.querySelectorAll('a, button, .card, .magnetic').forEach(el=>{
      el.addEventListener('mouseenter', ()=>ring.classList.add('hover'));
      el.addEventListener('mouseleave', ()=>ring.classList.remove('hover'));
    });
  }

  // --- magnetic buttons ---
  document.querySelectorAll('.magnetic').forEach(el=>{
    el.addEventListener('mousemove', e=>{
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width/2;
      const y = e.clientY - r.top - r.height/2;
      el.style.transform = `translate(${x*0.25}px, ${y*0.35}px)`;
    });
    el.addEventListener('mouseleave', ()=>{ el.style.transform = 'translate(0,0)'; });
  });

  // --- sticky header shadow ---
  const topbar = document.querySelector('.topbar');
  if (topbar) {
    window.addEventListener('scroll', ()=>{
      topbar.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive:true });
  }

  // --- scroll reveal ---
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(en=>{
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold:0.15, rootMargin:'0px 0px -60px 0px' });
  function observeReveals(root=document){
    root.querySelectorAll('.reveal, .reveal-stagger').forEach(el=>io.observe(el));
  }
  window.observeReveals = observeReveals;
  observeReveals();

  // --- floating bubbles: gentle parallax while scrolling ---
  const bubbles = document.querySelectorAll('.bg-bubble');
  if (bubbles.length){
    let ticking = false;
    window.addEventListener('scroll', ()=>{
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(()=>{
        const y = window.scrollY;
        bubbles.forEach((b,i)=>{
          const speed = 0.06 + (i % 3) * 0.05;
          b.style.setProperty('--scrollY', (y*speed)+'px');
        });
        ticking = false;
      });
    }, { passive:true });
  }

  // --- 3D tilt on cards ---
  // خفيف افتراضيًا للجميع (زاوية أقل)، وأخف جدًا (شبه مسطّح) لمين مفعّل "تقليل الحركة"
  const prefersReducedMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TILT_DEG = prefersReducedMotion ? 1.5 : 4;
  const TILT_LIFT = prefersReducedMotion ? 0 : 3;
  window.enableTilt = function(el){
    el.style.transition = 'transform .15s ease-out';
    el.addEventListener('mousemove', e=>{
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left)/r.width - 0.5;
      const py = (e.clientY - r.top)/r.height - 0.5;
      el.style.transform = `perspective(900px) rotateY(${px*TILT_DEG}deg) rotateX(${-py*TILT_DEG}deg) translateY(-${TILT_LIFT}px)`;
    });
    el.addEventListener('mouseleave', ()=>{ el.style.transform = ''; });
  };

  // --- brand name / whatsapp / socials from config (fetched fresh, no cache) ---
  const cfgReady = window.TOTA_CONFIG_READY || Promise.resolve(window.TOTA_CONFIG || {});

  // --- social icons (minimal line style, matches theme) ---
  const SOCIAL_ICONS = {
    whatsapp:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11.5a8.5 8.5 0 0 1-12.3 7.6L4 20l1-4a8.5 8.5 0 1 1 15.5-4.5Z"/><path d="M8.7 9.4c.2-.5.5-.5.8-.5h.6c.2 0 .4 0 .6.4.2.5.7 1.6.7 1.8.1.1.1.3 0 .4-.1.2-.2.3-.3.4-.2.2-.3.3-.1.6.6 1 1.3 1.6 2.3 2.1.2.1.4.1.5-.1.2-.2.6-.7.8-.9.1-.2.3-.2.5-.1.6.3 1.5.7 1.8.9.1.1.2.1.2.3 0 .5-.2 1.1-.6 1.5-.4.4-1 .6-1.6.6-1 0-2.6-.5-4.3-2-1.7-1.5-2.7-3.3-2.9-3.7-.1-.2-.6-1-.6-1.9 0-.7.3-1 .5-1.2Z" fill="currentColor" stroke="none"/></svg>',
    telegram:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4 3 11.5l6 2m12-9.5-3.2 15L9 14m12-9.5L9 14m0 0-.7 5.5L11 15.8"/></svg>',
    facebook:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9h3V6h-3c-1.7 0-3 1.3-3 3v2H8v3h3v6h3v-6h3l1-3h-4v-2c0-.6.4-1 1-1Z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><circle cx="16.6" cy="7.4" r="1" fill="currentColor" stroke="none"/></svg>',
    tiktok:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v9.5a3.5 3.5 0 1 1-3.5-3.5c.3 0 .7 0 1 .1"/><path d="M14 4c.3 2 1.8 3.6 4 4"/></svg>',
    email:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5.5" width="17" height="13" rx="3"/><path d="m4 7 8 6 8-6"/></svg>'
  };
  const SOCIAL_LABELS = { whatsapp:'واتساب', telegram:'تليجرام', facebook:'فيسبوك', instagram:'انستجرام', tiktok:'تيك توك', email:'إيميل' };

  // --- builds social pills from config; empty links show as "coming soon" and stay disabled ---
  // async: ينتظر تحميل الإعدادات الطازجة من السيرفر الأول لو لسه ماوصلتش
  window.buildSocials = async function(containerId){
    const cfg = await cfgReady;
    const el = document.getElementById(containerId);
    if (!el) return;
    const socials = cfg.socials || {};
    const order = ['whatsapp','telegram','facebook','instagram','tiktok','email'];
    el.innerHTML = order.map(key=>{
      const link = socials[key];
      const icon = SOCIAL_ICONS[key] || '';
      const label = SOCIAL_LABELS[key] || key;
      if (link){
        const href = key === 'email' ? `mailto:${link}` : link;
        return `<a class="social-pill magnetic" href="${href}" target="_blank" rel="noopener">${icon}<span>${label}</span></a>`;
      }
      return `<span class="social-pill disabled" title="لسه مفيش صفحة ${label} — قريبًا إن شاء الله">${icon}<span>${label}</span><em>قريبًا</em></span>`;
    }).join('');
  };

  // --- everything else that depends on fresh config: brand name, whatsapp links, floating button ---
  cfgReady.then((cfg)=>{
    // brand name
    document.querySelectorAll('[data-site-name]').forEach(el=> el.textContent = cfg.siteName || 'Tota');
    document.title = document.title.replace(/^المتجر/, cfg.siteName || 'Tota');

    // whatsapp quick links
    function waLink(text){
      const num = (cfg.whatsapp || '').replace(/\D/g,'');
      const msg = encodeURIComponent(text || cfg.whatsappMessage || 'أهلاً');
      return num ? `https://wa.me/${num}?text=${msg}` : '#';
    }
    window.waLink = waLink;
    document.querySelectorAll('[data-whatsapp-link]').forEach(el=>{
      el.href = waLink(cfg.whatsappMessage);
      el.target = '_blank';
    });

    // floating whatsapp button: stays pinned in the corner while scrolling
    if (!document.querySelector('.whatsapp-float')){
      const num = (cfg.whatsapp || '').replace(/\D/g,'');
      if (num){
        const msg = encodeURIComponent(cfg.whatsappMessage || 'أهلاً');
        const btn = document.createElement('a');
        btn.className = 'whatsapp-float magnetic';
        btn.href = `https://wa.me/${num}?text=${msg}`;
        btn.target = '_blank';
        btn.rel = 'noopener';
        btn.setAttribute('aria-label', 'تواصل معنا على واتساب');
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.03c-.24.68-1.4 1.3-1.93 1.35-.5.05-1.13.07-1.83-.11-.42-.11-.96-.3-1.65-.6-2.9-1.25-4.79-4.17-4.94-4.36-.14-.2-1.18-1.57-1.18-3 0-1.42.75-2.12 1.02-2.41.27-.29.58-.36.78-.36.2 0 .39 0 .56.01.18.01.42-.07.65.5.24.58.82 2 .89 2.14.07.15.12.32.02.51-.1.2-.15.32-.3.5-.15.17-.31.39-.44.52-.15.15-.3.31-.13.6.17.29.75 1.24 1.62 2 1.11.99 2.05 1.3 2.34 1.44.29.15.46.13.63-.08.17-.2.72-.84.92-1.13.19-.29.39-.24.65-.14.27.1 1.7.8 1.99.95.29.15.48.22.55.34.07.13.07.75-.17 1.43z"/></svg><span class="whatsapp-float-pulse"></span>';
        document.body.appendChild(btn);
        // small entrance delay so it doesn't fight with the intro curtain
        setTimeout(()=> btn.classList.add('show'), 900);
      }
    }
  });

})();