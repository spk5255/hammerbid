import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// The app is members-only from the first open: signed-out visitors are sent
// to the sign-up gate. Only server-to-server callbacks and PWA assets stay
// public.
const PUBLIC_PATHS = [
  "/auth", // gate + email confirmation callback
  "/welcome", // post-signup quick tour (generic content, no data exposed)
  "/api/stripe/webhook", // Stripe server-to-server events
  "/api/worker/settle", // settlement cron (has its own secret check)
  "/manifest.webmanifest",
  "/icon",
  "/apple-icon",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth token if needed. Do not run other logic between
  // createServerClient and getUser() — it can cause random logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const { pathname } = request.nextUrl;
    const code = request.nextUrl.searchParams.get("code");

    // Safety net: Supabase email links can land on the site root (the
    // project's default Site URL) instead of /auth/callback when the
    // redirect URL isn't allowed. Forward the code so the session exchange
    // — and the quick-tour hand-off — still happen.
    if (code && !pathname.startsWith("/auth")) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/callback";
      url.search = "";
      url.searchParams.set("code", code);
      const redirect = NextResponse.redirect(url);
      supabaseResponse.cookies
        .getAll()
        .forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }

    if (!isPublicPath(pathname)) {
      const url = request.nextUrl.clone();
      const next = pathname + request.nextUrl.search;
      url.pathname = "/auth";
      url.search = "";
      // Deep links survive the gate: after signing in the user lands where
      // they were headed.
      if (next !== "/") url.searchParams.set("next", next);

      const redirect = NextResponse.redirect(url);
      // Carry any refreshed auth cookies onto the redirect response.
      supabaseResponse.cookies
        .getAll()
        .forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }
  }

  return supabaseResponse;
}
