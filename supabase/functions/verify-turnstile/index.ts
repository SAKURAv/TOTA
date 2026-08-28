// ============================================================
// Edge Function: verify-turnstile
// بتاخد التوكين اللي جاي من الـ widget في الموقع، وتتحقق منه مع
// Cloudflare باستخدام الـ Secret Key (السري، مش موجود في الموقع
// أبدًا). لو التحقق فشل، التسجيل بيترفض من هنا قبل حتى ما يوصل
// لـ Supabase Auth.
//
// Rate limit ذاتي: نفس الـ IP معاه أكتر من RATE_LIMIT_MAX محاولة
// تحقق خلال RATE_LIMIT_WINDOW_SECONDS بيترفض فورًا (429) من غير ما
// نضرب Cloudflare siteverify أصلاً — بيحمي من استهلاك/abuse الدالة
// نفسها. العداد متخزن في جدول public.rate_limit_hits (نفس الجدول
// المستخدم في دوال الـ RPC) عن طريق REST API بمفتاح service role.
// ============================================================
// deno-lint-ignore-file
// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RATE_LIMIT_MAX = 10; // أقصى عدد محاولات تحقق لكل IP
const RATE_LIMIT_WINDOW_SECONDS = 60; // خلال الدقيقة

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return "unknown";
}

async function isRateLimited(ip: string): Promise<boolean> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return false; // لو الـ secrets مش متظبطة، منمنعش التسجيل بسبب حاجة تانية
  const rlKey = `turnstile_verify:${ip}`;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  try {
    const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
    // نظافة + عدّ الضربات الحالية لنفس المفتاح
    await fetch(`${url}/rest/v1/rate_limit_hits?rl_key=eq.${encodeURIComponent(rlKey)}&created_at=lt.${cutoff}`, {
      method: "DELETE",
      headers,
    });
    const countRes = await fetch(
      `${url}/rest/v1/rate_limit_hits?rl_key=eq.${encodeURIComponent(rlKey)}&select=id`,
      { headers: { ...headers, Prefer: "count=exact" } }
    );
    const contentRange = countRes.headers.get("content-range") || "";
    const total = parseInt(contentRange.split("/")[1] || "0", 10) || 0;
    if (total >= RATE_LIMIT_MAX) return true;
    await fetch(`${url}/rest/v1/rate_limit_hits`, {
      method: "POST",
      headers,
      body: JSON.stringify({ rl_key: rlKey }),
    });
    return false;
  } catch (e) {
    console.error("rate limit check failed:", e);
    return false; // لو فشل الفحص نفسه، منمنعش الطلب الشرعي بسببه
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const ip = getClientIp(req);
  if (await isRateLimited(ip)) {
    return new Response(JSON.stringify({ success: false, error: "rate_limited" }), {
      status: 429,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "missing_token" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!secret) {
      return new Response(JSON.stringify({ success: false, error: "server_not_configured" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
    });
    const verifyData = await verifyRes.json();

    return new Response(JSON.stringify({ success: !!verifyData.success }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: "bad_request" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});