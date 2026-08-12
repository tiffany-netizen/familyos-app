"use client";

// Address input with type-ahead suggestions (free Photon/OpenStreetMap
// geocoder, no API key). Swap the fetch for Google Places later if we
// want Google-grade suggestions.

import { useEffect, useRef, useState } from "react";

type PhotonFeature = {
  properties?: {
    housenumber?: string;
    street?: string;
    name?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
};

function format(f: PhotonFeature): string | null {
  const p = f.properties ?? {};
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const line1 = street || p.name || "";
  const city = p.city || p.town || p.village || "";
  const state = p.state || "";
  if (!line1 && !city) return null;
  return [line1, city, state].filter(Boolean).join(", ");
}

export default function AddressField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [sugs, setSugs] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chosen = useRef(false);

  useEffect(() => {
    if (chosen.current) {
      chosen.current = false;
      return;
    }
    if (!value || value.trim().length < 4) {
      setSugs([]);
      setOpen(false);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://photon.komoot.io/api/?limit=5&lang=en&q=${encodeURIComponent(value.trim())}`
        );
        const data = (await r.json()) as { features?: PhotonFeature[] };
        const opts: string[] = [];
        for (const f of data.features ?? []) {
          const s = format(f);
          if (s && !opts.includes(s)) opts.push(s);
        }
        setSugs(opts);
        setOpen(opts.length > 0);
      } catch {
        setSugs([]);
        setOpen(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value]);

  return (
    <div className="relative">
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-sub">
          {label}
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-xl border-[1.5px] border-line px-4 py-3 outline-none focus:border-brand"
        />
      </label>
      {open && sugs.length > 0 && (
        <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-line bg-white shadow-lg">
          {sugs.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={() => {
                chosen.current = true;
                onChange(s);
                setOpen(false);
              }}
              className="block w-full px-4 py-2.5 text-left text-sm hover:bg-blue-soft"
            >
              📍 {s}
            </button>
          ))}
        </div>
      )}
      {hint && <p className="mt-1.5 text-[13px] text-sub">{hint}</p>}
    </div>
  );
}
