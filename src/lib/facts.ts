// Gathers everything FamilyOS knows about one user into a compact object
// the AI can read. Works with both the cookie-scoped client (RLS applies)
// and the service-role client (cron), because every query filters owner_id.

import type { SupabaseClient } from "@supabase/supabase-js";

export type Facts = {
  today: string; // YYYY-MM-DD
  weekday: string; // "Tuesday"
  profile: {
    full_name: string | null;
    date_night_frequency_days: number | null;
    sweet_text_optin: boolean | null;
    home_address: string | null;
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
};

const PERSON_COLS =
  "id,name,nickname,relationship,birthday,grade,school,teacher_name,best_friend,clothing_size,interests,allergies,favorite_wine,favorite_flowers,works,job,stress_note,last_contact,breed";

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
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "full_name,date_night_frequency_days,sweet_text_optin,home_address"
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
      .select("kind,label,days,day_times,notify")
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
  ]);

  const todayStr = now.toISOString().slice(0, 10);
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
    today: now.toISOString().slice(0, 10),
    weekday: now.toLocaleDateString("en-US", { weekday: "long" }),
    profile: profile ?? {
      full_name: null,
      date_night_frequency_days: null,
      sweet_text_optin: null,
      home_address: null,
    },
    people: people ?? [],
    tracked_dates: dates ?? [],
    routines: routines ?? [],
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
  };
}
