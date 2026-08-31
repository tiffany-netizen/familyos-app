// GET /api/google/callback — Google sends the user back here with a code.
// Exchange it, store the tokens under the right slot, land on the profile
// page connected.

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { emailFromIdToken, exchangeCode, parseState } from "@/lib/google";

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

  const parsedExpected = expected ? parseState(expected) : null;
    const parsedState = state ? parseState(state) : null;

  if (
        !code ||
        !parsedState ||
        !parsedExpected ||
        state !== expected ||
        parsedState.slot !== parsedExpected.slot
      ) {
        return Response.redirect(new URL("/profile?calendar=error", request.url));
  }

  const { slot } = parsedState;

  try {
        const tokens = await exchangeCode(url.origin, code);
        if (!tokens.refresh_token) throw new Error("no refresh token returned");
        await supabase.from("google_tokens").upsert(
          {
                    owner_id: user.id,
                    slot,
                    refresh_token: tokens.refresh_token,
                    access_token: tokens.access_token,
                    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                    email: emailFromIdToken(tokens.id_token),
          },
          { onConflict: "owner_id,slot" }
              );
        return Response.redirect(
                new URL(`/profile?calendar=connected&slot=${slot}`, request.url)
              );
  } catch (e) {
        console.error("[google/callback]", e);
        return Response.redirect(new URL("/profile?calendar=error", request.url));
  }
}
