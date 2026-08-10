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

  const { data: todos } = await supabase
    .from("todos")
    .select("*")
    .order("created_at");

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-28 pt-8">
      <h1 className="text-2xl font-bold">To-dos</h1>
      <p className="mt-1 text-sm text-sub">
        Your personal list. Things you add during onboarding and the week land
        here too.
      </p>
      <TodoList todos={todos ?? []} />
      <BottomNav />
    </main>
  );
}
