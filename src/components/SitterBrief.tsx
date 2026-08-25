"use client";

// Composes a babysitter brief from what FamilyOS knows: kids, allergies,
// pediatrician, food rules, home address, and the nearest hospital, fire
// station, and police station (looked up from the home address via
// OpenStreetMap, no account needed). Fully editable, then text or copy.

import { useEffect, useState } from "react";
import Link from "next/link";

type Kid = {
  id: string;
  name: string;
  birthday: string | null;
  allergies: string | null;
  pediatrician: string | null;
  interests: string | null;
  school: string | null;
  dismissal_time: string | null;
};

type Sitter = { name: string; contact_info: string | null; schedule_note: string | null } | null;

type Emergency = { kind: string; name: string; dist: string };

function ageOf(birthday: string | null): string {
  if (!birthday) return "";
  const b = new Date(birthday + "T00:00:00");
  const years = Math.floor((Date.now() - b.getTime()) / (365.25 * 86400000));
  return years > 0 && years < 25 ? ` (${years})` : "";
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

const AMENITIES: { key: string; label: string }[] = [
  { key: "hospital", label: "Hospital" },
  { key: "fire_station", label: "Fire station" },
  { key: "police", label: "Police" },
];

export default function SitterBrief({
  kids,
  sitter,
  parentName,
  parentPhone = "",
  spouseName = "",
  spousePhone = "",
  address,
  mealNotes,
}: {
  kids: Kid[];
  sitter: Sitter;
  parentName: string;
  parentPhone?: string;
  spouseName?: string;
  spousePhone?: string;
  address: string;
  mealNotes: string;
}) {
  const [emergency, setEmergency] = useState<Emergency[] | null>(null);
  const [emergencyState, setEmergencyState] = useState<"loading" | "done" | "none">(
    address.trim() ? "loading" : "none"
  );
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  // Look up the nearest hospital / fire station / police from home.
  useEffect(() => {
    if (!address.trim()) return;
    let cancelled = false;
    (async () => {
      try {
        const geo = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address.trim())}`
        ).then((r) => r.json());
        if (!geo?.[0]) throw new Error("geocode");
        const lat = parseFloat(geo[0].lat);
        const lon = parseFloat(geo[0].lon);
        const q = `[out:json][timeout:12];(nwr[amenity~"hospital|fire_station|police"][name](around:12000,${lat},${lon}););out center 60;`;
        const data = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: "data=" + encodeURIComponent(q),
        }).then((r) => r.json());
        const found: Emergency[] = [];
        for (const a of AMENITIES) {
          let best: { name: string; d: number } | null = null;
          for (const el of data.elements ?? []) {
            if (el.tags?.amenity !== a.key || !el.tags?.name) continue;
            const elat = el.lat ?? el.center?.lat;
            const elon = el.lon ?? el.center?.lon;
            if (elat == null) continue;
            const d = miles(lat, lon, elat, elon);
            if (!best || d < best.d) best = { name: el.tags.name, d };
          }
          if (best) found.push({ kind: a.label, name: best.name, dist: `${best.d.toFixed(1)} mi` });
        }
        if (!cancelled) {
          setEmergency(found);
          setEmergencyState("done");
        }
      } catch {
        if (!cancelled) setEmergencyState("none");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  // Compose the brief once emergency lookup settles (or immediately without one).
  useEffect(() => {
    if (emergencyState === "loading") return;
    const lines: string[] = [];
    lines.push(`Sitter notes${parentName ? ` from ${parentName}` : ""}:`);
    if (address.trim()) lines.push(`Home: ${address.trim()}`);
    lines.push("");
    for (const k of kids) {
      const bits: string[] = [];
      if (k.allergies) bits.push(`ALLERGIES: ${k.allergies}`);
      if (k.pediatrician) bits.push(`pediatrician ${k.pediatrician}`);
      if (k.interests) bits.push(`into ${k.interests.toLowerCase()}`);
      lines.push(`${k.name}${ageOf(k.birthday)}${bits.length ? ": " + bits.join(". ") : ""}`);
    }
    if (mealNotes.trim()) {
      lines.push("");
      lines.push(`Food rules: ${mealNotes.trim()}`);
    }
    lines.push("");
    lines.push("Emergency: call 911 first, then us.");
    for (const e of emergency ?? []) {
      lines.push(`${e.kind}: ${e.name} (${e.dist})`);
    }
    const numbers: string[] = [];
    if (parentPhone.trim())
      numbers.push(`${parentName || "Parent"}: ${parentPhone.trim()}`);
    if (spousePhone.trim())
      numbers.push(`${spouseName || "Partner"}: ${spousePhone.trim()}`);
    lines.push(
      numbers.length
        ? `Our numbers: ${numbers.join(" / ")}`
        : "Our numbers: [add yours in your profile and the partner's page]"
    );
    setText(lines.join("\n"));
  }, [emergencyState, emergency, kids, parentName, parentPhone, spouseName, spousePhone, address, mealNotes]);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="space-y-4">
      {kids.length === 0 && (
        <p className="rounded-2xl border border-line bg-white p-4 text-sm text-sub">
          No kids on file yet. Add them in{" "}
          <Link href="/people" className="font-semibold text-blue-ink">
            People
          </Link>{" "}
          and this page writes itself.
        </p>
      )}

      {emergencyState === "loading" && (
        <p className="text-[13px] font-medium text-blue-ink">
          Finding the nearest hospital, fire station, and police to home...
        </p>
      )}
      {emergencyState === "none" && !address.trim() && (
        <p className="rounded-2xl border border-line bg-white p-4 text-[13px] text-sub">
          Add your home address in{" "}
          <Link href="/profile" className="font-semibold text-blue-ink">
            your profile
          </Link>{" "}
          and the nearest hospital, fire station, and police get pulled in
          automatically.
        </p>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-72 w-full rounded-2xl border-[1.5px] border-line bg-white p-4 text-sm leading-relaxed outline-none focus:border-brand"
      />

      <div className="flex flex-wrap gap-2">
        <a
          href={`sms:${sitter?.contact_info?.replace(/[^+\d]/g, "") ?? ""}?&body=${encodeURIComponent(text)}`}
          className="rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white"
        >
          {sitter ? `Text ${sitter.name.split(" ")[0]}` : "Text it"}
        </a>
        <button
          onClick={copy}
          className="rounded-lg bg-blue-soft px-4 py-2.5 text-[13px] font-semibold text-blue-ink"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        <Link
          href="/people"
          className="rounded-lg px-3 py-2.5 text-[13px] font-semibold text-sub"
        >
          Edit kid details ›
        </Link>
      </div>
      <p className="text-xs text-sub">
        Nothing sends until you hit send in your messages app.
      </p>
    </div>
  );
}
