"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Person = {
  id: string;
  name: string;
  relationship: string;
  birthday: string | null;
  gender: string | null;
  grade: string | null;
  school: string | null;
  teacher_name: string | null;
  best_friend: string | null;
  clothing_size: string | null;
  shoe_size: string | null;
  ring_size: string | null;
  hair_color: string | null;
  favorite_wine: string | null;
  favorite_flowers: string | null;
  favorite_toys: string | null;
  allergies: string | null;
  interests: string | null;
  breed: string | null;
  vet_info: string | null;
};

const COMMON: [keyof Person, string, string][] = [
  ["name", "Name", "text"],
  ["birthday", "Birthday", "date"],
  ["interests", "Interests", "text"],
  ["allergies", "Allergies", "text"],
];

const BY_REL: Record<string, [keyof Person, string, string][]> = {
  spouse: [
    ["hair_color", "Hair color", "text"],
    ["ring_size", "Ring size", "text"],
    ["clothing_size", "Clothing size", "text"],
    ["favorite_wine", "Favorite wine", "text"],
    ["favorite_flowers", "Favorite flowers", "text"],
  ],
  child: [
    ["gender", "Gender", "text"],
    ["grade", "Grade", "text"],
    ["school", "School", "text"],
    ["teacher_name", "Teacher", "text"],
    ["best_friend", "Best friend", "text"],
    ["clothing_size", "Clothing size", "text"],
    ["shoe_size", "Shoe size", "text"],
    ["favorite_toys", "Favorite toys", "text"],
  ],
  parent: [],
  friend: [],
  pet: [
    ["breed", "Breed", "text"],
    ["vet_info", "Vet info", "text"],
  ],
  other: [],
};

export default function EditPerson({ person }: { person: Person }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(() => {
    const f: Record<string, string> = {};
    [...COMMON, ...(BY_REL[person.relationship] ?? [])].forEach(([k]) => {
      f[k] = (person[k] as string | null) ?? "";
    });
    return f;
  });

  const fields = [...COMMON, ...(BY_REL[person.relationship] ?? [])];

  async function save() {
    if (!form.name?.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const patch: Record<string, string | null> = {};
    fields.forEach(([k]) => {
      patch[k] = form[k]?.trim() || null;
    });
    await supabase.from("people").update(patch).eq("id", person.id);
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("people").delete().eq("id", person.id);
    setBusy(false);
    router.push("/people");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-sub"
      >
        Edit
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 pb-9">
            <h3 className="mb-4 text-lg font-bold">Edit {person.name}</h3>
            <div className="space-y-3">
              {fields.map(([k, label, type]) => (
                <label key={k} className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-sub">
                    {label}
                  </span>
                  <input
                    type={type}
                    value={form[k] ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [k]: e.target.value }))
                    }
                    className="w-full rounded-xl border-[1.5px] border-line px-4 py-3 outline-none focus:border-brand"
                  />
                </label>
              ))}
            </div>
            <button
              onClick={save}
              disabled={busy || !form.name?.trim()}
              className="mt-5 w-full rounded-xl bg-brand py-4 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save changes"}
            </button>

            {confirmRemove ? (
              <div className="mt-4 rounded-xl bg-red-50 p-4 text-center">
                <p className="text-sm font-semibold text-red-600">
                  Remove {person.name} and everything saved about them?
                </p>
                <div className="mt-3 flex justify-center gap-2">
                  <button
                    onClick={() => setConfirmRemove(false)}
                    className="rounded-lg border border-line px-4 py-2 text-[13px] font-semibold text-sub"
                  >
                    Keep them
                  </button>
                  <button
                    onClick={remove}
                    disabled={busy}
                    className="rounded-lg bg-red-600 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                  >
                    Yes, remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmRemove(true)}
                className="mt-3 w-full py-2 text-center text-[13px] font-semibold text-red-500"
              >
                Remove this person
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
