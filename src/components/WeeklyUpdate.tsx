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

type Activity = {
  id?: string;
  label: string;
  days: number[];
  time: string;
  remind: string;
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

export default function WeeklyUpdate({
  routines,
  trips,
  hasKids = true,
}: {
  routines: Routine[];
  trips: TripRow[];
  hasKids?: boolean;
}) {
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
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold">Dinner duty nights</p>
        <DayChips days={dinnerDays} setDays={setDinnerDays} set={WEEKDAYS} />
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
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              setActivities((as) => [...as, { label: "", days: [], time: "", remind: "" }])
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
                {t.kind === "work" ? "💼" : "🧳"} <b>{t.destination}</b>
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
