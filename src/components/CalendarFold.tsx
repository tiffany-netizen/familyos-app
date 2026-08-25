"use client";

// The week view's work/other calendar fold, plus the events the user has
// promoted out of it. Promoting matches on the event title, so a
// recurring "Team standup" promoted once shows every week until it's
// moved back.

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CalLine = { summary: string; line: string };

export default function CalendarFold({
  pinned,
  other,
}: {
  pinned: CalLine[];
  other: CalLine[];
}) {
  const router = useRouter();

  async function promote(summary: string) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("calendar_includes")
      .upsert({ owner_id: user.id, summary }, { onConflict: "owner_id,summary" });
    router.refresh();
  }

  async function demote(summary: string) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("calendar_includes")
      .delete()
      .eq("owner_id", user.id)
      .eq("summary", summary);
    router.refresh();
  }

  if (pinned.length === 0 && other.length === 0) return null;

  return (
    <>
      {pinned.map((p) => (
        <p key={p.line} className="mt-1 flex items-center gap-2 text-sm">
          <span>{p.line} · calendar</span>
          <button
            onClick={() => demote(p.summary)}
            title="Move back to work / other"
            className="text-[11px] font-semibold text-sub"
          >
            ✕
          </button>
        </p>
      ))}
      {other.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer list-none text-[13px] font-semibold text-sub">
            + {other.length} work / other calendar event
            {other.length === 1 ? "" : "s"} ›
          </summary>
          {other.map((o) => (
            <p key={o.line} className="mt-1 flex items-center gap-2 text-[13px] text-sub">
              <span>{o.line}</span>
              <button
                onClick={() => promote(o.summary)}
                className="rounded border border-line px-1.5 py-0.5 text-[11px] font-semibold text-brand"
              >
                Add to week
              </button>
            </p>
          ))}
        </details>
      )}
    </>
  );
}
