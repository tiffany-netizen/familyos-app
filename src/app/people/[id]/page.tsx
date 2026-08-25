import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import CallCard from "@/components/CallCard";
import EditPerson from "@/components/EditPerson";
import { avatarColor, relationshipLabel } from "@/lib/peopleUi";

export default async function PersonPage({
  params,
}: PageProps<"/people/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: p }, { data: memories }, { data: gifts }, { data: dates }, { data: prof }] =
    await Promise.all([
      supabase.from("people").select("*").eq("id", id).single(),
      supabase
        .from("memories")
        .select("*")
        .eq("person_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("gift_ideas")
        .select("*")
        .eq("person_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("tracked_dates").select("*").eq("person_id", id),
      supabase.from("profiles").select("home_address").eq("id", user.id).single(),
    ]);

  if (!p) notFound();

  const facts: [string, string][] = [];
  if (p.birthday) facts.push(["Birthday", p.birthday]);
  (dates ?? []).forEach((d) => facts.push([d.label, d.date_value]));
  if (p.grade) facts.push(["Grade", p.grade]);
  if (p.teacher_name) facts.push(["Teacher", p.teacher_name]);
  if (p.best_friend) facts.push(["Best friend", p.best_friend]);
  if (p.clothing_size) facts.push(["Clothing size", p.clothing_size]);
  if (p.shoe_size) facts.push(["Shoe size", p.shoe_size]);
  if (p.ring_size) facts.push(["Ring size", p.ring_size]);
  if (p.hair_color) facts.push(["Hair color", p.hair_color]);
  if (p.interests) facts.push(["Interests", p.interests]);
  if (p.allergies) facts.push(["Allergies", p.allergies]);
  if (p.breed) facts.push(["Breed", p.breed]);
  if (p.vet_info) facts.push(["Vet", p.vet_info]);

  const showCall = p.relationship === "parent" || p.relationship === "friend";

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-28 pt-8">
      <Link href="/people" className="text-sm font-semibold text-sub">
        ‹ Your people
      </Link>

      <div className="mt-4 flex items-center gap-4">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold text-white"
          style={{ background: avatarColor(p.name) }}
        >
          {p.name[0]?.toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{p.name}</h1>
          <p className="text-sm text-sub">{relationshipLabel(p.relationship)}</p>
        </div>
        <EditPerson person={p} homeAddress={prof?.home_address ?? ""} />
      </div>

      {showCall && <CallCard personId={p.id} lastContact={p.last_contact} />}

      <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-widest text-sub">
        Details
      </h2>
      <div className="rounded-2xl border border-line bg-white px-4 shadow-sm">
        {facts.length === 0 && (
          <p className="py-4 text-sm text-sub">
            Nothing saved yet. Tell me things from the Today screen and they
            land here.
          </p>
        )}
        {facts.map(([k, v], i) => (
          <div
            key={k + i}
            className={`flex justify-between py-3 text-sm ${
              i > 0 ? "border-t border-line" : ""
            }`}
          >
            <span className="text-sub">{k}</span>
            <span className="max-w-[60%] text-right font-semibold">{v}</span>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-widest text-sub">
        Memories
      </h2>
      <div className="rounded-2xl border border-line bg-white px-4 shadow-sm">
        {(memories ?? []).length === 0 ? (
          <p className="py-4 text-sm text-sub">No memories yet.</p>
        ) : (
          (memories ?? []).map((m, i) => (
            <div
              key={m.id}
              className={`py-3 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <p className="text-sm">{m.body}</p>
              <p className="mt-1 text-xs text-sub">
                {new Date(m.created_at).toLocaleDateString()} ·{" "}
                {m.category.replace("_", " ")}
              </p>
            </div>
          ))
        )}
      </div>

      <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-widest text-sub">
        Gift ideas
      </h2>
      <div className="rounded-2xl border border-line bg-white px-4 shadow-sm">
        {(gifts ?? []).length === 0 ? (
          <p className="py-4 text-sm text-sub">
            No gift ideas yet. Save a note like &quot;{p.name} wants...&quot;
            and it lands here.
          </p>
        ) : (
          (gifts ?? []).map((g, i) => (
            <div
              key={g.id}
              className={`py-3 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <p className="text-sm">{g.title}</p>
              {g.detail && <p className="mt-1 text-xs text-sub">{g.detail}</p>}
            </div>
          ))
        )}
      </div>
      <BottomNav />
    </main>
  );
}
