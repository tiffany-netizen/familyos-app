"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Todo = { id: string; title: string; done: boolean };

export default function TodoList({ todos }: { todos: Todo[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function toggle(t: Todo) {
    const supabase = createClient();
    await supabase.from("todos").update({ done: !t.done }).eq("id", t.id);
    router.refresh();
  }

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("todos")
      .insert({ owner_id: user.id, title: title.trim() });
    setTitle("");
    setBusy(false);
    router.refresh();
  }

  async function clearDone() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("todos").delete().eq("owner_id", user.id).eq("done", true);
    router.refresh();
  }

  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  return (
    <>
      <div className="mt-4 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add something to do..."
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

      <div className="mt-4 rounded-2xl border border-line bg-white px-4 shadow-sm">
        {open.length === 0 && done.length === 0 && (
          <p className="py-4 text-sm text-sub">
            Nothing on the list. Enjoy it while it lasts.
          </p>
        )}
        {open.map((t, i) => (
          <button
            key={t.id}
            onClick={() => toggle(t)}
            className={`flex w-full items-center gap-3 py-3 text-left ${i > 0 ? "border-t border-line" : ""}`}
          >
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-[1.5px] border-line" />
            <span className="text-sm">{t.title}</span>
          </button>
        ))}
        {done.map((t) => (
          <button
            key={t.id}
            onClick={() => toggle(t)}
            className="flex w-full items-center gap-3 border-t border-line py-3 text-left"
          >
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-brand text-[11px] text-white">
              ✓
            </span>
            <span className="text-sm text-sub line-through">{t.title}</span>
          </button>
        ))}
      </div>
      {done.length > 0 && (
        <button
          onClick={clearDone}
          className="mt-3 w-full py-2 text-center text-xs font-semibold text-sub"
        >
          Clear completed
        </button>
      )}
    </>
  );
}
