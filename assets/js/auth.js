// ============================================================
//  تسجيل الدخول / إنشاء حساب / تسجيل الخروج + إدارة حالة الجلسة
//  وربطها بأيقونة الحساب في الشريط العلوي.
// ============================================================
(function () {
  'use strict';

  // نفترض "زائر" افتراضيًا من أول تحميل الصفحة (قبل ما نعرف حالة الجلسة
  // فعليًا من Supabase) عشان أزرار المفضلة/العربة متلمعش لحظة وبعدين تختفي.
  document.documentElement.classList.add('tota-is-guest');

  function injectModalMarkup() {
    if (document.getElementById('totaAuthModal')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <div class="tota-modal-overlay" id="totaAuthModal" hidden>
      <div class="tota-modal" data-lenis-prevent role="dialog" aria-modal="true" aria-labelledby="totaAuthTitle">
        <button type="button" class="tota-modal-close" id="totaAuthClose" aria-label="إغلاق">&times;</button>
        <h2 id="totaAuthTitle" class="tota-modal-title">تسجيل الدخول</h2>

        <div class="tota-auth-tabs">
          <button type="button" class="tota-auth-tab is-active" data-auth-tab="login">دخول</button>
          <button type="button" class="tota-auth-tab" data-auth-tab="signup">حساب جديد</button>
        </div>

        <form id="totaLoginForm" class="tota-auth-form">
          <label>البريد الإلكتروني<input type="email" name="email" required autocomplete="email"></label>
          <label>كلمة المرور
            <span class="tota-pass-wrap">
              <input type="password" name="password" required autocomplete="current-password" class="tota-pass-input">
              <button type="button" class="tota-pass-toggle" aria-label="إظهار كلمة المرور">👁</button>
            </span>
          </label>
          <div class="tota-auth-error" data-login-error hidden></div>
          <button type="submit" class="btn-primary tota-auth-submit">دخول</button>
          <button type="button" id="totaForgotPasswordLink" style="background:none;border:none;color:var(--muted);font-size:13px;text-decoration:underline;cursor:pointer;margin-top:4px;">نسيت كلمة المرور؟</button>
        </form>

        <form id="totaSignupForm" class="tota-auth-form" hidden>
          <label>الاسم<input type="text" name="full_name" required autocomplete="name"></label>
          <label>البريد الإلكتروني<input type="email" name="email" required autocomplete="email"></label>
          <label>رقم الهاتف (اختياري)
            <span data-phone-country-wrap>
              <input type="tel" name="phone" data-phone-local placeholder="1xxxxxxxxx" autocomplete="tel">
            </span>
          </label>
          <label>كلمة المرور
            <span class="tota-pass-wrap">
              <input type="password" name="password" required minlength="6" autocomplete="new-password" class="tota-pass-input">
              <button type="button" class="tota-pass-toggle" aria-label="إظهار كلمة المرور">👁</button>
            </span>
          </label>
          <div class="cf-turnstile" data-sitekey="" id="totaTurnstileWidget"></div>
          <div class="tota-auth-error" data-signup-error hidden></div>
          <p class="tota-auth-privacy">بياناتك بتُستخدم بس للتواصل معاك بخصوص طلباتك.</p>
          <label class="tota-terms-check">
            <input type="checkbox" required id="totaSignupTermsCheck">
            <span>موافق على <a href="terms.html" target="_blank" rel="noopener">الشروط والأحكام</a></span>
          </label>
          <button type="submit" class="btn-primary tota-auth-submit">إنشاء الحساب</button>
        </form>
      </div>
    </div>

    <div class="tota-modal-overlay" id="totaForgotPasswordModal" hidden>
      <div class="tota-modal" data-lenis-prevent role="dialog" aria-modal="true" aria-labelledby="totaForgotTitle">
        <button type="button" class="tota-modal-close" id="totaForgotClose" aria-label="إغلاق">&times;</button>
        <h2 id="totaForgotTitle" class="tota-modal-title">استعادة كلمة المرور</h2>
        <p style="color:var(--muted); font-size:14px; margin-top:-6px;">هنبعتلك رابط على إيميلك لتعيين كلمة مرور جديدة.</p>
        <form id="totaForgotPasswordForm" class="tota-auth-form">
          <label>البريد الإلكتروني<input type="email" name="email" required autocomplete="email"></label>
          <div class="tota-auth-error" data-forgot-error hidden></div>
          <div class="tota-auth-success" data-forgot-success hidden style="color:#2e7d32;font-size:14px;"></div>
          <button type="submit" class="btn-primary tota-auth-submit">إرسال رابط الاستعادة</button>
        </form>
      </div>
    </div>

    <div class="tota-modal-overlay" id="totaSetNewPasswordModal" hidden>
      <div class="tota-modal" data-lenis-prevent role="dialog" aria-modal="true" aria-labelledby="totaSetNewPasswordTitle">
        <h2 id="totaSetNewPasswordTitle" class="tota-modal-title">تعيين كلمة مرور جديدة</h2>
        <form id="totaSetNewPasswordForm" class="tota-auth-form">
          <label>كلمة المرور الجديدة
            <span class="tota-pass-wrap">
              <input type="password" name="password" required minlength="6" autocomplete="new-password" class="tota-pass-input">
              <button type="button" class="tota-pass-toggle" aria-label="إظهار كلمة المرور">👁</button>
            </span>
          </label>
          <div class="tota-auth-error" data-newpass-error hidden></div>
          <button type="submit" class="btn-primary tota-auth-submit">حفظ كلمة المرور</button>
        </form>
      </div>
    </div>

    <div class="tota-modal-overlay" id="totaCompleteProfileModal" hidden>
      <div class="tota-modal" data-lenis-prevent role="dialog" aria-modal="true" aria-labelledby="totaCompleteProfileTitle">
        <h2 id="totaCompleteProfileTitle" class="tota-modal-title">كمّل بياناتك</h2>
        <p style="color:var(--muted); font-size:14px; margin-top:-6px;">تقدر تضيف رقم هاتفك دلوقتي أو بعدين من صفحة حسابك.</p>
        <form id="totaCompleteProfileForm" class="tota-auth-form">
          <label>رقم الهاتف (اختياري)
            <span data-phone-country-wrap>
              <input type="tel" name="phone" data-phone-local placeholder="1xxxxxxxxx" autocomplete="tel">
            </span>
          </label>
          <div class="tota-auth-error" data-complete-profile-error hidden></div>
          <div style="display:flex; gap:10px;">
            <button type="submit" class="btn-primary tota-auth-submit">حفظ</button>
            <button type="button" id="totaCompleteProfileSkip" class="tota-auth-submit" style="background:none; border:1px solid var(--line); color:var(--ink);">تخطي دلوقتي</button>
          </div>
        </form>
      </div>
    </div>

    <div class="tota-modal-overlay" id="totaPhoneGateModal" hidden>
      <div class="tota-modal" data-lenis-prevent role="dialog" aria-modal="true" aria-labelledby="totaPhoneGateTitle">
        <button type="button" class="tota-modal-close" id="totaPhoneGateClose" aria-label="إغلاق">&times;</button>
        <h2 id="totaPhoneGateTitle" class="tota-modal-title">محتاجين رقم هاتفك</h2>
        <p style="color:var(--muted); font-size:14px; margin-top:-6px;">
          عشان نقدر نتواصل معاك بخصوص طلبك، لازم تسجّل رقم هاتفك (نفس رقم الواتساب) الأول.
        </p>
        <form id="totaPhoneGateForm" class="tota-auth-form">
          <label>رقم الهاتف
            <span data-phone-country-wrap>
              <input type="tel" name="phone" required data-phone-local placeholder="1xxxxxxxxx" autocomplete="tel">
            </span>
          </label>
          <div class="tota-auth-error" data-phone-gate-error hidden></div>
          <button type="submit" class="btn-primary tota-auth-submit">حفظ ومتابعة</button>
        </form>
      </div>
    </div>`;
    while (wrap.firstElementChild) document.body.appendChild(wrap.firstElementChild);
  }

  // قفل سكرول الصفحة اللي وراء المودال بشكل فعلي على الموبايل.
  // overflow:hidden على الـ body لوحده مش كافي على iOS Safari — الصفحة
  // اللي وراه بتفضل تتسكرول بالّلمس حتى لو المودال فاتح فوقها. الحل إننا
  // نثبّت الـ body بالكامل (position:fixed) في مكانه الحالي، وبعد ما
  // نقفل المودال نرجّعه يتسكرول من نفس المكان اللي كان واقف فيه.
  let totaScrollLockCount = 0;
  let totaSavedScrollY = 0;
  function lockBodyScroll() {
    if (totaScrollLockCount === 0) {
      totaSavedScrollY = window.scrollY || window.pageYOffset || 0;
      document.body.style.position = 'fixed';
      document.body.style.top = (-totaSavedScrollY) + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.classList.add('tota-modal-open');
      // <html> نفسه لازم ياخد overflow:hidden كمان. الـ body لوحده مش
      // كافي في كروم على الكمبيوتر: html هنا عنده overflow-x:hidden
      // متعرّف صراحةً، وده بيوقف عملية الـ "propagation" التلقائية
      // لخاصية overflow من body للـ viewport، فالمتصفح بيفضل يسكرول
      // الـ <html> نفسه حتى لو body مقفول.
      document.documentElement.classList.add('tota-modal-open');
      // Lenis (سكرول السايت الناعم في shared.js) بيمسك أحداث عجلة
      // الماوس على مستوى الصفحة كلها ويحرّك بيها سكرول الـ document
      // بنفسه (بدل السكرول الطبيعي)، فحتى لو قفلنا الصفحة اللي وراء
      // المودال، عجلة الماوس كانت بتفضل ماسكها Lenis ومش وصلة لسكرول
      // المودال نفسه (overflow-y:auto). لازم نوقّف Lenis مؤقتًا طول ما
      // في مودال مفتوح عشان السكرول الطبيعي جوه المودال يشتغل.
      if (window.lenis && typeof window.lenis.stop === 'function') window.lenis.stop();
    }
    totaScrollLockCount++;
  }
  function unlockBodyScroll() {
    if (totaScrollLockCount === 0) return;
    totaScrollLockCount--;
    if (totaScrollLockCount === 0) {
      document.body.classList.remove('tota-modal-open');
      document.documentElement.classList.remove('tota-modal-open');
      if (window.lenis && typeof window.lenis.start === 'function') window.lenis.start();
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, totaSavedScrollY);
    }
  }

  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }
  function clearError(el) { if (el) el.hidden = true; }

  function openModal(tab) {
    const modal = document.getElementById('totaAuthModal');
    modal.hidden = false;
    lockBodyScroll();
    switchTab(tab || 'login');
  }
  function closeModal() {
    const modal = document.getElementById('totaAuthModal');
    modal.hidden = true;
    unlockBodyScroll();
  }
  let turnstileWidgetId = null;
  function renderTurnstile() {
    const env = window.TOTA_ENV || {};
    const el = document.getElementById('totaTurnstileWidget');
    if (!el) return;
    if (!env.TURNSTILE_SITE_KEY) { el.hidden = true; return; }
    el.hidden = false;
    if (!window.turnstile) return;
    if (turnstileWidgetId !== null) {
      try { window.turnstile.remove(turnstileWidgetId); } catch (e) {}
    }
    turnstileWidgetId = window.turnstile.render(el, { sitekey: env.TURNSTILE_SITE_KEY });
  }

  function switchTab(tab) {
    document.querySelectorAll('.tota-auth-tab').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.authTab === tab);
    });
    document.getElementById('totaLoginForm').hidden = tab !== 'login';
    document.getElementById('totaSignupForm').hidden = tab !== 'signup';
    if (tab === 'signup') renderTurnstile();
  }

  async function getClient() {
    return window.TOTA_SUPABASE || (await window.TOTA_SUPABASE_READY);
  }

  function updateAccountUI(session) {
    document.querySelectorAll('[data-account-link]').forEach(function (btn) {
      btn.classList.toggle('is-logged-in', !!session);
    });
    // بتتحكم في إظهار/إخفاء أي عنصر عليه data-requires-auth (زي أزرار
    // المفضلة والعربة) — الزائر اللي مسجّلش حساب يشوف واتساب والمشاركة
    // بس، ولما يسجّل دخوله الأزرار دي بتظهر فورًا من غير ريفريش.
    document.documentElement.classList.toggle('tota-is-guest', !session);
    document.documentElement.classList.toggle('tota-is-authed', !!session);
  }

  async function init() {
    injectModalMarkup();
    // الفورمز اللي فيها رقم هاتف اتضافت للـ DOM لسه دلوقتي، لازم نطلب
    // من country-code.js يفحصها ويضيفلها كود الدولة (لو الملف اتحمّل).
    if (window.totaScanPhoneInputs) window.totaScanPhoneInputs();

    document.body.addEventListener('click', function (e) {
      const openBtn = e.target.closest('[data-account-link]');
      if (openBtn) {
        e.preventDefault();
        getClient().then(function (client) {
          if (client && client.auth.getSession) {
            client.auth.getSession().then(function (r) {
              if (r.data.session) {
                window.location.href = 'account.html';
              } else {
                openModal('login');
              }
            });
          } else {
            openModal('login');
          }
        });
      }
      if (e.target.classList && e.target.classList.contains('tota-pass-toggle')) {
        const input = e.target.previousElementSibling;
        if (input) {
          const show = input.type === 'password';
          input.type = show ? 'text' : 'password';
          e.target.textContent = show ? '🙈' : '👁';
        }
      }
      if (e.target.id === 'totaAuthClose' || e.target.id === 'totaAuthModal') closeModal();
      if (e.target.id === 'totaForgotPasswordLink') {
        closeModal();
        openForgotPasswordModal();
      }
      if (e.target.id === 'totaForgotClose' || e.target.id === 'totaForgotPasswordModal') closeForgotPasswordModal();
      const tabBtn = e.target.closest('[data-auth-tab]');
      if (tabBtn) switchTab(tabBtn.dataset.authTab);
    });

    function openForgotPasswordModal() {
      const modal = document.getElementById('totaForgotPasswordModal');
      modal.hidden = false;
      lockBodyScroll();
    }
    function closeForgotPasswordModal() {
      const modal = document.getElementById('totaForgotPasswordModal');
      modal.hidden = true;
      unlockBodyScroll();
    }
    const forgotForm = document.getElementById('totaForgotPasswordForm');
    forgotForm && forgotForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const errEl = forgotForm.querySelector('[data-forgot-error]');
      const successEl = forgotForm.querySelector('[data-forgot-success]');
      clearError(errEl);
      successEl.hidden = true;
      const client = await getClient();
      if (!client) { showError(errEl, 'الخدمة غير متاحة الآن، حاول لاحقًا.'); return; }
      const fd = new FormData(forgotForm);
      const btn = forgotForm.querySelector('.tota-auth-submit');
      btn.disabled = true;
      const { error } = await client.auth.resetPasswordForEmail(fd.get('email'), {
        redirectTo: window.location.origin + window.location.pathname
      });
      btn.disabled = false;
      if (error) { showError(errEl, 'حدث خطأ، حاول مرة أخرى.'); return; }
      successEl.textContent = 'اتبعتلك رابط على إيميلك. افتحه من نفس الجهاز خلال ساعة.';
      successEl.hidden = false;
      forgotForm.reset();
    });

    // لو المستخدم فتح رابط استعادة كلمة المرور من الإيميل، Supabase
    // بيبعت حدث PASSWORD_RECOVERY تلقائيًا (بفضل detectSessionInUrl)
    function openSetNewPasswordModal() {
      const modal = document.getElementById('totaSetNewPasswordModal');
      modal.hidden = false;
      lockBodyScroll();
    }
    const setNewPasswordForm = document.getElementById('totaSetNewPasswordForm');
    setNewPasswordForm && setNewPasswordForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const errEl = setNewPasswordForm.querySelector('[data-newpass-error]');
      clearError(errEl);
      const client = await getClient();
      if (!client) { showError(errEl, 'الخدمة غير متاحة الآن، حاول لاحقًا.'); return; }
      const fd = new FormData(setNewPasswordForm);
      const btn = setNewPasswordForm.querySelector('.tota-auth-submit');
      btn.disabled = true;
      const { error } = await client.auth.updateUser({ password: fd.get('password') });
      btn.disabled = false;
      if (error) { showError(errEl, 'تعذر حفظ كلمة المرور، جرب رابط استعادة جديد.'); return; }
      document.getElementById('totaSetNewPasswordModal').hidden = true;
      unlockBodyScroll();
      window.location.href = window.location.origin + window.location.pathname;
    });

    const loginForm = document.getElementById('totaLoginForm');
    const signupForm = document.getElementById('totaSignupForm');

    loginForm && loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const errEl = loginForm.querySelector('[data-login-error]');
      clearError(errEl);
      const client = await getClient();
      if (!client) { showError(errEl, 'الخدمة غير متاحة الآن، حاول لاحقًا.'); return; }
      const fd = new FormData(loginForm);
      const btn = loginForm.querySelector('.tota-auth-submit');
      btn.disabled = true;
      const { error } = await client.auth.signInWithPassword({
        email: fd.get('email'), password: fd.get('password')
      });
      btn.disabled = false;
      if (error) { showError(errEl, 'بيانات الدخول غير صحيحة.'); return; }
      window.location.reload();
    });

    signupForm && signupForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const errEl = signupForm.querySelector('[data-signup-error]');
      clearError(errEl);
      const client = await getClient();
      if (!client) { showError(errEl, 'الخدمة غير متاحة الآن، حاول لاحقًا.'); return; }
      const fd = new FormData(signupForm);
      const phoneInput = signupForm.querySelector('[data-phone-local]');
      // ملحوظة: بنستخدم الرقم الكامل (كود الدولة + محلي) للتحقق من الطول
      // بس، أما اللي بيتخزن في profiles.phone فلازم يكون محلي فقط (زي
      // ما بيحصل في الجست/guest checkout)، عشان country_code بيتخزن
      // لوحده أصلاً — تخزين الاتنين مع بعض كان بيسبب تكرار كود الدولة
      // مرتين وقت إرسال إشعار الأوردر (تليجرام/واتساب).
      const phone = phoneInput && phoneInput.value.trim() ? window.totaGetFullPhone(phoneInput) : '';
      const phoneLocal = phoneInput ? phoneInput.value.trim().replace(/\D/g, '').replace(/^0+/, '') : '';
      const phoneDial = phoneInput ? window.totaGetPhoneDial(phoneInput) : '+20';
      if (phoneInput && phoneInput.value.trim() && phone.length < 8) { showError(errEl, 'رقم الهاتف غير صحيح.'); return; }

      // Turnstile اختياري بالكامل: لو مفيش TURNSTILE_SITE_KEY متظبط في
      // GitHub Secrets (data/env.json)، الـ widget أصلاً مش بيتعرض
      // (شوف renderTurnstile فوق)، فمينفعش نطلب توكن منه — ده كان بيمنع
      // إنشاء أي حساب نهائيًا زي ما لوحظ. لو الـ site key متظبط فعلاً،
      // التحقق بيفضل إجباري زي ما هو.
      const env = window.TOTA_ENV || {};
      const turnstileEnabled = !!env.TURNSTILE_SITE_KEY;
      let turnstileToken = '';
      if (turnstileEnabled) {
        turnstileToken = window.turnstile && turnstileWidgetId !== null
          ? window.turnstile.getResponse(turnstileWidgetId) : '';
        if (!turnstileToken) { showError(errEl, 'من فضلك أكمل التحقق (أنا لست روبوت) قبل المتابعة.'); return; }
      }

      const btn = signupForm.querySelector('.tota-auth-submit');
      btn.disabled = true;

      if (turnstileEnabled) {
        try {
          const verifyRes = await fetch(env.SUPABASE_URL + '/functions/v1/verify-turnstile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: turnstileToken })
          });
          const verifyData = await verifyRes.json();
          if (!verifyData.success) {
            btn.disabled = false;
            showError(errEl, 'فشل التحقق الأمني، حاول مرة أخرى.');
            if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
            return;
          }
        } catch (e) {
          btn.disabled = false;
          showError(errEl, 'تعذر التحقق الأمني الآن، حاول لاحقًا.');
          return;
        }
      }
      const { data: signUpData, error } = await client.auth.signUp({
        email: fd.get('email'),
        password: fd.get('password'),
        options: {
          data: { full_name: fd.get('full_name'), phone: phoneLocal, country_code: phoneDial },
          // بيرجّع المستخدم لنفس صفحة الموقع بعد ما يدوس على لينك التأكيد
          // في إيميله — وبما إن detectSessionInUrl مفعّل في supabase-client.js،
          // هيتسجّل دخوله تلقائيًا فور الرجوع من غير ما يحتاج يفتح شاشة
          // تسجيل الدخول تاني بنفسه.
          emailRedirectTo: window.location.origin + window.location.pathname
        }
      });
      btn.disabled = false;
      if (error) {
        console.error('signUp error:', error);
        showError(errEl, error.message === 'User already registered' ? 'الإيميل مسجل بالفعل.' : 'حدث خطأ، حاول مرة أخرى.');
        return;
      }

      // لو Supabase مظبّط على "تأكيد الإيميل مطلوب" (الوضع الموصى بيه)،
      // مش بيرجّع session فورًا — الحساب بيتفعّل لما يدوس على لينك
      // التأكيد اللي وصله بالإيميل، وساعتها بيدخل تلقائيًا زي ما شرحنا فوق.
      if (!signUpData.session) {
        closeModal();
        showSignupCheckEmailNotice(fd.get('email'));
        return;
      }
      if (phone) { window.location.reload(); return; }
      openCompleteProfileModal();
    });

    // رسالة "تحقق من إيميلك" بعد التسجيل مباشرة، تظهر مكان نافذة الدخول
    function showSignupCheckEmailNotice(email) {
      const wrap = document.createElement('div');
      wrap.className = 'tota-modal-overlay';
      wrap.hidden = false;
      wrap.innerHTML = `
        <div class="tota-modal" data-lenis-prevent role="dialog" aria-modal="true">
          <button type="button" class="tota-modal-close" aria-label="إغلاق">&times;</button>
          <h2 class="tota-modal-title">اتبعتلك رسالة تأكيد ✉️</h2>
          <p style="color:var(--muted); font-size:14.5px;">
            بعتنالك رابط تفعيل على <strong>${email}</strong>. افتحه من نفس الجهاز ده
            وهتدخل حسابك تلقائيًا من غير ما تحتاج تسجّل دخول تاني.
          </p>
          <p style="color:var(--muted); font-size:13px;">مش لاقي الرسالة؟ شوف الـ Spam أو Junk.</p>
        </div>`;
      document.body.appendChild(wrap);
      lockBodyScroll();
      function close() { wrap.remove(); unlockBodyScroll(); }
      wrap.querySelector('.tota-modal-close').addEventListener('click', close);
      wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    }

    // بعد التسجيل: نافذة صغيرة اختيارية لإكمال رقم الهاتف، تقدر تتخطاها
    function openCompleteProfileModal() {
      closeModal();
      const modal = document.getElementById('totaCompleteProfileModal');
      modal.hidden = false;
      lockBodyScroll();
    }
    function closeCompleteProfileModal() {
      const modal = document.getElementById('totaCompleteProfileModal');
      modal.hidden = true;
      unlockBodyScroll();
      window.location.reload();
    }
    const completeProfileForm = document.getElementById('totaCompleteProfileForm');
    completeProfileForm && completeProfileForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const errEl = completeProfileForm.querySelector('[data-complete-profile-error]');
      clearError(errEl);
      const phoneInput = completeProfileForm.querySelector('[data-phone-local]');
      const phone = phoneInput && phoneInput.value.trim() ? window.totaGetFullPhone(phoneInput) : '';
      const phoneLocal = phoneInput ? phoneInput.value.trim().replace(/\D/g, '').replace(/^0+/, '') : '';
      const phoneDial = phoneInput ? window.totaGetPhoneDial(phoneInput) : '+20';
      if (phoneInput && phoneInput.value.trim() && phone.length < 8) { showError(errEl, 'رقم الهاتف غير صحيح.'); return; }
      const client = await getClient();
      if (client && phone) {
        const { data: sessionData } = await client.auth.getSession();
        if (sessionData.session) {
          await client.from('profiles').update({ phone: phoneLocal, country_code: phoneDial }).eq('id', sessionData.session.user.id);
        }
      }
      closeCompleteProfileModal();
    });
    document.getElementById('totaCompleteProfileSkip') && document.getElementById('totaCompleteProfileSkip')
      .addEventListener('click', closeCompleteProfileModal);

    // ---------------- بوابة "لازم رقم هاتف" قبل التواصل واتساب أو الطلب ----------------
    // بتفضل نفس الدالة اللي بتتنده من أي مكان في الموقع (زرار "اطلب على
    // واتساب" جوه صفحة منتج، وزرار "أضف للعربة") — لو المستخدم عنده رقم
    // هاتف مسجّل بالفعل، بتكمل على طول من غير ما تفتح أي حاجة.
    let pendingPhoneCallback = null;
    function openPhoneGateModal(onReady) {
      pendingPhoneCallback = onReady;
      const modal = document.getElementById('totaPhoneGateModal');
      modal.hidden = false;
      lockBodyScroll();
    }
    function closePhoneGateModal() {
      const modal = document.getElementById('totaPhoneGateModal');
      modal.hidden = true;
      unlockBodyScroll();
      pendingPhoneCallback = null;
    }
    document.getElementById('totaPhoneGateClose').addEventListener('click', closePhoneGateModal);
    const phoneGateForm = document.getElementById('totaPhoneGateForm');
    phoneGateForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const errEl = phoneGateForm.querySelector('[data-phone-gate-error]');
      clearError(errEl);
      const phoneInput = phoneGateForm.querySelector('[data-phone-local]');
      const phone = phoneInput ? window.totaGetFullPhone(phoneInput) : '';
      const phoneLocal = phoneInput ? phoneInput.value.trim().replace(/\D/g, '').replace(/^0+/, '') : '';
      const phoneDial = phoneInput ? window.totaGetPhoneDial(phoneInput) : '+20';
      if (!phoneInput || !phoneInput.value.trim() || phone.length < 8) { showError(errEl, 'رقم الهاتف غير صحيح.'); return; }
      const client = await getClient();
      if (!client) { showError(errEl, 'الخدمة غير متاحة الآن، حاول لاحقًا.'); return; }
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session) { showError(errEl, 'محتاج تسجّل دخولك الأول.'); return; }
      const btn = phoneGateForm.querySelector('.tota-auth-submit');
      btn.disabled = true;
      const { error } = await client.from('profiles').update({ phone: phoneLocal, country_code: phoneDial }).eq('id', sessionData.session.user.id);
      btn.disabled = false;
      if (error) { showError(errEl, 'تعذر حفظ الرقم، حاول تاني.'); return; }
      const cb = pendingPhoneCallback;
      phoneGateForm.reset();
      closePhoneGateModal();
      if (cb) cb();
    });

    // بتتنده من أي مكان في الموقع قبل أي إجراء لازم له رقم هاتف (طلب/تواصل
    // واتساب). onReady(session, phone) بتتنفذ فورًا لو الرقم موجود بالفعل.
    window.totaEnsurePhone = async function (onReady) {
      const client = await getClient();
      if (!client) return;
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session) {
        window.dispatchEvent(new CustomEvent('tota:auth-required'));
        return;
      }
      const { data: profile } = await client.from('profiles').select('phone').eq('id', sessionData.session.user.id).single();
      if (profile && profile.phone) { onReady(sessionData.session, profile.phone); return; }
      openPhoneGateModal(function () { onReady(sessionData.session, null); });
    };

    const client = await getClient();
    if (client) {
      const { data } = await client.auth.getSession();
      updateAccountUI(data.session);
      // getSession() بيرجع بيانات من localStorage بس (توكن لسه ما
      // انتهاش وقته)، مش بيتأكد إن الحساب لسه موجود فعليًا على السيرفر.
      // فلو المستخدم اتحذف حسابه من برنامج الأدمن، هيفضل شكله "مسجل
      // دخول" في المتصفح لحد ما التوكن ينتهي بنفسه. getUser() بالعكس
      // بيبعت طلب فعلي لسيرفر Supabase Auth للتأكد، فلو رجع خطأ (يعني
      // الحساب مش موجود / اتحذف) بنعمل تسجيل خروج فوري ونحدّث الواجهة.
      if (data.session) {
        client.auth.getUser().then(function (r) {
          if (r.error) {
            client.auth.signOut().then(function () {
              updateAccountUI(null);
              if (window.location.pathname.indexOf('account.html') !== -1) {
                window.location.href = 'index.html';
              }
            });
          }
        });
      }
      client.auth.onAuthStateChange(function (_evt, session) {
        updateAccountUI(session);
        if (_evt === 'PASSWORD_RECOVERY') openSetNewPasswordModal();
      });
    }
  }

  window.totaLogout = async function () {
    const client = await getClient();
    if (client) await client.auth.signOut();
    window.location.href = 'index.html';
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();