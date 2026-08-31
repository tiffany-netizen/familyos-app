// GET /api/google/auth?slot=personal|work — kick off the Google Calendar
// connection for one slot. Sends the signed-in user to Google's consent
// screen; a state cookie guards the round trip and carries the slot along.

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { authUrl, googleEnabled, type CalendarSlot } from "@/lib/google";

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

  const slotParam = new URL(request.url).searchParams.get("slot");
    const slot: CalendarSlot = slotParam === "work" ? "work" : "personal";

  const token = crypto.randomUUID();
    const cookieStore = await cookies();
    cookieStore.set("g_oauth_state", `${token}.${slot}`, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: 600,
          path: "/",
    });

  const origin = new URL(request.url).origin;
    return Response.redirect(authUrl(origin, token, slot));
}
