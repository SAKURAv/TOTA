// ============================================================
// Edge Function: verify-turnstile
// بتاخد التوكين اللي جاي من الـ widget في الموقع، وتتحقق منه مع
// Cloudflare باستخدام الـ Secret Key (السري، مش موجود في الموقع
// أبدًا). لو التحقق فشل، التسجيل بيترفض من هنا قبل حتى ما يوصل
// لـ Supabase Auth.
// ============================================================
// deno-lint-ignore-file
// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
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
