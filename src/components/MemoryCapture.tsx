"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const GIFT_WORDS = ["want", "wants", "wanted", "misses", "miss", "loves", "mentioned", "wish", "likes", "saved"];

export default function MemoryCapture({
  people,
}: {
  people: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function save() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const lower = body.toLowerCase();
    const person = people.find((p) =>
      lower.includes(p.name.split(" ")[0].toLowerCase())
    );
    const isGift = GIFT_WORDS.some((w) => lower.includes(w));

    await supabase.from("memories").insert({
      owner_id: user.id,
      person_id: person?.id ?? null,
      body,
      category: isGift ? "gift_idea" : "memory",
    });
    if (isGift && person) {
      await supabase.from("gift_ideas").insert({
        owner_id: user.id,
        person_id: person.id,
        title: body,
        detail: "From a saved note",
      });
    }

    setNote(
      `Filed under ${person ? person.name : "General"} → ${
        isGift ? "Gift ideas" : "Memories"
      }.`
    );
    setText("");
    setBusy(false);
    router.refresh();
    setTimeout(() => {
      setNote(null);
      setOpen(false);
    }, 2500);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl text-white shadow-lg"
        aria-label="Remember something"
      >
        +
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full rounded-t-3xl bg-white p-6 pb-9">
            <h3 className="text-lg font-bold">Remember something</h3>
            <p className="mb-4 mt-1 text-sm text-sub">
              FamilyOS files it in the right place and brings it back when
              it&apos;s useful.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='Try: "Sarah said she misses wine trips to Napa"'
              className="min-h-24 w-full rounded-xl border-[1.5px] border-line p-4 outline-none focus:border-brand"
            />
            {note && (
              <p className="mt-3 rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand">
                {note}
              </p>
            )}
            <button
              onClick={save}
              disabled={busy || !text.trim()}
              className="mt-4 w-full rounded-xl bg-brand py-4 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save it"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
