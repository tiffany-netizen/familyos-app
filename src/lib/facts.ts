// Gathers everything FamilyOS knows about one user into a compact object
// the AI can read. Works with both the cookie-scoped client (RLS applies)
// and the service-role client (cron), because every query filters owner_id.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccessToken, listUpcomingEvents, type CalendarEvent } from "@/lib/google";

export type Facts = {
  today: string; // YYYY-MM-DD
  weekday: string; // "Tuesday"
  profile: {
    full_name: string | null;
    date_night_frequency_days: number | null;
    sweet_text_optin: boolean | null;
    home_address: string | null;
    meal_notes?: string | null;
    owns_home?: boolean | null;
    brief_time?: string | null;
    grocery_store?: string | null;
    time_format?: string | null;
  };
  people: Record<string, unknown>[];
  tracked_dates: Record<string, unknown>[];
  routines: Record<string, unknown>[];
  home_items: Record<string, unknown>[];
  trips: Record<string, unknown>[];
  sports_events: Record<string, unknown>[];
  open_todo_count: number;
  recent_memories: Record<string, unknown>[];
  gift_ideas: Record<string, unknown>[];
  answered_followups: Record<string, unknown>[];
  service_providers: Record<string, unknown>[];
  suppressed_keys: string[];
  recent_sms_drafts: string[];
  saved_recipes: string[];
  shopping_list_open_count: number;
  calendar_connected: boolean;
  calendar_events: CalendarEvent[];
};

const PERSON_COLS =
  "id,name,nickname,relationship,birthday,phone,grade,school,school_address,teacher_name,dismissal_time,best_friend,clothing_size,interests,allergies,pediatrician,favorite_wine,favorite_flowers,works,job,stress_note,school_year_start,last_contact,breed";

