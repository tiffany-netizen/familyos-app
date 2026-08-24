import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import WeeklyUpdate from "@/components/WeeklyUpdate";

export default async function WeeklyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: routines }, { data: trips }, { data: kids }] = await Promise.all([
    supabase
      .from("routines")
      .select("id,kind,label,days,day_times,notify")
      .order("created_at"),
    supabase
      .from("trips")
      .select("id,kind,destination,start_date,end_date")
      .or(`end_date.gte.${today},end_date.is.null`)
      .order("start_date"),
    supabase.from("people").select("id,name").eq("relationship", "child"),
  ]);

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-28 pt-8">
      <Link href="/today" className="text-sm font-semibold text-sub">
        ‹ Today
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Update your week</h1>
      <p className="mb-6 mt-1 text-sm text-sub">
        A minute on Sunday keeps the whole week's briefs sharp. Set the
        rhythm, add the extras, and I'll handle the remembering.
      </p>

      <WeeklyUpdate
        routines={routines ?? []}
        trips={trips ?? []}
        hasKids={(kids ?? []).length > 0}
        kidNames={(kids ?? []).map((k) => String(k.name))}
      />
      <BottomNav />
    </main>
  );
}
