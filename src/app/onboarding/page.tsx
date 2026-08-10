"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Kid = {
  name: string;
  birthday: string;
  gender: string;
  grade: string;
  teacher: string;
  bestFriend: string;
  clothingSize: string;
  interests: string;
};

const emptyKid = (): Kid => ({
  name: "",
  birthday: "",
  gender: "",
  grade: "",
  teacher: "",
  bestFriend: "",
  clothingSize: "",
  interests: "",
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
              days.includes(w.n)
                ? days.filter((x) => x !== w.n)
                : [...days, w.n]
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
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 0: spouse
  const [married, setMarried] = useState(true);
  const [spouseName, setSpouseName] = useState("");
  const [spouseBirthday, setSpouseBirthday] = useState("");
  const [anniversary, setAnniversary] = useState("");
  const [spouseInterests, setSpouseInterests] = useState("");
  const [customDates, setCustomDates] = useState("");
  const [works, setWorks] = useState("full");
  const [job, setJob] = useState("");
  const [stressNote, setStressNote] = useState("");
  const [sweetText, setSweetText] = useState(true);

  // Step 1: kids + sitter
  const [kidCount, setKidCount] = useState(0);
  const [kids, setKids] = useState<Kid[]>([]);
  const [kidIndex, setKidIndex] = useState(0);
  const [sitterName, setSitterName] = useState("");
  const [sitterSched, setSitterSched] = useState("");

  // Step 2: parents & pets
  const [trackParents, setTrackParents] = useState(true);
  const [momName, setMomName] = useState("");
  const [momBirthday, setMomBirthday] = useState("");
  const [dadName, setDadName] = useState("");
  const [dadBirthday, setDadBirthday] = useState("");
  const [petName, setPetName] = useState("");
  const [petKind, setPetKind] = useState("");

  // Step 3: reminders
  const [holidays, setHolidays] = useState<string[]>(
    HOLIDAYS.map((h) => h.label)
  );
  const [dateNightDays, setDateNightDays] = useState(14);
  const [giftLists, setGiftLists] = useState(true);

  // Step 4: your week
  const [schoolDays, setSchoolDays] = useState<number[]>([]);
  const [dinnerDays, setDinnerDays] = useState<number[]>([]);
  const [weekExtras, setWeekExtras] = useState("");

  function setKid(i: number, patch: Partial<Kid>) {
    setKids((ks) => ks.map((k, j) => (j === i ? { ...k, ...patch } : k)));
  }

  function chooseKidCount(n: number) {
    setKidCount(n);
    setKids(Array.from({ length: n }, emptyKid));
    setKidIndex(0);
  }

  const steps = ["You", "Kids", "Family", "Reminders", "Your week"];
  const kidStepDone = kidCount === 0 || kidIndex >= kidCount - 1;

  async function finish() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You're signed out. Sign in and try again.");
      setBusy(false);
      return;
    }

    try {
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
          gender: k.gender || null,
          grade: k.grade || null,
          teacher_name: k.teacher || null,
          best_friend: k.bestFriend || null,
          clothing_size: k.clothingSize || null,
          interests: k.interests || null,
        });
      });
      if (trackParents) {
        if (momName)
          people.push({
            owner_id: user.id,
            name: momName,
            relationship: "parent",
            birthday: momBirthday || null,
          });
        if (dadName)
          people.push({
            owner_id: user.id,
            name: dadName,
            relationship: "parent",
            birthday: dadBirthday || null,
          });
      }
      if (petName)
        people.push({
          owner_id: user.id,
          name: petName,
          relationship: "pet",
          breed: petKind || null,
        });

      let spouseId: string | null = null;
      if (people.length) {
        const KEYS = [
          "owner_id","name","relationship","birthday","gender","grade",
          "teacher_name","best_friend","clothing_size","interests","breed",
          "works","job","stress_note",
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
        dates.push({
          owner_id: user.id,
          label: h.label,
          date_value: h.date,
          lead_time_days: 30,
        })
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

      // Weekly routines
      const routines: Record<string, unknown>[] = [];
      if (schoolDays.length)
        routines.push({
          owner_id: user.id,
          kind: "school_run",
          label: "School drop-off / pick-up",
          days: schoolDays.sort().join(","),
        });
      if (dinnerDays.length)
        routines.push({
          owner_id: user.id,
          kind: "dinner",
          label: "Dinner duty",
          days: dinnerDays.sort().join(","),
        });
      if (routines.length) {
        const { error: e3 } = await supabase.from("routines").insert(routines);
        if (e3) throw e3;
      }

      // This week's extras become todos
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

      // Babysitter
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
          date_night_frequency_days: dateNightDays,
          wants_gift_lists: giftLists,
          sweet_text_optin: married ? sweetText : false,
        })
        .eq("id", user.id);
      if (e6) throw e6;

      router.push("/today");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const kid = kids[kidIndex];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-7 py-10">
      <div className="mb-7 flex gap-1.5">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${i <= step ? "bg-brand" : "bg-line"}`}
          />
        ))}
      </div>

      {step === 0 && (
        <section className="flex flex-1 flex-col">
          <h1 className="mb-1 text-2xl font-bold">First, about you</h1>
          <p className="mb-5 text-sub">Are you married or partnered?</p>
          <div className="mb-4 flex gap-2">
            <Chip on={married} onClick={() => setMarried(true)}>Yes</Chip>
            <Chip on={!married} onClick={() => setMarried(false)}>No</Chip>
          </div>
          {married && (
            <div className="space-y-4">
              <Field label="Spouse's name" value={spouseName} onChange={setSpouseName} placeholder="Sarah" />
              <Field label="Their birthday" type="date" value={spouseBirthday} onChange={setSpouseBirthday} />
              <Field label="Anniversary" type="date" value={anniversary} onChange={setAnniversary} />
              <Field label="Their interests" value={spouseInterests} onChange={setSpouseInterests} placeholder="Wine, hiking, Italy" />
              <div>
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-sub">
                  Do they work?
                </span>
                <div className="flex gap-2">
                  {[["full", "Full time"], ["part", "Part time"], ["no", "No"]].map(([v, l]) => (
                    <Chip key={v} on={works === v} onClick={() => setWorks(v)}>{l}</Chip>
                  ))}
                </div>
              </div>
              {works !== "no" && (
                <>
                  <Field label="What do they do?" value={job} onChange={setJob} placeholder="Nurse, teacher, sales..." />
                  <Field
                    label="Stressful moments worth a good-luck text?"
                    value={stressNote}
                    onChange={setStressNote}
                    placeholder="Monday presentations, end of quarter..."
                  />
                </>
              )}
              <div>
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-sub">
                  Random weekly nudge to send them a sweet text?
                </span>
                <p className="mb-2 text-[13px] text-sub">
                  Impromptu surprise texts go a long way.
                </p>
                <div className="flex gap-2">
                  <Chip on={sweetText} onClick={() => setSweetText(true)}>Yes please</Chip>
                  <Chip on={!sweetText} onClick={() => setSweetText(false)}>No thanks</Chip>
                </div>
              </div>
              <Field label="Other dates to track (comma separated)" value={customDates} onChange={setCustomDates} placeholder="First date, proposal day" />
            </div>
          )}
          <button onClick={() => setStep(1)} className="mt-auto w-full rounded-xl bg-brand py-4 font-semibold text-white">
            Next
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-1 flex-col">
          <h1 className="mb-1 text-2xl font-bold">Your kids</h1>
          <p className="mb-5 text-sub">How many kids do you have?</p>
          <div className="mb-4 flex gap-2">
            {[0, 1, 2, 3, 4].map((n) => (
              <Chip key={n} on={kidCount === n} onClick={() => chooseKidCount(n)}>
                {n === 0 ? "None" : n}
              </Chip>
            ))}
          </div>
          {kid && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-blue-ink">
                Kid #{kidIndex + 1} of {kidCount}
              </p>
              <Field label="Name" value={kid.name} onChange={(v) => setKid(kidIndex, { name: v })} />
              <Field label="Birthday" type="date" value={kid.birthday} onChange={(v) => setKid(kidIndex, { birthday: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Gender" value={kid.gender} onChange={(v) => setKid(kidIndex, { gender: v })} />
                <Field label="Grade this fall" value={kid.grade} onChange={(v) => setKid(kidIndex, { grade: v })} />
              </div>
              <Field label="Teacher this year" value={kid.teacher} onChange={(v) => setKid(kidIndex, { teacher: v })} />
              <Field label="Best friend" value={kid.bestFriend} onChange={(v) => setKid(kidIndex, { bestFriend: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Clothing size" value={kid.clothingSize} onChange={(v) => setKid(kidIndex, { clothingSize: v })} />
                <Field label="Sports & interests" value={kid.interests} onChange={(v) => setKid(kidIndex, { interests: v })} />
              </div>
            </div>
          )}
          {kidCount > 0 && kidStepDone && (
            <div className="mt-5 space-y-4 border-t border-line pt-4">
              <p className="text-sm font-semibold">
                Do you have a nanny or babysitter you use regularly?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Their name (optional)" value={sitterName} onChange={setSitterName} />
                <Field label="Usual schedule" value={sitterSched} onChange={setSitterSched} placeholder="Tue/Thu afternoons" />
              </div>
            </div>
          )}
          <div className="mt-auto flex gap-2 pt-6">
            {kidIndex > 0 && (
              <button onClick={() => setKidIndex(kidIndex - 1)} className="rounded-xl border-[1.5px] border-line px-5 py-4 font-semibold text-sub">
                Back
              </button>
            )}
            <button
              onClick={() => (kidStepDone ? setStep(2) : setKidIndex(kidIndex + 1))}
              className="flex-1 rounded-xl bg-brand py-4 font-semibold text-white"
            >
              {kidStepDone ? "Next" : `Next: kid #${kidIndex + 2}`}
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-1 flex-col">
          <h1 className="mb-1 text-2xl font-bold">Parents and pets</h1>
          <p className="mb-5 text-sub">
            Want reminders to call your parents and track their birthdays?
          </p>
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
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pet's name (optional)" value={petName} onChange={setPetName} />
              <Field label="What kind?" value={petKind} onChange={setPetKind} placeholder="Golden retriever" />
            </div>
          </div>
          <button onClick={() => setStep(3)} className="mt-auto w-full rounded-xl bg-brand py-4 font-semibold text-white">
            Next
          </button>
        </section>
      )}

      {step === 3 && (
        <section className="flex flex-1 flex-col">
          <h1 className="mb-1 text-2xl font-bold">Reminders, your way</h1>
          <p className="mb-5 text-sub">
            We start planning 30 days before each date. Tap to include.
          </p>
          <div className="mb-6 flex flex-wrap gap-2">
            {HOLIDAYS.map((h) => (
              <Chip
                key={h.label}
                on={holidays.includes(h.label)}
                onClick={() =>
                  setHolidays((hs) =>
                    hs.includes(h.label)
                      ? hs.filter((x) => x !== h.label)
                      : [...hs, h.label]
                  )
                }
              >
                {h.label}
              </Chip>
            ))}
          </div>
          <p className="mb-2 text-sm font-semibold text-sub">
            How often is date night, ideally?
          </p>
          <div className="mb-6 flex gap-2">
            {[
              { l: "Weekly", d: 7 },
              { l: "Every 2 weeks", d: 14 },
              { l: "Monthly", d: 30 },
            ].map((o) => (
              <Chip key={o.d} on={dateNightDays === o.d} onClick={() => setDateNightDays(o.d)}>
                {o.l}
              </Chip>
            ))}
          </div>
          <p className="mb-2 text-sm font-semibold text-sub">
            Keep a running gift idea list for each person?
          </p>
          <div className="flex gap-2">
            <Chip on={giftLists} onClick={() => setGiftLists(true)}>Yes please</Chip>
            <Chip on={!giftLists} onClick={() => setGiftLists(false)}>No</Chip>
          </div>
          <button onClick={() => setStep(4)} className="mt-auto w-full rounded-xl bg-brand py-4 font-semibold text-white">
            Next
          </button>
        </section>
      )}

      {step === 4 && (
        <section className="flex flex-1 flex-col">
          <h1 className="mb-1 text-2xl font-bold">Your week</h1>
          <p className="mb-5 text-sub">
            Every morning you&apos;ll get a checklist so nothing slips. To build
            it, tell me about this week through Sunday. Each Sunday you can
            update it for the week ahead.
          </p>
          <div className="space-y-5">
            <div>
              <span className="mb-2 block text-sm font-semibold">
                What days are you picking up or dropping kids at school?
              </span>
              <DayPicker days={schoolDays} setDays={setSchoolDays} />
            </div>
            <div>
              <span className="mb-2 block text-sm font-semibold">
                What days do you need to make dinner?
              </span>
              <DayPicker days={dinnerDays} setDays={setDinnerDays} />
            </div>
            <div>
              <span className="mb-2 block text-sm font-semibold">
                Anything else this week you&apos;d like to be reminded of?
              </span>
              <textarea
                value={weekExtras}
                onChange={(e) => setWeekExtras(e.target.value)}
                placeholder="School play Tuesday, sign permission slip, order team photos"
                className="min-h-20 w-full rounded-xl border-[1.5px] border-line p-4 outline-none focus:border-brand"
              />
            </div>
          </div>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          <button
            onClick={finish}
            disabled={busy}
            className="mt-auto w-full rounded-xl bg-brand py-4 font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Building your Family Brief..." : "Build my Family Brief"}
          </button>
        </section>
      )}
    </main>
  );
}
