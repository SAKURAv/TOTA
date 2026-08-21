// ============================================================
// Edge Function: notify-telegram
// بتستقبل استدعاء من "Database Webhooks" بتاعة Supabase كل ما
// يحصل حدث مهم في قاعدة البيانات، وتبعت رسالة فورية في الخاص لبوت
// تليجرام بتاع الأدمن.
//
// الأحداث اللي بتتغطى دلوقتي:
//   - orders (insert) حيث status = 'placed'
//       → المستخدم ضغط "اطلب الآن" في السلة: بتتبعت رسالة واحدة
//         كاملة فيها كل منتجات الأوردر + العنوان + سعر التوصيل +
//         الإجمالي + رقم الهاتف + الملاحظة الإضافية لو موجودة.
//         (مفيش رسائل منفصلة لكل منتج بيتضاف للسلة زي الأول —
//         السلة نفسها صامتة، رسالة واحدة بس وقت الطلب الفعلي.)
//   - account_delete_requests (insert) → طلب حذف حساب جديد.
//
// ------------------------------------------------------------
// ⚠️ ليه كانت الرسايل مش بتوصل قبل كده / حلول لو استمرت المشكلة:
//   1) لازم الـ Webhooks نفسهم يكونوا متعملين من Dashboard → Database
//      → Webhooks (خطوة يدوية، مفيش كود ممكن يعملها بدل الأدمن):
//        - Webhook على جدول orders، الحدث Insert بس، Type: Supabase
//          Edge Functions → notify-telegram.
//        - Webhook على جدول account_delete_requests، الحدث Insert،
//          نفس الوجهة.
//      لو الجدولين دول مش متسجلين في Database Webhooks في الداشبورد،
//      الفنكشن مش هيتنادى خالص مهما كان الكود فيه صح.
//   2) لازم secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID (أو
//      TELEGRAM_ADMIN_CHAT_IDS لأكتر من أدمن), SUPABASE_URL,
//      SUPABASE_SERVICE_ROLE_KEY تكون متظبطة (supabase secrets set...).
//      من غيرهم الفنكشن هيرجع 200 لـ Supabase (عشان الـ webhook ميعتبرش
//      نفسه فاشل ويعيد المحاولة بلا داعي) لكن مش هيبعت أي رسالة فعليًا،
//      وهيسجل تفصيل السبب في function logs (Dashboard → Edge Functions
//      → notify-telegram → Logs) — اتأكد تشوف اللوجز دي لو الرسايل لسه
//      مش واصلة بعد التأكد من الـ webhooks نفسهم.
//   3) اتأكد إن الـ webhook مفعّل (enabled) مش متوقف (disabled) في
//      الداشبورد، وإن الجدول المستهدف صح بالظبط (orders مش order_items).
// ============================================================
// deno-lint-ignore-file
// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getAdminChatIds(): string[] {
  const multi = Deno.env.get("TELEGRAM_ADMIN_CHAT_IDS");
  if (multi) return multi.split(",").map((s) => s.trim()).filter(Boolean);
  const single = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID");
  return single ? [single.trim()] : [];
}

async function sendTelegram(text: string) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatIds = getAdminChatIds();
  if (!token || chatIds.length === 0) {
    console.error(
      "⚠ TELEGRAM_BOT_TOKEN أو TELEGRAM_ADMIN_CHAT_ID(S) مش متظبطين في secrets — " +
      "شغّل: supabase secrets set TELEGRAM_BOT_TOKEN=... TELEGRAM_ADMIN_CHAT_ID=..."
    );
    return;
  }
  const results = await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error(`✖ فشل إرسال تليجرام لـ ${chatId}: ${res.status} ${body}`);
          return false;
        }
        return true;
      } catch (e) {
        console.error(`✖ خطأ شبكة وقت الإرسال لـ ${chatId}:`, e);
        return false;
      }
    })
  );
  if (!results.some(Boolean)) console.error("✖ فشلت كل محاولات إرسال الرسالة لكل الأدمنز.");
}

function esc(v: unknown) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function restHeaders(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function fetchProfile(url: string, key: string, userId: string) {
  if (!userId) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/profiles?id=eq.${userId}&select=full_name,phone,country_code`,
      { headers: restHeaders(key) }
    );
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (e) {
    console.error("تعذر جلب profile:", e);
    return null;
  }
}

async function fetchAddress(url: string, key: string, addressId: string | null) {
  if (!addressId) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/addresses?id=eq.${addressId}&select=label,full_address,city`,
      { headers: restHeaders(key) }
    );
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (e) {
    console.error("تعذر جلب address:", e);
    return null;
  }
}

