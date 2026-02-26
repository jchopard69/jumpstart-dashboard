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

const GLOBAL_LOGIN_LIMIT = { max: 12, windowMs: 10 * 60 * 1000, blockMs: 15 * 60 * 1000 };
const DEMO_LOGIN_LIMIT = { max: 6, windowMs: 10 * 60 * 1000, blockMs: 30 * 60 * 1000 };

function sanitizeEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

function buildSupabaseClient(request: NextRequest, response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(supabaseUrl, supabaseAnonKey, {
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
  });
}

export async function POST(request: NextRequest) {
  const ip = getClientIpFromHeaders(request.headers);
  const globalLimit = checkRateLimit(`auth_login:${ip}`, GLOBAL_LOGIN_LIMIT);
  if (!globalLimit.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(globalLimit.retryAfterMs / 1000)) },
      }
    );
  }

  const body = await request.json().catch(() => null);
  const email = sanitizeEmail(body?.email);
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 });
  }

  const demoEmail = process.env.DEMO_USER_EMAIL?.trim().toLowerCase() || "demo@jumpstart.studio";
  const isDemoEmail = email === demoEmail;
  if (isDemoEmail) {
    const demoLimit = checkRateLimit(`demo_login:${ip}:${email}`, DEMO_LOGIN_LIMIT);
    if (!demoLimit.allowed) {
      logDemoAccess("rate_limited", { ip, email });
      return NextResponse.json(
        { error: "Trop de tentatives sur le compte démo. Réessayez plus tard." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(demoLimit.retryAfterMs / 1000)) },
        }
      );
    }

    if (!isDemoEnabled()) {
      logDemoAccess("login_blocked_demo_disabled", { ip, email });
      return NextResponse.json({ error: "Le mode démo est désactivé." }, { status: 403 });
    }
    if (isDemoAccessExpired()) {
      logDemoAccess("login_blocked_demo_expired", { ip, email });
      return NextResponse.json({ error: "L'accès démo a expiré." }, { status: 403 });
    }

    // Optional strict check to avoid stale credentials in env.
    try {
      const expected = getDemoCredentials();
      if (email !== expected.email.toLowerCase()) {
        return NextResponse.json({ error: "Compte démo invalide." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Configuration démo invalide." }, { status: 500 });
    }
  }

  const sessionResponse = NextResponse.json({ ok: true });
  const supabase = buildSupabaseClient(request, sessionResponse);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    if (isDemoEmail) {
      logDemoAccess("login_failed", { ip, email, reason: signInError.message });
    }
    return NextResponse.json(
      { error: "Identifiants incorrects." },
      { status: 401 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profil introuvable." }, { status: 403 });
  }

  if (isDemoEmail) {
    if (!profile.tenant_id || !(await isDemoTenant(profile.tenant_id))) {
      logDemoAccess("login_blocked_non_demo_tenant", {
        ip,
        email,
        tenantId: profile.tenant_id,
      });
      await supabase.auth.signOut();
      return NextResponse.json({ error: "Compte démo invalide." }, { status: 403 });
    }
    logDemoAccess("login_success", { ip, email, tenantId: profile.tenant_id });
  }

  const redirectTo = profile.role === "agency_admin" ? "/admin" : "/client/dashboard";
  const finalResponse = NextResponse.json({ ok: true, redirectTo });
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
