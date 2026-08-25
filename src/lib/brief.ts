// Computes the daily brief from real data. This rule-based version is the
// instant scaffold and the fallback; the Claude API layer (lib/aiBrief.ts)
// rewrites the brief in natural language when a key is configured.

type Person = {
  id: string;
  name: string;
  nickname?: string | null;
  relationship: string;
  birthday: string | null;
  teacher_name: string | null;
  interests: string | null;
  last_contact: string | null;
};

type TrackedDate = {
  label: string;
  date_value: string;
  lead_time_days: number;
  recurs_yearly: boolean;
  person_id: string | null;
};

type HomeItem = {
  task_name: string;
  last_performed: string | null;
  frequency_days: number;
};

export type Trip = {
  kind: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
};

export type BriefAction = {
  label: string;
  kind: "confirm" | "we_talked" | "sms" | "link" | "snooze" | "dismiss";
  payload?: string;
  href?: string;
  personId?: string;
  primary?: boolean;
};

export type BriefItem = {
  icon: string;
  text: string;
  meta: string;
  role: string;
  key?: string;
  until?: string; // "HH:MM" local; the feed hides the card after this time
  event_date?: string; // "YYYY-MM-DD"; snoozes never reach past this date
  event_title?: string; // clean calendar-event name ("Anniversary"), no relative timing
  actions?: BriefAction[];
};

const DAY = 86400000;

export function openTableUrl(term?: string) {
  const base = "https://www.opentable.com/s?covers=2";
  return term ? `${base}&term=${encodeURIComponent(term)}` : base;
}

function nextOccurrence(dateStr: string, recursYearly: boolean, today: Date): Date {
  const d = new Date(dateStr + "T00:00:00");
  if (!recursYearly) return d;
  const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next.getTime() < today.getTime() - DAY / 2) {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next;
}

function daysUntil(d: Date, today: Date): number {
  return Math.round((d.getTime() - today.getTime()) / DAY);
}

type Routine = {
  kind: string;
  label: string | null;
  days: string;
  day_times?: Record<string, string> | null;
};
type Profile = {
  sweet_text_optin?: boolean | null;
  grocery_store?: string | null;
} | null;

