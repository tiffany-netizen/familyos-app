import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { avatarColor, relationshipLabel, daysSince } from "@/lib/peopleUi";
import AddPerson from "@/components/AddPerson";

export default async function PeoplePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: people }, { data: profile }] = await Promise.all([
    supabase.from("people").select("*").order("created_at"),
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
  ]);
  const firstName =
    (profile?.full_name ?? "").trim().split(" ")[0] || "You";

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-28 pt-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Your people</h1>
        <Link
          href="/gifts"
          className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-sub"
        >
          Gift lists ›
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {/* The user belongs on their own people screen. */}
        <Link
          href="/profile"
          className="rounded-2xl border-[1.5px] border-brand bg-white p-4 shadow-sm"
        >
          <div className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
            {firstName[0]?.toUpperCase()}
          </div>
          <p className="font-semibold">{firstName}</p>
          <p className="mt-0.5 text-xs text-sub">You · edit your profile</p>
        </Link>
        {(people ?? []).map((p) => {
            const gap = daysSince(p.last_contact);
            return (
              <Link
                key={p.id}
                href={`/people/${p.id}`}
                className="rounded-2xl border border-line bg-white p-4 shadow-sm"
              >
                <div
                  className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold text-white"
                  style={{ background: avatarColor(p.name) }}
                >
                  {p.name[0]?.toUpperCase()}
                </div>
                <p className="font-semibold">{p.name}</p>
                <p className="mt-0.5 text-xs text-sub">
                  {relationshipLabel(p.relationship)}
                  {p.birthday ? ` · 🎂 ${p.birthday.slice(5)}` : ""}
                </p>
                {gap !== null && gap >= 10 && (
                  <span className="mt-2 inline-block rounded-lg bg-blue-soft px-2 py-1 text-[11px] font-bold text-blue-ink">
                    {gap} days since a call
                  </span>
                )}
              </Link>
            );
          })}
      </div>
      {(people ?? []).length === 0 && (
        <p className="mt-4 text-sm text-sub">
          Nobody else here yet. People you added in onboarding show up here, and
          you can tell me about more anytime from the Today screen.
        </p>
      )}
      <AddPerson />
      <BottomNav />
    </main>
  );
}
