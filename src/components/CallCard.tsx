"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CallCard({
  personId,
  lastContact,
}: {
  personId: string;
  lastContact: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const gap = lastContact
    ? Math.round(
        (Date.now() - new Date(lastContact + "T00:00:00").getTime()) / 86400000
      )
    : null;

  async function log(method: "call" | "we_talked") {
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("contact_logs").insert({
      owner_id: user.id,
      person_id: personId,
      method,
    });
    await supabase
      .from("people")
      .update({ last_contact: today })
      .eq("id", personId);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm font-bold">
          {gap === null
            ? "No calls logged yet"
            : gap === 0
              ? "Talked today"
              : `Last call: ${gap} day${gap === 1 ? "" : "s"} ago`}
        </p>
        <p className="mt-0.5 text-xs text-sub">
          Calls started here log themselves
        </p>
      </div>
      {gap !== 0 && (
        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={() => log("call")}
            className="rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            Call
          </button>
          <button
            disabled={busy}
            onClick={() => log("we_talked")}
            className="rounded-lg bg-blue-soft px-3.5 py-2 text-[13px] font-semibold text-blue-ink disabled:opacity-50"
          >
            We talked
          </button>
        </div>
      )}
    </div>
  );
}
