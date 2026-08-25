"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const RELS = [
  ["spouse", "Spouse"],
  ["child", "Kid"],
  ["parent", "Parent"],
  ["sibling", "Sibling"],
  ["friend", "Friend"],
  ["pet", "Pet"],
  ["other", "Other"],
];

export default function AddPerson() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rel, setRel] = useState("friend");
  const [relOther, setRelOther] = useState("");
  const [birthday, setBirthday] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("people").insert({
      owner_id: user.id,
      name: name.trim(),
      relationship:
        rel === "other" && relOther.trim()
          ? relOther.trim().toLowerCase()
          : rel,
      birthday: birthday || null,
    });
    setBusy(false);
    setOpen(false);
    setName("");
    setBirthday("");
    setRelOther("");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-5 w-full rounded-xl border-[1.5px] border-dashed border-line py-3.5 text-sm font-semibold text-sub"
      >
        + Add a person
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full rounded-t-3xl bg-white p-6 pb-9">
            <h3 className="text-lg font-bold">Add a person</h3>
            <p className="mb-4 mt-1 text-sm text-sub">
              Track anyone: a friend, a sibling, a neighbor.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="mb-3 w-full rounded-xl border-[1.5px] border-line px-4 py-3 outline-none focus:border-brand"
            />
            <div className="mb-3 flex flex-wrap gap-2">
              {RELS.map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setRel(v)}
                  className={`rounded-lg border-[1.5px] px-3 py-2 text-sm ${
                    rel === v
                      ? "border-brand bg-brand-soft font-semibold"
                      : "border-line"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            {rel === "other" && (
              <input
                value={relOther}
                onChange={(e) => setRelOther(e.target.value)}
                placeholder="Who are they? (cousin, coach, neighbor...)"
                className="mb-3 w-full rounded-xl border-[1.5px] border-line px-4 py-3 outline-none focus:border-brand"
              />
            )}
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-sub">
              Birthday (optional)
            </label>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
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
