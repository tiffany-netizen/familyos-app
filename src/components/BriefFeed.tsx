"use client";

// Renders the day's brief and drops any card whose time has passed,
// in the reader's own timezone. Routine cards clear themselves; no
// checking off required.

import { useEffect, useState } from "react";
import type { BriefItem } from "@/lib/brief";
import BriefCard from "@/components/BriefCard";

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function BriefFeed({ items }: { items: BriefItem[] }) {
  const [now, setNow] = useState(nowHHMM());

  // Keep the feed honest if the page sits open across a card's expiry.
  useEffect(() => {
    const t = setInterval(() => setNow(nowHHMM()), 60000);
    return () => clearInterval(t);
  }, []);

  const visible = items.filter((it) => !it.until || it.until >= now);
  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((b, i) => (
        <BriefCard key={b.key ?? i} item={b} />
      ))}
    </>
  );
}
