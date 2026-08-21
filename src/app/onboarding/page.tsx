"use client";

// Onboarding v2. One question per screen, visible progress, acknowledgment
// beats, voice input on free-text answers, and it ends by building the
// user's first Family Brief on screen. No partner invite, by decision.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AddressField from "@/components/AddressField";
import type { BriefItem } from "@/lib/brief";

type Kid = {
  name: string;
  birthday: string;
  grade: string;
  school: string;
  teacher: string;
  dismissal: string;
  activities: string;
  allergies: string;
  pediatrician: string;
};

const emptyKid = (): Kid => ({
  name: "",
  birthday: "",
  grade: "",
  school: "",
  teacher: "",
  dismissal: "",
  activities: "",
  allergies: "",
  pediatrician: "",
});

const HOLIDAYS: { label: string; date: string }[] = [
  { label: "Valentine's Day", date: "2027-02-14" },
  { label: "Mother's Day", date: "2027-05-09" },
  { label: "Father's Day", date: "2027-06-20" },
  { label: "Christmas", date: "2026-12-25" },
];

const WEEKDAYS: { n: number; l: string }[] = [
  { n: 1, l: "Mon" },
  { n: 2, l: "Tue" },
  { n: 3, l: "Wed" },
  { n: 4, l: "Thu" },
  { n: 5, l: "Fri" },
];

