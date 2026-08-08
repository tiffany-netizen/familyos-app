"use client";

import { useState } from "react";

const RESTAURANTS: Record<string, string[]> = {
  Cheap: ["Taco Loco (0.8 mi)", "Nonna's Slice House", "The Noodle Bar"],
  Mid: ["Osteria Nella", "Harvest Table", "Blue Fin Sushi"],
  Pricey: ["Vinoteca", "The Grove Steakhouse", "Chez Camille"],
};

export function DateNightCard({ spouseName }: { spouseName: string }) {
  const [tier, setTier] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-soft text-lg">
          ❤️
        </div>
        <div className="flex-1">
          <p className="text-[15px] leading-snug">
            <b>Date night with {spouseName}.</b> Pick a lane and I&apos;ll pull
            options nearby.
          </p>
          <p className="mt-1 text-xs text-sub">husband · standing priority</p>

          {booked ? (
            <p className="mt-2.5 text-[13px] font-semibold text-brand">
              ✓ {booked} it is. Real booking arrives in the next update, so
              lock it in the old-fashioned way for now.
            </p>
          ) : (
            <>
              <div className="mt-3 flex gap-2">
                {Object.keys(RESTAURANTS).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTier(t)}
                    className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold ${
                      tier === t
                        ? "bg-brand text-white"
                        : "bg-blue-soft text-blue-ink"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {tier && (
                <div className="mt-3 space-y-1.5">
                  {RESTAURANTS[tier].map((r) => (
                    <button
                      key={r}
                      onClick={() => setBooked(r)}
                      className="block w-full rounded-lg border border-line px-3 py-2 text-left text-[13px] font-medium"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
              <a
                href={`sms:?&body=${encodeURIComponent(
                  `Thinking about you. Date night soon? ❤️`
                )}`}
                className="mt-3 inline-block text-[13px] font-semibold text-blue-ink"
              >
                Or just send {spouseName} a sweet text ›
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function HealthCard() {
  const [connected, setConnected] = useState(false);
  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-soft text-lg">
        😴
      </div>
      <div className="flex-1">
        <p className="text-[15px] leading-snug">
          <b>You averaged 5h 58m of sleep this week.</b> A little more tonight
          wouldn&apos;t hurt.
        </p>
        <p className="mt-1 text-xs text-sub">personal · preview with sample data</p>
        {connected ? (
          <p className="mt-2.5 text-[13px] font-semibold text-brand">
            ✓ Noted. Real sleep and activity sync lands with the phone app.
          </p>
        ) : (
          <button
            onClick={() => setConnected(true)}
            className="mt-3 rounded-lg bg-blue-soft px-3.5 py-2 text-[13px] font-semibold text-blue-ink"
          >
            Connect health data
          </button>
        )}
      </div>
    </div>
  );
}

export function CheckinCard() {
  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-soft text-lg">
        ✍️
      </div>
      <div className="flex-1">
        <p className="text-[15px] leading-snug">
          <b>Weekly check-in.</b> Anything come up this week you want me to
          remember? A gift hint, a toy they loved, something they said?
        </p>
        <button
          onClick={() => window.dispatchEvent(new Event("open-memory"))}
          className="mt-3 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white"
        >
          Tell me something
        </button>
      </div>
    </div>
  );
}

export function ReferralCard() {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = "https://familyos-lac.vercel.app";
    const text =
      "I've been using FamilyOS — it remembers birthdays, gift ideas, and everything else so I don't have to. ";
    if (navigator.share) {
      try {
        await navigator.share({ title: "FamilyOS", text, url });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(text + url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }
  return (
    <div className="rounded-2xl border border-brand-soft bg-brand-soft/40 p-4 text-center">
      <p className="text-sm font-bold">Give a month, get a month</p>
      <p className="mx-auto mt-1 max-w-[260px] text-[13px] leading-relaxed text-sub">
        Every friend who signs up earns you both a free month when FamilyOS
        goes paid.
      </p>
      <button
        onClick={share}
        className="mt-3 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white"
      >
        {copied ? "Link copied!" : "Share FamilyOS"}
      </button>
    </div>
  );
}
