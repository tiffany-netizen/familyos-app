// Computes the daily brief from real data. Rule-based for v1;
// the Claude API layer in phase 2 turns these into natural language.

type Person = {
  id: string;
  name: string;
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

export type BriefItem = {
  icon: string;
  text: string;
  meta: string;
  role: string;
};

const DAY = 86400000;

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

export function buildBrief(
  people: Person[],
  dates: TrackedDate[],
  homeItems: HomeItem[],
  today = new Date()
): BriefItem[] {
  const items: BriefItem[] = [];
  const byId = new Map(people.map((p) => [p.id, p]));

  // Birthdays coming up
  for (const p of people) {
    if (!p.birthday) continue;
    const days = daysUntil(nextOccurrence(p.birthday, true, today), today);
    if (days >= 0 && days <= 30) {
      items.push({
        icon: "🎂",
        text:
          days === 0
            ? `Today is ${p.name}'s birthday!`
            : `${p.name}'s birthday is in ${days} day${days === 1 ? "" : "s"}.${
                p.interests ? ` They're into ${p.interests.toLowerCase()}.` : ""
              }`,
        meta: `${p.relationship} · ${days === 0 ? "today" : "coming up"}`,
        role: p.relationship === "child" ? "dad" : p.relationship,
      });
    }
  }

  // Tracked dates (anniversary, holidays, custom)
  for (const d of dates) {
    const days = daysUntil(nextOccurrence(d.date_value, d.recurs_yearly, today), today);
    if (days >= 0 && days <= d.lead_time_days) {
      const who = d.person_id ? byId.get(d.person_id) : null;
      items.push({
        icon: d.label.toLowerCase().includes("anniversary") ? "💍" : "📅",
        text:
          days === 0
            ? `${d.label} is today.`
            : `${d.label} is in ${days} day${days === 1 ? "" : "s"}.${
                days > 7 ? " Reservations and gifts are easier now than later." : ""
              }`,
        meta: `${who ? who.name + " · " : ""}planning ahead`,
        role: "husband",
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
      });
    }
  }

  return items;
}
