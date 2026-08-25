"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { BriefItem } from "@/lib/brief";
import Icon, { briefIcon } from "@/components/Icon";

// Snooze choices for the picker. "Pick a date" covers everything else.
const SNOOZE_CHOICES = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
  { label: "In 2 weeks", days: 14 },
  { label: "In a month", days: 30 },
];

export default function BriefCard({ item }: { item: BriefItem }) {
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [calState, setCalState] = useState<"idle" | "busy" | "done">("idle");

  const cardKey = item.key ?? `card:${item.text.slice(0, 40)}`;
  // Daily routine cards: a dismiss clears today only, never weeks ahead.
  const isDailyRoutine = ["dinner", "dinner-plan", "school-run", "school-run-plan"].includes(
    item.key ?? ""
  );

  async function setCardState(status: "snoozed" | "dismissed", until: string) {
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("card_states").upsert(
      { owner_id: user.id, card_key: cardKey, status, until },
      { onConflict: "owner_id,card_key" }
    );
    setBusy(false);
  }

  async function snoozeUntil(until: string) {
    await setCardState("snoozed", until);
    setPickerOpen(false);
    setNote(
      `Snoozed. Back ${new Date(until + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })}.`
    );
    setTimeout(() => setHidden(true), 1600);
  }

  function daysFromNow(days: number): string {
    return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  }

  async function act(a: NonNullable<BriefItem["actions"]>[number]) {
    if (a.kind === "confirm") {
      setNote(a.payload ?? "Done.");
      return;
    }
    if (a.kind === "snooze") {
      // Every snooze opens the picker; the user chooses when it comes back.
      setPickerOpen(true);
      return;
    }
    if (a.kind === "dismiss") {
      await setCardState("dismissed", daysFromNow(isDailyRoutine ? 1 : 45));
      setNote(
        isDailyRoutine
          ? "Cleared for today. Back on its next day."
          : "Marked under control. I'll stay out of it."
      );
      setTimeout(() => setHidden(true), 1600);
      return;
    }
    if (a.kind === "we_talked" && a.personId) {
      setBusy(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("contact_logs").insert({
        owner_id: user.id,
        person_id: a.personId,
        method: "we_talked",
      });
      await supabase
        .from("people")
        .update({ last_contact: new Date().toISOString().slice(0, 10) })
        .eq("id", a.personId);
      setBusy(false);
      setNote("Logged. Counter reset to today.");
      router.refresh();
    }
  }

  if (hidden) return null;

  const hasSnoozeAction = (item.actions ?? []).some((a) => a.kind === "snooze");

  // Snoozes never reach past the event itself.
  const dayBeforeEvent = item.event_date
    ? new Date(new Date(item.event_date + "T00:00:00").getTime() - 86400000)
        .toISOString()
        .slice(0, 10)
    : null;
  const choices = SNOOZE_CHOICES.filter(
    (c) => !dayBeforeEvent || daysFromNow(c.days) <= dayBeforeEvent
  );

  // One tap onto the user's own calendar for anything with a real date.
  // The event title must be a clean name: "Anniversary", never
  // "Anniversary is in 31 days, September 24".
  const calTitle =
    item.event_title ??
    item.text
      .split(/[.?!]/)[0]
      .replace(/\s+(?:is|are)?\s*(?:coming up\s*)?in \d+ (?:days?|weeks?|months?)/i, "")
      .replace(/\s+(?:is|are)\s+(?:today|tomorrow)/i, "")
      .replace(/,\s*[A-Z][a-z]+ \d{1,2}(?:st|nd|rd|th)?$/, "")
      .trim()
      .slice(0, 60);
  // All-day events end the NEXT day (Google treats the end as exclusive).
  const calEnd = item.event_date
    ? new Date(new Date(item.event_date + "T00:00:00").getTime() + 86400000)
        .toISOString()
        .slice(0, 10)
    : null;
  const calendarHref = item.event_date
    ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        calTitle
      )}&dates=${item.event_date.replace(/-/g, "")}/${calEnd!.replace(/-/g, "")}`
    : null;

  // With calendar write access, one tap creates the all-day event with a
  // night-before reminder. Otherwise Google's prefilled editor opens.
  async function addToCalendar() {
    if (!item.event_date) return;
    setCalState("busy");
    try {
      const res = await fetch("/api/google/event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: calTitle, date: item.event_date }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.ok) {
        setCalState("done");
        return;
      }
    } catch {}
    setCalState("idle");
    if (calendarHref) window.open(calendarHref, "_blank", "noreferrer");
  }

  return (
    <div className="flex gap-3 bg-white p-4">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-line bg-background text-brand">
        <Icon name={briefIcon(item.key, item.role)} />
      </div>
      <div className="flex-1">
        <p className="text-[15px] leading-snug">{item.text}</p>
        <p className="mt-1 text-xs text-sub">{item.meta}</p>
        {note ? (
          <p className="mt-2.5 text-[13px] font-semibold text-brand">✓ {note}</p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(item.actions ?? []).map((a) =>
              a.kind === "sms" || a.kind === "link" ? (
                <a
                  key={a.label}
                  href={
                    a.kind === "sms"
                      ? `sms:?&body=${encodeURIComponent(a.payload ?? "")}`
                      : a.href ?? "#"
                  }
                  target={a.kind === "link" && a.href?.startsWith("https") ? "_blank" : undefined}
                  rel={a.kind === "link" && a.href?.startsWith("https") ? "noreferrer" : undefined}
                  className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold ${
                    a.primary
                      ? "bg-brand text-white"
                      : "bg-blue-soft text-blue-ink"
                  }`}
                >
                  {a.label}
                </a>
              ) : (
                <button
                  key={a.label}
                  disabled={busy}
                  onClick={() => act(a)}
                  className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-50 ${
                    a.primary
                      ? "bg-brand text-white"
                      : "bg-blue-soft text-blue-ink"
                  }`}
                >
                  {a.kind === "snooze" ? "Snooze" : a.label}
                </button>
              )
            )}
            {calendarHref && calState !== "done" && (
              <button
                disabled={calState === "busy"}
                onClick={addToCalendar}
                className="rounded-lg px-2.5 py-2 text-[13px] font-semibold text-blue-ink disabled:opacity-60"
              >
                {calState === "busy" ? "Adding..." : "Add to calendar"}
              </button>
            )}
            {calState === "done" && (
              <span className="px-2.5 py-2 text-[13px] font-semibold text-brand">
                ✓ On your calendar
              </span>
            )}
            {!hasSnoozeAction && item.key && (
              <button
                disabled={busy}
                onClick={() => setPickerOpen(true)}
                aria-label="Snooze this reminder"
                className="rounded-lg px-2.5 py-2 text-[13px] font-semibold text-sub disabled:opacity-50"
              >
                Snooze
              </button>
            )}
          </div>
        )}
      </div>

      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={(e) => e.target === e.currentTarget && setPickerOpen(false)}
        >
          <div className="w-full rounded-t-3xl bg-white p-6 pb-9">
            <h3 className="text-lg font-bold">Remind me again...</h3>
            <p className="mb-4 mt-1 text-sm text-sub">
              It leaves your brief until then.
              {dayBeforeEvent &&
                ` The date is ${new Date(item.event_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}, so choices stop the day before.`}
            </p>
            <div className="flex flex-wrap gap-2">
              {dayBeforeEvent && (
                <button
                  disabled={busy}
                  onClick={() => snoozeUntil(dayBeforeEvent)}
                  className="rounded-xl border-[1.5px] border-brand bg-brand-soft px-4 py-2.5 text-sm font-semibold"
                >
                  Day before
                </button>
              )}
              {choices.map((c) => (
                <button
                  key={c.days}
                  disabled={busy}
                  onClick={() => snoozeUntil(daysFromNow(c.days))}
                  className="rounded-xl border-[1.5px] border-line px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
              <span className="text-sm font-semibold">Or pick a date</span>
              <input
                type="date"
                value={customDate}
                min={daysFromNow(1)}
                max={dayBeforeEvent ?? undefined}
                onChange={(e) => setCustomDate(e.target.value)}
                className="flex-1 rounded-lg border-[1.5px] border-line px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <button
                disabled={busy || !customDate}
                onClick={() => snoozeUntil(customDate)}
                className="rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                Set
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
