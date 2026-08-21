"use client";

// One tap: Claude reads the whole family picture (sitter on file, city,
// kids' schedules, spouse tastes) and lays out the date night checklist.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PlanItem = { title: string; detail: string; link?: string; todo?: string };

export default function DateNightPlanner() {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [items, setItems] = useState<PlanItem[]>([]);
  const [added, setAdded] = useState<Set<number>>(new Set());

  async function plan() {
    setState("loading");
    try {
      const res = await fetch("/api/ai/datenight", { method: "POST" });
      if (!res.ok) throw new Error("bad status");
      const data = (await res.json()) as { considerations: PlanItem[] };
      if (!data.considerations?.length) throw new Error("empty");
      setItems(data.considerations);
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
    await supabase.from("todos").insert({ owner_id: user.id, title: text });
    setAdded((s) => new Set(s).add(i));
  }

  if (state === "idle" || state === "loading" || state === "error") {
    return (
      <div className="mt-3">
        <button
          onClick={plan}
          disabled={state === "loading"}
          className="rounded-lg bg-blue-soft px-3.5 py-2 text-[13px] font-semibold text-blue-ink disabled:opacity-60"
        >
          {state === "loading" ? "Working on it..." : "Plan the whole night for me"}
        </button>
        {state === "error" && (
          <p className="mt-2 text-[13px] text-sub">
            Couldn&apos;t build the plan right now. Try again in a minute.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {items.map((c, i) => (
        <div key={i} className="rounded-xl border border-line p-3">
          <p className="text-[14px] font-semibold">{c.title}</p>
          <p className="mt-0.5 text-[13px] text-sub">{c.detail}</p>
          <div className="mt-2 flex flex-wrap gap-2">
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
              (added.has(i) ? (
                <span className="px-1 py-1.5 text-[12px] font-semibold text-brand">
                  ✓ On your list
                </span>
              ) : (
                <button
                  onClick={() => addTodo(i, c.todo!)}
                  className="rounded-lg bg-blue-soft px-3 py-1.5 text-[12px] font-semibold text-blue-ink"
                >
                  + Add to-do
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
