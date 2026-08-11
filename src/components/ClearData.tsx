"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TABLES = [
  "contact_logs",
  "gift_ideas",
  "memories",
  "tracked_dates",
  "sports_events",
  "bucket_list_items",
  "home_items",
  "service_providers",
  "vehicles",
  "routines",
  "todos",
  "trips",
  "followups",
  "briefs",
  "people",
];

export default function ClearData() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function wipe() {
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    for (const t of TABLES) {
      await supabase.from(t).delete().eq("owner_id", user.id);
    }
    await supabase
      .from("profiles")
      .update({ onboarded: false })
      .eq("id", user.id);
    setBusy(false);
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="mt-6 text-center">
      {confirming ? (
        <div className="rounded-xl bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-600">
            Erase everything and start over? People, memories, gift ideas, all
            of it. This can&apos;t be undone.
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <button
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-line bg-white px-4 py-2 text-[13px] font-semibold text-sub"
            >
              Never mind
            </button>
            <button
              onClick={wipe}
              disabled={busy}
              className="rounded-lg bg-red-600 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Clearing..." : "Yes, start fresh"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="text-xs font-semibold text-sub underline-offset-2 hover:underline"
        >
          Start fresh (clear my data)
        </button>
      )}
    </div>
  );
}
