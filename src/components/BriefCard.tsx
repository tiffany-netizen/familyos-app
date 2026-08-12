"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { BriefItem } from "@/lib/brief";

export default function BriefCard({ item }: { item: BriefItem }) {
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(a: NonNullable<BriefItem["actions"]>[number]) {
    if (a.kind === "confirm") {
      setNote(a.payload ?? "Done.");
      return;
    }
    if (a.kind === "snooze" || a.kind === "dismiss") {
      setBusy(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const days =
        a.kind === "snooze" ? parseInt(a.payload ?? "14", 10) || 14 : 45;
      const until = new Date(Date.now() + days * 86400000)
        .toISOString()
        .slice(0, 10);
      const key = item.key ?? `card:${item.text.slice(0, 40)}`;
      await supabase.from("card_states").upsert(
        {
          owner_id: user.id,
          card_key: key,
          status: a.kind === "snooze" ? "snoozed" : "dismissed",
          until,
        },
        { onConflict: "owner_id,card_key" }
      );
      setBusy(false);
      setNote(
        a.kind === "snooze"
          ? `Snoozed. Back on your radar ${new Date(until + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`
          : "Marked under control. I'll stay out of it."
      );
      return;
    }
    if (a.kind === "we_talked" && a.personId) {
      setBusy(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("contact_logs").insert({
        owner_id: user.id,
        person_id: a.personId,
        method: "we_talked",
      });
      await supabase
        .from("people")
        .update({ last_contact: new Date().toISOString().slice(0, 10) })
        .eq("id", a.personId);
      setBusy(false);
      setNote("Logged. Counter reset to today.");
      router.refresh();
    }
  }

  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-soft text-lg">
        {item.icon}
      </div>
      <div className="flex-1">
        <p className="text-[15px] leading-snug">{item.text}</p>
        <p className="mt-1 text-xs text-sub">{item.meta}</p>
        {note ? (
          <p className="mt-2.5 text-[13px] font-semibold text-brand">✓ {note}</p>
        ) : (
          item.actions &&
          item.actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.actions.map((a) =>
                a.kind === "sms" || a.kind === "link" ? (
                  <a
                    key={a.label}
                    href={
                      a.kind === "sms"
                        ? `sms:?&body=${encodeURIComponent(a.payload ?? "")}`
                        : a.href ?? "#"
                    }
                    target={a.kind === "link" && a.href?.startsWith("https") ? "_blank" : undefined}
                    rel={a.kind === "link" && a.href?.startsWith("https") ? "noreferrer" : undefined}
                    className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold ${
                      a.primary
                        ? "bg-brand text-white"
                        : "bg-blue-soft text-blue-ink"
                    }`}
                  >
                    {a.label}
                  </a>
                ) : (
                  <button
                    key={a.label}
                    disabled={busy}
                    onClick={() => act(a)}
                    className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-50 ${
                      a.primary
                        ? "bg-brand text-white"
                        : "bg-blue-soft text-blue-ink"
                    }`}
                  >
                    {a.label}
                  </button>
                )
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
