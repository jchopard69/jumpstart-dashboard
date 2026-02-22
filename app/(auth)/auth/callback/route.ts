import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * Auth callback handler for Supabase
 * Handles: invitation links, password reset links, email confirmation
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next") ?? "/";

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Ignore errors in Server Component context
          }
        },
      },
    }
  );

  // Handle code exchange (OAuth, magic link)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Check if this is a password reset flow
      if (type === "recovery") {
        return NextResponse.redirect(new URL("/set-password", requestUrl.origin));
      }
      // Check if this is an invitation
      if (type === "invite" || type === "signup") {
        return NextResponse.redirect(new URL("/set-password", requestUrl.origin));
      }
      // Default redirect
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // Handle token_hash (older Supabase format for invitations/recovery)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "invite" | "recovery" | "signup" | "email",
    });

    if (!error) {
      // For invitation or recovery, redirect to set password
      if (type === "invite" || type === "recovery") {
        return NextResponse.redirect(new URL("/set-password", requestUrl.origin));
      }
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // If we get here, something went wrong
  console.error("[auth/callback] Invalid or expired token");
  return NextResponse.redirect(
    new URL("/login?error=invalid_token", requestUrl.origin)
  );
}
