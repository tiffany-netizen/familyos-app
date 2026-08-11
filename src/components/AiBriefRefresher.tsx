"use client";

// Quietly upgrades the rule-based brief to the AI-written one.
// Renders a small "writing your brief" hint while Claude works, then
// refreshes the page so the server picks up the cached AI brief.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AiBriefRefresher() {
  const router = useRouter();
  const [state, setState] = useState<"working" | "done" | "off">("working");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai/brief", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data?.source === "ai" || data?.source === "cache") {
          setState("done");
          router.refresh();
        } else {
          setState("off");
        }
      } catch {
        if (!cancelled) setState("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state !== "working") return null;
  return (
    <p className="mb-3 flex items-center gap-2 text-xs font-medium text-sub">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand" />
      Writing today&apos;s brief from everything I know...
    </p>
  );
}