export async function gatherFacts(
  supabase: SupabaseClient,
  userId: string,
  now = new Date()
): Promise<Facts> {
  const [
    { data: profile },
    { data: people },
    { data: dates },
    { data: routines },
    { data: homeItems },
    { data: trips },
    { data: events },
    { data: todos },
    { data: memories },
    { data: gifts },
    { data: followups },
    { data: providers },
    { data: cardStates },
    { data: recentBriefs },
    { data: recipes },
    { data: shoppingOpen },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "full_name,date_night_frequency_days,sweet_text_optin,home_address,meal_notes,owns_home,brief_time,grocery_store,time_format"
      )
      .eq("id", userId)
      .single(),
    supabase.from("people").select(PERSON_COLS).eq("owner_id", userId),
    supabase
      .from("tracked_dates")
      .select("label,date_value,recurs_yearly,lead_time_days,person_id")
      .eq("owner_id", userId),
    supabase
      .from("routines")
      .select("kind,label,days,day_times,notify,end_date")
      .eq("owner_id", userId),
    supabase
      .from("home_items")
      .select("task_name,last_performed,frequency_days")
      .eq("owner_id", userId),
    supabase
      .from("trips")
      .select("kind,destination,start_date,end_date,notes")
      .eq("owner_id", userId)
      .gte("end_date", now.toISOString().slice(0, 10)),
    supabase
      .from("sports_events")
      .select("sport,team,event_date,location")
      .eq("owner_id", userId)
      .gte("event_date", now.toISOString())
      .order("event_date")
      .limit(10),
    supabase.from("todos").select("id").eq("owner_id", userId).eq("done", false),
    supabase
      .from("memories")
      .select("body,category,created_at,person_id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("gift_ideas")
      .select("title,person_id,status")
      .eq("owner_id", userId)
      .eq("status", "idea"),
    supabase
      .from("followups")
      .select("kind,subject,question,answer")
      .eq("owner_id", userId)
      .eq("status", "answered"),
    supabase
      .from("service_providers")
      .select("name,kind,contact_info,schedule_note,next_visit")
      .eq("owner_id", userId),
    supabase
      .from("card_states")
      .select("card_key,status,until")
      .eq("owner_id", userId),
    supabase
      .from("briefs")
      .select("items,brief_date")
      .eq("owner_id", userId)
      .gte(
        "brief_date",
        new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10)
      )
      .order("brief_date", { ascending: false })
      .limit(14),
    supabase
      .from("recipes")
      .select("title")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("shopping_items")
      .select("id")
      .eq("owner_id", userId)
      .eq("done", false),
  ]);

  // All "today" math runs on Eastern time, not server UTC. A brief built
  // at 9pm ET must not think it's already tomorrow.
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));

  // Precomputed day gaps: the model must never do calendar math itself.
  const DAY = 86400000;
  const midnight = new Date(et.getFullYear(), et.getMonth(), et.getDate());
  const daysUntil = (dateStr: string, recursYearly: boolean): number => {
    const d = new Date(dateStr + "T00:00:00");
    if (!recursYearly) return Math.round((d.getTime() - midnight.getTime()) / DAY);
    const next = new Date(et.getFullYear(), d.getMonth(), d.getDate());
    if (next.getTime() < midnight.getTime()) next.setFullYear(next.getFullYear() + 1);
    return Math.round((next.getTime() - midnight.getTime()) / DAY);
  };
  const peopleAug = (people ?? []).map((p) => ({
    ...p,
    birthday_in_days:
      typeof p.birthday === "string" && p.birthday
        ? daysUntil(p.birthday, true)
        : null,
  }));
  const datesAug = (dates ?? []).map((d) => ({
    ...d,
    in_days:
      typeof d.date_value === "string" && d.date_value
        ? daysUntil(d.date_value, Boolean(d.recurs_yearly))
        : null,
  }));

  // Routines: precompute which run today/tomorrow and format their times in
  // the user's clock format. Day numbers are 0=Sunday..6=Saturday; the model
  // must never map weekday numbers itself.
  const DAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const dow = et.getDay();
  const dowTomorrow = (dow + 1) % 7;
  const wants24h = profile?.time_format === "24h";
  const fmtTime = (t: unknown): string | null => {
    if (typeof t !== "string" || !/^\d{1,2}:\d{2}/.test(t)) return null;
    const [h, m] = t.split(":").map((x) => parseInt(x, 10));
    if (wants24h) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  };
  const etTodayStr = `${et.getFullYear()}-${String(et.getMonth() + 1).padStart(2, "0")}-${String(et.getDate()).padStart(2, "0")}`;
  const routinesAug = (routines ?? [])
    // A routine past its end date (season over) is gone from the brief.
    .filter((r) => !r.end_date || String(r.end_date) >= etTodayStr)
    .map((r) => {
    const dayNums = String(r.days ?? "")
      .split(",")
      .map((s) => parseInt(s, 10))
      .filter((n) => !isNaN(n) && n >= 0 && n <= 6);
    const times = (r.day_times ?? null) as Record<string, string> | null;
    const timeFor = (d: number) => fmtTime(times?.[String(d)]);
    return {
      ...r,
      days_named: dayNums.map((n) => DAY_NAMES[n]).join(", "),
      runs_today: dayNums.includes(dow),
      runs_tomorrow: dayNums.includes(dowTomorrow),
      time_today: dayNums.includes(dow) ? timeFor(dow) : null,
      time_tomorrow: dayNums.includes(dowTomorrow) ? timeFor(dowTomorrow) : null,
      notify: fmtTime(r.notify) ?? r.notify,
    };
  });

  // Google Calendar, when connected: the next 7 days of the primary calendar.
  let calendarEvents: CalendarEvent[] = [];
  let calendarConnected = false;
  try {
    const token = await getAccessToken(supabase, userId);
    if (token) {
      calendarConnected = true;
      calendarEvents = await listUpcomingEvents(token, 7);
    }
  } catch (e) {
    console.error("[facts] calendar", e);
  }

  const todayStr = `${et.getFullYear()}-${String(et.getMonth() + 1).padStart(2, "0")}-${String(et.getDate()).padStart(2, "0")}`;
  const suppressed = (cardStates ?? [])
    .filter((c) => !c.until || (c.until as string) >= todayStr)
    .map((c) => c.card_key as string);

  const smsDrafts: string[] = [];
  for (const b of recentBriefs ?? []) {
    const items = (b.items ?? []) as { actions?: { kind?: string; payload?: string }[] }[];
    for (const it of items) {
      for (const a of it.actions ?? []) {
        if (a?.kind === "sms" && typeof a.payload === "string") smsDrafts.push(a.payload);
      }
    }
  }

  return {
    today: todayStr,
    weekday: DAY_NAMES[dow],
    profile: profile ?? {
      full_name: null,
      date_night_frequency_days: null,
      sweet_text_optin: null,
      home_address: null,
    },
    people: peopleAug,
    tracked_dates: datesAug,
    routines: routinesAug,
    home_items: homeItems ?? [],
    trips: trips ?? [],
    sports_events: events ?? [],
    open_todo_count: (todos ?? []).length,
    recent_memories: memories ?? [],
    gift_ideas: gifts ?? [],
    answered_followups: followups ?? [],
    service_providers: providers ?? [],
    suppressed_keys: suppressed,
    recent_sms_drafts: smsDrafts.slice(0, 20),
    saved_recipes: (recipes ?? []).map((r) => String(r.title)),
    shopping_list_open_count: (shoppingOpen ?? []).length,
    calendar_connected: calendarConnected,
    calendar_events: calendarEvents,
  };
}
