import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected =
    path.startsWith("/today") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/people") ||
    path.startsWith("/gifts") ||
    path.startsWith("/home-hub") ||
    path.startsWith("/digest") ||
    path.startsWith("/todos");
  const isAuthPage = path === "/login" || path === "/signup";

  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && (isAuthPage || path === "/")) {
    return NextResponse.redirect(new URL("/today", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-.*).*)"],
};
