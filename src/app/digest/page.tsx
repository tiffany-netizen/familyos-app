import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import UploadSchedule from "@/components/UploadSchedule";
import { getAccessToken, listUpcomingEvents, type CalendarEvent } from "@/lib/google";

const DAY = 86400000;

export default async function DigestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: people }, { data: dates }, { data: events }, { data: routines }, { data: profile }] =
    await Promise.all([
      supabase.from("people").select("*"),
      supabase.from("tracked_dates").select("*"),
      supabase.from("sports_events").select("*"),
      supabase.from("routines").select("*"),
      supabase.from("profiles").select("time_format").eq("id", user.id).single(),
    ]);
  const hour12 = profile?.time_format !== "24h";

  // Google Calendar events, when connected
  let calEvents: CalendarEvent[] = [];
  try {
    const token = await getAccessToken(supabase, user.id);
    if (token) calEvents = await listUpcomingEvents(token, 7);
  } catch {}

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const week: { day: string; items: string[] }[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getTime() + i * DAY);
    const items: string[] = [];
    const mmdd = d.toISOString().slice(5, 10);

    (people ?? []).forEach((p) => {
      if (p.birthday?.slice(5) === mmdd) items.push(`${p.name}'s birthday`);
    });
    (dates ?? []).forEach((t) => {
      if (t.date_value?.slice(5) === mmdd) items.push(t.label);
    });
    (routines ?? []).forEach((r) => {
      if (r.days.split(",").map(Number).includes(d.getDay())) {
        items.push(
          r.kind === "school_run"
            ? "School drop-off / pick-up (you)"
            : r.kind === "dinner"
              ? "Dinner duty"
              : `${r.label ?? "Routine"}`
        );
      }
    });
    calEvents.forEach((e) => {
      const start = new Date(e.all_day ? e.start + "T00:00:00" : e.start);
      if (start >= d && start < new Date(d.getTime() + DAY)) {
        const time = e.all_day
          ? "all day"
          : start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12 });
        items.push(`${e.summary} · ${time} · calendar`);
      }
    });
    (events ?? []).forEach((e) => {
      const ed = new Date(e.event_date);
      if (ed >= d && ed < new Date(d.getTime() + DAY)) {
        const time = ed.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12,
        });
        items.push(`${e.sport ?? "Practice"} · ${time}${e.location ? " · " + e.location : ""}`);
      }
    });

    week.push({
      day:
        i === 0
          ? "Today"
          : i === 1
            ? "Tomorrow"
            : d.toLocaleDateString("en-US", { weekday: "long" }),
      items,
    });
  }

  const child = (people ?? []).find((p) => p.relationship === "child");

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-28 pt-8">
      <Link href="/today" className="text-sm font-semibold text-sub">
        ‹ Today
      </Link>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">The week ahead</h1>
        <Link
          href="/weekly"
          className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-sub"
        >
          Update my week ›
        </Link>
      </div>
      <p className="mt-1 text-sm text-sub">
        Your Sunday digest, built from everything FamilyOS knows.
      </p>

      <div className="mt-5 rounded-2xl border border-line bg-white px-4 shadow-sm">
        {week.map((w, i) => (
          <div key={w.day} className={`py-3 ${i > 0 ? "border-t border-line" : ""}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-ink">
              {w.day}
            </p>
            {w.items.length === 0 ? (
              <p className="mt-1 text-[13px] text-sub">Nothing scheduled.</p>
            ) : (
              w.items.map((it) => (
                <p key={it} className="mt-1 text-sm">
                  {it}
                </p>
              ))
            )}
          </div>
        ))}
      </div>

      <UploadSchedule childName={child?.name ?? null} personId={child?.id ?? null} />
      <BottomNav />
    </main>
  );
}
