// Google Calendar helpers. Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
// in the environment. Tokens live in google_tokens, one row per user;
// access tokens are refreshed here as they expire.

import type { SupabaseClient } from "@supabase/supabase-js";

export function googleEnabled() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

export function authUrl(origin: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${origin}/api/google/callback`,
    response_type: "code",
    scope: `${GOOGLE_SCOPE} email`,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeCode(origin: string, code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${origin}/api/google/callback`,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!res.ok) throw new Error(`token exchange ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    id_token?: string;
  };
}

// Reads the user's Google account email out of the id_token payload.
export function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64url").toString()
    );
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`token refresh ${res.status}`);
  return (await res.json()) as { access_token: string; expires_in: number };
}

// Returns a live access token for the user, or null if not connected.
export async function getAccessToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  if (!googleEnabled()) return null;
  const { data: row } = await supabase
    .from("google_tokens")
    .select("refresh_token,access_token,expires_at")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!row) return null;

  const stillGood =
    row.access_token &&
    row.expires_at &&
    new Date(row.expires_at).getTime() - Date.now() > 120000;
  if (stillGood) return row.access_token as string;

  try {
    const fresh = await refreshAccessToken(row.refresh_token as string);
    await supabase
      .from("google_tokens")
      .update({
        access_token: fresh.access_token,
        expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
      })
      .eq("owner_id", userId);
    return fresh.access_token;
  } catch (e) {
    console.error("[google] refresh failed", e);
    return null;
  }
}

export type CalendarEvent = {
  summary: string;
  start: string; // ISO datetime or date
  end: string;
  all_day: boolean;
};

// The user's primary calendar for the next N days.
export async function listUpcomingEvents(
  accessToken: string,
  days = 7
): Promise<CalendarEvent[]> {
  const now = new Date();
  const p = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + days * 86400000).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "30",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${p}`,
    { headers: { authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`calendar list ${res.status}`);
  const data = (await res.json()) as {
    items?: {
      summary?: string;
      status?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }[];
  };
  return (data.items ?? [])
    .filter((e) => e.status !== "cancelled" && (e.start?.dateTime || e.start?.date))
    .map((e) => ({
      summary: e.summary || "(busy)",
      start: e.start?.dateTime ?? e.start?.date ?? "",
      end: e.end?.dateTime ?? e.end?.date ?? "",
      all_day: Boolean(e.start?.date && !e.start?.dateTime),
    }));
}
