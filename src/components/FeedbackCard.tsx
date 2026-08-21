"use client";

// Sandbox feedback capture: one box, straight into the feedback table.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function FeedbackCard() {
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!body.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("feedback").insert({
      owner_id: user.id,
      body: body.trim(),
      page: "today",
    });
    setBusy(false);
    setBody("");
    setSent(true);
    setTimeout(() => setSent(false), 4000);
  }

  return (
    <div className="mt-8 rounded-2xl border border-dashed border-line bg-white p-4">
      <p className="text-sm font-bold">You&apos;re in the test build</p>
      <p className="mt-1 text-[13px] text-sub">
        Something confusing, broken, or missing? Drop it here and it goes
        straight to the build list. Coming next: a recipe box with a shopping
        list.
      </p>
      {sent ? (
        <p className="mt-3 text-[13px] font-semibold text-brand">
          ✓ Got it. Thank you.
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Tell us anything..."
            className="min-w-0 flex-1 rounded-xl border-[1.5px] border-line px-3.5 py-2.5 text-sm outline-none focus:border-brand"
          />
          <button
            onClick={send}
            disabled={busy || !body.trim()}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
