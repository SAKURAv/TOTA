// ============================================================
// Edge Function: notify-telegram
// بتستقبل استدعاء من "Database Webhooks" بتاعة Supabase (مفعّلة من
// لوحة تحكم المشروع، مش محتاجة أي كود إضافي في الموقع نفسه) كل ما
// يحصل حدث مهم في قاعدة البيانات، وتبعت رسالة فورية في الخاص لبوت
// تليجرام بتاع الأدمن (مش جروب — رسالة خاصة بس للأدمن).
//
// الأحداث اللي بتتغطى:
//   - orders          (insert)  → أوردر جديد (أول منتج في العربة)
//   - order_items     (insert)  → منتج جديد اتضاف لأوردر موجود بالفعل
//   - account_delete_requests (insert) → طلب حذف حساب جديد يحتاج مراجعة
//   - profiles        (insert)  → حساب جديد اتسجل في الموقع
//
// الإعداد (خطوة واحدة من غير كود):
//   1) اعمل بوت تليجرام من BotFather وهياخد لك TELEGRAM_BOT_TOKEN.
//   2) ابعت أي رسالة للبوت من حساب الأدمن، وبعدين افتح:
//      https://api.telegram.org/bot<TOKEN>/getUpdates
//      هتلاقي رقم "chat":{"id": ...} ده هو TELEGRAM_ADMIN_CHAT_ID.
//   3) supabase secrets set TELEGRAM_BOT_TOKEN=... TELEGRAM_ADMIN_CHAT_ID=...
//   4) من Dashboard → Database → Webhooks: اعمل webhook لكل جدول من
//      الجداول الأربعة فوق (Insert بس)، ووجّهه لـ notify-telegram.
// ============================================================
// deno-lint-ignore-file
// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// بيدعم أكتر من أدمن واحد: TELEGRAM_ADMIN_CHAT_IDS = "111111,222222,333333"
// (مفصولين بفاصلة، مسافات زيادة حوالين كل id متجاهلة تلقائيًا). لو مش
// موجود، بيرجع للسر القديم TELEGRAM_ADMIN_CHAT_ID (id واحد بس) عشان
// أي إعداد قديم يفضل شغال من غير ما يحتاج تغيير.
function getAdminChatIds(): string[] {
  const multi = Deno.env.get("TELEGRAM_ADMIN_CHAT_IDS");
  if (multi) {
    return multi.split(",").map((s) => s.trim()).filter(Boolean);
  }
  const single = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID");
  return single ? [single.trim()] : [];
}

async function sendTelegram(text: string) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatIds = getAdminChatIds();
  if (!token || chatIds.length === 0) {
    console.error("TELEGRAM_BOT_TOKEN أو TELEGRAM_ADMIN_CHAT_IDS مش متظبطين في secrets.");
    return;
  }
  // بتتبعت لكل الأدمنز في نفس الوقت (مش واحد ورا التاني) عشان الإشعار
  // يوصل بسرعة للكل، وفشل رسالة لأدمن واحد ميوقفش باقي الإشعارات.
  await Promise.all(
    chatIds.map(async (chatId) => {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`فشل إرسال تليجرام لـ ${chatId}:`, res.status, body);
      }
    })
  );
}

function esc(v: unknown) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// بيجيب اسم/هاتف صاحب الحساب من جدول profiles عشان الرسالة تبقى
// مفيدة فورًا من غير ما الأدمن يحتاج يفتح البرنامج ليعرف مين ده.
async function fetchProfile(userId: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key || !userId) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/profiles?id=eq.${userId}&select=full_name,phone`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const payload = await req.json();
    const table = payload.table;
    const record = payload.record || {};

    let text = "";

    if (table === "orders") {
      const profile = await fetchProfile(record.user_id);
      const name = profile?.full_name || "بدون اسم";
      const phone = profile?.phone || "بدون رقم";
      text =
        `🛒 <b>أوردر جديد</b>\n` +
        `👤 ${esc(name)}\n` +
        `📱 ${esc(phone)}\n` +
        `💰 الإجمالي الحالي: ${esc(record.total ?? 0)}`;
    } else if (table === "order_items") {
      text =
        `➕ <b>منتج جديد اتضاف لأوردر</b>\n` +
        `📦 ${esc(record.product_name_snapshot)}\n` +
        `🔢 الكمية: ${esc(record.quantity)}\n` +
        `💵 السعر: ${esc(record.unit_price)}`;
    } else if (table === "account_delete_requests") {
      const profile = await fetchProfile(record.user_id);
      const name = profile?.full_name || "بدون اسم";
      const phone = profile?.phone || "بدون رقم";
      text =
        `⚠️ <b>طلب حذف حساب جديد</b>\n` +
        `👤 ${esc(name)}\n` +
        `📱 ${esc(phone)}\n` +
        (record.reason ? `📝 السبب: ${esc(record.reason)}\n` : "") +
        `يحتاج مراجعة من برنامج الأدمن.`;
    } else if (table === "profiles") {
      const name = record.full_name || "بدون اسم";
      const phone = record.phone || "بدون رقم";
      text =
        `✨ <b>حساب جديد اتسجل في الموقع</b>\n` +
        `👤 ${esc(name)}\n` +
        `📱 ${esc(phone)}`;
    } else {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    await sendTelegram(text);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-telegram error:", e);
    return new Response(JSON.stringify({ ok: false, error: "bad_request" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
