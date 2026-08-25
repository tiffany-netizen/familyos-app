"use client";

// One follow-up question at a time on the Today screen.
// Text kinds get a free-text box; weekend activities and trips get
// small structured pickers. Answers flow to /api/followups, where the
// AI turns open-ended ones into concrete next steps.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Followup = {
  id: string;
  kind: string;
  subject: string | null;
  question: string;
};

const DAYS = [
  { n: 6, l: "Sat" },
  { n: 0, l: "Sun" },
];

export default function FollowupCard() {
  const router = useRouter();
  const [fu, setFu] = useState<Followup | null>(null);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<string | null>(null);

  // free text
  const [answer, setAnswer] = useState("");
  // weekend activity
  const [actLabel, setActLabel] = useState("");
  const [actDays, setActDays] = useState<number[]>([]);
  const [actTime, setActTime] = useState("");
  const [actRemind, setActRemind] = useState("");
  // trip
  const [tripKind, setTripKind] = useState("family");
  const [tripDest, setTripDest] = useState("");
  const [tripStart, setTripStart] = useState("");
  const [tripEnd, setTripEnd] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/followups");
      const data = await res.json();
      setFu(data?.followup ?? null);
    } catch {
      setFu(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetInputs() {
    setAnswer("");
    setActLabel("");
    setActDays([]);
    setActTime("");
    setActRemind("");
    setTripDest("");
    setTripStart("");
    setTripEnd("");
  }

  async function submit(payload: Record<string, unknown>) {
    if (!fu) return;
    setBusy(true);
    try {
      const res = await fetch("/api/followups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: fu.id, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      setReply(data?.reply ?? "Saved.");
      setBusy(false);
      router.refresh();
      setTimeout(() => {
        setReply(null);
        resetInputs();
        load();
      }, 5200);
    } catch {
      setBusy(false);
    }
  }

  if (!fu) return null;

  const isText = ["nickname", "address", "relationship", "interest", "todo", "contact"].includes(fu.kind);

  return (
    <div className="rounded-2xl border-[1.5px] border-brand-soft bg-brand-soft/30 p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-brand">
        Getting to know you
      </p>
      <p className="mt-2 text-[15px] leading-snug">{fu.question}</p>

      {reply ? (
        <p className="mt-3 rounded-xl bg-white px-4 py-3 text-sm font-medium text-brand">
          ✓ {reply}
        </p>
      ) : (
        <>
          {isText && (
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={fu.kind === "relationship" ? 3 : 1}
              className="mt-3 w-full rounded-xl border-[1.5px] border-line bg-white p-3 text-sm outline-none focus:border-brand"
              placeholder={
                fu.kind === "nickname"
                  ? '"babe", "love", or a name'
                  : fu.kind === "address"
                    ? "City or full address"
                    : "Tell me in your own words..."
              }
            />
          )}

          {fu.kind === "weekend_activity" && (
            <div className="mt-3 space-y-2.5">
              <input
                value={actLabel}
                onChange={(e) => setActLabel(e.target.value)}
                placeholder="What is it? (Farmers market, Emma's swim class...)"
                className="w-full rounded-xl border-[1.5px] border-line bg-white p-3 text-sm outline-none focus:border-brand"
              />
              <div className="flex items-center gap-2">
                {DAYS.map((d) => (
                  <button
                    key={d.n}
                    type="button"
                    onClick={() =>
                      setActDays((ds) =>
                        ds.includes(d.n) ? ds.filter((x) => x !== d.n) : [...ds, d.n]
                      )
                    }
                    className={`rounded-lg border-[1.5px] px-3.5 py-2 text-[13px] font-semibold ${
                      actDays.includes(d.n)
                        ? "border-brand bg-white text-brand"
                        : "border-line bg-white text-sub"
                    }`}
                  >
                    {d.l}
                  </button>
                ))}
                <input
                  type="time"
                  value={actTime}
                  onChange={(e) => setActTime(e.target.value)}
                  className="flex-1 rounded-lg border-[1.5px] border-line bg-white px-2 py-2 text-[13px] outline-none focus:border-brand"
                />
              </div>
              <label className="block text-xs text-sub">
                Remind me at
                <input
                  type="time"
                  value={actRemind}
                  onChange={(e) => setActRemind(e.target.value)}
                  className="ml-2 rounded-lg border-[1.5px] border-line bg-white px-2 py-1.5 text-[13px] outline-none focus:border-brand"
                />
              </label>
            </div>
          )}

          {fu.kind === "trips" && (
            <div className="mt-3 space-y-2.5">
              <div className="flex gap-2">
                {[
                  ["family", "Family / personal"],
                  ["work", "Work"],
                ].map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTripKind(v)}
                    className={`rounded-lg border-[1.5px] px-3.5 py-2 text-[13px] font-semibold ${
                      tripKind === v
                        ? "border-brand bg-white text-brand"
                        : "border-line bg-white text-sub"
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
                className="w-full rounded-xl border-[1.5px] border-line bg-white p-3 text-sm outline-none focus:border-brand"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={tripStart}
                  onChange={(e) => setTripStart(e.target.value)}
                  className="flex-1 rounded-lg border-[1.5px] border-line bg-white px-2 py-2 text-[13px] outline-none focus:border-brand"
                />
                <input
                  type="date"
                  value={tripEnd}
                  onChange={(e) => setTripEnd(e.target.value)}
                  className="flex-1 rounded-lg border-[1.5px] border-line bg-white px-2 py-2 text-[13px] outline-none focus:border-brand"
                />
              </div>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              disabled={
                busy ||
                (isText && !answer.trim()) ||
                (fu.kind === "weekend_activity" && (!actLabel.trim() || actDays.length === 0)) ||
                (fu.kind === "trips" && !tripDest.trim())
              }
              onClick={() =>
                submit(
                  fu.kind === "weekend_activity"
                    ? {
                        answer: actLabel,
                        data: { label: actLabel, days: actDays, time: actTime || undefined, remind: actRemind || undefined },
                      }
                    : fu.kind === "trips"
                      ? {
                          answer: "",
                          data: {
                            kind: tripKind,
                            destination: tripDest,
                            start_date: tripStart || undefined,
                            end_date: tripEnd || undefined,
                          },
                        }
                      : { answer }
                )
              }
              className="rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Thinking..." : "Save"}
            </button>
            {(fu.kind === "weekend_activity" || fu.kind === "trips") && (
              <button
                disabled={busy}
                onClick={() => submit({ answer: "no" })}
                className="rounded-lg bg-white px-4 py-2.5 text-[13px] font-semibold text-sub"
              >
                {fu.kind === "trips" ? "No trips" : "Nothing regular"}
              </button>
            )}
            <button
              disabled={busy}
              onClick={() => submit({ action: "dismiss" })}
              className="ml-auto rounded-lg px-3 py-2.5 text-[13px] font-semibold text-sub"
            >
              Not now
            </button>
          </div>
        </>
      )}
    </div>
  );
}
