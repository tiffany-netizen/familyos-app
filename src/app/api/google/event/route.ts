// POST /api/google/event — create a calendar event (one-off or weekly
// recurring) on the user's Google Calendar with reminders attached:
// one hour before, plus the night before at 8pm. Falls back cleanly:
// "not_connected" when no Google link exists, "needs_reconnect" when the
// stored token predates write access.

import { createClient } from "@/lib/supabase/server";
import { getAccessToken, createCalendarEvent } from "@/lib/google";

function etToday(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    title?: string;
    days?: number[];
    time?: string;
    date?: string;
    durationMin?: number;
    until?: string;
    location?: string;
    description?: string;
  } = {};
  try {
    body = await request.json();
  } catch {}
  const title = String(body.title ?? "").trim().slice(0, 120);
  if (!title) return Response.json({ error: "missing title" }, { status: 400 });

  const token = await getAccessToken(supabase, user.id);
  if (!token) return Response.json({ error: "not_connected" });

  const days = Array.isArray(body.days)
    ? body.days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : [];
  const time =
    typeof body.time === "string" && /^\d{2}:\d{2}$/.test(body.time)
      ? body.time
      : undefined;

  // First occurrence: the provided date, or the next matching weekday.
  let date =
    typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : null;
  if (!date) {
    const now = etToday();
    let d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (days.length) {
      for (let i = 0; i < 7; i++) {
        const cand = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        if (days.includes(cand.getDay())) {
          d = cand;
          break;
        }
      }
    }
    date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  }

  // Reminders: 1 hour before, and the night before at 8pm.
  let reminders: number[];
  if (time) {
    const [h, m] = time.split(":").map((x) => parseInt(x, 10));
    reminders = [60, h * 60 + m + 240];
  } else {
    // All-day events measure minutes before midnight: 240 = 8pm the night before.
    reminders = [240];
  }

  const result = await createCalendarEvent(token, {
    title,
    date,
    time,
    durationMin: body.durationMin,
    days: days.length ? days : undefined,
    until:
      typeof body.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.until)
        ? body.until
        : undefined,
    reminders,
    location:
      typeof body.location === "string" && body.location.trim()
        ? body.location.trim().slice(0, 300)
        : undefined,
    description:
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim().slice(0, 1000)
        : "Added by FamilyOS. Reminders: night before and 1 hour ahead.",
  });

  if (!result.ok) return Response.json({ error: result.error });
  return Response.json({ ok: true, link: result.link });
}
