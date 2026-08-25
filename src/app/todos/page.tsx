import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import TodoList from "@/components/TodoList";

export default async function TodosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: todos }, { data: people }] = await Promise.all([
    supabase
      .from("todos")
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at"),
    supabase.from("people").select("id,name").eq("owner_id", user.id),
  ]);

  const peopleNames: Record<string, string> = {};
  (people ?? []).forEach((p) => {
    peopleNames[p.id] = String(p.name ?? "").split(" ")[0];
  });

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-28 pt-8">
      <h1 className="text-2xl font-bold">To-dOS</h1>
      <p className="mt-1 text-sm text-sub">
        Tell it what and when in one line. It sorts, links people, and
        suggests the first move.
      </p>
      <TodoList todos={todos ?? []} peopleNames={peopleNames} />
      <BottomNav />
    </main>
  );
}
