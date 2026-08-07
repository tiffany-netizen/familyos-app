"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function MarkDone({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const supabase = createClient();
        await supabase
          .from("home_items")
          .update({ last_performed: new Date().toISOString().slice(0, 10) })
          .eq("id", itemId);
        setBusy(false);
        router.refresh();
      }}
      className="rounded-lg bg-blue-soft px-3 py-1.5 text-xs font-semibold text-blue-ink disabled:opacity-50"
    >
      Done today
    </button>
  );
}

export function AddHomeItem() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState("");
  const [freq, setFreq] = useState(90);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!task.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("home_items").insert({
      owner_id: user.id,
      task_name: task.trim(),
      frequency_days: freq,
      last_performed: new Date().toISOString().slice(0, 10),
    });
    setBusy(false);
    setOpen(false);
    setTask("");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-xl border-[1.5px] border-dashed border-line py-3 text-sm font-semibold text-sub"
      >
        + Add a maintenance task
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full rounded-t-3xl bg-white p-6 pb-9">
            <h3 className="mb-4 text-lg font-bold">Add a maintenance task</h3>
            <input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Task (HVAC filters, gutters...)"
              className="mb-3 w-full rounded-xl border-[1.5px] border-line px-4 py-3 outline-none focus:border-brand"
            />
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                [30, "Monthly"],
                [90, "Every 3 months"],
                [180, "Twice a year"],
                [365, "Yearly"],
              ].map(([d, l]) => (
                <button
                  key={d}
                  onClick={() => setFreq(d as number)}
                  className={`rounded-lg border-[1.5px] px-3 py-2 text-sm ${
                    freq === d
                      ? "border-brand bg-brand-soft font-semibold"
                      : "border-line"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              onClick={save}
              disabled={busy || !task.trim()}
              className="w-full rounded-xl bg-brand py-4 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function AddProvider() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("other");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("service_providers").insert({
      owner_id: user.id,
      name: name.trim(),
      kind,
      contact_info: contact.trim() || null,
    });
    setBusy(false);
    setOpen(false);
    setName("");
    setContact("");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-xl border-[1.5px] border-dashed border-line py-3 text-sm font-semibold text-sub"
      >
        + Add a service provider
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full rounded-t-3xl bg-white p-6 pb-9">
            <h3 className="mb-4 text-lg font-bold">Add a service provider</h3>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (Luis the gardener...)"
              className="mb-3 w-full rounded-xl border-[1.5px] border-line px-4 py-3 outline-none focus:border-brand"
            />
            <div className="mb-3 flex flex-wrap gap-2">
              {[
                ["gardener", "Gardener"],
                ["cleaner", "Cleaner"],
                ["mechanic", "Mechanic"],
                ["cpa", "Taxes"],
                ["other", "Other"],
              ].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setKind(v)}
                  className={`rounded-lg border-[1.5px] px-3 py-2 text-sm ${
                    kind === v
                      ? "border-brand bg-brand-soft font-semibold"
                      : "border-line"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Phone or email (optional)"
              className="mb-4 w-full rounded-xl border-[1.5px] border-line px-4 py-3 outline-none focus:border-brand"
            />
            <button
              onClick={save}
              disabled={busy || !name.trim()}
              className="w-full rounded-xl bg-brand py-4 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
