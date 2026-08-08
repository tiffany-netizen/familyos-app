import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import UploadSchedule from "@/components/UploadSchedule";

const DAY = 86400000;

export default async function DigestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: people }, { data: dates }, { data: events }] =
    await Promise.all([
      supabase.from("people").select("*"),
      supabase.from("tracked_dates").select("*"),
      supabase.from("sports_events").select("*"),
    ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const week: { day: string; items: string[] }[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getTime() + i * DAY);
    const items: string[] = [];
    const mmdd = d.toISOString().slice(5, 10);

    (people ?? []).forEach((p) => {
      if (p.birthday?.slice(5) === mmdd) items.push(`🎂 ${p.name}'s birthday`);
    });
    (dates ?? []).forEach((t) => {
      if (t.date_value?.slice(5) === mmdd) items.push(`📅 ${t.label}`);
    });
    (events ?? []).forEach((e) => {
      const ed = new Date(e.event_date);
      if (ed >= d && ed < new Date(d.getTime() + DAY)) {
        const time = ed.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
        items.push(`⚽ ${e.sport ?? "Practice"} · ${time}${e.location ? " · " + e.location : ""}`);
      }
    });

    week.push({
      day:
        i === 0
          ? "Today"
          : i === 1
            ? "Tomorrow"
            : d.toLocaleDateString("en-US", { weekday: "long" }),
      items,
    });
  }

  const child = (people ?? []).find((p) => p.relationship === "child");

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-28 pt-8">
      <Link href="/today" className="text-sm font-semibold text-sub">
        ‹ Today
      </Link>
      <h1 className="mt-2 text-2xl font-bold">The week ahead</h1>
      <p className="mt-1 text-sm text-sub">
        Your Sunday digest, built from everything FamilyOS knows.
      </p>

      <div className="mt-5 rounded-2xl border border-line bg-white px-4 shadow-sm">
        {week.map((w, i) => (
          <div key={w.day} className={`py-3 ${i > 0 ? "border-t border-line" : ""}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-ink">
              {w.day}
            </p>
            {w.items.length === 0 ? (
              <p className="mt-1 text-[13px] text-sub">Nothing scheduled.</p>
            ) : (
              w.items.map((it) => (
                <p key={it} className="mt-1 text-sm">
                  {it}
                </p>
              ))
            )}
          </div>
        ))}
      </div>

      <UploadSchedule childName={child?.name ?? null} />
      <BottomNav />
    </main>
  );
}
