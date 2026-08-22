// ============================================================
//  عميل Supabase الموحّد لكل صفحات الموقع. بيستنى env.js يخلص
//  تحميل data/env.json (بدون كاش) قبل ما يبني العميل، عشان يضمن
//  إنه شغال بأحدث قيم دايمًا من غير ما تكون متحفوظة في الكود.
// ============================================================
window.TOTA_SUPABASE_READY = (async function () {
  const env = await (window.TOTA_ENV_READY || Promise.resolve({}));
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    console.error('متغيرات Supabase غير متاحة (تأكد من إضافة GitHub Secrets ثم عمل Push).');
    return null;
  }
  const client = window.supabase.createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.TOTA_SUPABASE = client;
  return client;
})();
