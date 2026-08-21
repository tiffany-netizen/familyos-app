// GET /api/google/auth — kick off the Google Calendar connection.
// Sends the signed-in user to Google's consent screen; a state cookie
// guards the round trip.

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { authUrl, googleEnabled } from "@/lib/google";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.redirect(new URL("/login", request.url));

  if (!googleEnabled()) {
    return new Response(
      "Google Calendar isn't configured yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
      { status: 503 }
    );
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("g_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const origin = new URL(request.url).origin;
  return Response.redirect(authUrl(origin, state));
}
