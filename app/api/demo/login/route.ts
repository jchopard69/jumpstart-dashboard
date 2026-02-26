import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getClientIpFromHeaders,
  getDemoCredentials,
  isDemoAccessExpired,
  isDemoEnabled,
  isDemoTenant,
  logDemoAccess,
} from "@/lib/demo";

const DEMO_ENTRY_LIMIT = { max: 8, windowMs: 10 * 60 * 1000, blockMs: 30 * 60 * 1000 };

function buildSupabaseClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const ip = getClientIpFromHeaders(request.headers);
  const limit = checkRateLimit(`demo_entry:${ip}`, DEMO_ENTRY_LIMIT);
  if (!limit.allowed) {
    logDemoAccess("entry_rate_limited", { ip });
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
      }
    );
  }

  if (!isDemoEnabled()) {
    logDemoAccess("entry_blocked_disabled", { ip });
    return NextResponse.json({ error: "Le mode démo est désactivé." }, { status: 403 });
  }
  if (isDemoAccessExpired()) {
    logDemoAccess("entry_blocked_expired", { ip });
    return NextResponse.json({ error: "L'accès démo a expiré." }, { status: 403 });
  }

  let credentials: { email: string; password: string };
  try {
    credentials = getDemoCredentials();
  } catch (error) {
    console.error("[demo] invalid credentials config", error);
    return NextResponse.json({ error: "Configuration démo invalide." }, { status: 500 });
  }

  const sessionResponse = NextResponse.json({ ok: true });
  const supabase = buildSupabaseClient(request, sessionResponse);
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (signInError) {
    logDemoAccess("entry_login_failed", { ip, reason: signInError.message });
    return NextResponse.json({ error: "Connexion démo indisponible." }, { status: 401 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id || !(await isDemoTenant(profile.tenant_id))) {
    logDemoAccess("entry_blocked_non_demo_profile", { ip, userId: user.id, tenantId: profile?.tenant_id });
    await supabase.auth.signOut();
    return NextResponse.json({ error: "Compte démo invalide." }, { status: 403 });
  }

  logDemoAccess("entry_success", { ip, userId: user.id, tenantId: profile.tenant_id });

  const finalResponse = NextResponse.json({
    ok: true,
    redirectTo: `/client/dashboard?tenantId=${profile.tenant_id}`,
  });
  for (const cookie of sessionResponse.cookies.getAll()) {
    finalResponse.cookies.set(cookie.name, cookie.value, {
      domain: cookie.domain,
      expires: cookie.expires,
      httpOnly: cookie.httpOnly,
      maxAge: cookie.maxAge,
      path: cookie.path,
      sameSite: cookie.sameSite,
      secure: cookie.secure,
    });
  }
  return finalResponse;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
