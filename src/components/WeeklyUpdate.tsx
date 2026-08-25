"use client";

// The Sunday weekly-update flow: edit school runs, dinner nights, and
// weekend activities in-app (they were onboarding-only before), drop in
// this week's extras, and keep trips current.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Routine = {
  id: string;
  kind: string;
  label: string | null;
  days: string;
  day_times: Record<string, string> | null;
  notify: string | null;
  end_date: string | null;
};

type TripRow = {
  id: string;
  kind: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
};

const WEEKDAYS = [
  { n: 1, l: "Mon" },
  { n: 2, l: "Tue" },
  { n: 3, l: "Wed" },
  { n: 4, l: "Thu" },
  { n: 5, l: "Fri" },
];
const ALLDAYS = [...WEEKDAYS, { n: 6, l: "Sat" }, { n: 0, l: "Sun" }];

// Google Calendar template link for a weekly recurring event: prefilled
// title, first occurrence, and RRULE. Google's URL can't preset reminders,
// so the details text nudges the user to add night-before and 1-hour ones
// while the editor is open. FamilyOS itself still does the night-before
// plan and day-of item in the brief.
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
function recurringCalUrl(
  title: string,
  days: number[],
  time: string,
  durationMin: number
): string | null {
  if (days.length === 0) return null;
  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (days.includes(d.getDay())) {
      start = d;
      break;
    }
  }
  const [h, m] = (time || "08:00").split(":").map((x) => parseInt(x, 10));
  start.setHours(isNaN(h) ? 8 : h, isNaN(m) ? 0 : m, 0, 0);
  const end = new Date(start.getTime() + durationMin * 60000);
  const fmt = (x: Date) =>
    `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, "0")}${String(
      x.getDate()
    ).padStart(2, "0")}T${String(x.getHours()).padStart(2, "0")}${String(
      x.getMinutes()
    ).padStart(2, "0")}00`;
  const recur = `RRULE:FREQ=WEEKLY;BYDAY=${[...days]
    .sort()
    .map((n) => BYDAY[n])
    .join(",")}`;
  const details =
    "From FamilyOS. Tip: add two notifications while you're here, one the night before and one 1 hour before.";
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title
  )}&dates=${fmt(start)}/${fmt(end)}&recur=${encodeURIComponent(
    recur
  )}&details=${encodeURIComponent(details)}`;
}

// One tap when the calendar is connected with write access: FamilyOS
// creates the recurring event itself, reminders included (night before at
// 8pm + 1 hour ahead). Otherwise it falls back to Google's prefilled
// editor in a new tab.
function CalAdd({
  title,
  days,
  time,
  durationMin,
  location,
  description,
}: {
  title: string;
  days: number[];
  time: string;
  durationMin: number;
  location?: string;
  description?: string;
}) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "fallback">(
    "idle"
  );
  if (days.length === 0) return null;
  async function add() {
    setState("busy");
    try {
      const res = await fetch("/api/google/event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, days, time, durationMin, location, description }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.ok) {
        setState("done");
        return;
      }
    } catch {}
    setState("fallback");
    let url = recurringCalUrl(title, days, time, durationMin);
    if (url && location) url += `&location=${encodeURIComponent(location)}`;
    if (url) window.open(url, "_blank", "noreferrer");
  }
  if (state === "done") {
    return (
      <p className="mt-2 text-[13px] font-semibold text-brand">
        ✓ On your Google Calendar with reminders, night before and 1 hour
        ahead.
      </p>
    );
  }
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={add}
        disabled={state === "busy"}
        className="text-[13px] font-semibold text-blue-ink disabled:opacity-60"
      >
        {state === "busy"
          ? "Adding..."
          : "Add to Google Calendar (repeats weekly) ›"}
      </button>
      {state === "fallback" && (
        <p className="mt-1 text-xs text-sub">
          Opened Google&apos;s editor instead. Connect (or reconnect) your
          calendar in your profile and this becomes one tap with reminders
          attached.
        </p>
      )}
    </div>
  );
}

type Activity = {
  id?: string;
  label: string;
  days: number[];
  time: string;
  remind: string;
  end: string;
};

function DayChips({
  days,
  setDays,
  set,
}: {
  days: number[];
  setDays: (d: number[]) => void;
  set: { n: number; l: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {set.map((w) => (
        <button
          key={w.n}
          type="button"
          onClick={() =>
            setDays(
              days.includes(w.n) ? days.filter((x) => x !== w.n) : [...days, w.n]
            )
          }
          className={`rounded-xl border-[1.5px] px-3.5 py-2 text-sm ${
            days.includes(w.n)
              ? "border-brand bg-brand-soft font-semibold"
              : "border-line bg-white"
          }`}
        >
          {w.l}
        </button>
      ))}
    </div>
  );
}

type Kid = { name: string; school: string | null; school_address: string | null };

export default function WeeklyUpdate({
  routines,
  trips,
  hasKids = true,
  kids = [],
}: {
  routines: Routine[];
  trips: TripRow[];
  hasKids?: boolean;
  kids?: Kid[];
}) {
  const schoolRunTitle =
    kids.length === 1
      ? `Take ${kids[0].name.split(" ")[0]} to school`
      : "Take the kids to school";
  // School addresses drive the calendar event: one shared school becomes
  // the event location; different schools put the first in the location
  // and list every stop in the event body.
  const schooled = kids.filter((k) => k.school_address);
  const uniqueSchools = [...new Set(schooled.map((k) => k.school_address as string))];
  const schoolLocation = uniqueSchools[0];
  const schoolDescription =
    uniqueSchools.length > 1
      ? "Stops: " +
        schooled
          .map(
            (k) =>
              `${k.name.split(" ")[0]} at ${k.school ?? "school"} (${k.school_address})`
          )
          .join(" | ")
      : undefined;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [schoolDays, setSchoolDays] = useState<number[]>(
    routines.find((r) => r.kind === "school_run")?.days.split(",").map(Number) ?? []
  );
  const [dinnerDays, setDinnerDays] = useState<number[]>(
    routines.find((r) => r.kind === "dinner")?.days.split(",").map(Number) ?? []
  );
  const [activities, setActivities] = useState<Activity[]>(
    routines
      .filter((r) => r.kind !== "school_run" && r.kind !== "dinner")
      .map((r) => ({
        id: r.id,
        label: r.label ?? "",
        days: r.days.split(",").map(Number),
        time: r.day_times ? (Object.values(r.day_times)[0] ?? "") : "",
        remind: r.notify ?? "",
        end: r.end_date ?? "",
      }))
  );
  const [extras, setExtras] = useState("");

  // trips
  const [tripList, setTripList] = useState<TripRow[]>(trips);
  const [tripKind, setTripKind] = useState("family");
  const [tripDest, setTripDest] = useState("");
  const [tripStart, setTripStart] = useState("");
  const [tripEnd, setTripEnd] = useState("");

  function setActivity(i: number, patch: Partial<Activity>) {
    setActivities((as) => as.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  }

  async function addTrip() {
    if (!tripDest.trim()) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error: e } = await supabase
      .from("trips")
      .insert({
        owner_id: user.id,
        kind: tripKind,
        destination: tripDest.trim(),
        start_date: tripStart || null,
        end_date: tripEnd || tripStart || null,
      })
      .select("id,kind,destination,start_date,end_date")
      .single();
    if (!e && data) {
      setTripList((t) => [...t, data]);
      setTripDest("");
      setTripStart("");
      setTripEnd("");
    }
  }

  async function removeTrip(id: string) {
    const supabase = createClient();
    await supabase.from("trips").delete().eq("id", id);
    setTripList((t) => t.filter((x) => x.id !== id));
  }

  async function save() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You're signed out. Sign in and try again.");
      setBusy(false);
      return;
    }
    try {
      // Replace routines wholesale: simplest correct model for a weekly reset
      const { error: eDel } = await supabase
        .from("routines")
        .delete()
        .eq("owner_id", user.id);
      if (eDel) throw eDel;

      const rows: Record<string, unknown>[] = [];
      if (schoolDays.length)
        rows.push({
          owner_id: user.id,
          kind: "school_run",
          label: "School drop-off / pick-up",
          days: [...schoolDays].sort().join(","),
        });
      if (dinnerDays.length)
        rows.push({
          owner_id: user.id,
          kind: "dinner",
          label: "Dinner duty",
          days: [...dinnerDays].sort().join(","),
        });
      for (const a of activities) {
        if (!a.label.trim() || a.days.length === 0) continue;
        const dayTimes: Record<string, string> = {};
        if (a.time) a.days.forEach((n) => (dayTimes[String(n)] = a.time));
        rows.push({
          owner_id: user.id,
          kind: "activity",
          label: a.label.trim(),
          days: [...a.days].sort().join(","),
          day_times: a.time ? dayTimes : null,
          notify: a.remind || null,
          end_date: a.end || null,
        });
      }
      if (rows.length) {
        const { error: eIns } = await supabase.from("routines").insert(rows);
        if (eIns) throw eIns;
      }

      const extraItems = extras
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (extraItems.length) {
        const { error: eTodo } = await supabase
          .from("todos")
          .insert(extraItems.map((t) => ({ owner_id: user.id, title: t })));
        if (eTodo) throw eTodo;
      }

      // The week changed, so today's cached brief is stale. Toss it; the
      // Today page rebuilds instantly and the AI rewrites it in the background.
      const todayStr = new Date().toISOString().slice(0, 10);
      await supabase
        .from("briefs")
        .delete()
        .eq("owner_id", user.id)
        .eq("brief_date", todayStr);

      setSaved(true);
      setBusy(false);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7">
      {hasKids && (
        <div>
          <p className="mb-2 text-sm font-semibold">
            School drop-off / pick-up days
          </p>
          <DayChips days={schoolDays} setDays={setSchoolDays} set={WEEKDAYS} />
          <CalAdd
            title={schoolRunTitle}
            days={schoolDays}
            time="08:00"
            durationMin={30}
            location={schoolLocation}
            description={schoolDescription}
          />
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold">Dinner duty nights</p>
        <DayChips days={dinnerDays} setDays={setDinnerDays} set={WEEKDAYS} />
        <CalAdd title="Dinner duty" days={dinnerDays} time="18:00" durationMin={60} />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Weekend & regular activities</p>
        <div className="space-y-4">
          {activities.map((a, i) => (
            <div key={i} className="rounded-2xl border border-line bg-white p-3.5">
              <div className="flex items-center gap-2">
                <input
                  value={a.label}
                  onChange={(e) => setActivity(i, { label: e.target.value })}
                  placeholder="Activity"
                  className="flex-1 rounded-lg border-[1.5px] border-line px-3 py-2 text-sm outline-none focus:border-brand"
                />
                <button
                  onClick={() => setActivities((as) => as.filter((_, j) => j !== i))}
                  className="rounded-lg px-2 py-2 text-sm font-semibold text-red-500"
                  aria-label="Remove activity"
                >
                  ✕
                </button>
              </div>
              <div className="mt-2.5">
                <DayChips
                  days={a.days}
                  setDays={(d) => setActivity(i, { days: d })}
                  set={ALLDAYS}
                />
              </div>
              <div className="mt-2.5 flex items-center gap-3 text-xs text-sub">
                <label>
                  At{" "}
                  <input
                    type="time"
                    value={a.time}
                    onChange={(e) => setActivity(i, { time: e.target.value })}
                    className="ml-1 rounded-lg border-[1.5px] border-line px-2 py-1.5 text-[13px] outline-none focus:border-brand"
                  />
                </label>
                <label>
                  Remind at{" "}
                  <input
                    type="time"
                    value={a.remind}
                    onChange={(e) => setActivity(i, { remind: e.target.value })}
                    className="ml-1 rounded-lg border-[1.5px] border-line px-2 py-1.5 text-[13px] outline-none focus:border-brand"
                  />
                </label>
                <label>
                  Ends{" "}
                  <input
                    type="date"
                    value={a.end}
                    onChange={(e) => setActivity(i, { end: e.target.value })}
                    className="ml-1 rounded-lg border-[1.5px] border-line px-2 py-1.5 text-[13px] outline-none focus:border-brand"
                  />
                </label>
              </div>
              {a.label.trim() && (
                <CalAdd
                  title={a.label.trim()}
                  days={a.days}
                  time={a.time || "17:00"}
                  durationMin={60}
                />
              )}
            </div>
          ))}
          <button
            onClick={() =>
              setActivities((as) => [...as, { label: "", days: [], time: "", remind: "", end: "" }])
            }
            className="rounded-lg bg-blue-soft px-3.5 py-2 text-[13px] font-semibold text-blue-ink"
          >
            + Add an activity
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">
          Anything else this week? (becomes to-dos)
        </p>
        <textarea
          value={extras}
          onChange={(e) => setExtras(e.target.value)}
          placeholder="School play Tuesday, sign permission slip, order team photos"
          className="min-h-20 w-full rounded-xl border-[1.5px] border-line p-4 outline-none focus:border-brand"
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Trips on the horizon</p>
        <div className="space-y-2">
          {tripList.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-sm"
            >
              <span>
                <b>{t.destination}</b>
                <span className="ml-1.5 text-xs uppercase tracking-wide text-sub">{t.kind}</span>
                {t.start_date ? ` · ${t.start_date}` : ""}
                {t.end_date && t.end_date !== t.start_date ? ` → ${t.end_date}` : ""}
              </span>
              <button
                onClick={() => removeTrip(t.id)}
                className="text-sm font-semibold text-red-500"
                aria-label="Remove trip"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-2xl border border-line bg-white p-3.5">
          <div className="flex gap-2">
            {[
              ["family", "Family"],
              ["work", "Work"],
            ].map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setTripKind(v)}
                className={`rounded-lg border-[1.5px] px-3.5 py-2 text-[13px] font-semibold ${
                  tripKind === v
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line text-sub"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <input
            value={tripDest}
            onChange={(e) => setTripDest(e.target.value)}
            placeholder="Where to?"
            className="mt-2.5 w-full rounded-lg border-[1.5px] border-line px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <div className="mt-2.5 flex gap-2">
            <input
              type="date"
              value={tripStart}
              onChange={(e) => setTripStart(e.target.value)}
              className="flex-1 rounded-lg border-[1.5px] border-line px-2 py-2 text-[13px] outline-none focus:border-brand"
            />
            <input
              type="date"
              value={tripEnd}
              onChange={(e) => setTripEnd(e.target.value)}
              className="flex-1 rounded-lg border-[1.5px] border-line px-2 py-2 text-[13px] outline-none focus:border-brand"
            />
          </div>
          <button
            onClick={addTrip}
            disabled={!tripDest.trim()}
            className="mt-2.5 rounded-lg bg-blue-soft px-3.5 py-2 text-[13px] font-semibold text-blue-ink disabled:opacity-50"
          >
            + Add trip
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={save}
        disabled={busy}
        className="w-full rounded-xl bg-brand py-4 font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving..." : saved ? "✓ Week updated" : "Save my week"}
      </button>
    </div>
  );
}
