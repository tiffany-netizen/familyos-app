"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UploadSchedule({
  childName,
}: {
  childName: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "reading" | "done">("idle");

  async function handleFile() {
    setState("reading");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Demo: simulate AI reading the schedule, then add two real events.
    await new Promise((r) => setTimeout(r, 2200));
    const now = new Date();
    const nextDow = (dow: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7 || 7));
      d.setHours(16, 0, 0, 0);
      return d.toISOString();
    };
    const team = childName ? `${childName}'s team` : "The team";
    await supabase.from("sports_events").insert([
      { owner_id: user.id, sport: "Soccer", team, event_date: nextDow(2), location: "City Park Field 3" },
      { owner_id: user.id, sport: "Soccer", team, event_date: nextDow(4), location: "City Park Field 3" },
    ]);
    setState("done");
    router.refresh();
  }

  return (
    <div className="mt-6 rounded-2xl border border-line bg-white p-4 shadow-sm">
      <p className="text-sm font-bold">📷 Upload a schedule</p>
      <p className="mt-1 text-[13px] leading-relaxed text-sub">
        Snap a photo of any sports or school schedule and the dates get read
        into your week automatically.
      </p>
      {state === "idle" && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="mt-3 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white"
          >
            Choose a photo
          </button>
        </>
      )}
      {state === "reading" && (
        <p className="mt-3 text-[13px] font-semibold text-blue-ink">
          Reading dates from your photo...
        </p>
      )}
      {state === "done" && (
        <p className="mt-3 text-[13px] font-semibold text-brand">
          ✓ Found 2 practices and added them to your week below. (Preview: the
          full AI reader is coming; these are sample events you can see in your
          digest.)
        </p>
      )}
    </div>
  );
}
