"use client";

// One tap: Claude reads the whole family picture (sitter on file, city,
// kids' schedules, spouse tastes) and lays out the date night checklist.
// The plan PERSISTS: it stays open across visits, remembers which steps
// became to-dos, and shows progress as those to-dos get checked off.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PlanItem = {
  title: string;
  detail: string;
  link?: string;
  todo?: string;
  todo_id?: string;
};

export default function DateNightPlanner() {
  const [state, setState] = useState<"loading" | "idle" | "working" | "ready" | "error">(
    "loading"
  );
  const [planId, setPlanId] = useState<string | null>(null);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  // Pick up the open plan, if there is one, and its to-dos' done states.
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return setState("idle");
      const { data: plan } = await supabase
        .from("plans")
        .select("id,items")
        .eq("owner_id", user.id)
        .eq("kind", "date_night")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!plan) return setState("idle");
      const its = (plan.items ?? []) as PlanItem[];
      setPlanId(plan.id);
      setItems(its);
      const ids = its.map((i) => i.todo_id).filter(Boolean) as string[];
      if (ids.length) {
        const { data: todos } = await supabase
          .from("todos")
          .select("id,done")
          .in("id", ids);
        setDoneIds(new Set((todos ?? []).filter((t) => t.done).map((t) => t.id)));
      }
      setState("ready");
    })();
  }, []);

  async function plan() {
    setState("working");
    try {
      const res = await fetch("/api/ai/datenight", { method: "POST" });
      if (!res.ok) throw new Error("bad status");
      const data = (await res.json()) as { considerations: PlanItem[] };
      if (!data.considerations?.length) throw new Error("empty");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // One open plan at a time.
        await supabase
          .from("plans")
          .update({ status: "done" })
          .eq("owner_id", user.id)
          .eq("kind", "date_night")
          .eq("status", "open");
        const { data: saved } = await supabase
          .from("plans")
          .insert({ owner_id: user.id, kind: "date_night", items: data.considerations })
          .select("id")
          .single();
        setPlanId(saved?.id ?? null);
      }
      setItems(data.considerations);
      setDoneIds(new Set());
      setState("ready");
    } catch {
      setState("error");
    }
  }

  async function addTodo(i: number, text: string) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: inserted } = await supabase
      .from("todos")
      .insert({ owner_id: user.id, title: text })
      .select("id")
      .single();
    const next = items.map((it, idx) =>
      idx === i ? { ...it, todo_id: inserted?.id } : it
    );
    setItems(next);
    if (planId) await supabase.from("plans").update({ items: next }).eq("id", planId);
    // Let the AI enrich it like any typed to-do.
    fetch("/api/ai/todo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: text, id: inserted?.id ?? null }),
    }).catch(() => {});
  }

  async function startOver() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && planId) {
      await supabase.from("plans").update({ status: "done" }).eq("id", planId);
    }
    setPlanId(null);
    setItems([]);
    setDoneIds(new Set());
    setState("idle");
  }

  if (state === "loading") return null;

  if (state === "idle" || state === "working" || state === "error") {
    return (
      <div className="mt-3">
        <button
          onClick={plan}
          disabled={state === "working"}
          className="rounded-lg bg-blue-soft px-3.5 py-2 text-[13px] font-semibold text-blue-ink disabled:opacity-60"
        >
          {state === "working" ? "Working on it..." : "Plan the whole night for me"}
        </button>
        {state === "error" && (
          <p className="mt-2 text-[13px] text-sub">
            Couldn&apos;t build the plan right now. Try again in a minute.
          </p>
        )}
      </div>
    );
  }

  const linked = items.filter((c) => c.todo_id);
  const doneCount = linked.filter((c) => c.todo_id && doneIds.has(c.todo_id)).length;

  return (
    <div className="mt-3 space-y-2">
      {linked.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-blue-soft">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${linked.length ? (doneCount / linked.length) * 100 : 0}%` }}
            />
          </div>
          <p className="text-[12px] font-semibold text-sub">
            {doneCount} of {linked.length} handled
          </p>
        </div>
      )}
      {items.map((c, i) => {
        const isDone = Boolean(c.todo_id && doneIds.has(c.todo_id));
        return (
          <div
            key={i}
            className={`rounded-xl border border-line p-3 ${isDone ? "opacity-60" : ""}`}
          >
            <p className={`text-[14px] font-semibold ${isDone ? "line-through" : ""}`}>
              {c.title}
            </p>
            <p className="mt-0.5 text-[13px] text-sub">{c.detail}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {c.link && (
                <a
                  href={c.link}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-blue-soft px-3 py-1.5 text-[12px] font-semibold text-blue-ink"
                >
                  Open ›
                </a>
              )}
              {c.todo &&
                (c.todo_id ? (
                  <a
                    href="/todos"
                    className="px-1 py-1.5 text-[12px] font-semibold text-brand"
                  >
                    {isDone ? "✓ Done" : "✓ On your list ›"}
                  </a>
                ) : (
                  <button
                    onClick={() => addTodo(i, c.todo!)}
                    className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold"
                  >
                    Add to my list
                  </button>
                ))}
            </div>
          </div>
        );
      })}
      <button onClick={startOver} className="w-full py-2 text-xs font-semibold text-sub">
        Start a fresh plan
      </button>
    </div>
  );
}
