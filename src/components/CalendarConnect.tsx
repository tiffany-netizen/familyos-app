"use client";

// Connect / disconnect Google Calendar from the profile page.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CalendarConnect({
  connectedEmail,
  available,
  status,
}: {
  connectedEmail: string | null;
  available: boolean;
  status?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("google_tokens").delete().eq("owner_id", user.id);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-sm font-bold">Google Calendar</p>
      {status === "connected" && (
        <p className="mt-1 text-[13px] font-medium text-brand">
          ✓ Connected. Your real schedule now feeds the brief and the weekly
          digest.
        </p>
      )}
      {status === "error" && (
        <p className="mt-1 text-[13px] font-medium text-red-600">
          That connection attempt didn&apos;t finish. Try again.
        </p>
      )}
      {connectedEmail ? (
        <>
          <p className="mt-1 text-[13px] text-sub">
            Reading {connectedEmail}&apos;s primary calendar. Events show in the
            brief and digest; nothing is ever written to your calendar.
          </p>
          <button
            onClick={disconnect}
            disabled={busy}
            className="mt-2.5 rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-sub disabled:opacity-50"
          >
            {busy ? "Disconnecting..." : "Disconnect"}
          </button>
        </>
      ) : available ? (
        <>
          <p className="mt-1 text-[13px] text-sub">
            Connect your calendar so the brief can check the real schedule and
            date night can find free evenings. Read-only.
          </p>
          <a
            href="/api/google/auth"
            className="mt-2.5 inline-block rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white"
          >
            Connect Google Calendar
          </a>
        </>
      ) : (
        <p className="mt-1 text-[13px] text-sub">
          Coming online soon. The connection needs its Google credentials set
          up first.
        </p>
      )}
    </div>
  );
}
