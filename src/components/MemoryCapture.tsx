"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SpeechRecognitionLike = {
  new (): {
    lang: string;
    interimResults: boolean;
    onresult: (e: { results: { [i: number]: { [j: number]: { transcript: string } } }; resultIndex: number }) => void;
    onend: () => void;
    start: () => void;
    stop: () => void;
  };
};

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
  const [listening, setListening] = useState(false);
  const [micAvailable, setMicAvailable] = useState(false);
  const recRef = useRef<InstanceType<SpeechRecognitionLike> | null>(null);

  useEffect(() => {
    const openHandler = () => setOpen(true);
    window.addEventListener("open-memory", openHandler);
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionLike;
      webkitSpeechRecognition?: SpeechRecognitionLike;
    };
    setMicAvailable(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => window.removeEventListener("open-memory", openHandler);
  }, []);

  function toggleMic() {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionLike;
      webkitSpeechRecognition?: SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const t = e.results[e.resultIndex]?.[0]?.transcript ?? "";
      setText((prev) => (prev ? prev + " " : "") + t);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

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
        className="fixed bottom-24 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl text-white shadow-lg"
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
            {micAvailable && (
              <button
                onClick={toggleMic}
                className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold ${
                  listening
                    ? "bg-red-100 text-red-600"
                    : "bg-blue-soft text-blue-ink"
                }`}
              >
                {listening ? "● Listening... tap to stop" : "🎤 Speak it instead"}
              </button>
            )}
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