function Chip({
  on,
  children,
  onClick,
}: {
  on: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border-[1.5px] px-4 py-2.5 text-sm ${
        on ? "border-brand bg-brand-soft font-semibold" : "border-line bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-sub">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border-[1.5px] border-line px-4 py-3 outline-none focus:border-brand"
      />
    </label>
  );
}

type SpeechRecognitionLike = {
  new (): {
    lang: string;
    interimResults: boolean;
    onresult: (e: {
      results: { [i: number]: { [j: number]: { transcript: string } } };
      resultIndex: number;
    }) => void;
    onend: () => void;
    start: () => void;
    stop: () => void;
  };
};

function Mic({ onText }: { onText: (t: string) => void }) {
  const [listening, setListening] = useState(false);
  const [available, setAvailable] = useState(false);
  const recRef = useRef<InstanceType<SpeechRecognitionLike> | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionLike;
      webkitSpeechRecognition?: SpeechRecognitionLike;
    };
    setAvailable(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  if (!available) return null;

  function toggle() {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionLike;
      webkitSpeechRecognition?: SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const t = e.results[e.resultIndex]?.[0]?.transcript ?? "";
      if (t) onText(t);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold ${
        listening ? "bg-red-100 text-red-600" : "bg-blue-soft text-blue-ink"
      }`}
    >
      {listening ? "● Listening... tap to stop" : "🎤 Say it instead"}
    </button>
  );
}

function DayPicker({
  days,
  setDays,
}: {
  days: number[];
  setDays: (d: number[]) => void;
}) {
  return (
    <div className="flex gap-2">
      {WEEKDAYS.map((w) => (
        <Chip
          key={w.n}
          on={days.includes(w.n)}
          onClick={() =>
            setDays(
              days.includes(w.n) ? days.filter((x) => x !== w.n) : [...days, w.n]
            )
          }
        >
          {w.l}
        </Chip>
      ))}
    </div>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [ack, setAck] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // You
  const [yourName, setYourName] = useState("");
  const [yourBirthday, setYourBirthday] = useState("");
  const [homeCity, setHomeCity] = useState("");

  // Partner
  const [married, setMarried] = useState<boolean | null>(null);
  const [spouseName, setSpouseName] = useState("");
  const [spouseBirthday, setSpouseBirthday] = useState("");
  const [anniversary, setAnniversary] = useState("");
  const [customDates, setCustomDates] = useState("");
  const [spouseInterests, setSpouseInterests] = useState("");
  const [works, setWorks] = useState<string | null>(null);
  const [job, setJob] = useState("");
  const [stressNote, setStressNote] = useState("");
  const [sweetText, setSweetText] = useState(true);

  // Kids
  const [kidCount, setKidCount] = useState<number | null>(null);
  const [kids, setKids] = useState<Kid[]>([]);
  const [sitterName, setSitterName] = useState("");
  const [sitterSched, setSitterSched] = useState("");

  // Parents & pets
  const [trackParents, setTrackParents] = useState(true);
  const [momName, setMomName] = useState("");
  const [momBirthday, setMomBirthday] = useState("");
  const [dadName, setDadName] = useState("");
  const [dadBirthday, setDadBirthday] = useState("");
  const [petName, setPetName] = useState("");
  const [petKind, setPetKind] = useState("");

  // Rhythm
  const [holidays, setHolidays] = useState<string[]>(HOLIDAYS.map((h) => h.label));
  const [dateNightDays, setDateNightDays] = useState(14);
  const [mealNotes, setMealNotes] = useState("");
  const [ownsHome, setOwnsHome] = useState<boolean | null>(null);
  const [schoolDays, setSchoolDays] = useState<number[]>([]);
  const [dinnerDays, setDinnerDays] = useState<number[]>([]);
  const [weekExtras, setWeekExtras] = useState("");
  const [briefTime, setBriefTime] = useState("07:00");

  // Finale
  const [finale, setFinale] = useState<"idle" | "saving" | "brief" | "error">("idle");
  const [firstBrief, setFirstBrief] = useState<{ intro: string | null; items: BriefItem[] } | null>(null);
  const savedRef = useRef(false);

  // Prefill your name from signup
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.full_name) setYourName((v) => v || data.full_name);
        });
    });
  }, []);

  const screens = useMemo(() => {
    const s: string[] = ["name", "birthday", "address", "partner"];
    if (married) {
      s.push("partner-name", "partner-dates", "partner-interests", "partner-work");
      if (works && works !== "no") s.push("partner-job");
      s.push("sweet-text");
    }
    s.push("kids-count");
    kids.forEach((_, i) => s.push(`kid-basics-${i}`, `kid-school-${i}`, `kid-life-${i}`));
    if ((kidCount ?? 0) > 0) s.push("sitter");
    s.push("parents", "pet", "holidays", "date-night", "meals", "home", "week", "brief-time", "finale");
    return s;
  }, [married, works, kids, kidCount]);

  const screen = screens[Math.min(idx, screens.length - 1)];
  const progress = Math.min(idx / (screens.length - 1), 1);

  function next(withAck?: string | null) {
    setAck(withAck ?? null);
    setIdx((i) => Math.min(i + 1, screens.length - 1));
  }
  function back() {
    setAck(null);
    setIdx((i) => Math.max(i - 1, 0));
  }
  function pick(setter: () => void, withAck?: string | null) {
    setter();
    setTimeout(() => next(withAck), 220);
  }

  function setKid(i: number, patch: Partial<Kid>) {
    setKids((ks) => ks.map((k, j) => (j === i ? { ...k, ...patch } : k)));
  }

  async function saveEverything() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("You're signed out. Sign in and try again.");

    const people: Record<string, unknown>[] = [];
    if (married && spouseName) {
      people.push({
        owner_id: user.id,
        name: spouseName,
        relationship: "spouse",
        birthday: spouseBirthday || null,
        interests: spouseInterests || null,
        works: works || null,
        job: job || null,
        stress_note: stressNote || null,
      });
    }
    kids.forEach((k) => {
      if (!k.name) return;
      people.push({
        owner_id: user.id,
        name: k.name,
        relationship: "child",
        birthday: k.birthday || null,
        grade: k.grade || null,
        school: k.school || null,
        teacher_name: k.teacher || null,
        dismissal_time: k.dismissal || null,
        interests: k.activities || null,
        allergies: k.allergies || null,
        pediatrician: k.pediatrician || null,
      });
    });
    if (trackParents) {
      if (momName)
        people.push({ owner_id: user.id, name: momName, relationship: "parent", birthday: momBirthday || null });
      if (dadName)
        people.push({ owner_id: user.id, name: dadName, relationship: "parent", birthday: dadBirthday || null });
    }
    if (petName)
      people.push({ owner_id: user.id, name: petName, relationship: "pet", breed: petKind || null });

    let spouseId: string | null = null;
    if (people.length) {
      const KEYS = [
        "owner_id","name","relationship","birthday","grade","school",
        "teacher_name","dismissal_time","interests","allergies","pediatrician",
        "breed","works","job","stress_note",
      ];
      const normalized = people.map((p) =>
        Object.fromEntries(KEYS.map((k) => [k, p[k] ?? null]))
      );
      const { data, error: e1 } = await supabase
        .from("people")
        .insert(normalized)
        .select("id, relationship");
      if (e1) throw e1;
      spouseId = data?.find((p) => p.relationship === "spouse")?.id ?? null;
    }

    const dates: Record<string, unknown>[] = [];
    if (anniversary)
      dates.push({
        owner_id: user.id,
        person_id: spouseId,
        label: "Anniversary",
        date_value: anniversary,
        lead_time_days: 30,
      });
    HOLIDAYS.filter((h) => holidays.includes(h.label)).forEach((h) =>
      dates.push({ owner_id: user.id, label: h.label, date_value: h.date, lead_time_days: 30 })
    );
    customDates
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((label) =>
        dates.push({
          owner_id: user.id,
          person_id: spouseId,
          label,
          date_value: anniversary || new Date().toISOString().slice(0, 10),
          lead_time_days: 14,
        })
      );
    if (dates.length) {
      const { error: e2 } = await supabase.from("tracked_dates").insert(dates);
      if (e2) throw e2;
    }

    const routines: Record<string, unknown>[] = [];
    if (schoolDays.length)
      routines.push({
        owner_id: user.id,
        kind: "school_run",
        label: "School drop-off / pick-up",
        days: [...schoolDays].sort().join(","),
      });
    if (dinnerDays.length)
      routines.push({
        owner_id: user.id,
        kind: "dinner",
        label: "Dinner duty",
        days: [...dinnerDays].sort().join(","),
      });
    if (routines.length) {
      const { error: e3 } = await supabase.from("routines").insert(routines);
      if (e3) throw e3;
    }

    const extras = weekExtras
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (extras.length) {
      const { error: e4 } = await supabase
        .from("todos")
        .insert(extras.map((t) => ({ owner_id: user.id, title: t })));
      if (e4) throw e4;
    }

    if (sitterName.trim()) {
      const { error: e5 } = await supabase.from("service_providers").insert({
        owner_id: user.id,
        name: sitterName.trim(),
        kind: "babysitter",
        schedule_note: sitterSched.trim() || null,
      });
      if (e5) throw e5;
    }

    const { error: e6 } = await supabase
      .from("profiles")
      .update({
        onboarded: true,
        ...(yourName.trim() ? { full_name: yourName.trim() } : {}),
        birthday: yourBirthday || null,
        home_address: homeCity.trim() || null,
        date_night_frequency_days: dateNightDays,
        sweet_text_optin: married ? sweetText : false,
        meal_notes: mealNotes.trim() || null,
        owns_home: ownsHome,
        brief_time: briefTime || "07:00",
      })
      .eq("id", user.id);
    if (e6) throw e6;
  }

  // Entering the finale saves everything, then builds the first brief.
  useEffect(() => {
    if (screen !== "finale" || savedRef.current) return;
    savedRef.current = true;
    setFinale("saving");
    (async () => {
      try {
        await saveEverything();
        try {
          const res = await fetch("/api/ai/brief", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ force: true }),
          });
          const data = await res.json().catch(() => null);
          if (res.ok && Array.isArray(data?.items) && data.items.length) {
            setFirstBrief({ intro: data.intro ?? null, items: data.items });
            setFinale("brief");
            return;
          }
        } catch {}
        // AI unavailable: still done, straight to Today.
        router.push("/today");
        router.refresh();
      } catch (err) {
        savedRef.current = false;
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setFinale("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const kidIdx = screen.startsWith("kid-") ? parseInt(screen.split("-")[2], 10) : -1;
  const kid = kidIdx >= 0 ? kids[kidIdx] : null;
  const spouseFirst = spouseName.split(" ")[0] || "your partner";

  const NextBtn = ({ label = "Next", disabled = false, onClick, }: { label?: string; disabled?: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-auto w-full rounded-xl bg-brand py-4 font-semibold text-white disabled:opacity-50"
    >
      {label}
    </button>
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-7 py-8">
      {screen !== "finale" && (
        <>
          <div className="mb-2 flex items-center gap-3">
            {idx > 0 ? (
              <button onClick={back} aria-label="Back" className="text-lg font-semibold text-sub">
                ‹
              </button>
            ) : (
              <span className="w-3" />
            )}
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-brand transition-all duration-300"
                style={{ width: `${Math.max(progress * 100, 3)}%` }}
              />
            </div>
          </div>
          {ack && (
            <p className="mb-3 mt-2 rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand">
              ✓ {ack}
            </p>
          )}
        </>
      )}

      {screen === "name" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">What should I call you?</h1>
          <p className="mb-5 text-sub">Your brief gets written for you, by name.</p>
          <Field label="Your name" value={yourName} onChange={setYourName} placeholder="Jamie" />
          <NextBtn disabled={!yourName.trim()} onClick={() => next()} />
        </section>
      )}

      {screen === "birthday" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">When's your birthday?</h1>
          <p className="mb-5 text-sub">Goes on the calendar like everyone else&apos;s.</p>
          <Field label="Your birthday" type="date" value={yourBirthday} onChange={setYourBirthday} />
          <NextBtn onClick={() => next()} />
        </section>
      )}

      {screen === "address" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">Where's home?</h1>
          <p className="mb-5 text-sub">
            Powers restaurant picks, sitters, and plans near you. Never shared.
          </p>
          <AddressField
            label="Home address"
            value={homeCity}
            onChange={setHomeCity}
            placeholder="Start typing your address..."
            hint="Pick from the suggestions."
          />
          <NextBtn
            onClick={() => next(homeCity.trim() ? "Restaurants and plans will point near home." : null)}
            label={homeCity.trim() ? "Next" : "Skip for now"}
          />
        </section>
      )}

      {screen === "partner" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">Are you married or partnered?</h1>
          <p className="mb-5 text-sub">FamilyOS helps you show up for them, consistently.</p>
          <div className="flex gap-2">
            <Chip on={married === true} onClick={() => pick(() => setMarried(true))}>Yes</Chip>
            <Chip on={married === false} onClick={() => pick(() => setMarried(false))}>No</Chip>
          </div>
        </section>
      )}

      {screen === "partner-name" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">What's their name?</h1>
          <p className="mb-5 text-sub">First name is plenty.</p>
          <Field label="Partner's name" value={spouseName} onChange={setSpouseName} placeholder="Sarah" />
          <NextBtn disabled={!spouseName.trim()} onClick={() => next()} />
        </section>
      )}

      {screen === "partner-dates" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">{spouseFirst}&apos;s big dates</h1>
          <p className="mb-5 text-sub">The two I should never let you miss, plus any extras.</p>
          <div className="space-y-4">
            <Field label="Their birthday" type="date" value={spouseBirthday} onChange={setSpouseBirthday} />
            <Field label="Anniversary" type="date" value={anniversary} onChange={setAnniversary} />
            <Field
              label="Other dates to track (comma separated)"
              value={customDates}
              onChange={setCustomDates}
              placeholder="First date, proposal day"
            />
          </div>
          <NextBtn onClick={() => next()} />
        </section>
      )}

      {screen === "partner-interests" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">What&apos;s {spouseFirst} into?</h1>
          <p className="mb-5 text-sub">
            Hobbies, favorites, dream trips. This feeds gift ideas and date plans all year.
          </p>
          <textarea
            value={spouseInterests}
            onChange={(e) => setSpouseInterests(e.target.value)}
            placeholder="Wine, working out, Italy someday..."
            className="min-h-24 w-full rounded-xl border-[1.5px] border-line p-4 outline-none focus:border-brand"
          />
          <Mic onText={(t) => setSpouseInterests((v) => (v ? v + " " : "") + t)} />
          <NextBtn
            onClick={() =>
              next(
                spouseInterests.trim()
                  ? `Got it. I'll start watching for gift ideas around ${spouseInterests.split(",")[0].trim().toLowerCase()}.`
                  : null
              )
            }
            label={spouseInterests.trim() ? "Next" : "Skip for now"}
          />
        </section>
      )}

      {screen === "partner-work" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">Does {spouseFirst} work?</h1>
          <p className="mb-5 text-sub">Work rhythm shapes the week.</p>
          <div className="flex gap-2">
            {[["full", "Full time"], ["part", "Part time"], ["no", "No"]].map(([v, l]) => (
              <Chip key={v} on={works === v} onClick={() => pick(() => setWorks(v))}>
                {l}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {screen === "partner-job" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">What do they do?</h1>
          <p className="mb-5 text-sub">
            And the stressful moments worth a good-luck text.
          </p>
          <div className="space-y-4">
            <Field label="Their job" value={job} onChange={setJob} placeholder="Nurse, teacher, sales..." />
            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-sub">
                Stressful recurring moments
              </span>
              <textarea
                value={stressNote}
                onChange={(e) => setStressNote(e.target.value)}
                placeholder="Monday presentations, end of quarter..."
                className="min-h-20 w-full rounded-xl border-[1.5px] border-line p-4 outline-none focus:border-brand"
              />
              <Mic onText={(t) => setStressNote((v) => (v ? v + " " : "") + t)} />
            </div>
          </div>
          <NextBtn onClick={() => next()} />
        </section>
      )}

      {screen === "sweet-text" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">Random weekly sweet-text nudge?</h1>
          <p className="mb-5 text-sub">
            Once a week, on a day {spouseFirst} won&apos;t see coming, I&apos;ll hand you a
            drafted text. Impromptu beats planned.
          </p>
          <div className="flex gap-2">
            <Chip
              on={sweetText}
              onClick={() =>
                pick(() => setSweetText(true), "I'll pick a random weekday each week and draft it fresh.")
              }
            >
              Yes please
            </Chip>
            <Chip on={!sweetText} onClick={() => pick(() => setSweetText(false))}>
              No thanks
            </Chip>
          </div>
        </section>
      )}

      {screen === "kids-count" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">How many kids do you have?</h1>
          <p className="mb-5 text-sub">Each one gets their own memory bank.</p>
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map((n) => (
              <Chip
                key={n}
                on={kidCount === n}
                onClick={() =>
                  pick(() => {
                    setKidCount(n);
                    setKids((ks) => {
                      const copy = ks.slice(0, n);
                      while (copy.length < n) copy.push(emptyKid());
                      return copy;
                    });
                  })
                }
              >
                {n === 0 ? "None" : n}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {kid && screen === `kid-basics-${kidIdx}` && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">
            {kidIdx === 0 ? "Tell me about kid #1" : `Kid #${kidIdx + 1}`}
          </h1>
          <p className="mb-5 text-sub">Name and birthday to start.</p>
          <div className="space-y-4">
            <Field label="Name" value={kid.name} onChange={(v) => setKid(kidIdx, { name: v })} />
            <Field label="Birthday" type="date" value={kid.birthday} onChange={(v) => setKid(kidIdx, { birthday: v })} />
          </div>
          <NextBtn disabled={!kid.name.trim()} onClick={() => next()} />
        </section>
      )}

      {kid && screen === `kid-school-${kidIdx}` && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">{kid.name || "Their"}&apos;s school life</h1>
          <p className="mb-5 text-sub">
            Dismissal time powers the school-run reminders every weekday.
          </p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="School" value={kid.school} onChange={(v) => setKid(kidIdx, { school: v })} placeholder="Lincoln Elementary" />
              <Field label="Grade this fall" value={kid.grade} onChange={(v) => setKid(kidIdx, { grade: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Teacher this year" value={kid.teacher} onChange={(v) => setKid(kidIdx, { teacher: v })} placeholder="Mrs. Johnson" />
              <Field label="Dismissal time" type="time" value={kid.dismissal} onChange={(v) => setKid(kidIdx, { dismissal: v })} />
            </div>
          </div>
          <NextBtn onClick={() => next()} />
        </section>
      )}

      {kid && screen === `kid-life-${kidIdx}` && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">{kid.name || "Their"}&apos;s world</h1>
          <p className="mb-5 text-sub">Activities now, and the safety stuff worth having on file.</p>
          <div className="space-y-4">
            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-sub">
                Sports & activities right now
              </span>
              <textarea
                value={kid.activities}
                onChange={(e) => setKid(kidIdx, { activities: e.target.value })}
                placeholder="Soccer this fall, piano on Tuesdays..."
                className="min-h-16 w-full rounded-xl border-[1.5px] border-line p-4 outline-none focus:border-brand"
              />
              <Mic onText={(t) => setKid(kidIdx, { activities: (kid.activities ? kid.activities + " " : "") + t })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Allergies or meds (optional)" value={kid.allergies} onChange={(v) => setKid(kidIdx, { allergies: v })} placeholder="Peanuts" />
              <Field label="Pediatrician (optional)" value={kid.pediatrician} onChange={(v) => setKid(kidIdx, { pediatrician: v })} placeholder="Dr. Lee" />
            </div>
          </div>
          <NextBtn
            onClick={() =>
              next(kid.name ? `${kid.name} is in the system. I've got the school rhythm covered.` : null)
            }
          />
        </section>
      )}

      {screen === "sitter" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">A regular nanny or babysitter?</h1>
          <p className="mb-5 text-sub">Date night plans get easier when I know who to suggest.</p>
          <div className="space-y-4">
            <Field label="Their name (optional)" value={sitterName} onChange={setSitterName} />
            <Field label="Usual schedule" value={sitterSched} onChange={setSitterSched} placeholder="Tue/Thu afternoons" />
          </div>
          <NextBtn onClick={() => next()} label={sitterName.trim() ? "Next" : "Skip for now"} />
        </section>
      )}

      {screen === "parents" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">Want reminders to call your parents?</h1>
          <p className="mb-5 text-sub">Birthdays tracked, and a nudge when it&apos;s been too long.</p>
          <div className="mb-4 flex gap-2">
            <Chip on={trackParents} onClick={() => setTrackParents(true)}>Yes</Chip>
            <Chip on={!trackParents} onClick={() => setTrackParents(false)}>Skip</Chip>
          </div>
          {trackParents && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mom's name" value={momName} onChange={setMomName} />
                <Field label="Her birthday" type="date" value={momBirthday} onChange={setMomBirthday} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Dad's name" value={dadName} onChange={setDadName} />
                <Field label="His birthday" type="date" value={dadBirthday} onChange={setDadBirthday} />
              </div>
            </div>
          )}
          <NextBtn onClick={() => next()} />
        </section>
      )}

      {screen === "pet" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">Any pets?</h1>
          <p className="mb-5 text-sub">Vet visits and food runs get tracked here later.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pet's name (optional)" value={petName} onChange={setPetName} />
            <Field label="What kind?" value={petKind} onChange={setPetKind} placeholder="Golden retriever" />
          </div>
          <NextBtn onClick={() => next()} label={petName.trim() ? "Next" : "Skip for now"} />
        </section>
      )}

      {screen === "holidays" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">Which occasions should I work?</h1>
          <p className="mb-5 text-sub">
            I start planning a month out: table, gift, card, sitter.
          </p>
          <div className="flex flex-wrap gap-2">
            {HOLIDAYS.map((h) => (
              <Chip
                key={h.label}
                on={holidays.includes(h.label)}
                onClick={() =>
                  setHolidays((hs) =>
                    hs.includes(h.label) ? hs.filter((x) => x !== h.label) : [...hs, h.label]
                  )
                }
              >
                {h.label}
              </Chip>
            ))}
          </div>
          <NextBtn onClick={() => next()} />
        </section>
      )}

      {screen === "date-night" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">How often is date night, ideally?</h1>
          <p className="mb-5 text-sub">The brief tracks the gap and calls it out.</p>
          <div className="flex gap-2">
            {[
              { l: "Weekly", d: 7 },
              { l: "Every 2 weeks", d: 14 },
              { l: "Monthly", d: 30 },
            ].map((o) => (
              <Chip key={o.d} on={dateNightDays === o.d} onClick={() => pick(() => setDateNightDays(o.d))}>
                {o.l}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {screen === "meals" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">Any family food rules?</h1>
          <p className="mb-5 text-sub">
            Allergies, no-go foods, the 2-3 dinners everyone actually eats. Dinner
            suggestions will follow them.
          </p>
          <textarea
            value={mealNotes}
            onChange={(e) => setMealNotes(e.target.value)}
            placeholder="No shellfish, Emma won't touch mushrooms, taco night always works..."
            className="min-h-24 w-full rounded-xl border-[1.5px] border-line p-4 outline-none focus:border-brand"
          />
          <Mic onText={(t) => setMealNotes((v) => (v ? v + " " : "") + t)} />
          <NextBtn
            onClick={() => next(mealNotes.trim() ? "Noted. Dinner ideas will respect the food rules." : null)}
            label={mealNotes.trim() ? "Next" : "Skip for now"}
          />
        </section>
      )}

      {screen === "home" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">Do you own or rent?</h1>
          <p className="mb-5 text-sub">
            Owners get home maintenance on the radar. Renters skip it.
          </p>
          <div className="flex gap-2">
            <Chip
              on={ownsHome === true}
              onClick={() => pick(() => setOwnsHome(true), "I'll keep an eye on the house too. Filters, gutters, the stuff nobody remembers.")}
            >
              Own
            </Chip>
            <Chip on={ownsHome === false} onClick={() => pick(() => setOwnsHome(false))}>
              Rent
            </Chip>
          </div>
        </section>
      )}

      {screen === "week" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">Your week</h1>
          <p className="mb-5 text-sub">
            This builds your morning checklist. Update it any Sunday.
          </p>
          <div className="space-y-5">
            {(kidCount ?? 0) > 0 && (
              <div>
                <span className="mb-2 block text-sm font-semibold">
                  School drop-off / pick-up days
                </span>
                <DayPicker days={schoolDays} setDays={setSchoolDays} />
              </div>
            )}
            <div>
              <span className="mb-2 block text-sm font-semibold">Dinner duty nights</span>
              <DayPicker days={dinnerDays} setDays={setDinnerDays} />
            </div>
            <div>
              <span className="mb-2 block text-sm font-semibold">
                Anything else this week?
              </span>
              <textarea
                value={weekExtras}
                onChange={(e) => setWeekExtras(e.target.value)}
                placeholder="School play Tuesday, sign permission slip, order team photos"
                className="min-h-20 w-full rounded-xl border-[1.5px] border-line p-4 outline-none focus:border-brand"
              />
              <Mic onText={(t) => setWeekExtras((v) => (v ? v + " " : "") + t)} />
            </div>
          </div>
          <NextBtn onClick={() => next()} />
        </section>
      )}

      {screen === "brief-time" && (
        <section className="flex flex-1 flex-col pt-4">
          <h1 className="mb-1 text-2xl font-bold">When should your brief arrive?</h1>
          <p className="mb-5 text-sub">
            Your Family Brief is ready in the app every morning, and lands by email
            too.
          </p>
          <input
            type="time"
            value={briefTime}
            onChange={(e) => setBriefTime(e.target.value)}
            className="w-full rounded-xl border-[1.5px] border-line px-4 py-3 text-lg outline-none focus:border-brand"
          />
          <p className="mt-2 text-[13px] text-sub">
            Email currently goes out at 7:00 AM ET; your pick here takes over as
            delivery windows roll out.
          </p>
          <NextBtn label="Build my Family Brief" onClick={() => next()} />
        </section>
      )}

      {screen === "finale" && (
        <section className="flex flex-1 flex-col pt-10">
          {finale === "saving" && (
            <div className="my-auto text-center">
              <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-brand-soft border-t-brand" />
              <h1 className="text-2xl font-bold">Building your first Family Brief...</h1>
              <p className="mt-2 text-sub">
                Reading everything you just told me and writing tomorrow&apos;s plan.
              </p>
            </div>
          )}

          {finale === "brief" && firstBrief && (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest text-sub">
                Your first Family Brief
              </p>
              <h1 className="mt-1 text-2xl font-bold">
                Good morning, {yourName.split(" ")[0] || "there"}
              </h1>
              {firstBrief.intro && (
                <p className="mt-2 text-[15px] leading-relaxed">{firstBrief.intro}</p>
              )}
              <div className="mt-5 space-y-3">
                {firstBrief.items.slice(0, 5).map((b, i) => (
                  <div key={i} className="flex gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-soft text-lg">
                      {b.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-[15px] leading-snug">{b.text}</p>
                      <p className="mt-1 text-xs text-sub">{b.meta}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-sub">
                This is what every morning looks like from now on. The more you tell
                me, the sharper it gets.
              </p>
              <button
                onClick={() => {
                  router.push("/today");
                  router.refresh();
                }}
                className="mt-6 w-full rounded-xl bg-brand py-4 font-semibold text-white"
              >
                Take me to my day
              </button>
            </>
          )}

          {finale === "error" && (
            <div className="my-auto text-center">
              <h1 className="text-2xl font-bold">Hmm, that didn&apos;t save</h1>
              <p className="mt-2 text-sm text-red-600">{error}</p>
              <button
                onClick={() => {
                  setFinale("idle");
                  setIdx(screens.length - 2);
                }}
                className="mt-5 rounded-xl bg-brand px-6 py-3 font-semibold text-white"
              >
                Try again
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
