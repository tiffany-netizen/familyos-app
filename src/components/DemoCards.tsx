"use client";

import DateNightPlanner from "@/components/DateNightPlanner";
import { useState } from "react";
import Link from "next/link";
import { openTableUrl } from "@/lib/brief";

const FALLBACK: Record<string, { name: string; dist: string }[]> = {
  Cheap: [
    { name: "Taco Loco", dist: "" },
    { name: "Nonna's Slice House", dist: "" },
    { name: "The Noodle Bar", dist: "" },
  ],
  Mid: [
    { name: "Osteria Nella", dist: "" },
    { name: "Harvest Table", dist: "" },
    { name: "Blue Fin Sushi", dist: "" },
  ],
  Pricey: [
    { name: "Vinoteca", dist: "" },
    { name: "The Grove Steakhouse", dist: "" },
    { name: "Chez Camille", dist: "" },
  ],
};

const CHEAP_CUISINES = ["burger", "pizza", "mexican", "sandwich", "chicken", "kebab", "noodle", "taco"];
const PRICEY_CUISINES = ["french", "japanese", "steak", "steak_house", "seafood", "sushi", "fine_dining"];

type Spot = { name: string; dist: string; tier: string };

// "412 Maple Ave, Montclair, NJ" -> "Montclair"; "Montclair, NJ" -> "Montclair"
function cityOf(addr: string): string {
  const parts = addr.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 2];
  if (parts.length === 2) return parts[0];
  return addr.trim();
}

function miles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function DateNightCard({
  spouseName,
  homeCity,
}: {
  spouseName: string;
  homeCity?: string | null;
}) {
  const [tier, setTier] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [locState, setLocState] = useState<"idle" | "finding" | "live" | "fallback">("idle");

  async function useLocation() {
    setLocState("finding");
    try {
      let lat: number;
      let lon: number;
      // The home town from onboarding wins; browser location is the fallback.
      if (homeCity && homeCity.trim()) {
        const geo = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(homeCity.trim())}`
        ).then((r) => r.json());
        if (!geo?.[0]) throw new Error("geocode");
        lat = parseFloat(geo[0].lat);
        lon = parseFloat(geo[0].lon);
      } else {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, {
            timeout: 10000,
            maximumAge: 300000,
          })
        );
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      }
      const q = `[out:json][timeout:10];(node[amenity~"restaurant|fast_food"][name](around:5000,${lat},${lon}););out body 80;`;
      const r = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: "data=" + encodeURIComponent(q),
      });
      const data = await r.json();
      const seen = new Set<string>();
      const found: Spot[] = [];
      for (const el of data.elements ?? []) {
        const name = el.tags?.name;
        if (!name || seen.has(name)) continue;
        seen.add(name);
        const cuisine = (el.tags?.cuisine ?? "").toLowerCase();
        let t = "Mid";
        if (
          el.tags?.amenity === "fast_food" ||
          CHEAP_CUISINES.some((c) => cuisine.includes(c))
        )
          t = "Cheap";
        else if (PRICEY_CUISINES.some((c) => cuisine.includes(c))) t = "Pricey";
        const d = miles(lat, lon, el.lat, el.lon);
        found.push({ name, dist: `${d.toFixed(1)} mi`, tier: t });
      }
      found.sort((a, b) => parseFloat(a.dist) - parseFloat(b.dist));
      if (found.length === 0) throw new Error("none");
      setSpots(found);
      setLocState("live");
    } catch {
      setSpots(null);
      setLocState("fallback");
    }
  }

  function listFor(t: string): { name: string; dist: string }[] {
    if (spots) {
      const l = spots.filter((s) => s.tier === t).slice(0, 4);
      return l.length ? l : spots.slice(0, 4);
    }
    return FALLBACK[t];
  }

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
          <p className="mt-1 text-xs text-sub">
            husband ·{" "}
            {locState === "live"
              ? homeCity && homeCity.trim()
                ? `restaurants near ${cityOf(homeCity)}`
                : "restaurants near you"
              : locState === "fallback"
                ? "sample list (location unavailable)"
                : "standing priority"}
          </p>

          <DateNightPlanner />
          {booked ? (
            <div className="mt-2.5">
              <p className="text-[13px] font-semibold text-brand">
                ✓ {booked} it is.
              </p>
              <a
                href={openTableUrl(booked)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white"
              >
                Check tables on OpenTable ›
              </a>
              <button
                onClick={() => setBooked(null)}
                className="ml-2 text-[13px] font-semibold text-sub"
              >
                Pick another
              </button>
            </div>
          ) : (
            <>
              {locState === "idle" && (
                <button
                  onClick={useLocation}
                  className="mt-3 rounded-lg bg-blue-soft px-3.5 py-2 text-[13px] font-semibold text-blue-ink"
                >
                  📍 {homeCity && homeCity.trim() ? `Find restaurants near home (${cityOf(homeCity)})` : "Find restaurants near me"}
                </button>
              )}
              {locState === "finding" && (
                <p className="mt-3 text-[13px] font-semibold text-blue-ink">
                  Finding spots near you...
                </p>
              )}
              {(locState === "live" || locState === "fallback") && (
                <div className="mt-3 flex gap-2">
                  {["Cheap", "Mid", "Pricey"].map((t) => (
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
              )}
              {tier && locState !== "idle" && locState !== "finding" && (
                <div className="mt-3 space-y-1.5">
                  {listFor(tier).map((r) => (
                    <button
                      key={r.name}
                      onClick={() => setBooked(r.name)}
                      className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2 text-left text-[13px] font-medium"
                    >
                      <span>{r.name}</span>
                      {r.dist && <span className="text-xs text-sub">{r.dist}</span>}
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
          remember? A gift hint, a toy they loved, something they said? And on
          Sundays, update your week: school runs, dinner nights, what&apos;s
          coming.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => window.dispatchEvent(new Event("open-memory"))}
            className="rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white"
          >
            Tell me something
          </button>
          <Link
            href="/weekly"
            className="rounded-lg bg-blue-soft px-3.5 py-2 text-[13px] font-semibold text-blue-ink"
          >
            Update my week
          </Link>
        </div>
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
