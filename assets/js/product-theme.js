// ============================================================================
// تخصيص شكل كل منتج على حدة (ألوان/إطار/ظل) — لو موجود ليه ملف في
// themes/products/<id>.json (بيتحط من برنامج الأدمن). لو الملف مش
// موجود (404 عادي جدًا، مش خطأ)، المنتج بياخد شكل الموقع الافتراضي
// زي ما هو من غير أي تغيير.
//
// الطريقة: بنحقن <style> فيه override محلي لنفس متغيرات CSS اللي
// الموقع أصلاً بيستخدمها (--paper, --ink, --line, --accent...) لكن
// معمول له scope بس على .card[data-id="ID"] و .modal[data-id="ID"]
// — فمنتج تاني مش بيتأثر خالص، وأي جزء من الكارت/المودال مبني على
// نفس المتغيرات ده بيتلوّن تلقائي من غير ما نلمس كل selector لوحده.
// ============================================================================
(function(){
  // كاش بسيط في الذاكرة: بيمنع تكرار نفس الـ fetch لو المنتج ظهر
  // أكتر من مرة (كارت + موديل، أو أكتر من كارت لنفس المنتج في أكتر
  // من قسم بالصفحة)
  const requested = new Set();

  function fileNameFor(id){
    // استبدال "/" بـ"__" عشان يبقى اسم ملف صالح، وبنعمل encode لكل
    // جزء لوحده عشان أي حروف عربي أو خاصة في الـ slug تفضل شغالة
    return id.split('/').map(encodeURIComponent).join('__') + '.json';
  }

  function hexToRgb(hex){
    if (!hex) return null;
    const m = String(hex).trim().replace('#', '');
    const full = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    };
  }

  function shadowCss(shadow){
    if (!shadow || shadow.enabled === false) return null;
    const rgb = hexToRgb(shadow.color) || { r: 90, g: 70, b: 50 };
    const opacity = shadow.opacity != null ? shadow.opacity : 0.14;
    const blur = shadow.blur != null ? shadow.blur : 34;
    const y = shadow.y != null ? shadow.y : 14;
    return `0 ${y}px ${blur}px rgba(${rgb.r},${rgb.g},${rgb.b},${opacity})`;
  }

  // بيحوّل قيم وضع واحد (فاتح أو غامق) لسطور CSS custom properties
  function varsFor(mode){
    if (!mode) return '';
    const lines = [];
    if (mode.background){
      lines.push(`--paper:${mode.background};`);
      lines.push(`--paper-dim:${mode.background};`);
    }
    if (mode.text) lines.push(`--ink:${mode.text};`);
    if (mode.textSoft) lines.push(`--ink-soft:${mode.textSoft};`);
    if (mode.border) lines.push(`--line:${mode.border};`);
    if (mode.button){
      // متغيّر واحد بيلوّن كل عائلة الأزرار (السعر/المفضلة عند الهوفر/
      // زرار واتساب في الكارت والموديل/زرار أضف للعربة عند الهوفر...)
      // عشان يبقى شكل الأزرار متناسق مع بعضه بدل ما يتلخبط
      lines.push(`--accent:${mode.button};`);
      lines.push(`--accent-dark:${mode.button};`);
      lines.push(`--accent-2:${mode.button};`);
      lines.push(`--wa-btn:${mode.button};`);
    }
    if (mode.borderRadius != null){
      const r = `${mode.borderRadius}px`;
      lines.push(`--radius:${r};`);
      lines.push(`--radius-mobile:${r};`);
      lines.push(`--modal-radius:${r};`);
    }
    if (mode.borderStyle) lines.push(`--border-style:${mode.borderStyle};`);
    if (mode.shadow){
      const css = shadowCss(mode.shadow);
      if (css){
        lines.push(`--shadow:${css};`);
        lines.push(`--card-shadow:${css};`);
      } else {
        lines.push(`--card-shadow:none;`);
      }
    }
    return lines.join('');
  }

  function buildCss(id, theme){
    // بنهرب من علامة الاقتباس المزدوجة جوه الـ id (نظريًا مش متوقعة
    // في slug، بس بنحمي نفسنا من أي كسر في الـ selector)
    const safeId = String(id).replace(/"/g, '\\"');
    const scope = `.card[data-id="${safeId}"], .modal[data-id="${safeId}"]`;
    const darkScope = `[data-theme="dark"] .card[data-id="${safeId}"], [data-theme="dark"] .modal[data-id="${safeId}"]`;

    const light = theme.light || {};
    const dark = theme.sameForBothModes ? light : (theme.dark || {});

    const lightVars = varsFor(light);
    const darkVars = varsFor(dark);

    let css = '';
    if (lightVars) css += `${scope}{${lightVars}}\n`;
    if (darkVars) css += `${darkScope}{${darkVars}}\n`;
    return css;
  }

  async function apply(id){
    if (!id || requested.has(id)) return;
    requested.add(id);
    try{
      const res = await fetch('themes/products/' + fileNameFor(id), { cache: 'no-store' });
      if (!res.ok) return; // 404 = مفيش تخصيص لهذا المنتج، طبيعي جدًا
      const theme = await res.json();
      if (!theme || typeof theme !== 'object') return;
      const css = buildCss(id, theme);
      if (!css.trim()) return;
      const styleEl = document.createElement('style');
      styleEl.setAttribute('data-product-theme', id);
      styleEl.textContent = css;
      document.head.appendChild(styleEl);
    }catch(e){
      // فشل الشبكة أو JSON تالف — بنتجاهله بهدوء ونسيب المنتج بشكله
      // الافتراضي بدل ما نكسر باقي الصفحة
    }
  }

  window.TotaProductTheme = { apply };
})();
