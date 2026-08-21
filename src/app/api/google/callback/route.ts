// GET /api/google/callback — Google sends the user back here with a code.
// Exchange it, store the tokens, land on the profile page connected.

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { emailFromIdToken, exchangeCode } from "@/lib/google";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.redirect(new URL("/login", request.url));

  const cookieStore = await cookies();
  const expected = cookieStore.get("g_oauth_state")?.value;
  cookieStore.delete("g_oauth_state");

  if (!code || !state || !expected || state !== expected) {
    return Response.redirect(new URL("/profile?calendar=error", request.url));
  }

  try {
    const tokens = await exchangeCode(url.origin, code);
    if (!tokens.refresh_token) throw new Error("no refresh token returned");
    await supabase.from("google_tokens").upsert(
      {
        owner_id: user.id,
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        email: emailFromIdToken(tokens.id_token),
      },
      { onConflict: "owner_id" }
    );
    return Response.redirect(new URL("/profile?calendar=connected", request.url));
  } catch (e) {
    console.error("[google/callback]", e);
    return Response.redirect(new URL("/profile?calendar=error", request.url));
  }
}
