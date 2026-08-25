"use client";

// "What's new" walkthrough: speech-bubble callouts that walk a tester
// through each screen and point out what the app can do. Shows once per
// tour version, then stays quiet. Replay from the profile page.

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// Bump this string when the tour content changes and everyone sees the
// new tour exactly once.
export const TOUR_VERSION = "2026-08-25";
const KEY = `fos_tour_${TOUR_VERSION}`;

type Step = {
  path: string;
  kicker: string;
  title: string;
  text: string;
};

const STEPS: Step[] = [
  {
    path: "/today",
    kicker: "Today",
    title: "Your brief thinks ahead",
    text: "Cards are short headlines now; tap + for detail and actions. It plans the night before, drafts texts, and takes standing orders you write (or speak) in your profile.",
  },
  {
    path: "/today",
    kicker: "Today",
    title: "Just tell it things",
    text: "Type a memory like \"Jackson has practice Mon and Wed at 4\" and it offers to add it to your week, your Google Calendar, and asks who the coach is.",
  },
  {
    path: "/digest",
    kicker: "WeekOS",
    title: "The whole week, one glance",
    text: "Family calendar events, school runs, sports, holidays, and likely no-school days. Work events fold away; hit \"Add to week\" on any that belong.",
  },
  {
    path: "/todos",
    kicker: "To-dOS",
    title: "A list that sorts itself",
    text: "Type \"call dentist tomorrow\" and it files the due date, categorizes it, links the person, and suggests a first move. Snooze what can wait.",
  },
  {
    path: "/people",
    kicker: "PeopleOS",
    title: "Everyone in one place",
    text: "Profiles remember birthdays, sizes, allergies, teachers, and gift ideas. Your own profile lives here too. Schools are map-searched so calendar events get real addresses.",
  },
  {
    path: "/meals",
    kicker: "MealOS",
    title: "Dinner, handled",
    text: "Save recipes from sites that import cleanly, build the week's plan, and the shopping list writes itself.",
  },
  {
    path: "/home-hub",
    kicker: "HomeOS",
    title: "The house on autopilot",
    text: "Filters, gutters, smoke alarms: recurring upkeep with reminders before things break.",
  },
  {
    path: "/sitter",
    kicker: "Sitter brief",
    title: "One tap, sitter's ready",
    text: "Kids youngest to oldest with ages, allergies, routines, your numbers, and the address. Text it straight to the sitter.",
  },
  {
    path: "/profile",
    kicker: "Profile",
    title: "Make it yours",
    text: "Write or dictate standing orders for your morning brief, set your clock format, and reply to the brief email to file things hands-free.",
  },
];

export default function FeatureTour() {
  const pathname = usePathname();
  const router = useRouter();
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      return;
    }
    // Only start on real app screens, never on auth or onboarding.
    if (["/login", "/signup", "/onboarding", "/"].includes(pathname)) return;
    const t = setTimeout(() => setStep(0), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (step === null) return null;
  const s = STEPS[step];
  if (!s) return null;

  function finish() {
    try {
      localStorage.setItem(KEY, "done");
    } catch {}
    setStep(null);
  }

  function go(n: number) {
    const next = STEPS[n];
    if (!next) {
      finish();
      return;
    }
    setStep(n);
    if (next.path !== pathname) router.push(next.path);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pb-24">
      <div className="mx-auto w-full max-w-md px-5">
        <div className="relative rounded-2xl border-[1.5px] border-brand bg-white p-4 shadow-lg">
          {/* Speech-bubble tail pointing at the nav below */}
          <div className="absolute -bottom-[9px] left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b-[1.5px] border-r-[1.5px] border-brand bg-white" />
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-sub">
              {s.kicker} · {step + 1} of {STEPS.length}
            </p>
            <button
              onClick={finish}
              aria-label="Close tour"
              className="-mr-1 -mt-1 px-1 text-sub"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 font-semibold">{s.title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-sub">{s.text}</p>
          <div className="mt-3 flex items-center justify-between">
            <button onClick={finish} className="text-xs font-semibold text-sub">
              Skip tour
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  onClick={() => go(step - 1)}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold"
                >
                  Back
                </button>
              )}
              <button
                onClick={() => go(step + 1)}
                className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                {step + 1 === STEPS.length ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// A small "replay the tour" link for the profile page.
export function TourReplay() {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        try {
          localStorage.removeItem(KEY);
        } catch {}
        router.push("/today");
        // A hard refresh restarts the tour effect cleanly.
        setTimeout(() => window.location.reload(), 50);
      }}
      className="mt-4 w-full rounded-xl border border-line py-3 text-sm font-semibold text-sub"
    >
      Show me around the app again
    </button>
  );
}
