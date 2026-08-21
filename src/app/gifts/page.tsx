import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import AddGift from "@/components/AddGift";

export default async function GiftsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: gifts }, { data: allPeople }] = await Promise.all([
    supabase
      .from("gift_ideas")
      .select("*, people(id, name)")
      .order("created_at", { ascending: false }),
    supabase.from("people").select("id, name").order("created_at"),
  ]);

  const byPerson = new Map<string, { name: string; items: typeof gifts }>();
  (gifts ?? []).forEach((g) => {
    const person = g.people as { id: string; name: string } | null;
    const key = person?.id ?? "general";
    if (!byPerson.has(key))
      byPerson.set(key, { name: person?.name ?? "General", items: [] });
    byPerson.get(key)!.items!.push(g);
  });

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-28 pt-8">
      <h1 className="text-2xl font-bold">Gift ideas</h1>
      <p className="mt-1.5 text-sm text-sub">
        Anything they mention gets saved here from your notes.
      </p>

      {byPerson.size === 0 ? (
        <p className="mt-6 text-sm text-sub">
          Nothing saved yet. From the Today screen, save a note like
          &quot;Sarah wants new hiking boots&quot; and it shows up here under
          her name.
        </p>
      ) : (
        [...byPerson.entries()].map(([key, group]) => (
          <section key={key} className="mt-5">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-sub">
              {group.name}
            </h2>
            <div className="rounded-2xl border border-line bg-white px-4 shadow-sm">
              {group.items!.map((g, i) => (
                <div
                  key={g.id}
                  className={`py-3 ${i > 0 ? "border-t border-line" : ""}`}
                >
                  <p className="text-sm">{g.title}</p>
                  {g.detail && (
                    <p className="mt-1 text-xs text-sub">{g.detail}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      <AddGift people={allPeople ?? []} />

      <div className="mt-6 rounded-2xl border border-line bg-white p-4 text-center text-[13px] leading-relaxed text-sub shadow-sm">
        Coming soon: see something on Amazon, hit Share, pick FamilyOS, and
        it lands on the right person&apos;s list.
      </div>
      <BottomNav />
    </main>
  );
}
