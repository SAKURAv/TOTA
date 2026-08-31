// ============================================================
//  كود الدولة لأرقام الهاتف: بيحول أي <input type="tel"
//  data-phone-local> جنبه لـ select بكود الدولة (🇪🇬 +20 ...) بيتحدد
//  تلقائيًا بناءً على موقع الزائر (IP)، مع إمكانية تغييره يدويًا.
//  وبيعالج مشكلة الصفر الزيادة في أول الرقم المحلي تلقائيًا.
//
//  الاستخدام في أي فورم:
//    <span data-phone-country-wrap>
//      <input type="tel" data-phone-local placeholder="1xxxxxxxxx">
//    </span>
//  والسكريبت بيضيف الـ <select> لوحده جنب أي input عليه data-phone-local.
//
//  window.totaGetFullPhone(inputEl) => "+20xxxxxxxxxx" (بدون صفر زيادة)
//  window.totaSetPhoneCountry(inputEl, dial) => يغيّر كود الدولة برمجيًا
// ============================================================
(function () {
  'use strict';

  // قائمة مختصرة تغطي مصر والدول العربية والأكتر شيوعًا + كل الباقي
  // بكود عام. مش لازم تكون كل دول العالم بالظبط، المهم تغطية واسعة.
  const COUNTRIES = [
    ['EG', '+20', '🇪🇬 مصر'], ['SA', '+966', '🇸🇦 السعودية'], ['AE', '+971', '🇦🇪 الإمارات'],
    ['KW', '+965', '🇰🇼 الكويت'], ['QA', '+974', '🇶🇦 قطر'], ['BH', '+973', '🇧🇭 البحرين'],
    ['OM', '+968', '🇴🇲 عمان'], ['JO', '+962', '🇯🇴 الأردن'], ['LB', '+961', '🇱🇧 لبنان'],
    ['IQ', '+964', '🇮🇶 العراق'], ['SY', '+963', '🇸🇾 سوريا'], ['PS', '+970', '🇵🇸 فلسطين'],
    ['YE', '+967', '🇾🇪 اليمن'], ['LY', '+218', '🇱🇾 ليبيا'], ['TN', '+216', '🇹🇳 تونس'],
    ['DZ', '+213', '🇩🇿 الجزائر'], ['MA', '+212', '🇲🇦 المغرب'], ['SD', '+249', '🇸🇩 السودان'],
    ['SO', '+252', '🇸🇴 الصومال'], ['TR', '+90', '🇹🇷 تركيا'], ['GB', '+44', '🇬🇧 بريطانيا'],
    ['US', '+1', '🇺🇸 أمريكا'], ['DE', '+49', '🇩🇪 ألمانيا'], ['FR', '+33', '🇫🇷 فرنسا'],
    ['IT', '+39', '🇮🇹 إيطاليا'], ['CA', '+1', '🇨🇦 كندا']
  ];

  function findByIso(iso) {
    return COUNTRIES.find(function (c) { return c[0] === (iso || '').toUpperCase(); });
  }

  let detectedDial = null;
  const detectPromise = (async function () {
    try {
      const res = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
      const data = await res.json();
      const match = findByIso(data && data.country_code);
      detectedDial = match ? match[1] : '+20';
    } catch (e) {
      detectedDial = '+20'; // مصر كافتراضي لو تعذر تحديد الموقع
    }
    return detectedDial;
  })();

  function buildSelect(currentDial) {
    const select = document.createElement('select');
    select.className = 'tota-phone-country-select';
    select.setAttribute('aria-label', 'كود الدولة');
    COUNTRIES.forEach(function (c) {
      const opt = document.createElement('option');
      opt.value = c[1];
      opt.textContent = c[2] + ' ' + c[1];
      if (c[1] === currentDial) opt.selected = true;
      select.appendChild(opt);
    });
    return select;
  }

  // بيشيل أي صفر (أو أكتر) زيادة في أول الرقم المحلي — بيحصل غالبًا لما
  // حد ينسخ رقمه بصيغة "01xxxxxxxxx" بعد ما يكون دخل كود الدولة أصلاً.
  function stripLeadingZeros(local) {
    return (local || '').replace(/\D/g, '').replace(/^0+/, '');
  }

  function combine(dial, local) {
    const cleanLocal = stripLeadingZeros(local);
    return cleanLocal ? (dial + cleanLocal) : '';
  }

  // بيفصل رقم متخزن كامل زي "+201012345678" لـ {dial, local} عشان نعمر
  // بيه الـ select والـ input وقت التعديل (مش الإضافة الأولى).
  function split(fullPhone) {
    const val = (fullPhone || '').trim();
    if (!val) return { dial: null, local: '' };
    const sorted = COUNTRIES.slice().sort(function (a, b) { return b[1].length - a[1].length; });
    for (const c of sorted) {
      if (val.startsWith(c[1])) return { dial: c[1], local: val.slice(c[1].length) };
    }
    // مفيش + في الأول (رقم قديم اتسجل قبل ما الميزة دي تتضاف) — سيبه
    // زي ما هو كـ local بكود دولة افتراضي.
    return { dial: null, local: stripLeadingZeros(val) };
  }

  async function enhance(wrap) {
    const input = wrap.querySelector('[data-phone-local]');
    if (!input || wrap.dataset.phoneEnhanced) return;
    wrap.dataset.phoneEnhanced = '1';
    wrap.style.display = 'flex';
    wrap.style.gap = '6px';

    const presetFull = wrap.getAttribute('data-phone-value');
    const parsed = split(presetFull);
    if (parsed.local) input.value = parsed.local;

    const dial = parsed.dial || await detectPromise;
    const select = buildSelect(dial);
    wrap.insertBefore(select, input);
    wrap._totaCountrySelect = select;
  }

  function getFullPhone(inputEl) {
    const wrap = inputEl.closest('[data-phone-country-wrap]');
    const select = wrap && wrap._totaCountrySelect;
    const dial = select ? select.value : '+20';
    return combine(dial, inputEl.value);
  }

  // بيرجّع كود الدولة المختار حاليًا جنب الـ input (زي "+20") لوحده،
  // من غير ما يدمجه مع الرقم — محتاجينه نخزّنه منفصل في profiles.country_code.
  function getDial(inputEl) {
    const wrap = inputEl.closest('[data-phone-country-wrap]');
    const select = wrap && wrap._totaCountrySelect;
    return select ? select.value : '+20';
  }

  function setCountry(inputEl, dial) {
    const wrap = inputEl.closest('[data-phone-country-wrap]');
    const select = wrap && wrap._totaCountrySelect;
    if (select) select.value = dial;
  }

  function scan() {
    document.querySelectorAll('[data-phone-country-wrap]').forEach(enhance);
  }

  document.addEventListener('DOMContentLoaded', scan);
  // أي جزء من الصفحة بيتحمّل ديناميكيًا بعد كده (زي فورم في مودال)
  // يقدر ينادي على الدالة دي تاني.
  window.totaScanPhoneInputs = scan;
  window.totaGetFullPhone = getFullPhone;
  window.totaGetPhoneDial = getDial;
  window.totaSetPhoneCountry = setCountry;
  window.totaStripLeadingZeros = stripLeadingZeros;
})();
