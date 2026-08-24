import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import MealsClient from "@/components/MealsClient";

export default async function MealsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: recipes }, { data: items }, { data: profile }, { data: people }] =
    await Promise.all([
      supabase
        .from("recipes")
        .select("id,title,url,ingredients,instructions,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("shopping_items")
        .select("id,name,done,recipe_id")
        .order("created_at"),
      supabase
        .from("profiles")
        .select("meal_notes,grocery_store")
        .eq("id", user.id)
        .single(),
      supabase
        .from("people")
        .select("name,allergies")
        .eq("owner_id", user.id)
        .not("allergies", "is", null),
    ]);

  // "Peanuts, tree nuts (mild)" -> terms ["peanut", "tree nuts"...] per person
  const STOP = new Set(["mild", "severe", "allergy", "allergies", "and", "the", "some"]);
  const allergyTerms = (people ?? []).flatMap((p) =>
    String(p.allergies ?? "")
      .split(/[,;/]+/)
      .map((t) => t.replace(/\(.*?\)/g, "").trim().toLowerCase())
      .filter((t) => t.length > 2 && !STOP.has(t))
      .map((term) => ({ person: String(p.name).split(" ")[0], term }))
  );

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-28 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meals</h1>
        <Link
          href="/today"
          className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-sub"
        >
          ‹ Today
        </Link>
      </div>
      <p className="mb-6 mt-1 text-sm text-sub">
        Paste a recipe link and it lands here with a shopping list one tap away.
      </p>
      <MealsClient
        initialRecipes={(recipes ?? []) as never}
        initialItems={(items ?? []) as never}
        mealNotes={profile?.meal_notes ?? ""}
        showGrocery={profile?.grocery_store !== "none"}
        allergyTerms={allergyTerms}
      />
      <BottomNav />
    </main>
  );
}
