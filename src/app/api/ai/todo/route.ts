// POST /api/ai/todo — makes the to-do list active instead of a dead
// checklist. Every new to-do gets enriched: a category, a due date when
// the wording implies one, a link to the person it's about, and a
// concrete suggested next step. When completing it would produce
// something FamilyOS should capture ("find a babysitter" -> that sitter
// belongs in the database), a follow-up question is queued too.

import { createClient } from "@/lib/supabase/server";
import { aiEnabled, askClaude, extractJson } from "@/lib/ai";

const SYSTEM = `You watch a family chief-of-staff app's to-do list. The user just added a to-do. Enrich it.

Return ONLY JSON with these fields:

"category": one of "call" | "buy" | "book" | "schedule" | "home" | "school" | "errand" | "other". Pick what fits the verb: phone someone -> call, purchase -> buy, reserve/appointment -> book or schedule, house repair/maintenance -> home, kid school stuff -> school, physical trip to a store or place -> errand.

"due_date": "YYYY-MM-DD" or null. ONLY when the to-do's wording implies a deadline ("by Friday", "before the party", "tomorrow"). Use the TODAY date given to resolve relative words. Never invent a deadline the user didn't imply.

"person": the first name of the family member or person this is about, or null. Only use names from the PEOPLE list given.

"next_step": one short concrete suggestion (under 90 chars) for the very first move, e.g. "Look up the dentist's number in People" or "Add it to Saturday errands". null if the to-do is its own next step (buy milk).

"question": ONE short conditional follow-up to show on the dashboard later, ONLY when completing the to-do would naturally produce something the app should remember: a new person (sitter, coach, doctor) -> People; a date -> tracked dates; a place/gift/preference -> memories; a recurring duty -> routines. Example for "find a babysitter": "Sitter hunt still on? When you land one, tell me their name and I'll keep them on file for date nights." Plain to-dos (buy milk, call plumber once): null.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!aiEnabled()) return Response.json({ queued: false });

  let title = "";
  let id = "";
  try {
    const body = await request.json();
    title = String(body?.title ?? "").trim();
    id = String(body?.id ?? "").trim();
  } catch {}
  if (!title) return Response.json({ queued: false });

  try {
    const { data: people } = await supabase
      .from("people")
      .select("id,name")
      .eq("owner_id", user.id);
    const names = (people ?? [])
      .map((p) => String(p.name ?? "").split(" ")[0])
      .filter(Boolean);

    const today = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
    );
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const weekday = today.toLocaleDateString("en-US", { weekday: "long" });

    const raw = await askClaude({
      system: SYSTEM,
      prompt: `TODAY: ${todayStr} (${weekday})\nPEOPLE: ${names.join(", ") || "none"}\nTo-do just added: "${title}"`,
      maxTokens: 400,
    });
    const out = extractJson<{
      category?: string | null;
      due_date?: string | null;
      person?: string | null;
      next_step?: string | null;
      question?: string | null;
    }>(raw);

    // Write the enrichment onto the row.
    if (id && out) {
      const personId = out.person
        ? (people ?? []).find(
            (p) =>
              String(p.name ?? "")
                .toLowerCase()
                .split(" ")[0] === String(out.person).toLowerCase()
          )?.id ?? null
        : null;
      const patch: Record<string, unknown> = {};
      const CATS = ["call", "buy", "book", "schedule", "home", "school", "errand", "other"];
      if (out.category && CATS.includes(out.category)) patch.category = out.category;
      if (out.due_date && /^\d{4}-\d{2}-\d{2}$/.test(out.due_date) && out.due_date >= todayStr)
        patch.due_date = out.due_date;
      if (personId) patch.person_id = personId;
      if (out.next_step && typeof out.next_step === "string")
        patch.next_step = out.next_step.slice(0, 120);
      if (Object.keys(patch).length) {
        await supabase.from("todos").update(patch).eq("id", id).eq("owner_id", user.id);
      }
    }

    if (out?.question && typeof out.question === "string") {
      // One follow-up per to-do title; skip if an identical one exists.
      const { data: existing } = await supabase
        .from("followups")
        .select("id")
        .eq("owner_id", user.id)
        .eq("kind", "todo")
        .eq("subject", title.slice(0, 120))
        .maybeSingle();
      if (!existing) {
        await supabase.from("followups").insert({
          owner_id: user.id,
          kind: "todo",
          subject: title.slice(0, 120),
          question: out.question.slice(0, 300),
        });
      }
      return Response.json({ queued: true, enriched: true });
    }
    return Response.json({ queued: false, enriched: true });
  } catch (e) {
    console.error("[ai/todo]", e);
  }
  return Response.json({ queued: false });
}