async function fetchOrderItems(url: string, key: string, orderId: string) {
  try {
    const res = await fetch(
      `${url}/rest/v1/order_items?order_id=eq.${orderId}&select=product_name_snapshot,unit_price,quantity`,
      { headers: restHeaders(key) }
    );
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    console.error("تعذر جلب order_items:", e);
    return [];
  }
}

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: "لم يتم الدفع",
  partial: "دفع جزء من المبلغ",
  paid: "تم الدفع بالكامل",
};
const DELIVERY_LABELS: Record<string, string> = {
  not_shipped: "لم يشحن",
  out_for_delivery: "خرج للتوصيل",
  shipping: "جار التوصيل",
  delivered: "تم التوصيل",
};

async function buildOrderMessage(url: string, key: string, record: any, heading: string) {
  const profile = await fetchProfile(url, key, record.user_id);
  const address = await fetchAddress(url, key, record.address_id);
  const items = await fetchOrderItems(url, key, record.id);

  const name = (profile && profile.full_name) || record.guest_name || "بدون اسم";
  const phone = (profile && profile.phone) || record.guest_phone || "بدون رقم";

  const itemsText = items.length
    ? items.map((it: any) =>
        `• ${esc(it.product_name_snapshot)} × ${esc(it.quantity)} — ${esc(it.unit_price)}`
      ).join("\n")
    : "—";

  const addressText = address
    ? `${esc(address.label || "عنوان")}: ${esc(address.full_address)}${address.city ? " — " + esc(address.city) : ""}`
    : (record.guest_address ? esc(record.guest_address) : "بدون عنوان");

  const lines = [
    heading,
    `👤 ${esc(name)}`,
    `📱 ${esc(phone)}`,
    `📍 ${addressText}`,
    ``,
    `🛍️ المنتجات:`,
    itemsText,
    ``,
    `🚚 التوصيل: ${esc(record.delivery_price ?? 0)}`,
    `💰 الإجمالي: ${esc(record.total ?? 0)}`,
    `💳 حالة الدفع: ${esc(PAYMENT_LABELS[record.payment_status] || record.payment_status || "—")}`,
    `📦 حالة التوصيل: ${esc(DELIVERY_LABELS[record.delivery_status] || record.delivery_status || "—")}`,
  ];
  if (record.note) lines.push(``, `📝 ملاحظة العميل: ${esc(record.note)}`);
  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  try {
    const payload = await req.json();
    const table = payload.table;
    const type = payload.type; // 'INSERT' | 'UPDATE' | ...
    const record = payload.record || {};

    if (table === "orders") {
      // 1) أوردر جديد اتبعت فعليًا من السلة (insert بحالة placed).
      // 2) الأدمن علّم الأوردر إنه "تم التسليم" من البرنامج (update لـ
      //    delivery_status = delivered) — بيتبعت تأكيد بكل بيانات
      //    الأوردر برضه، مطلوب عشان الأرشفة/المتابعة على تليجرام.
      const wasAlreadyPlaced = payload.old_record && payload.old_record.status === "placed";
      const becameDelivered =
        type === "UPDATE" &&
        record.delivery_status === "delivered" &&
        payload.old_record &&
        payload.old_record.delivery_status !== "delivered";

      if (record.status === "placed" && !wasAlreadyPlaced) {
        const text = await buildOrderMessage(SUPABASE_URL, SERVICE_KEY, record, "🛒 <b>أوردر جديد</b>");
        await sendTelegram(text);
      } else if (becameDelivered) {
        const text = await buildOrderMessage(SUPABASE_URL, SERVICE_KEY, record, "✅ <b>تم تسليم الأوردر</b>");
        await sendTelegram(text);
      } else {
        return new Response(JSON.stringify({ ok: true, skipped: true }), {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    } else if (table === "account_delete_requests") {
      const profile = await fetchProfile(SUPABASE_URL, SERVICE_KEY, record.user_id);
      const name = (profile && profile.full_name) || "بدون اسم";
      const phone = (profile && profile.phone) || "بدون رقم";
      const text =
        `⚠️ <b>طلب حذف حساب جديد</b>\n` +
        `👤 ${esc(name)}\n` +
        `📱 ${esc(phone)}\n` +
        (record.reason ? `📝 السبب: ${esc(record.reason)}\n` : "") +
        `يحتاج مراجعة من برنامج الأدمن.`;
      await sendTelegram(text);
    } else if (table === "profiles" && type === "INSERT") {
      const name = record.full_name || "بدون اسم";
      const phone = record.phone || "بدون رقم";
      const text =
        `✨ <b>حساب جديد اتسجل في الموقع</b>\n` +
        `👤 ${esc(name)}\n` +
        `📱 ${esc(phone)}`;
      await sendTelegram(text);
    } else {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

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