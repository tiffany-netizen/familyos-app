"use client";

// The dynamic to-do list. Items carry due dates, categories, person
// links, and an AI-suggested first move. The list groups itself by
// urgency, lets you snooze instead of ignore, and nudges you on items
// that have been sitting for weeks.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Todo = {
  id: string;
  title: string;
  done: boolean;
  due_date: string | null;
  category: string | null;
  next_step: string | null;
  snoozed_until: string | null;
  person_id: string | null;
  created_at: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  call: "Call",
  buy: "Buy",
  book: "Book",
  schedule: "Schedule",
  home: "Home",
  school: "School",
  errand: "Errand",
};

const DAY = 86400000;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "call dentist tomorrow" -> due date filled before the AI even runs.
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
function parseQuickDue(raw: string): { title: string; due: string | null } {
  const t = raw.trim();
  const lower = t.toLowerCase();
  const now = new Date();
  const strip = (m: string) =>
    t.slice(0, t.length - m.length).replace(/[\s,]+(by|on|due|before)?[\s,]*$/i, "").trim();

  if (/(today|tonight)$/.test(lower)) {
    const m = lower.match(/(today|tonight)$/)![0];
    return { title: strip(m), due: toStr(now) };
  }
  if (/tomorrow$/.test(lower)) {
    return { title: strip("tomorrow"), due: toStr(new Date(now.getTime() + DAY)) };
  }
  if (/next week$/.test(lower)) {
    return { title: strip("next week"), due: toStr(new Date(now.getTime() + 7 * DAY)) };
  }
  for (let i = 0; i < 7; i++) {
    const name = WEEKDAYS[i];
    if (lower.endsWith(name)) {
      let ahead = (i - now.getDay() + 7) % 7;
      if (ahead === 0) ahead = 7;
      return { title: strip(t.slice(-name.length)), due: toStr(new Date(now.getTime() + ahead * DAY)) };
    }
  }
  return { title: t, due: null };
}

function dueLabel(due: string, today: string): { text: string; late: boolean } {
  const dd = new Date(due + "T00:00:00");
  const td = new Date(today + "T00:00:00");
  const diff = Math.round((dd.getTime() - td.getTime()) / DAY);
  if (diff < 0) return { text: diff === -1 ? "Yesterday" : `${-diff} days late`, late: true };
  if (diff === 0) return { text: "Today", late: false };
  if (diff === 1) return { text: "Tomorrow", late: false };
  if (diff < 7)
    return { text: dd.toLocaleDateString("en-US", { weekday: "long" }), late: false };
  return { text: dd.toLocaleDateString("en-US", { month: "short", day: "numeric" }), late: false };
}

