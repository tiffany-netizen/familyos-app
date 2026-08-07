import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { MarkDone, AddHomeItem, AddProvider } from "@/components/HomeActions";

const DAY = 86400000;

export default async function HomeHubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: items }, { data: providers }] = await Promise.all([
    supabase.from("home_items").select("*").order("created_at"),
    supabase.from("service_providers").select("*").order("created_at"),
  ]);

  function dueInfo(item: { last_performed: string | null; frequency_days: number }) {
    if (!item.last_performed) return { label: "Not started", cls: "bg-blue-soft text-blue-ink" };
    const due =
      new Date(item.last_performed + "T00:00:00").getTime() +
      item.frequency_days * DAY;
    const days = Math.round((due - Date.now()) / DAY);
    if (days <= 0) return { label: "Due now", cls: "bg-red-100 text-red-600" };
    if (days <= 14) return { label: `${days} days`, cls: "bg-amber-100 text-amber-700" };
    return { label: "On track", cls: "bg-brand-soft text-brand" };
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-28 pt-8">
      <h1 className="text-2xl font-bold">Home &amp; house</h1>

      <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-widest text-sub">
        Maintenance
      </h2>
      <div className="rounded-2xl border border-line bg-white px-4 shadow-sm">
        {(items ?? []).length === 0 && (
          <p className="py-4 text-sm text-sub">No tasks yet. Add one below.</p>
        )}
        {(items ?? []).map((it, i) => {
          const d = dueInfo(it);
          return (
            <div
              key={it.id}
              className={`flex items-center gap-3 py-3 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <div className="flex-1">
                <p className="text-sm font-semibold">{it.task_name}</p>
                <p className="text-xs text-sub">
                  Every {it.frequency_days} days
                  {it.last_performed ? ` · last done ${it.last_performed}` : ""}
                </p>
              </div>
              <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${d.cls}`}>
                {d.label}
              </span>
              <MarkDone itemId={it.id} />
            </div>
          );
        })}
      </div>
      <AddHomeItem />

      <h2 className="mb-2 mt-7 text-xs font-bold uppercase tracking-widest text-sub">
        Service providers
      </h2>
      <div className="rounded-2xl border border-line bg-white px-4 shadow-sm">
        {(providers ?? []).length === 0 && (
          <p className="py-4 text-sm text-sub">
            No providers yet. Add your gardener, mechanic, whoever keeps the
            house running.
          </p>
        )}
        {(providers ?? []).map((p, i) => (
          <div key={p.id} className={`py-3 ${i > 0 ? "border-t border-line" : ""}`}>
            <p className="text-sm font-semibold">{p.name}</p>
            <p className="text-xs text-sub">
              {p.kind}
              {p.contact_info ? ` · ${p.contact_info}` : ""}
              {p.schedule_note ? ` · ${p.schedule_note}` : ""}
            </p>
          </div>
        ))}
      </div>
      <AddProvider />
      <BottomNav />
    </main>
  );
}
