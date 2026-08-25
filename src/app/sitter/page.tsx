import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import SitterBrief from "@/components/SitterBrief";

export default async function SitterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: kids }, { data: sitters }, { data: profile }, { data: spouse }] =
    await Promise.all([
      supabase
        .from("people")
        .select("id,name,birthday,allergies,pediatrician,interests,school,dismissal_time")
        .eq("owner_id", user.id)
        .eq("relationship", "child")
        .order("created_at"),
      supabase
        .from("service_providers")
        .select("name,contact_info,schedule_note")
        .eq("owner_id", user.id)
        .eq("kind", "babysitter"),
      supabase
        .from("profiles")
        .select("full_name,home_address,meal_notes,phone")
        .eq("id", user.id)
        .single(),
      supabase
        .from("people")
        .select("name,phone")
        .eq("owner_id", user.id)
        .eq("relationship", "spouse")
        .maybeSingle(),
    ]);

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-28 pt-8">
      <Link href="/today" className="text-sm font-semibold text-sub">
        ‹ Today
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Sitter brief</h1>
      <p className="mb-6 mt-1 text-sm text-sub">
        Everything a babysitter should know, ready to text. Edit anything
        before you send it.
      </p>
      <SitterBrief
        kids={(kids ?? []) as never}
        sitter={(sitters ?? [])[0] ?? null}
        parentName={(profile?.full_name ?? "").split(" ")[0]}
        parentPhone={profile?.phone ?? ""}
        spouseName={(spouse?.name ?? "").split(" ")[0]}
        spousePhone={spouse?.phone ?? ""}
        address={profile?.home_address ?? ""}
        mealNotes={profile?.meal_notes ?? ""}
      />
      <BottomNav />
    </main>
  );
}
