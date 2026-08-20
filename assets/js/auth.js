// ============================================================
//  تسجيل الدخول / إنشاء حساب / تسجيل الخروج + إدارة حالة الجلسة
//  وربطها بأيقونة الحساب في الشريط العلوي.
// ============================================================
(function () {
  'use strict';

  function injectModalMarkup() {
    if (document.getElementById('totaAuthModal')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <div class="tota-modal-overlay" id="totaAuthModal" hidden>
      <div class="tota-modal" role="dialog" aria-modal="true" aria-labelledby="totaAuthTitle">
        <button type="button" class="tota-modal-close" id="totaAuthClose" aria-label="إغلاق">&times;</button>
        <h2 id="totaAuthTitle" class="tota-modal-title">تسجيل الدخول</h2>

        <div class="tota-auth-tabs">
          <button type="button" class="tota-auth-tab is-active" data-auth-tab="login">دخول</button>
          <button type="button" class="tota-auth-tab" data-auth-tab="signup">حساب جديد</button>
        </div>

        <form id="totaLoginForm" class="tota-auth-form">
          <label>البريد الإلكتروني<input type="email" name="email" required autocomplete="email"></label>
          <label>كلمة المرور<input type="password" name="password" required autocomplete="current-password"></label>
          <div class="tota-auth-error" data-login-error hidden></div>
          <button type="submit" class="btn-primary tota-auth-submit">دخول</button>
        </form>

        <form id="totaSignupForm" class="tota-auth-form" hidden>
          <label>الاسم<input type="text" name="full_name" required autocomplete="name"></label>
          <label>البريد الإلكتروني<input type="email" name="email" required autocomplete="email"></label>
          <label>رقم الهاتف (اختياري)<input type="tel" name="phone" pattern="01[0-9]{9}" placeholder="01xxxxxxxxx" autocomplete="tel"></label>
          <label>كلمة المرور<input type="password" name="password" required minlength="6" autocomplete="new-password"></label>
          <div class="cf-turnstile" data-sitekey="" id="totaTurnstileWidget"></div>
          <div class="tota-auth-error" data-signup-error hidden></div>
          <p class="tota-auth-privacy">بياناتك بتُستخدم بس للتواصل معاك بخصوص طلباتك.</p>
          <button type="submit" class="btn-primary tota-auth-submit">إنشاء الحساب</button>
        </form>
      </div>
    </div>

    <div class="tota-modal-overlay" id="totaCompleteProfileModal" hidden>
      <div class="tota-modal" role="dialog" aria-modal="true" aria-labelledby="totaCompleteProfileTitle">
        <h2 id="totaCompleteProfileTitle" class="tota-modal-title">كمّل بياناتك</h2>
        <p style="color:var(--muted); font-size:14px; margin-top:-6px;">تقدر تضيف رقم هاتفك دلوقتي أو بعدين من صفحة حسابك.</p>
        <form id="totaCompleteProfileForm" class="tota-auth-form">
          <label>رقم الهاتف (اختياري)<input type="tel" name="phone" pattern="01[0-9]{9}" placeholder="01xxxxxxxxx" autocomplete="tel"></label>
          <div class="tota-auth-error" data-complete-profile-error hidden></div>
          <div style="display:flex; gap:10px;">
            <button type="submit" class="btn-primary tota-auth-submit">حفظ</button>
            <button type="button" id="totaCompleteProfileSkip" class="tota-auth-submit" style="background:none; border:1px solid var(--line); color:var(--ink);">تخطي دلوقتي</button>
          </div>
        </form>
      </div>
    </div>`;
    while (wrap.firstElementChild) document.body.appendChild(wrap.firstElementChild);
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
    document.body.classList.add('tota-modal-open');
    switchTab(tab || 'login');
  }
  function closeModal() {
    const modal = document.getElementById('totaAuthModal');
    modal.hidden = true;
    document.body.classList.remove('tota-modal-open');
  }
  let turnstileWidgetId = null;
  function renderTurnstile() {
    const env = window.TOTA_ENV || {};
    const el = document.getElementById('totaTurnstileWidget');
    if (!el || !window.turnstile || !env.TURNSTILE_SITE_KEY) return;
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
  }

  async function init() {
    injectModalMarkup();

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
      if (e.target.id === 'totaAuthClose' || e.target.id === 'totaAuthModal') closeModal();
      const tabBtn = e.target.closest('[data-auth-tab]');
      if (tabBtn) switchTab(tabBtn.dataset.authTab);
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
      const phone = (fd.get('phone') || '').trim();
      if (phone && !/^01[0-9]{9}$/.test(phone)) { showError(errEl, 'رقم الهاتف غير صحيح (11 رقم يبدأ بـ 01).'); return; }

      const turnstileToken = window.turnstile && turnstileWidgetId !== null
        ? window.turnstile.getResponse(turnstileWidgetId) : '';
      if (!turnstileToken) { showError(errEl, 'من فضلك أكمل التحقق (أنا لست روبوت) قبل المتابعة.'); return; }

      const btn = signupForm.querySelector('.tota-auth-submit');
      btn.disabled = true;

      const env = window.TOTA_ENV || {};
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
      const { error } = await client.auth.signUp({
        email: fd.get('email'),
        password: fd.get('password'),
        options: { data: { full_name: fd.get('full_name'), phone: phone } }
      });
      btn.disabled = false;
      if (error) { showError(errEl, error.message === 'User already registered' ? 'الإيميل مسجل بالفعل.' : 'حدث خطأ، حاول مرة أخرى.'); return; }
      if (phone) { window.location.reload(); return; }
      openCompleteProfileModal();
    });

    // بعد التسجيل: نافذة صغيرة اختيارية لإكمال رقم الهاتف، تقدر تتخطاها
    function openCompleteProfileModal() {
      closeModal();
      const modal = document.getElementById('totaCompleteProfileModal');
      modal.hidden = false;
      document.body.classList.add('tota-modal-open');
    }
    function closeCompleteProfileModal() {
      const modal = document.getElementById('totaCompleteProfileModal');
      modal.hidden = true;
      document.body.classList.remove('tota-modal-open');
      window.location.reload();
    }
    const completeProfileForm = document.getElementById('totaCompleteProfileForm');
    completeProfileForm && completeProfileForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const errEl = completeProfileForm.querySelector('[data-complete-profile-error]');
      clearError(errEl);
      const fd = new FormData(completeProfileForm);
      const phone = (fd.get('phone') || '').trim();
      if (phone && !/^01[0-9]{9}$/.test(phone)) { showError(errEl, 'رقم الهاتف غير صحيح (11 رقم يبدأ بـ 01).'); return; }
      const client = await getClient();
      if (client && phone) {
        const { data: sessionData } = await client.auth.getSession();
        if (sessionData.session) {
          await client.from('profiles').update({ phone: phone }).eq('id', sessionData.session.user.id);
        }
      }
      closeCompleteProfileModal();
    });
    document.getElementById('totaCompleteProfileSkip') && document.getElementById('totaCompleteProfileSkip')
      .addEventListener('click', closeCompleteProfileModal);

    const client = await getClient();
    if (client) {
      const { data } = await client.auth.getSession();
      updateAccountUI(data.session);
      client.auth.onAuthStateChange(function (_evt, session) { updateAccountUI(session); });
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
