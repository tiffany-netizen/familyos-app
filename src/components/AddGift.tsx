"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AddGift({
  people,
}: {
  people: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim() || !personId) return;
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("gift_ideas").insert({
      owner_id: user.id,
      person_id: personId,
      title: title.trim(),
      detail: "Added by hand",
    });
    setBusy(false);
    setOpen(false);
    setTitle("");
    router.refresh();
  }

  if (people.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-5 w-full rounded-xl border-[1.5px] border-dashed border-line py-3.5 text-sm font-semibold text-sub"
      >
        + Add a gift idea
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full rounded-t-3xl bg-white p-6 pb-9">
            <h3 className="mb-4 text-lg font-bold">Add a gift idea</h3>
            <div className="mb-3 flex flex-wrap gap-2">
              {people.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPersonId(p.id)}
                  className={`rounded-lg border-[1.5px] px-3 py-2 text-sm ${
                    personId === p.id
                      ? "border-brand bg-brand-soft font-semibold"
                      : "border-line"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The idea"
              className="mb-4 w-full rounded-xl border-[1.5px] border-line px-4 py-3 outline-none focus:border-brand"
            />
            <button
              onClick={save}
              disabled={busy || !title.trim()}
              className="w-full rounded-xl bg-brand py-4 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
