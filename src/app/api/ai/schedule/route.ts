// POST /api/ai/schedule — the real schedule photo reader.
// Client sends a downscaled base64 image; Claude reads the dates out of it
// and they land in sports_events (which feeds the digest and the brief).

import { createClient } from "@/lib/supabase/server";
import { aiEnabled, askClaude, extractJson } from "@/lib/ai";

type ParsedEvent = {
  title: string;
  sport: string | null;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM 24h
  location: string | null;
};

const SYSTEM = `You read family schedules from photos: sports schedules, school calendars, practice emails, flyers.

Extract every dated event you can see. Return ONLY a JSON array:
[{"title":"Soccer practice","sport":"Soccer","date":"2026-09-14","time":"16:00","location":"City Park Field 3"}]

Rules:
- date must be YYYY-MM-DD. Use the year printed on the schedule; if none is printed, pick the next occurrence of that date on or after today (today's date is given).
- time is 24h HH:MM, or null if not shown.
- sport is the sport or activity name, or null.
- location null if not shown.
- Skip anything without a readable date. If the image has no events at all, return [].`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  if (!aiEnabled()) return Response.json({ source: "disabled" }, { status: 503 });

  let image = "";
  let mediaType = "image/jpeg";
  let team: string | null = null;
  let personId: string | null = null;
  try {
    const body = await request.json();
    image = String(body?.image ?? "");
    mediaType = String(body?.media_type ?? "image/jpeg");
    team = body?.team ? String(body.team) : null;
    personId = body?.person_id ? String(body.person_id) : null;
  } catch {}
  if (!image) return Response.json({ error: "no image" }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);

  try {
    const raw = await askClaude({
      system: SYSTEM,
      prompt: `Today's date: ${today}. Read the schedule in this image.`,
      image: { media_type: mediaType, data: image },
      maxTokens: 2000,
    });
    const events = extractJson<ParsedEvent[]>(raw);
    if (!events || !Array.isArray(events)) {
      return Response.json({ source: "error" }, { status: 502 });
    }
    if (events.length === 0) {
      return Response.json({ source: "ai", count: 0, events: [] });
    }

    const rows = events
      .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date ?? ""))
      .slice(0, 40)
      .map((e) => ({
        owner_id: user.id,
        person_id: personId,
        sport: e.sport || e.title || null,
        team,
        event_date: new Date(
          `${e.date}T${/^\d{2}:\d{2}$/.test(e.time ?? "") ? e.time : "12:00"}:00`
        ).toISOString(),
        location: e.location || null,
      }));

    if (rows.length) {
      const { error } = await supabase.from("sports_events").insert(rows);
      if (error) throw error;
    }

    return Response.json({
      source: "ai",
      count: rows.length,
      events: events.slice(0, 5).map((e) => `${e.title ?? e.sport} · ${e.date}`),
    });
  } catch (e) {
    console.error("[ai/schedule]", e);
    return Response.json({ source: "error" }, { status: 502 });
  }
}
