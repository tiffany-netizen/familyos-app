// Major US holidays computed locally, no API. Each holiday says whether
// schools are typically closed ("no" = closed nearly everywhere,
// "maybe" = varies by district) so the week digest can flag likely
// no-school days for families with kids.

export type Holiday = { name: string; school: "no" | "maybe" | "open" };

// Anonymous Gregorian Easter computus.
function easter(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

// nth weekday of a month: nth 1-5, weekday 0=Sun..6=Sat. nth -1 = last.
function nthWeekday(year: number, month: number, weekday: number, nth: number): number {
  if (nth === -1) {
    const last = new Date(year, month, 0).getDate();
    for (let d = last; d > last - 7; d--) {
      if (new Date(year, month - 1, d).getDay() === weekday) return d;
    }
  }
  const firstDow = new Date(year, month - 1, 1).getDay();
  const offset = (weekday - firstDow + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}

export function holidayFor(d: Date): Holiday | null {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();

  // Fixed dates
  if (m === 1 && day === 1) return { name: "New Year's Day", school: "no" };
  if (m === 2 && day === 14) return { name: "Valentine's Day", school: "open" };
  if (m === 3 && day === 17) return { name: "St. Patrick's Day", school: "open" };
  if (m === 6 && day === 19) return { name: "Juneteenth", school: "maybe" };
  if (m === 7 && day === 4) return { name: "Independence Day", school: "no" };
  if (m === 10 && day === 31) return { name: "Halloween", school: "open" };
  if (m === 11 && day === 11) return { name: "Veterans Day", school: "maybe" };
  if (m === 12 && day === 24) return { name: "Christmas Eve", school: "no" };
  if (m === 12 && day === 25) return { name: "Christmas Day", school: "no" };
  if (m === 12 && day === 31) return { name: "New Year's Eve", school: "no" };

  // Floating dates
  if (m === 1 && day === nthWeekday(y, 1, 1, 3)) return { name: "MLK Day", school: "no" };
  if (m === 2 && day === nthWeekday(y, 2, 1, 3)) return { name: "Presidents Day", school: "no" };
  if (m === 5 && day === nthWeekday(y, 5, 0, 2)) return { name: "Mother's Day", school: "open" };
  if (m === 5 && day === nthWeekday(y, 5, 1, -1)) return { name: "Memorial Day", school: "no" };
  if (m === 6 && day === nthWeekday(y, 6, 0, 3)) return { name: "Father's Day", school: "open" };
  if (m === 9 && day === nthWeekday(y, 9, 1, 1)) return { name: "Labor Day", school: "no" };
  if (m === 10 && day === nthWeekday(y, 10, 1, 2))
    return { name: "Indigenous Peoples' Day", school: "maybe" };

  // Thanksgiving + the Friday after
  const tg = nthWeekday(y, 11, 4, 4);
  if (m === 11 && day === tg) return { name: "Thanksgiving", school: "no" };
  if (m === 11 && day === tg + 1) return { name: "Day after Thanksgiving", school: "no" };

  // Easter and Good Friday
  const e = easter(y);
  if (m === e.month && day === e.day) return { name: "Easter", school: "open" };
  const gf = new Date(y, e.month - 1, e.day - 2);
  if (m === gf.getMonth() + 1 && day === gf.getDate())
    return { name: "Good Friday", school: "maybe" };

  // Election Day: first Tuesday after the first Monday of November
  const electionDay = nthWeekday(y, 11, 1, 1) + 1;
  if (m === 11 && day === electionDay)
    return { name: "Election Day", school: "maybe" };

  return null;
}
