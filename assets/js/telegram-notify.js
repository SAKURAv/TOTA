// ============================================================
//  إشعار تليجرام فوري لأوردر جديد — بيبعت مباشرة من المتصفح لـ
//  Telegram Bot API (بدون أي وسيط سيرفر/Edge Function/Webhook).
//
//  التوكن وأرقام شات الأدمن بييجوا من data/env.json، اللي بيتولّد
//  وقت النشر من GitHub Secrets (TELEGRAM_BOT_TOKEN,
//  TELEGRAM_ADMIN_CHAT_IDS) بنفس آلية SUPABASE_URL/ANON_KEY الحالية
//  (شوف assets/js/env.js). ده معناه إن التوكن هيكون موجود في كود
//  الموقع المنشور (عادي وظاهر لأي حد يفتح devtools) — ده الثمن
//  الحتمي إن الموقع يبعت لتليجرام من غير أي سيرفر وسيط. لتقليل
//  المخاطرة: اعمل بوت مخصص للموقع بس (منفصل عن أي استخدام تاني)،
//  ولو حسيت إن حد بيسيء استخدامه اعمل /revoke من BotFather وحط
//  توكن جديد في GitHub Secrets وانشر تاني.
// ============================================================
(function () {
  'use strict';

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function getEnv() {
    if (window.TOTA_ENV) return window.TOTA_ENV;
    if (window.TOTA_ENV_READY) return await window.TOTA_ENV_READY;
    return {};
  }

  async function sendToAdmins(token, idsCsv, text, replyMarkup) {
    const ids = String(idsCsv || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!ids.length) return;
    await Promise.all(ids.map(function (chatId) {
      return fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML',
          reply_markup: replyMarkup || undefined
        })
      }).catch(function (e) { console.error('فشل إرسال تليجرام لـ ' + chatId, e); });
    }));
  }

  // إرسال نص بسيط (بدون منتجات/أزرار) لكل شاتات الأدمن — مستخدمة في
  // إشعارات زي "طلب حذف حساب جديد" أو "حساب جديد اتسجل".
  window.totaNotifyTextTelegram = async function (text) {
    try {
      const env = await getEnv();
      const token = env.TELEGRAM_BOT_TOKEN;
      const adminIds = env.TELEGRAM_ADMIN_CHAT_IDS;
      if (!token || !adminIds) return;
      await sendToAdmins(token, adminIds, text);
    } catch (e) {
      console.error('تعذر إرسال إشعار تليجرام:', e);
    }
  };

  // order = {
  //   heading, name, countryCode, phone, address, note,
  //   items: [{ name, quantity, price }], deliveryPrice, total
  // }
  window.totaNotifyOrderTelegram = async function (order) {
    try {
      const env = await getEnv();
      const token = env.TELEGRAM_BOT_TOKEN;
      const adminIds = env.TELEGRAM_ADMIN_CHAT_IDS;
      if (!token || !adminIds) {
        console.warn('TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_IDS مش متظبطين في data/env.json — لن يتم إرسال إشعار الأوردر.');
        return;
      }

      // رقم الهاتف كامل بكود الدولة، بصيغة واحدة تستخدم لعرض النسخ
      // وللينك واتساب مع بعض — <code> في تليجرام معناها ضغطة واحدة تنسخ الرقم.
      const digits = (String(order.countryCode || '') + String(order.phone || '')).replace(/\D/g, '');
      const phoneDisplay = digits ? ('+' + digits) : 'بدون رقم';

      const itemsText = (order.items || []).length
        ? order.items.map(function (it) {
            return '• ' + esc(it.name) + ' × ' + esc(it.quantity) + ' — ' + esc(it.price);
          }).join('\n')
        : '—';

      const lines = [
        order.heading || '🛒 <b>أوردر جديد</b>',
        '👤 ' + esc(order.name || 'بدون اسم'),
        '📱 <code>' + esc(phoneDisplay) + '</code>',
        '📍 ' + esc(order.address || 'بدون عنوان'),
        '',
        '🛍️ المنتجات:',
        itemsText,
        '',
        '🚚 التوصيل: ' + esc(order.deliveryPrice != null ? order.deliveryPrice : 0),
        '💰 الإجمالي: ' + esc(order.total != null ? order.total : 0)
      ];
      if (order.note) lines.push('', '📝 ملاحظة العميل: ' + esc(order.note));

      const replyMarkup = digits
        ? { inline_keyboard: [[{ text: 'واتساب 💬', url: 'https://wa.me/' + digits }]] }
        : undefined;

      await sendToAdmins(token, adminIds, lines.join('\n'), replyMarkup);
    } catch (e) {
      // مقصود: فشل إشعار تليجرام ميوقفش أو يفشّل تسجيل الأوردر نفسه.
      console.error('تعذر إرسال إشعار تليجرام:', e);
    }
  };
})();