export default function TodoList({
  todos,
  peopleNames,
}: {
  todos: Todo[];
  peopleNames: Record<string, string>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [smartNote, setSmartNote] = useState<string | null>(null);

  const today = todayStr();
  const supabase = () => createClient();

  async function toggle(t: Todo) {
    await supabase().from("todos").update({ done: !t.done }).eq("id", t.id);
    router.refresh();
  }

  async function patch(id: string, fields: Record<string, unknown>) {
    await supabase().from("todos").update(fields).eq("id", id);
    router.refresh();
  }

  async function drop(id: string) {
    await supabase().from("todos").delete().eq("id", id);
    setOpenId(null);
    router.refresh();
  }

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    const sb = supabase();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return;
    const parsed = parseQuickDue(title);
    const { data: inserted } = await sb
      .from("todos")
      .insert({
        owner_id: user.id,
        title: parsed.title,
        ...(parsed.due ? { due_date: parsed.due } : {}),
      })
      .select("id")
      .single();
    setTitle("");
    setBusy(false);
    router.refresh();

    // The AI reads each new to-do: category, due date, person link, a
    // first move, and a dashboard follow-up when finishing it should
    // feed the database.
    try {
      const res = await fetch("/api/ai/todo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: parsed.title, id: inserted?.id ?? null }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.enriched) router.refresh();
      if (data?.queued) {
        setSmartNote(
          "Noted. I'll follow up on your Today screen so what comes out of this lands in the system."
        );
        setTimeout(() => setSmartNote(null), 5000);
      }
    } catch {}
  }

  async function clearDone() {
    const sb = supabase();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return;
    await sb.from("todos").delete().eq("owner_id", user.id).eq("done", true);
    router.refresh();
  }

  const isSnoozed = (t: Todo) => !t.done && t.snoozed_until && t.snoozed_until > today;
  const active = todos.filter((t) => !t.done && !isSnoozed(t));
  const snoozed = todos.filter(isSnoozed);
  const done = todos.filter((t) => t.done);

  const overdue = active.filter((t) => t.due_date && t.due_date < today);
  const dueToday = active.filter((t) => t.due_date === today);
  const thisWeek = active.filter(
    (t) => t.due_date && t.due_date > today && t.due_date <= toStr(new Date(Date.now() + 7 * DAY))
  );
  const later = active.filter(
    (t) => t.due_date && t.due_date > toStr(new Date(Date.now() + 7 * DAY))
  );
  const someday = active.filter((t) => !t.due_date);

  const sections: { label: string; items: Todo[] }[] = [
    { label: "Overdue", items: overdue },
    { label: "Today", items: dueToday },
    { label: "This week", items: thisWeek },
    { label: "Coming up", items: later },
    { label: "Anytime", items: someday },
  ].filter((s) => s.items.length > 0);

  const ageDays = (t: Todo) =>
    Math.round((Date.now() - new Date(t.created_at).getTime()) / DAY);

  function row(t: Todo) {
    const open = openId === t.id;
    const due = t.due_date ? dueLabel(t.due_date, today) : null;
    const person = t.person_id ? peopleNames[t.person_id] : null;
    const cat = t.category ? CATEGORY_LABEL[t.category] : null;
    const stale = !t.due_date && !t.done && ageDays(t) >= 14;

    return (
      <div key={t.id} className="border-t border-line py-3 first:border-t-0">
        <div className="flex items-start gap-3">
          <button
            onClick={() => toggle(t)}
            aria-label="Mark done"
            className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-[1.5px] border-line"
          />
          <button onClick={() => setOpenId(open ? null : t.id)} className="flex-1 text-left">
            <span className="text-sm">{t.title}</span>
            {(due || person || cat) && (
              <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] font-semibold">
                {due && (
                  <span className={due.late ? "text-red-600" : "text-sub"}>{due.text}</span>
                )}
                {person && <span className="text-sub">{person}</span>}
                {cat && <span className="text-sub">{cat}</span>}
              </span>
            )}
            {stale && !open && (
              <span className="mt-0.5 block text-[11px] text-sub">
                On the list {Math.floor(ageDays(t) / 7)} weeks. Still needed?
              </span>
            )}
          </button>
          <button
            onClick={() => setOpenId(open ? null : t.id)}
            className="px-1 text-sub"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? "−" : "+"}
          </button>
        </div>

        {open && (
          <div className="mt-2 space-y-3 pl-8">
            {t.next_step && (
              <p className="rounded-lg bg-brand-soft px-3 py-2 text-[13px]">
                First move: {t.next_step}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[11px] font-semibold text-sub">Due</label>
              <input
                type="date"
                value={t.due_date ?? ""}
                onChange={(e) => patch(t.id, { due_date: e.target.value || null })}
                className="rounded-lg border border-line px-2 py-1.5 text-[13px]"
              />
              {t.due_date && (
                <button
                  onClick={() => patch(t.id, { due_date: null })}
                  className="text-[11px] font-semibold text-sub"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => patch(t.id, { snoozed_until: toStr(new Date(Date.now() + DAY)) })}
                className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold"
              >
                Snooze to tomorrow
              </button>
              <button
                onClick={() =>
                  patch(t.id, { snoozed_until: toStr(new Date(Date.now() + 7 * DAY)) })
                }
                className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold"
              >
                Next week
              </button>
              <button
                onClick={() => drop(t.id)}
                className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-red-600"
              >
                Drop it
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder='Try "call dentist tomorrow"...'
          className="flex-1 rounded-xl border-[1.5px] border-line px-4 py-3 outline-none focus:border-brand"
        />
        <button
          onClick={add}
          disabled={busy || !title.trim()}
          className="rounded-xl bg-brand px-5 font-semibold text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {smartNote && (
        <p className="mt-3 rounded-xl bg-brand-soft px-4 py-3 text-[13px] font-medium text-brand">
          {smartNote}
        </p>
      )}

      {sections.length === 0 && snoozed.length === 0 && done.length === 0 && (
        <div className="mt-4 rounded-2xl border border-line bg-white px-4 py-4 shadow-sm">
          <p className="text-sm text-sub">Nothing on the list. Enjoy it while it lasts.</p>
        </div>
      )}

      {sections.map((s) => (
        <div key={s.label} className="mt-4">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-blue-ink">
            {s.label}
          </p>
          <div className="rounded-2xl border border-line bg-white px-4 shadow-sm">
            {s.items.map(row)}
          </div>
        </div>
      ))}

      {snoozed.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-wider text-sub">
            Snoozed ({snoozed.length}) ›
          </summary>
          <div className="mt-1.5 rounded-2xl border border-line bg-white px-4 shadow-sm">
            {snoozed.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-t-0">
                <span className="text-sm text-sub">{t.title}</span>
                <button
                  onClick={() => patch(t.id, { snoozed_until: null })}
                  className="text-[11px] font-semibold text-brand"
                >
                  Wake
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {done.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-sub">Done</p>
          <div className="rounded-2xl border border-line bg-white px-4 shadow-sm">
            {done.map((t) => (
              <button
                key={t.id}
                onClick={() => toggle(t)}
                className="flex w-full items-center gap-3 border-t border-line py-3 text-left first:border-t-0"
              >
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-brand text-[11px] text-white">
                  ✓
                </span>
                <span className="text-sm text-sub line-through">{t.title}</span>
              </button>
            ))}
          </div>
          <button
            onClick={clearDone}
            className="mt-2 w-full py-2 text-center text-xs font-semibold text-sub"
          >
            Clear completed
          </button>
        </div>
      )}
    </>
  );
}
