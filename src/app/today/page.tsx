import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { buildBrief, type BriefItem } from "@/lib/brief";
import { aiEnabled } from "@/lib/ai";
import AiBriefRefresher from "@/components/AiBriefRefresher";
import FollowupCard from "@/components/FollowupCard";
import MemoryCapture from "@/components/MemoryCapture";
import SignOutButton from "@/components/SignOutButton";
import BottomNav from "@/components/BottomNav";
import BriefCard from "@/components/BriefCard";
import Link from "next/link";
import {
  DateNightCard,
  HealthCard,
  CheckinCard,
  ReferralCard,
} from "@/components/DemoCards";
import ClearData from "@/components/ClearData";

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const todayStr = new Date().toISOString().slice(0, 10);
  const [{ data: profile }, { data: people }, { data: dates }, { data: homeItems }, { data: memories }, { data: routines }, { data: openTodos }, { data: trips }, { data: cachedBrief }] =
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
      supabase.from("routines").select("*"),
      supabase.from("todos").select("id").eq("done", false),
      supabase
        .from("trips")
        .select("kind,destination,start_date,end_date")
        .gte("end_date", todayStr),
      supabase
        .from("briefs")
        .select("intro,items")
        .eq("owner_id", user.id)
        .eq("brief_date", todayStr)
        .maybeSingle(),
    ]);

  if (profile && !profile.onboarded) redirect("/onboarding");

  // Cached AI brief wins; the rule-based one renders instantly otherwise
  // and AiBriefRefresher upgrades it in the background.
  const aiItems = (cachedBrief?.items as BriefItem[] | undefined) ?? null;
  const brief =
    aiItems && aiItems.length
      ? aiItems
      : buildBrief(
          people ?? [],
          dates ?? [],
          homeItems ?? [],
          new Date(),
          routines ?? [],
          profile,
          trips ?? []
        );
  const intro = aiItems && aiItems.length ? cachedBrief?.intro : null;
  const needsAi = aiEnabled() && !(aiItems && aiItems.length);
  const todoCount = (openTodos ?? []).length;
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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Good morning, {firstName}</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/digest"
            className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-sub"
          >
            Week ›
          </Link>
          <SignOutButton />
        </div>
      </div>

      {intro && (
        <p className="mt-3 text-[15px] leading-relaxed text-ink">{intro}</p>
      )}

      <h2 className="mb-3 mt-6 text-xs font-bold uppercase tracking-widest text-sub">
        Here&apos;s what matters today
      </h2>

      {needsAi && <AiBriefRefresher />}

      {brief.length === 0 && (
        <div className="rounded-2xl border border-line p-5 text-center text-sm text-sub shadow-sm">
          🟢 Nothing urgent today. As you add people, dates, and notes, your
          brief fills in here every morning.
        </div>
      )}

      <div className="space-y-3">
        <FollowupCard />
        {brief.map((b, i) => (
          <BriefCard key={i} item={b} />
        ))}
        {(() => {
          const spouse = (people ?? []).find((p) => p.relationship === "spouse");
          return spouse ? <DateNightCard spouseName={spouse.name} /> : null;
        })()}
        {todoCount > 0 && (
          <Link
            href="/todos"
            className="flex items-center justify-between rounded-2xl border border-line bg-white p-4 shadow-sm"
          >
            <span className="text-[15px]">
              ✅ <b>{todoCount} thing{todoCount === 1 ? "" : "s"}</b> on your
              to-do list
            </span>
            <span className="text-sm font-semibold text-blue-ink">View ›</span>
          </Link>
        )}
        <HealthCard />
        <CheckinCard />
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

      <div className="mt-8">
        <ReferralCard />
      </div>
      <ClearData />

      <MemoryCapture
        people={(people ?? []).map((p) => ({ id: p.id, name: p.name }))}
      />
      <BottomNav />
    </main>
  );
}
