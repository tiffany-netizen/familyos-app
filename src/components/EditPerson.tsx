"use client";

import { useRef, useState } from "react";
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
  school_address: string | null;
  phone: string | null;
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
  ["phone", "Phone", "tel"],
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

export default function EditPerson({
  person,
  homeAddress = "",
}: {
  person: Person;
  homeAddress?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // School search: type a name, we find the actual school near home
  // (OpenStreetMap, biased to the home address) and keep its address for
  // calendar events.
  const [schoolAddress, setSchoolAddress] = useState(person.school_address ?? "");
  const [schoolSugs, setSchoolSugs] = useState<{ name: string; address: string }[]>([]);
  const [schoolSearching, setSchoolSearching] = useState(false);
  const schoolTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const homeGeo = useRef<{ lat: number; lon: number } | null | undefined>(undefined);

  async function searchSchools(q: string) {
    if (q.trim().length < 3) {
      setSchoolSugs([]);
      return;
    }
    setSchoolSearching(true);
    try {
      if (homeGeo.current === undefined) {
        homeGeo.current = null;
        if (homeAddress.trim()) {
          const geo = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(homeAddress.trim())}`
          ).then((r) => r.json());
          if (geo?.[0])
            homeGeo.current = { lat: parseFloat(geo[0].lat), lon: parseFloat(geo[0].lon) };
        }
      }
      const h = homeGeo.current;
      const vb = h
        ? `&viewbox=${h.lon - 0.5},${h.lat + 0.5},${h.lon + 0.5},${h.lat - 0.5}&bounded=1`
        : "";
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(
          q.toLowerCase().includes("school") ? q : q + " school"
        )}${vb}`
      ).then((r) => r.json());
      setSchoolSugs(
        ((res ?? []) as { display_name: string }[]).map((r) => ({
          name: r.display_name.split(",")[0],
          address: r.display_name,
        }))
      );
    } catch {
      setSchoolSugs([]);
    }
    setSchoolSearching(false);
  }

  function onSchoolType(v: string) {
    setForm((f) => ({ ...f, school: v }));
    setSchoolAddress("");
    if (schoolTimer.current) clearTimeout(schoolTimer.current);
    schoolTimer.current = setTimeout(() => searchSchools(v), 500);
  }
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
    if (person.relationship === "child") {
      patch.school_address = schoolAddress.trim() || null;
    }
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
              {fields.map(([k, label, type]) =>
                k === "school" ? (
                  <label key={k} className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-sub">
                      {label}
                    </span>
                    <input
                      type="text"
                      value={form.school ?? ""}
                      onChange={(e) => onSchoolType(e.target.value)}
                      placeholder="Type the school's name..."
                      className="w-full rounded-xl border-[1.5px] border-line px-4 py-3 outline-none focus:border-brand"
                    />
                    {schoolSearching && (
                      <span className="mt-1 block text-xs text-sub">
                        Searching near home...
                      </span>
                    )}
                    {schoolSugs.length > 0 && (
                      <div className="mt-1 divide-y divide-line rounded-xl border border-line bg-white">
                        {schoolSugs.map((sug) => (
                          <button
                            key={sug.address}
                            type="button"
                            onClick={() => {
                              setForm((f) => ({ ...f, school: sug.name }));
                              setSchoolAddress(sug.address);
                              setSchoolSugs([]);
                            }}
                            className="block w-full px-3 py-2.5 text-left text-[13px]"
                          >
                            <span className="font-semibold">{sug.name}</span>
                            <span className="block text-xs text-sub">{sug.address}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {schoolAddress && (
                      <span className="mt-1 block text-xs text-brand">
                        ✓ {schoolAddress}
                      </span>
                    )}
                  </label>
                ) : (
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
                )
              )}
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
