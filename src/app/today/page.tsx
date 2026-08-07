import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { buildBrief } from "@/lib/brief";
import MemoryCapture from "@/components/MemoryCapture";
import SignOutButton from "@/components/SignOutButton";

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: people }, { data: dates }, { data: homeItems }, { data: memories }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("people").select("*").order("created_at"),
      supabase.from("tracked_dates").select("*"),
      supabase.from("home_items").select("*"),
      supabase
        .from("memories")
        .select("*, people(name)")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  if (profile && !profile.onboarded) redirect("/onboarding");

  const brief = buildBrief(people ?? [], dates ?? [], homeItems ?? []);
  const firstName = (profile?.full_name || "there").split(" ")[0];
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-28 pt-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-sub">
        {dateLabel}
      </p>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Good morning, {firstName}</h1>
        <SignOutButton />
      </div>

      <h2 className="mb-3 mt-6 text-xs font-bold uppercase tracking-widest text-sub">
        Here&apos;s what matters today
      </h2>

      {brief.length === 0 && (
        <div className="rounded-2xl border border-line p-5 text-center text-sm text-sub shadow-sm">
          🟢 Nothing urgent today. As you add people, dates, and notes, your
          brief fills in here every morning.
        </div>
      )}

      <div className="space-y-3">
        {brief.map((b, i) => (
          <div key={i} className="flex gap-3 rounded-2xl border border-line p-4 shadow-sm">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-soft text-lg">
              {b.icon}
            </div>
            <div>
              <p className="text-[15px] leading-snug">{b.text}</p>
              <p className="mt-1 text-xs text-sub">{b.meta}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-xs font-bold uppercase tracking-widest text-sub">
        Recently remembered
      </h2>
      {(memories ?? []).length === 0 ? (
        <p className="text-sm text-sub">
          Nothing yet. Use the box below to save your first one.
        </p>
      ) : (
        <div className="space-y-2">
          {(memories ?? []).map((m) => (
            <div key={m.id} className="rounded-xl border border-line px-4 py-3 text-sm">
              <p>{m.body}</p>
              <p className="mt-1 text-xs text-sub">
                {(m.people as { name: string } | null)?.name ?? "General"} ·{" "}
                {m.category.replace("_", " ")}
              </p>
            </div>
          ))}
        </div>
      )}

      <MemoryCapture
        people={(people ?? []).map((p) => ({ id: p.id, name: p.name }))}
      />
    </main>
  );
}