export function buildBrief(
  people: Person[],
  dates: TrackedDate[],
  homeItems: HomeItem[],
  today = new Date(),
  routines: Routine[] = [],
  profile: Profile = null,
  trips: Trip[] = []
): BriefItem[] {
  const items: BriefItem[] = [];
  const byId = new Map(people.map((p) => [p.id, p]));
  const dow = today.getDay();

  // Today's routines (school run, dinner duty, weekend activities)
  for (const r of routines) {
    if (!r.days.split(",").map(Number).includes(dow)) continue;
    if (r.kind === "school_run") {
      items.push({
        icon: "🎒",
        text: "School run today. You're on drop-off / pick-up duty.",
        meta: "dad · today's checklist",
        role: "dad",
        key: "school-run",
        until: "16:00",
      });
    } else if (r.kind === "dinner") {
      items.push({
        icon: "🍳",
        text: "Dinner's on you tonight. Recipe or groceries?",
        meta: "home · today's checklist",
        role: "home",
        key: "dinner",
        until: "20:00",
        actions: [
          {
            label: "Recipe box",
            kind: "link",
            href: "/meals",
            primary: true,
          },
          ...(profile?.grocery_store === "none"
            ? []
            : [
                {
                  label: "Order groceries",
                  kind: "link",
                  href: "https://www.instacart.com/store",
                } as BriefAction,
              ]),
          { label: "Handled", kind: "dismiss" },
        ],
      });
    } else {
      const time = r.day_times?.[String(dow)];
      items.push({
        icon: "📌",
        text: `${r.label ?? "Weekend activity"} today${time ? ` at ${time}` : ""}.`,
        meta: "family · your week",
        role: "dad",
        until: time && /^\d{2}:\d{2}$/.test(time) ? time : undefined,
      });
    }
  }

  // Weekly sweet text nudge: lands on a weekday that shifts each week
  const spouse = people.find((p) => p.relationship === "spouse") as
    | (Person & { stress_note?: string | null; job?: string | null })
    | undefined;
  if (profile?.sweet_text_optin && spouse) {
    const week = Math.floor(today.getTime() / (7 * 86400000));
    const nudgeDay = ((week * 3 + 1) % 5) + 1; // Mon-Fri, moves each week
    if (dow === nudgeDay) {
      const stress = spouse.stress_note;
      const dear = spouse.nickname || spouse.name.split(" ")[0];
      items.push({
        icon: "💬",
        text: `Surprise ${spouse.name} with a short sweet text today.${
          stress ? ` (You mentioned: ${stress}.)` : ""
        } Impromptu beats planned.`,
        meta: "husband · weekly nudge",
        role: "husband",
        actions: [
          {
            label: "Draft the text",
            kind: "sms",
            payload: stress
              ? `Hey ${dear}, thinking of you today. You've got this ❤️`
              : `Hey ${dear}, no reason. Just thinking about you ❤️`,
            primary: true,
          },
          { label: "Skip this week", kind: "confirm", payload: "Okay. Next nudge lands on a different day." },
        ],
      });
    }
  }

  // Trips coming up
  for (const t of trips) {
    if (!t.start_date) continue;
    const days = daysUntil(new Date(t.start_date + "T00:00:00"), today);
    if (days < 0 || days > 14) continue;
    const isWork = t.kind === "work";
    items.push({
      icon: isWork ? "💼" : "🧳",
      text:
        days === 0
          ? `Your ${isWork ? "work trip" : "trip"} to ${t.destination} starts today.`
          : `Your ${isWork ? "work trip" : "trip"} to ${t.destination} is in ${days} day${days === 1 ? "" : "s"}.${
              isWork
                ? " A little prep now makes the week easier on everyone at home."
                : " Want to line up something fun before you go?"
            }`,
      meta: `${isWork ? "work" : "family"} · trip`,
      role: isWork ? "husband" : "dad",
      actions: [
        { label: "Got it", kind: "confirm", payload: "On the radar.", primary: true },
      ],
    });
  }

  // Birthdays coming up
  for (const p of people) {
    if (!p.birthday) continue;
    const next = nextOccurrence(p.birthday, true, today);
    const days = daysUntil(next, today);
    if (days >= 0 && days <= 30) {
      items.push({
        event_date: next.toISOString().slice(0, 10),
        event_title: `${p.name}'s birthday`,
        icon: "🎂",
        text:
          days === 0
            ? `Today is ${p.name}'s birthday!`
            : `${p.name}'s birthday is in ${days} day${days === 1 ? "" : "s"}.${
                p.interests ? ` They're into ${p.interests.toLowerCase()}.` : ""
              }`,
        meta: `${p.relationship} · ${days === 0 ? "today" : "coming up"}`,
        role: p.relationship === "child" ? "dad" : p.relationship,
        actions: [
          {
            label: "Plan a gift",
            kind: "confirm",
            payload: `Pulled ${p.name}'s saved ideas into the Gifts tab. Tap it when you're ready to shop.`,
            primary: true,
          },
          { label: "Remind me next week", kind: "confirm", payload: "Will do. It'll come back around." },
        ],
      });
    }
  }

  // Tracked dates (anniversary, holidays, custom)
  for (const d of dates) {
    const nextDate = nextOccurrence(d.date_value, d.recurs_yearly, today);
    const days = daysUntil(nextDate, today);
    if (days >= 0 && days <= d.lead_time_days) {
      const who = d.person_id ? byId.get(d.person_id) : null;
      items.push({
        event_date: nextDate.toISOString().slice(0, 10),
        event_title: d.label,
        icon: d.label.toLowerCase().includes("anniversary") ? "💍" : "📅",
        text:
          days === 0
            ? `${d.label} is today.`
            : `${d.label} is in ${days} day${days === 1 ? "" : "s"}.${
                days > 7 ? " Reservations and gifts are easier now than later." : ""
              }`,
        meta: `${who ? who.name + " · " : ""}planning ahead`,
        role: "husband",
        actions: [
          {
            label: "Check tables on OpenTable",
            kind: "link",
            href: openTableUrl(),
            primary: true,
          },
          { label: "Remind me later", kind: "confirm", payload: "Okay, parking it for now." },
        ],
      });
    }
  }

  // Call gaps for parents and friends
  for (const p of people) {
    if (p.relationship !== "parent" && p.relationship !== "friend") continue;
    if (!p.last_contact) continue;
    const gap = Math.round(
      (today.getTime() - new Date(p.last_contact + "T00:00:00").getTime()) / DAY
    );
    if (gap >= 10) {
      items.push({
        icon: "📞",
        text: `It's been ${gap} days since you talked with ${p.name}.`,
        meta: `${p.relationship} · reconnect`,
        role: p.relationship === "parent" ? "son" : "friend",
        actions: [
          { label: "We talked", kind: "we_talked", personId: p.id, primary: true },
          { label: "Tonight at 7:30", kind: "confirm", payload: "Reminder set for 7:30 tonight." },
        ],
      });
    }
  }

  // Home maintenance due
  for (const h of homeItems) {
    if (!h.last_performed) continue;
    const due = new Date(
      new Date(h.last_performed + "T00:00:00").getTime() +
        h.frequency_days * DAY
    );
    const days = daysUntil(due, today);
    if (days <= 14) {
      items.push({
        icon: "🔧",
        text:
          days <= 0
            ? `${h.task_name} is due now.`
            : `${h.task_name} is due in ${days} day${days === 1 ? "" : "s"}.`,
        meta: "home · maintenance",
        role: "home",
        actions: [
          { label: "Add to weekend list", kind: "confirm", payload: "On your Saturday list. Mark it done from the Home tab when it's handled.", primary: true },
        ],
      });
    }
  }

  return items;
}
